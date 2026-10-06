import { validateImageReference } from './images.js';

export const variantKey = options => JSON.stringify([...options].sort((a, b) => a.attributeId - b.attributeId).map(option => [option.attributeId, option.label]));

export function generateVariantRows(attributes, rows, defaults, reservedSkus = []) {
  const used = new Set([...reservedSkus, ...rows.map(row => row.sku)].map(sku => String(sku).trim().toLowerCase()));
  let sequence = 1;
  return variantCombinations(attributes).map(options => {
    const existing = rows.find(row => variantKey(row.options) === variantKey(options));
    if (existing) return existing;
    let sku;
    do { sku = `${(defaults.sku || 'SKU').slice(0, 90)}-V${sequence++}`; } while (used.has(sku.toLowerCase()));
    used.add(sku.toLowerCase());
    return { options, sku, imageUrl: defaults.image || '',
      price: defaults.discountEnabled ? defaults.originalPrice : defaults.price,
      salePrice: defaults.discountEnabled ? defaults.price : '', stockQuantity: '0', isActive: true };
  });
}

// Keep unchanged combinations and their IDs/SKU/prices/stock; discard removed
// options immediately instead of leaving stale rows until Generate is clicked.
export function retainCompatibleVariants(attributes, rows) {
  return rows.filter(row => row.options.length === attributes.length && attributes.every(attribute =>
    row.options.some(option => option.attributeId === attribute.id && attribute.values.some(value => value.label === option.label))));
}

export function variantCombinations(attributes) {
  const count = attributes.reduce((total, attribute) => total * attribute.values.length, 1);
  if (count > 200) throw new Error('Choose fewer options: a product can have at most 200 variants.');
  return attributes.reduce((rows, attribute) => rows.flatMap(row => attribute.values.map(value => [...row, { attributeId: attribute.id, label: value.label }])), [[]]);
}

export function validateVariants(attributes, variants, existingVariants = []) {
  const expected = new Set(variantCombinations(attributes).map(variantKey));
  if (!Array.isArray(variants) || variants.length !== expected.size) throw new Error('Generate and complete all variant combinations before saving.');
  if (variants.reduce((sum, variant) => sum + Number(variant.stockQuantity || 0), 0) > 100000000) throw new Error('Total variant stock cannot exceed 100,000,000 units.');
  const seen = new Set(), skus = new Set();
  return variants.map(variant => {
    if (!Array.isArray(variant.options)) throw new Error('Invalid variant options.');
    const key = variantKey(variant.options);
    if (!expected.has(key) || seen.has(key)) throw new Error('Duplicate or invalid variant combination. Regenerate variants.');
    seen.add(key);
    const sku = typeof variant.sku === 'string' ? variant.sku.trim() : '';
    if (!sku || sku.length > 100 || skus.has(sku.toLowerCase())) throw new Error('Each variant needs a unique SKU (up to 100 characters).');
    skus.add(sku.toLowerCase());
    const money = value => /^\d{1,8}(\.\d{1,2})?$/.test(String(value));
    if (!money(variant.price) || Number(variant.price) <= 0) throw new Error(`Enter a valid regular price for ${sku}.`);
    const salePrice = variant.salePrice === '' || variant.salePrice == null ? null : variant.salePrice;
    if (salePrice !== null && (!money(salePrice) || Number(salePrice) >= Number(variant.price))) throw new Error(`Sale price must be below regular price for ${sku}.`);
    if (variant.stockQuantity === '' || variant.stockQuantity == null || !Number.isInteger(Number(variant.stockQuantity)) || Number(variant.stockQuantity) < 0 || Number(variant.stockQuantity) > 100000000) throw new Error(`Enter valid stock for ${sku}.`);
    // The server supplies these existing values from SQL, never from the request.
    const unchangedImage = variant.id && existingVariants.some(row => row.id === variant.id && row.imageUrl === variant.imageUrl);
    if (!unchangedImage) validateImageReference(variant.imageUrl);
    return { ...variant, key, sku, salePrice, stockQuantity: Number(variant.stockQuantity), isActive: variant.isActive !== false };
  });
}
