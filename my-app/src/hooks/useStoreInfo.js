import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function useStoreInfo() {
  const [settings, setSettings] = useState(null);
  const { pathname } = useLocation();
  useEffect(() => {
    let controller;
    const load = () => {
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      fetch('/api/settings/public', { signal, cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error('Settings unavailable');
        const data = await response.json();
        if (!signal.aborted && data.success) setSettings(data.settings);
      }).catch(() => { /* Keep branding usable; quotes remain backend-authoritative. */ });
    };
    load(); window.addEventListener('store-settings-updated', load);
    return () => { controller?.abort(); window.removeEventListener('store-settings-updated', load); };
  }, [pathname]);
  return settings;
}

export function shippingDescription(settings) {
  if (!settings) return 'Shipping is calculated at checkout.';
  if (settings.shippingFee === 0) return 'Standard shipping is free.';
  return `Free shipping on orders above Rs. ${Number(settings.freeShippingAbove).toFixed(2)} before discounts. Otherwise, standard shipping is Rs. ${Number(settings.shippingFee).toFixed(2)}.`;
}
