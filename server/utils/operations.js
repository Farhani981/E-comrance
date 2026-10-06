import { DEFAULT_SETTINGS, readStoreSettings } from './storeSettings.js';
import { normalizeStock } from '../../shared/stock.js';
export const CURRENCY = DEFAULT_SETTINGS.currency;
export const toMinorUnits = value => Math.round((Number(value) + Number.EPSILON) * 100);

import { syncVariantSummary } from './variants.js';

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

export function textValue(value, label, max = 500) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) fail(`${label} is required and must be at most ${max} characters.`);
  return text;
}

export function numberValue(value, label, min = 0, integer = false) {
  if (value === '' || value === null || value === undefined) fail(`${label} is required.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > 100000000 || (integer && !Number.isInteger(number))) fail(`Invalid ${label.toLowerCase()}.`);
  return number;
}

import { createNotification } from '../services/notificationService.js';

export async function changeStock(connection, productId, delta, reason, actorId, variantId = null) {
  const [[product]] = await connection.query('SELECT id, name, stock, has_variants FROM products WHERE id = ? FOR UPDATE', [productId]);
  if (!product) fail('Product not found.', 404);
  const prevStock = Number(product.stock || 0);

  if (product.has_variants) {
    if (!variantId) fail('This product uses variants. Manage individual stock in Products → Edit → Variants.');
    const [updated] = await connection.query('UPDATE product_variants SET stock_quantity=stock_quantity+? WHERE id=? AND product_id=? AND stock_quantity+? >= 0', [delta,variantId,productId,delta]);
    if (!updated.affectedRows) fail('Variant not found or insufficient variant stock.');
    await syncVariantSummary(connection, productId);
    await connection.query('INSERT INTO stock_adjustments (product_id, product_name, delta, reason, actor_id) VALUES (?, ?, ?, ?, ?)', [productId,product.name,delta,`${reason} (variant ${variantId})`,actorId || null]);
    return;
  }
  const nextStock = prevStock + delta;
  if (nextStock < 0) fail(`Insufficient stock for ${product.name}.`);
  await connection.query("UPDATE products SET stock = ?, stock_quantity = ?, status = CASE WHEN ? = 0 THEN 'Out of Stock' WHEN ? <= 5 THEN 'Low Stock' ELSE 'Active' END WHERE id = ?", [nextStock, nextStock, nextStock, nextStock, productId]);
  await connection.query('INSERT INTO stock_adjustments (product_id, product_name, delta, reason, actor_id) VALUES (?, ?, ?, ?, ?)', [productId, product.name, delta, reason, actorId || null]);

  // Check stock threshold alerts (crossing thresholds)
  if (prevStock > 5 && nextStock <= 5 && nextStock > 0) {
    createNotification({
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: `${product.name} has only ${nextStock} items remaining.`,
      priority: 'MEDIUM',
      metadata: { productId, productName: product.name, remainingStock: nextStock },
    });
  } else if (prevStock > 0 && nextStock === 0) {
    createNotification({
      type: 'OUT_OF_STOCK',
      title: 'Out of Stock Alert',
      message: `${product.name} is now out of stock.`,
      priority: 'HIGH',
      metadata: { productId, productName: product.name, remainingStock: 0 },
    });
  }
}

export function calculateQuote(lines, promotions, code = '', now = new Date(), settings = DEFAULT_SETTINGS) {
  const subtotal = lines.reduce((sum, line) => sum + toMinorUnits(line.price) * line.quantity, 0) / 100;
  const normalized = String(code || '').trim().toUpperCase();
  const eligible = promotions.filter(p => p.active && (!p.starts_at || new Date(p.starts_at) <= now) && (!p.ends_at || new Date(p.ends_at) >= now) && subtotal >= Number(p.min_subtotal));
  const coupon = normalized ? eligible.find(p => p.code === normalized) : null;
  if (normalized && !coupon) fail('This coupon is invalid, expired, or its minimum spend has not been met.');
  const discountFor = p => {
    const amount = lines.filter(line => !p.product_id || Number(p.product_id) === Number(line.id)).reduce((sum, line) => sum + toMinorUnits(line.price) * line.quantity, 0) / 100;
    return Math.min(amount, p.discount_type === 'Percentage' ? amount * Number(p.value) / 100 : Number(p.value));
  };
  if (coupon && discountFor(coupon) <= 0) fail('This coupon does not apply to the products in your cart.');
  const candidates = eligible.filter(p => !p.code || p === coupon).map(p => ({ promotion: p, discount: discountFor(p) })).sort((a, b) => b.discount - a.discount);
  const best = candidates[0];
  const discountAmount = toMinorUnits(best?.discount || 0) / 100;
  const shipping = subtotal > settings.freeShippingAbove || subtotal === 0 ? 0 : settings.shippingFee;
  const tax = 0; // Existing business rules do not add tax.
  const totalMinor = toMinorUnits(subtotal) - toMinorUnits(discountAmount) + toMinorUnits(shipping) + toMinorUnits(tax);
  return { currency: settings.currency, tax, subtotal, discountAmount, shipping, totalMinor,
    grandTotal: totalMinor / 100, promotionName: best?.promotion.name || '', couponCode: normalized };
}

import { getActiveDiscounts, calculateProductDiscount, validateAndApplyCoupon } from '../services/pricingEngine.js';

export async function quoteCart(connection, items, code, lock = false, customerOptions = {}) {
  if (!Array.isArray(items) || !items.length || items.length > 200) fail('A cart with 1–200 products is required.');
  const quantities = new Map();
  for (const item of items) {
    const id = numberValue(item.id, 'Product ID', 1, true);
    const variantId = item.productVariantId == null ? null : numberValue(item.productVariantId, 'Variant ID', 1, true);
    const key = `${id}:${variantId || ''}`;
    const quantity = numberValue(item.quantity, 'Quantity', 1, true);
    quantities.set(key, { id, variantId, quantity: (quantities.get(key)?.quantity || 0) + quantity });
  }
  const ids = [...new Set([...quantities.values()].map(item => item.id))].sort((a, b) => a - b);
  const [products] = await connection.query(`SELECT id, name, price, original_price, category_id, category_name, stock, image, has_variants, status, deleted_at FROM products WHERE id IN (?) ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [ids]);
  if (products.length !== ids.length) fail('One or more products are no longer available.');

  const now = new Date();
  const activeDiscounts = await getActiveDiscounts(connection, now).catch(() => []);

  const lines = [];
  for (const item of [...quantities.values()].sort((a,b) => a.id-b.id || (a.variantId || 0)-(b.variantId || 0))) {
    const product = products.find(p => p.id === item.id);
    if (product.deleted_at || normalizeStock(product).status === 'Out of Stock') fail(`${product.name} is out of stock.`);

    let baseUnitPrice = Number(product.price || 0);
    let lineObj = { ...product, quantity: item.quantity };

    if (product.has_variants) {
      if (!item.variantId) fail(`Choose a variant for ${product.name}. Remove the old cart item and add it again.`);
      const [[variant]] = await connection.query(`SELECT * FROM product_variants WHERE id=? AND product_id=? AND is_active=TRUE${lock ? ' FOR UPDATE' : ''}`, [item.variantId,item.id]);
      if (!variant) fail('A selected variant is no longer available.');
      const options = typeof variant.options === 'string' ? JSON.parse(variant.options) : variant.options;
      baseUnitPrice = Number(variant.sale_price ?? variant.price);
      lineObj = {
        ...product,
        name: `${product.name} (${options.map(option => option.label).join(' / ') || 'Default'})`,
        price: baseUnitPrice,
        stock: variant.stock_quantity,
        image: variant.image_url,
        productVariantId: variant.id,
        sku: variant.sku,
        variantOptions: options,
        quantity: item.quantity,
      };
    }

    // Apply automatic discounts deterministically
    const promoPricing = calculateProductDiscount({ ...lineObj, price: baseUnitPrice }, activeDiscounts);
    lineObj.originalPrice = promoPricing.originalPrice;
    lineObj.price = promoPricing.finalPrice;
    lineObj.productDiscountAmount = promoPricing.discountAmount;
    lineObj.appliedDiscountId = promoPricing.appliedDiscount?.id || null;
    lineObj.appliedDiscountName = promoPricing.appliedDiscount?.name || null;
    lines.push(lineObj);
  }

  for (const line of lines) if (line.quantity > Number(line.stock)) fail(`Only ${line.stock} units of ${line.name} are available.`);

  const subtotal = lines.reduce((sum, line) => sum + toMinorUnits(line.price) * line.quantity, 0) / 100;
  const settings = await readStoreSettings(connection, lock);
  const normalizedCode = String(code || '').trim().toUpperCase();

  let couponDiscountAmount = 0;
  let promotionName = '';
  let appliedCouponId = null;

  if (normalizedCode) {
    const couponResult = await validateAndApplyCoupon(connection, {
      code: normalizedCode,
      cartLines: lines,
      customerEmail: customerOptions.email,
      userId: customerOptions.userId,
      now,
    });

    if (couponResult.valid) {
      couponDiscountAmount = couponResult.discountAmount;
      promotionName = couponResult.coupon.name || couponResult.coupon.code;
      appliedCouponId = couponResult.coupon.id;
    } else {
      // Fallback check against legacy promotions table if exists
      const [legacyPromos] = await connection.query('SELECT * FROM promotions WHERE active = TRUE').catch(() => [[]]);
      const legacyQuote = calculateQuote(lines, legacyPromos, normalizedCode, now, settings);
      if (legacyQuote.discountAmount > 0) {
        couponDiscountAmount = legacyQuote.discountAmount;
        promotionName = legacyQuote.promotionName;
      } else {
        fail(couponResult.message || 'This coupon is invalid, expired, or does not apply.');
      }
    }
  }

  // Tag lines with applied coupon ID if coupon was applied
  if (appliedCouponId) {
    for (const line of lines) {
      line.appliedCouponId = appliedCouponId;
    }
  }

  const shipping = subtotal > settings.freeShippingAbove || subtotal === 0 ? 0 : settings.shippingFee;
  const tax = 0;
  const totalMinor = Math.max(0, toMinorUnits(subtotal) - toMinorUnits(couponDiscountAmount) + toMinorUnits(shipping) + toMinorUnits(tax));

  return {
    currency: settings.currency,
    tax,
    subtotal,
    discountAmount: couponDiscountAmount,
    shipping,
    totalMinor,
    grandTotal: totalMinor / 100,
    promotionName,
    couponCode: normalizedCode,
    appliedCouponId,
    lines,
  };
}
