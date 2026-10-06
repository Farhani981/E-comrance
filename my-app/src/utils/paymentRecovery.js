export const paymentStorageKey='shophub_pending_payment';
export function readPaymentRecovery(storage=localStorage) {
  try { const value=JSON.parse(storage.getItem(paymentStorageKey)); return value?.checkoutId && value?.recoveryKey ? value : null; } catch { return null; }
}
export function beginPaymentRecovery(storage=localStorage) {
  const existing=readPaymentRecovery(storage);
  if(existing) return existing;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const reference={checkoutId:crypto.randomUUID(),recoveryKey:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
  // Must succeed before asking Stripe to charge; never save card data/client secret.
  storage.setItem(paymentStorageKey,JSON.stringify(reference)); return reference;
}
export async function recoverPayment(reference,token,action='reconcile') {
  const response=await fetch(`/api/orders/payments/${reference.checkoutId}/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({recoveryKey:reference.recoveryKey})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.message || 'Recovery is temporarily unavailable. Keep this reference and do not pay again.');
  return result;
}
