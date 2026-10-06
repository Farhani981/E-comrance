export function readGuest(storage, key) {
  try { const value = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
export function guestBatch(storage, key, kind) {
  const guest = readGuest(storage, key);
  if (!guest.length) return null;
  let mergeId = storage.getItem(`${key}_merge_id`);
  if (!mergeId) { mergeId = crypto.randomUUID(); storage.setItem(`${key}_merge_id`, mergeId); }
  return { action: 'merge', mergeId, items: kind === 'cart' ? guest.map(p => ({ id: p?.id, productVariantId: p?.productVariantId || null, quantity: p?.quantity })) : guest.map(p => p?.id) };
}
export async function requestShopping(token, kind, body) {
  const response = await fetch(`/api/shopping/${kind}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !Array.isArray(data.items)) throw new Error(data.message || 'Unable to synchronize shopping items. Please try again.');
  return data;
}
