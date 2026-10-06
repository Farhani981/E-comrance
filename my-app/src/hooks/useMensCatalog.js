import { useCallback, useEffect, useState } from 'react';

export default function useMensCatalog(pathname) {
  const [catalogTree, setTree] = useState([]);
  const [catalogLoading, setLoading] = useState(true);
  const [catalogError, setError] = useState('');
  const [attributes, setAttributes] = useState({ fits: [], occasions: [] });
  const refreshCatalog = useCallback(async (signal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/catalog', { signal });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load categories.');
      if (!signal?.aborted) { setTree(data.tree); setAttributes({ fits: data.fits, occasions: data.occasions }); setError(''); }
    } catch (error) { if (!signal?.aborted) setError(error.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refreshCatalog(controller.signal);
    const focus = () => { if (!document.hidden) void refreshCatalog(controller.signal); };
    window.addEventListener('focus', focus);
    return () => { controller.abort(); window.removeEventListener('focus', focus); };
  }, [pathname, refreshCatalog]);
  return { catalogTree, catalogLoading, catalogError, refreshCatalog: () => refreshCatalog(), ...attributes };
}
