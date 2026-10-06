import { useEffect } from 'react';
import useStoreInfo from '../hooks/useStoreInfo';

export default function StoreMetadata() {
  const settings = useStoreInfo();
  useEffect(() => {
    if (!settings) return;
    const oldTitle = document.title;
    document.title = settings.metaTitle || settings.storeName;
    const undo = ['description', 'keywords'].map(name => {
      const existing = document.head.querySelector(`meta[name="${name}"]`);
      const node = existing || document.createElement('meta');
      const oldContent = node.getAttribute('content');
      node.name = name;
      node.content = settings[name === 'description' ? 'metaDescription' : 'metaKeywords'] || '';
      if (!existing) document.head.append(node);
      return () => {
        if (!existing) node.remove();
        else if (oldContent == null) node.removeAttribute('content');
        else node.setAttribute('content', oldContent);
      };
    });
    return () => { document.title = oldTitle; undo.forEach(restore => restore()); };
  }, [settings]);
  return null;
}
