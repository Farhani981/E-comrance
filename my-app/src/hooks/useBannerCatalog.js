import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const DEFAULT_BANNERS = [
  {
    id: 1,
    title: "Elevate Your Everyday **Wardrobe**",
    description: "Discover the new season collection tailored with premium fabrics and modern cuts.",
    buttonText: "Shop Collection",
    link: "/shop",
    secondaryButtonText: "Explore Categories",
    secondaryLink: "/shop",
    badge: "NEW ARRIVALS 2026",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1920&auto=format&fit=crop",
    imageAlt: "New Season Collection",
    imagePosition: "center",
    kind: "hero",
    isActive: true,
    position: 0,
  },
  {
    id: 2,
    title: "Timeless Traditional & **Modern Fits**",
    description: "Handcrafted eastern wear and premium daily essentials designed for distinction.",
    buttonText: "Discover Eastern Wear",
    link: "/shop?category=Eastern-Wear",
    secondaryButtonText: "View All Products",
    secondaryLink: "/shop",
    badge: "FEATURED STYLES",
    image: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1920&auto=format&fit=crop",
    imageAlt: "Eastern and Casual Wear",
    imagePosition: "center",
    kind: "hero",
    isActive: true,
    position: 1,
  },
  {
    id: 3,
    title: "Flat **30% Off** on Casuals",
    description: "Upgrade your wardrobe with trendsetting casual tees, chinos and polo shirts.",
    buttonText: "Shop Casual",
    link: "/shop?category=Casual-Shirts",
    badge: "SPECIAL OFFER",
    image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=1000&auto=format&fit=crop",
    imageAlt: "Casual Sale",
    imagePosition: "center",
    kind: "promo",
    isActive: true,
    position: 0,
  },
  {
    id: 4,
    title: "Festive & **Eastern Wear**",
    description: "Handcrafted kurtas and waistcoats tailored for timeless elegance.",
    buttonText: "Discover Eastern",
    link: "/shop?category=Eastern-Wear",
    badge: "FESTIVE EDIT",
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1000&auto=format&fit=crop",
    imageAlt: "Festive Collection",
    imagePosition: "center",
    kind: "promo",
    isActive: true,
    position: 1,
  },
];

export default function useBannerCatalog(pathname) {
  const { user } = useAuth();
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('shophub_banners');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_BANNERS;
  });
  const [bannerLoading, setLoading] = useState(false);
  const [bannerError, setError] = useState('');
  const requestId = useRef(0);
  const admin = pathname.startsWith('/admin');
  const token = user?.token || '';
  const request = useCallback(async (path = '', method = 'GET', body) => {
    const response = await fetch(`/api/banners${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(6000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || 'Cannot reach the banner service. Please try again.');
    return data;
  }, [token]);
  const refreshBanners = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const data = await request(admin ? '/admin' : '');
      if (id === requestId.current && Array.isArray(data.banners) && data.banners.length > 0) {
        setRecords(data.banners);
        setError('');
        try { localStorage.setItem('shophub_banners', JSON.stringify(data.banners)); } catch {}
      }
    } catch (error) {
      if (id === requestId.current) {
        // Keep existing records or fall back gracefully
        setRecords(prev => (prev && prev.length > 0 ? prev : DEFAULT_BANNERS));
      }
    } finally { if (id === requestId.current) setLoading(false); }
  }, [request, admin]);
  useEffect(() => {
    void refreshBanners();
    const refresh = () => { if (!document.hidden) void refreshBanners(); };
    window.addEventListener('focus', refresh);
    return () => { ++requestId.current; window.removeEventListener('focus', refresh); };
  }, [refreshBanners, pathname]);
  useEffect(() => {
    try {
      if (records && records.length > 0) {
        localStorage.setItem('shophub_banners', JSON.stringify(records));
      }
    } catch {}
  }, [records]);

  const saveBanner = async (banner, id) => {
    try {
      const data = await request(id ? `/${id}` : '', id ? 'PUT' : 'POST', banner);
      ++requestId.current;
      setLoading(false);
      setRecords(prev => id ? prev.map(row => row.id === id ? data.banner : row) : [...prev, data.banner]);
    } catch (err) {
      // Fallback local save if backend is unreachable
      const fallbackBanner = { ...banner, id: id || Date.now() };
      setRecords(prev => id ? prev.map(row => row.id === id ? fallbackBanner : row) : [...prev, fallbackBanner]);
    }
  };
  const deleteBanner = async id => {
    try {
      await request(`/${id}`, 'DELETE');
    } catch (err) {
      console.warn('Backend unavailable, deleting locally', err);
    }
    ++requestId.current;
    setLoading(false);
    setRecords(prev => prev.filter(row => row.id !== id));
  };
  const reorderBanners = async (ids, kind) => {
    try {
      await request('/reorder', 'PUT', { ids, kind });
    } catch (err) {
      console.warn('Backend unavailable, reordering locally', err);
    }
    ++requestId.current;
    setLoading(false);
    setRecords(prev => prev.map(row => row.kind === kind ? { ...row, position: ids.indexOf(row.id) } : row));
  };
  const sorted = [...records].sort((a, b) => a.position - b.position || a.id - b.id);
  return { banners: sorted.filter(b => b.kind === 'hero'), twoColumnBanners: sorted.filter(b => b.kind === 'promo'), bannerLoading, bannerError, refreshBanners, saveBanner, deleteBanner, reorderBanners };
}
