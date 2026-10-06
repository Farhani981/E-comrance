import { useEffect, useState } from 'react';
import { checkoutItems } from '../../../shared/checkout.js';
export default function useCartQuote(cart, couponCode = '') {
  const key = JSON.stringify({ items: checkoutItems(cart), couponCode });
  const [state, setState] = useState({ key: '', quote: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    if (cart.length) fetch('/api/operations/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to calculate your cart.');
      setState({ key, quote: data.quote, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setState({ key, quote: null, error: error.message }); });
    return () => controller.abort();
  }, [key, cart.length]);
  const current = state.key === key;
  return { quote: current ? state.quote : null, quoteError: current ? state.error : '', quoteLoading: cart.length > 0 && !current };
}
