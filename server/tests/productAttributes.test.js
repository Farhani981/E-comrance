import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductAttributes, withProductAttributes } from '../utils/productAttributes.js';
import { normalizeProduct } from '../../my-app/src/utils/catalog.js';
import { retainCompatibleVariants } from '../../shared/variants.js';

const definitions = [
  { id: 1, name: 'Color', type: 'color', attribute_values: JSON.stringify([{ label: 'Black', color: '#000000' }, { label: 'Blue', color: '#0000FF' }]) },
  { id: 2, name: 'Size', type: 'text', attribute_values: [{ label: 'S' }, { label: 'M' }] },
];
const db = { query: async () => [definitions] };
test('saves only selected options with authoritative names and swatches', async () => {
  const attributes = await resolveProductAttributes(db, [{ id: 1, name: 'Forged', values: [{ label: 'Black', color: '#FFFFFF' }] }, { id: 2, values: [{ label: 'M' }] }]);
  assert.equal(attributes[0].name, 'Color');
  assert.equal(attributes[0].values[0].color, '#000000');
  const loaded = normalizeProduct(withProductAttributes({ id: 10, attributes: JSON.stringify(attributes) }));
  assert.deepEqual(loaded.sizes, ['M']);
  assert.deepEqual(loaded.colors, [{ name: 'Black', hex: '#000000' }]);
  assert.deepEqual(loaded.attributes, attributes);
});
test('rejects missing attributes, unavailable values, duplicates and malformed selections', async () => {
  for (const input of [null, {}, [null], [{ id: 99, values: [{ label: 'S' }] }], [{ id: 2, values: [] }], [{ id: 2, values: [{ label: 'XXL' }] }], [{ id: 2, values: [{ label: 'S' }, { label: 'S' }] }], [{ id: 2, values: [{ label: 'S' }] }, { id: 2, values: [{ label: 'M' }] }]]) {
    await assert.rejects(() => resolveProductAttributes(db, input));
  }
});
test('clearing selections removes storefront options and handles old database rows', async () => {
  assert.deepEqual(await resolveProductAttributes(db, []), []);
  const loaded = normalizeProduct(withProductAttributes({ attributes: null }));
  assert.deepEqual(loaded.attributes, []);
  assert.deepEqual(loaded.sizes, []);
  assert.deepEqual(loaded.colors, []);
});

test('explicit option clearing overrides stale cached arrays and stays cleared on reload', () => {
  const previous = normalizeProduct({ attributes: [{ name: ' Sizes ', type: 'text', values: [{ label: 'M' }] },
    { name: 'Color', type: 'color', values: [{ label: 'Black', color: '#000000' }] }] });
  for (const attributes of [[], null, '[]']) {
    const cleared = normalizeProduct({ ...previous, attributes });
    assert.deepEqual(cleared.sizes, []);
    assert.deepEqual(cleared.colors, []);
    assert.deepEqual(normalizeProduct(cleared), cleared);
  }
  const changed = normalizeProduct({ ...previous, attributes: [{ name: 'Size', values: [{ label: 'L' }] }] });
  assert.deepEqual(changed.sizes, ['L']);
  assert.deepEqual(changed.colors, []);
});

test('legacy options survive normalization without an attributes field and variant records are untouched', () => {
  const variants = [{ id: 7, sku: 'SHIRT-M', price: 500, salePrice: 450, stockQuantity: 3, options: [{ attributeId: 2, label: 'M' }] }];
  const legacy = { sizes: ['M'], colors: [{ name: 'Black', hex: '#000000' }], variants, hasVariants: true };
  const normalized = normalizeProduct(legacy);
  assert.deepEqual(normalizeProduct(normalized).sizes, ['M']);
  assert.deepEqual(normalized.colors, legacy.colors);
  assert.equal(normalized.variants, variants);
});

test('removing an option drops stale variant rows while retaining unchanged SKU/price/stock relationships', () => {
  const medium = { id: 7, sku: 'M', price: 500, stockQuantity: 3, options: [{ attributeId: 2, label: 'M' }] };
  const large = { id: 8, sku: 'L', price: 600, stockQuantity: 4, options: [{ attributeId: 2, label: 'L' }] };
  const retained = retainCompatibleVariants([{ id: 2, values: [{ label: 'L' }] }], [medium, large]);
  assert.deepEqual(retained, [large]);
  assert.equal(retained[0], large);
  assert.deepEqual(retainCompatibleVariants([], [medium, large]), []);
});
