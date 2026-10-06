import pool from '../config/db.js';

/**
 * Normalizes an array or JSON field from MySQL into a JS Array of strings/numbers.
 */
export function parseJsonList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Fetch all active, unpaused, non-deleted discounts at the current server time.
 */
export async function getActiveDiscounts(connection = pool, now = new Date()) {
  const [rows] = await connection.query(`
    SELECT * FROM discounts 
    WHERE deleted_at IS NULL 
      AND is_paused = FALSE 
      AND starts_at <= ? 
      AND ends_at >= ?
    ORDER BY id DESC
  `, [now, now]);

  return rows.map(d => ({
    ...d,
    product_ids: parseJsonList(d.product_ids).map(Number),
    category_ids: parseJsonList(d.category_ids).map(String),
    collection_ids: parseJsonList(d.collection_ids).map(Number),
  }));
}

/**
 * Deterministically finds the single winning automatic discount for a product.
 * Priority hierarchy:
 * 1. Specific Product
 * 2. Category
 * 3. Collection
 * 4. All Products
 * 
 * Same-priority conflict:
 * Selects the discount providing the highest saving (best deal for customer).
 * No silent stacking.
 */
export function calculateProductDiscount(product, activeDiscounts = []) {
  const basePrice = Number(product.price ?? product.sale_price ?? 0);
  if (basePrice <= 0 || !Array.isArray(activeDiscounts) || activeDiscounts.length === 0) {
    return {
      originalPrice: basePrice,
      finalPrice: basePrice,
      discountAmount: 0,
      discountPercent: 0,
      appliedDiscount: null,
    };
  }

  const productId = Number(product.id);
  const categoryId = product.category_id ? String(product.category_id) : '';
  const categoryName = String(product.category_name || product.category || '').toLowerCase();
  const categorySlug = String(product.category_slug || '').toLowerCase();
  const collectionIds = parseJsonList(product.collection_ids || product.collectionId).map(Number);

  // Group applicable discounts by priority level
  const priorityGroups = {
    product: [],    // Priority 1
    category: [],   // Priority 2
    collection: [], // Priority 3
    all: [],        // Priority 4
  };

  for (const d of activeDiscounts) {
    if (d.apply_to === 'Products' && d.product_ids.includes(productId)) {
      priorityGroups.product.push(d);
    } else if (d.apply_to === 'Categories') {
      const match = d.category_ids.some(c => 
        c === categoryId || 
        c.toLowerCase() === categoryName || 
        c.toLowerCase() === categorySlug
      );
      if (match) priorityGroups.category.push(d);
    } else if (d.apply_to === 'Collections') {
      const match = d.collection_ids.some(c => collectionIds.includes(c));
      if (match) priorityGroups.collection.push(d);
    } else if (d.apply_to === 'All') {
      priorityGroups.all.push(d);
    }
  }

  // Find the highest-priority non-empty group
  let candidateGroup = null;
  if (priorityGroups.product.length > 0) candidateGroup = priorityGroups.product;
  else if (priorityGroups.category.length > 0) candidateGroup = priorityGroups.category;
  else if (priorityGroups.collection.length > 0) candidateGroup = priorityGroups.collection;
  else if (priorityGroups.all.length > 0) candidateGroup = priorityGroups.all;

  if (!candidateGroup) {
    return {
      originalPrice: basePrice,
      finalPrice: basePrice,
      discountAmount: 0,
      discountPercent: 0,
      appliedDiscount: null,
    };
  }

  // Same-priority resolution: Pick the discount giving the largest monetary saving
  let winningDiscount = null;
  let maxSavings = -1;

  for (const d of candidateGroup) {
    let savings = 0;
    const value = Number(d.discount_value) || 0;

    if (d.discount_type === 'Percentage') {
      const pct = Math.min(Math.max(value, 0), 100);
      savings = (basePrice * pct) / 100;
    } else {
      savings = Math.min(value, basePrice);
    }

    if (savings > maxSavings) {
      maxSavings = savings;
      winningDiscount = d;
    }
  }

  if (!winningDiscount || maxSavings <= 0) {
    return {
      originalPrice: basePrice,
      finalPrice: basePrice,
      discountAmount: 0,
      discountPercent: 0,
      appliedDiscount: null,
    };
  }

  const discountAmount = Math.round(maxSavings * 100) / 100;
  const finalPrice = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);
  const discountPercent = winningDiscount.discount_type === 'Percentage'
    ? Math.round(Number(winningDiscount.discount_value))
    : Math.round((discountAmount / basePrice) * 100);

  return {
    originalPrice: basePrice,
    finalPrice,
    discountAmount,
    discountPercent,
    appliedDiscount: {
      id: winningDiscount.id,
      name: winningDiscount.name,
      discount_type: winningDiscount.discount_type,
      discount_value: Number(winningDiscount.discount_value),
      apply_to: winningDiscount.apply_to,
    },
  };
}

