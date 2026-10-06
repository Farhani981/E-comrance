import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAttribute } from '../utils/attributeValidation.js';

test('normalizes color names and hex values', () => {
  assert.deepEqual(validateAttribute({ name: ' Color ', type: 'color', values: [{ label: ' Blue ', color: '#aabbcc' }] }), { name: 'Color', type: 'color', values: [{ label: 'Blue', color: '#AABBCC' }] });
});
test('text attributes discard unused swatches', () => {
  assert.deepEqual(validateAttribute({ name: 'Size', type: 'text', values: [{ label: 'M', color: '#000000' }] }).values, [{ label: 'M' }]);
});
test('rejects invalid and duplicate values', () => {
  for (const values of [[], [null], [{ label: ' ' }], [{ label: 'M' }, { label: ' m ' }]]) {
    assert.throws(() => validateAttribute({ name: 'Size', type: 'text', values }));
  }
  assert.throws(() => validateAttribute({ name: 'Color', type: 'color', values: [{ label: 'Red', color: 'red' }] }));
  assert.throws(() => validateAttribute({ name: '', type: 'text', values: [{ label: 'M' }] }));
  assert.throws(() => validateAttribute({ name: 'Size', type: 'invalid', values: [{ label: 'M' }] }));
});
