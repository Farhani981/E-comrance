// API status labels and legacy cached values share one availability contract.
export function normalizeStock(product) {
  const raw = product.stock ?? product.stock_quantity ?? product.stockQuantity;
  const hasQuantity = raw !== undefined && raw !== null;
  const quantity = Number(raw);
  const stock = hasQuantity && Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const label = String(product.status ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const blocked = ['outofstock', 'soldout', 'unavailable', 'false', '0'].includes(label);
  const available = hasQuantity ? stock > 0 : product.inStock !== false && product.inStock !== 'false' && product.inStock !== 0;
  const inStock = !blocked && available;
  const status = !inStock ? 'Out of Stock' : label === 'lowstock' ? 'Low Stock' : 'Active';
  // Do not invent a quantity for legacy products that only contain availability.
  return { ...(hasQuantity ? { stock } : {}), status, inStock };
}
