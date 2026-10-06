import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct } from '../../my-app/src/utils/catalog.js';
import { quoteCart } from '../utils/operations.js';
import { saveVariants } from '../utils/variants.js';

test('admin out-of-stock status overrides positive inventory on the storefront', () => {
  assert.equal(normalizeProduct({ stock: 100, status: 'Out of Stock' }).inStock, false);
  assert.equal(normalizeProduct({ stock: 100, status: 'Active' }).inStock, true);
  assert.equal(normalizeProduct({ stock: 0, status: 'Active' }).inStock, false);
});

test('stock labels, numeric strings and legacy flags normalize consistently and idempotently', () => {
  for (const status of ['out of stock', ' OUT_OF_STOCK ', 'Out-of-Stock', 'outofstock', false, 0]) {
    const product = normalizeProduct({ stock: '100', status });
    assert.equal(product.status, 'Out of Stock');
    assert.equal(product.inStock, false);
    assert.deepEqual(normalizeProduct(product), product);
  }
  for (const status of ['in stock', ' IN_STOCK ', 'active', true, 1]) {
    assert.equal(normalizeProduct({ stock: '3', status }).inStock, true);
    assert.equal(normalizeProduct({ stock: '0', status }).inStock, false);
  }
  assert.equal(normalizeProduct({ stock_quantity: '3', status: ' LOW-stock ' }).status, 'Low Stock');
  for (const stock of ['bad', -1, Infinity, '']) assert.equal(normalizeProduct({ stock, status: 'Active' }).inStock, false);
  assert.equal(normalizeProduct({ inStock: false }).inStock, false);
  assert.equal(normalizeProduct({ inStock: true }).inStock, true);
});

test('checkout also rejects noncanonical out-of-stock labels', async () => {
  const db = { query: async () => [[{ id: 1, name: 'Shirt', stock: '100', status: ' OUT_OF_STOCK ' }]] };
  await assert.rejects(quoteCart(db, [{ id: 1, quantity: 1 }]), /out of stock/);
});

test('checkout rejects an out-of-stock product even when its variants have stock', async () => {
  const db = { query: async () => [[{ id: 1, name: 'Shirt', stock: 100, has_variants: true, status: 'Out of Stock' }]] };
  await assert.rejects(quoteCart(db, [{ id: 1, quantity: 1 }]), /out of stock/);
});

test('saving variants preserves the admin status during summary synchronization', async () => {
  let summary;
  const db = { query: async (sql, params) => {
    if (sql.startsWith('INSERT INTO product_variants')) return [{ insertId: 1 }];
    if (sql.startsWith('SELECT * FROM product_variants')) return [[{ stock_quantity: 10, price: 100, image_url: '/shirt.jpg' }]];
    if (sql.startsWith('UPDATE products SET has_variants')) summary = params;
    return [[]];
  } };
  await saveVariants(db, 1, [], [{ options: [], sku: 'SHIRT', price: 100, salePrice: null, stockQuantity: 10, imageUrl: '/shirt.jpg', isActive: true }]);
  assert.equal(summary[6], true);
});