/**
 * Validates a coupon and calculates its discount against a given cart.
 * Authoritative server-side validation.
 */
export async function validateAndApplyCoupon(connection, {
  code,
  cartLines = [],
  customerEmail = '',
  userId = null,
  now = new Date(),
}) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    return { valid: false, message: 'Please enter a coupon code.' };
  }

  let coupons = [];
  try {
    const [rows] = await connection.query(`
      SELECT * FROM coupons 
      WHERE UPPER(code) = ? AND deleted_at IS NULL
      LIMIT 1
    `, [normalized]);
    coupons = rows || [];
  } catch {
    coupons = [];
  }

  if (coupons.length === 0) {
    return { valid: false, message: 'Coupon does not exist.' };
  }

  const coupon = coupons[0];
  const startsAt = new Date(coupon.starts_at);
  const endsAt = new Date(coupon.ends_at);

  if (coupon.is_paused) {
    return { valid: false, message: 'Coupon is currently paused.' };
  }

  if (now < startsAt) {
    return { valid: false, message: 'Coupon is not active yet.' };
  }

  if (now > endsAt) {
    return { valid: false, message: 'Coupon has expired.' };
  }

  // Check global usage limit
  if (coupon.usage_limit != null && Number(coupon.usage_limit) > 0) {
    if (Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
      return { valid: false, message: 'Coupon usage limit has been reached.' };
    }
  }

  // Check per-customer usage limit
  const cleanEmail = String(customerEmail || '').trim().toLowerCase();
  if (coupon.per_customer_limit != null && Number(coupon.per_customer_limit) > 0) {
    const conditions = [];
    const params = [coupon.id];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (cleanEmail) {
      conditions.push('customer_email = ?');
      params.push(cleanEmail);
    }

    if (conditions.length > 0) {
      const [[{ count }]] = await connection.query(`
        SELECT COUNT(*) AS count FROM coupon_usages
        WHERE coupon_id = ? AND (${conditions.join(' OR ')})
      `, params);

      if (Number(count) >= Number(coupon.per_customer_limit)) {
        return { valid: false, message: 'You have already used this coupon the maximum number of times.' };
      }
    }
  }

  // Calculate cart subtotal from lines
  const totalCartSubtotal = cartLines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 1), 0);

  // Check minimum cart amount
  const minOrder = Number(coupon.min_order_amount) || 0;
  if (totalCartSubtotal < minOrder) {
    return { 
      valid: false, 
      message: `Minimum order amount is Rs. ${minOrder.toLocaleString('en-PK')}.` 
    };
  }

  // Check product / category / collection eligibility
  const productIds = parseJsonList(coupon.product_ids).map(Number);
  const categoryIds = parseJsonList(coupon.category_ids).map(String);
  const collectionIds = parseJsonList(coupon.collection_ids).map(Number);

  const eligibleLines = cartLines.filter(line => {
    if (coupon.apply_to === 'All') return true;
    if (coupon.apply_to === 'Products') {
      return productIds.includes(Number(line.id));
    }
    if (coupon.apply_to === 'Categories') {
      const lineCatId = String(line.category_id || '');
      const lineCatName = String(line.category_name || line.category || '').toLowerCase();
      const lineCatSlug = String(line.category_slug || '').toLowerCase();
      return categoryIds.some(c => c === lineCatId || c.toLowerCase() === lineCatName || c.toLowerCase() === lineCatSlug);
    }
    if (coupon.apply_to === 'Collections') {
      const lineCols = parseJsonList(line.collection_ids || line.collectionId).map(Number);
      return collectionIds.some(c => lineCols.includes(c));
    }
    return false;
  });

  if (eligibleLines.length === 0) {
    return { valid: false, message: 'This coupon is not valid for the selected products.' };
  }

  const eligibleSubtotal = eligibleLines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 1), 0);
  let calculatedDiscount = 0;

  if (coupon.discount_type === 'Percentage') {
    const pct = Math.min(Math.max(Number(coupon.discount_value), 0), 100);
    calculatedDiscount = (eligibleSubtotal * pct) / 100;
  } else {
    calculatedDiscount = Math.min(eligibleSubtotal, Number(coupon.discount_value));
  }

  // Cap with max_discount_amount if configured
  if (coupon.max_discount_amount != null && Number(coupon.max_discount_amount) > 0) {
    calculatedDiscount = Math.min(calculatedDiscount, Number(coupon.max_discount_amount));
  }

  calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;
  if (calculatedDiscount <= 0) {
    return { valid: false, message: 'Coupon discount cannot be applied to this cart.' };
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      discountAmount: calculatedDiscount,
      applyTo: coupon.apply_to,
    },
    discountAmount: calculatedDiscount,
    message: `Coupon Applied: ${coupon.code} (Rs. ${calculatedDiscount.toLocaleString('en-PK')} OFF)`,
  };
}
