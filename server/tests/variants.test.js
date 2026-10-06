import test from 'node:test';
import assert from 'node:assert/strict';
import { variantCombinations, variantKey, validateVariants, generateVariantRows } from '../../shared/variants.js';

test('adding options preserves existing inventory and does not reuse retained or historical SKUs', () => {
  const old = { id: 42, options: [{ attributeId: 1, label: 'Blue' }], sku: 'SHIRT-V1', stockQuantity: 7, originalStockQuantity: 7, imageUrl: '/blue.jpg' };
  const expanded = [{ id: 1, values: [{ label: 'Red' }, { label: 'Blue' }, { label: 'Green' }] }];
  const result = generateVariantRows(expanded, [old], { sku: 'SHIRT', price: '100', image: '/new.jpg' }, ['shirt-v2']);
  assert.equal(result[1], old);
  assert.deepEqual(result.map(row => row.sku), ['SHIRT-V3', 'SHIRT-V1', 'SHIRT-V4']);
  assert.equal(result[0].stockQuantity, '0');
  assert.equal(result[0].imageUrl, '/new.jpg');
  assert.equal(result[2].id, undefined);
});

const attributes = [{ id: 1, values: [{ label: 'Red' }, { label: 'Blue' }] }, { id: 2, values: [{ label: 'S' }, { label: 'M' }] }];
const rows = () => variantCombinations(attributes).map((options, i) => ({ options, sku: 'TEST-'+i, price: '100.00', salePrice: '80.00', stockQuantity: 3, imageUrl: '/test.jpg', isActive: true }));
test('matrix creates Cartesian combinations with order-independent stable keys', () => {
  assert.equal(rows().length, 4);
  assert.equal(variantKey(rows()[0].options), variantKey([...rows()[0].options].reverse()));
  assert.deepEqual(variantCombinations([]), [[]]);
  assert.throws(() => variantCombinations([{ id: 1, values: Array(201).fill({ label: 'A' }) }]));
});
test('variant validation rejects duplicate, missing, incorrect and invalid commercial data', () => {
  assert.equal(validateVariants(attributes, rows()).length, 4);
  for (const changes of [{ sku: '' }, { sku: 'TEST-1' }, { price: '-1' }, { salePrice: '100' }, { stockQuantity: -1 }, { stockQuantity: 1.5 }, { imageUrl: 'javascript:alert(1)' }, { options: [] }]) {
    const input = rows(); input[0] = { ...input[0], ...changes };
    assert.throws(() => validateVariants(attributes, input));
  }
  assert.throws(() => validateVariants(attributes, rows().slice(1)));
  const input = rows(); input[0].salePrice = '0';
  assert.equal(validateVariants(attributes, input)[0].salePrice, '0');
});
