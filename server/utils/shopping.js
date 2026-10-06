import { attachVariants } from './variants.js';
import { withProductAttributes } from './productAttributes.js';
import { normalizeStock } from '../../shared/stock.js';

export async function ensureShoppingSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS customer_shopping (
    user_id INT PRIMARY KEY, cart JSON NOT NULL, wishlist JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await db.query(`CREATE TABLE IF NOT EXISTS shopping_merge_receipts (
    user_id INT NOT NULL, kind VARCHAR(10) NOT NULL, merge_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,kind,merge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
}
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
export const shoppingKey = item => `${item?.id}:${item?.productVariantId || 0}`;
const positive = value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 100000000;
export function cartReference(item) {
  if (!item || !positive(item.id) || !positive(item.quantity) || (item.productVariantId != null && !positive(item.productVariantId))) fail('Invalid product, variant or quantity.');
  return { id: item.id, productVariantId: item.productVariantId || null, quantity: item.quantity };
}
export const parseList = value => typeof value === 'string' ? JSON.parse(value) : value;

export async function shoppingProducts(db, ids) {
  if (!ids.length) return [];
  const [rows] = await db.query('SELECT * FROM products WHERE id IN (?) AND deleted_at IS NULL ORDER BY id', [[...new Set(ids)]]);
  return attachVariants(db, rows.map(withProductAttributes));
}
export function hydrateCart(items, products) {
  const grouped = new Map(), notices = [];
  for (const item of items) {
    try { const ref = cartReference(item); const key = shoppingKey(ref); grouped.set(key, { ...ref, quantity: (grouped.get(key)?.quantity || 0) + ref.quantity }); }
    catch { notices.push('An invalid cart item was removed.'); }
  }
  const refs = [], hydrated = [];
  for (const ref of grouped.values()) {
    const p = products.find(p => p.id === ref.id);
    const variant = p?.variants?.find(v => v.id === ref.productVariantId && v.isActive);
    const stock = Number(p?.hasVariants ? variant?.stockQuantity : p?.stock);
    if (!p || !normalizeStock(p).inStock || (p.hasVariants ? !variant : ref.productVariantId != null) || !Number.isFinite(stock) || stock < 1) { notices.push('An unavailable product or variant was removed.'); continue; }
    const quantity = Math.min(ref.quantity, stock);
    if (quantity !== ref.quantity) notices.push(`Quantity for ${p.name} was reduced to available stock.`);
    const options = variant?.options || [];
    refs.push({ ...ref, quantity });
    hydrated.push({ ...p, title: p.name, price: Number(variant ? variant.salePrice ?? variant.price : p.price), originalPrice: Number(variant ? variant.salePrice != null ? variant.price : 0 : p.original_price || 0),
      image: variant?.imageUrl || p.image, sku: variant?.sku || p.sku, stock, quantity,
      productVariantId: variant?.id || null, variantId: variant ? `variant-${variant.id}` : `product-${p.id}`,
      variantOptions: options,
      selectedSize: options.find(o => ['size', 'sizes'].includes(p.attributes.find(a => a.id === o.attributeId)?.name.toLowerCase()))?.label || '',
      selectedColor: options.find(o => p.attributes.find(a => a.id === o.attributeId)?.type === 'color')?.label || '',
    });
  }
  return { refs, items: hydrated, notices };
}

// Called inside the order transaction after the same user lock as shopping APIs.
export async function consumePurchasedCart(db, userId, lines) {
  const [[state]] = await db.query('SELECT cart FROM customer_shopping WHERE user_id=?', [userId]);
  if (!state) return;
  const purchased = new Map(lines.map(line => [shoppingKey(line), line.quantity]));
  const cart = parseList(state.cart).map(item => ({ ...item, quantity: item.quantity - (purchased.get(shoppingKey(item)) || 0) })).filter(item => item.quantity > 0);
  await db.query('UPDATE customer_shopping SET cart=? WHERE user_id=?', [JSON.stringify(cart), userId]);
}
