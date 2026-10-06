import { createHash } from 'node:crypto';
import { validateVariants } from '../../shared/variants.js';

export async function attachVariants(db, products) {
  if (!products.length) return products;
  const [rows] = await db.query('SELECT * FROM product_variants WHERE product_id IN (?) ORDER BY id', [products.map(p => p.id)]);
  return products.map(product => ({ ...product, hasVariants: Boolean(product.has_variants), variants: rows.filter(row => row.product_id === product.id).map(row => ({
    id: row.id, options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
    sku: row.sku, imageUrl: row.image_url, price: row.price, salePrice: row.sale_price,
    stockQuantity: row.stock_quantity, originalStockQuantity: row.stock_quantity, isActive: Boolean(row.is_active)
  })) }));
}

export async function syncVariantSummary(db, productId, preserveStatus = false) {
  const [rows] = await db.query('SELECT * FROM product_variants WHERE product_id=? AND is_active=TRUE ORDER BY COALESCE(sale_price,price),id', [productId]);
  const stock = rows.reduce((total, row) => total + row.stock_quantity, 0);
  const first = rows[0];
  await db.query("UPDATE products SET has_variants=TRUE,stock=?,stock_quantity=?,price=COALESCE(?,price),original_price=?,image=COALESCE((SELECT image_url FROM product_variants WHERE id=?),image),status=CASE WHEN ?=0 THEN 'Out of Stock' WHEN ? THEN status ELSE 'Active' END WHERE id=?", [stock,stock,first?.sale_price ?? first?.price ?? null,first?.sale_price != null ? first.price : null,first?.id ?? null,stock,preserveStatus,productId]);
}

export async function saveVariants(db, productId, attributes, input) {
  const [existing] = await db.query('SELECT id,sku,combination_hash,stock_quantity,image_url FROM product_variants WHERE product_id=? FOR UPDATE', [productId]);
  let variants;
  try { variants = validateVariants(attributes, input, existing.map(row => ({ id: row.id, imageUrl: row.image_url }))); }
  catch (error) { error.status = 400; throw error; }
  await db.query('DELETE FROM product_attribute_values WHERE product_id=?', [productId]);
  await db.query('UPDATE product_variants SET is_active=FALSE WHERE product_id=?', [productId]);
  const updatedIds = new Set();
  for (const variant of variants) {
    const hash = createHash('sha256').update(variant.key).digest('hex');
    // Identity comes from the saved variant, not its editable color/size.
    const byId = variant.id ? existing.find(row => row.id === Number(variant.id)) : null;
    if (variant.id && !byId) throw Object.assign(new Error('Variant does not belong to this product.'), { status: 400 });
    const bySku = existing.find(row => row.sku.toLowerCase() === variant.sku.toLowerCase());
    const byCombination = existing.find(row => row.combination_hash === hash);
    const current = byId || bySku || byCombination;
    if (current && updatedIds.has(current.id)) throw Object.assign(new Error('The same existing variant cannot be used for two combinations.'), { status: 400 });
    if (current && byCombination && byCombination.id !== current.id) throw Object.assign(new Error('That color/size combination already belongs to another saved variant. Edit that variant instead.'), { status: 409 });
    if (current) updatedIds.add(current.id);
    if (current && variant.originalStockQuantity !== undefined && Number(variant.originalStockQuantity) !== current.stock_quantity) throw Object.assign(new Error(`Stock for ${variant.sku} changed since you opened the form. Reopen this product before saving.`), { status: 409 });
    let id = current?.id;
    const sku = variant.sku;
    const [[conflict]] = await db.query('SELECT id FROM product_variants WHERE sku=? AND id<>? LIMIT 1', [sku, id || 0]);
    if (conflict) throw Object.assign(new Error(`Variant SKU "${sku}" belongs to a different variant. Keep this variant's original SKU.`), { status: 409 });
    const data = [JSON.stringify(variant.options),sku,variant.imageUrl,variant.price,variant.salePrice,variant.stockQuantity,variant.isActive];
    if (id) {
      if (current.image_url === variant.imageUrl) data[2] = null;
      await db.query('UPDATE product_variants SET options=?,sku=?,image_url=COALESCE(?,image_url),price=?,sale_price=?,stock_quantity=?,is_active=?,combination_hash=? WHERE id=?', [...data,hash,id]);
    }
    else {
      const [result] = await db.query('INSERT INTO product_variants (options,sku,image_url,price,sale_price,stock_quantity,is_active,product_id,combination_hash) VALUES (?,?,?,?,?,?,?,?,?)', [...data,productId,hash]);
      id = result.insertId;
    }
    await db.query('DELETE FROM variant_attribute_values WHERE variant_id=?', [id]);
    for (const option of variant.options) {
      const attribute = attributes.find(a => a.id === option.attributeId);
      const value = attribute.values.find(v => v.label === option.label);
      await db.query('INSERT INTO attribute_values (attribute_id,label,color_hex) VALUES (?,?,?) ON DUPLICATE KEY UPDATE color_hex=VALUES(color_hex)', [attribute.id,value.label,value.color || null]);
      const [[stored]] = await db.query('SELECT id FROM attribute_values WHERE attribute_id=? AND label=?', [attribute.id,value.label]);
      await db.query('INSERT IGNORE INTO product_attribute_values (product_id,attribute_id,value_id) VALUES (?,?,?)', [productId,attribute.id,stored.id]);
      await db.query('INSERT INTO variant_attribute_values (variant_id,attribute_id,value_id) VALUES (?,?,?)', [id,attribute.id,stored.id]);
    }
  }
  await syncVariantSummary(db, productId, true);
}
