import useMensCatalog from '../hooks/useMensCatalog';
import useBannerCatalog from '../hooks/useBannerCatalog';
import { normalizeProduct } from '../utils/catalog';
import { useLocation } from 'react-router-dom';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { products as initialProductsData, categories as initialCategoriesData } from '../productsData';

const ProductContext = createContext();

const API_BASE_URL = '/api';
const persistCollection = (key, value, label) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') {
      console.error(`Failed to save ${label} to localStorage`, error);
      return;
    }

    const withoutUploadedImages = value.map(item => ({
      ...item,
      ...(typeof item.img === 'string' && item.img.startsWith('data:') ? { img: '' } : {}),
      ...(typeof item.image === 'string' && item.image.startsWith('data:') ? { image: '' } : {}),
      ...(Array.isArray(item.images)
        ? { images: item.images.filter(image => typeof image !== 'string' || !image.startsWith('data:')) }
        : {}),
    }));

    try {
      localStorage.setItem(key, JSON.stringify(withoutUploadedImages));
      console.warn(`Some uploaded images were not persisted for ${label} because browser storage is full.`);
    } catch (fallbackError) {
      console.warn(`Could not persist ${label}; browser storage is full.`, fallbackError);
    }
  }
};

export const ProductProvider = ({ children }) => {
  const { pathname } = useLocation();
  const mensCatalog = useMensCatalog(pathname);
  // 1. Products State (localStorage synced)
  const [products, setProducts] = useState(() => {
    try {
      const savedProducts = localStorage.getItem('shophub_products');
      if (savedProducts) {
        const parsed = JSON.parse(savedProducts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeProduct);
        }
      }
      return initialProductsData.map(normalizeProduct);
    } catch {
      return initialProductsData.map(normalizeProduct);
    }
  });

  // 2. Categories State (localStorage synced)
  const [categories, setCategories] = useState(() => {
    try {
      const savedCategories = localStorage.getItem('shophub_categories');
      if (savedCategories) {
        const parsed = JSON.parse(savedCategories);
        // Check if saved categories have the required img field (new format).
        // If not (old format without img), discard and use fresh initialCategoriesData.
        const hasImgField = Array.isArray(parsed) && parsed.length > 0 && parsed[0].img;
        if (hasImgField) {
          return parsed;
        }
      }
      // Clear stale/broken cached categories so fresh data is saved
      localStorage.removeItem('shophub_categories');
      return initialCategoriesData;
    } catch {
      return initialCategoriesData;
    }
  });

  const bannerCatalog = useBannerCatalog(pathname);

  const [loading, setLoading] = useState(false);

  // Sync state changes to localStorage
  useEffect(() => {
    persistCollection('shophub_products', products, 'products');
  }, [products]);

  useEffect(() => {
    persistCollection('shophub_categories', categories, 'categories');
  }, [categories]);



  // Try fetching products from backend API if reachable
  useEffect(() => {
    let cancelled = false;
    const fetchApiProducts = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/products`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.products)) {
            const formatted = data.products.map(p => {
              const productAttributes = p.attributes || [];
              return normalizeProduct({
                id: p.id,
                attributes: productAttributes,
                variants: p.variants || [], hasVariants: p.hasVariants,
                title: p.name || p.title,
                price: Number(p.price) || 0,
                originalPrice: Number(p.original_price ?? p.originalPrice) || 0,
                category: p.category_name || p.category || 'Eastern Wear',
                subCategory: p.subcategory || p.subCategory || '',
                sku: p.sku || '',
                categorySlug: p.category_slug, subcategorySlug: p.subcategory_slug, productTypeSlug: p.product_type_slug,
                productType: p.product_type || '', fit: p.fit || '', occasion: p.occasion || '',
                createdAt: p.created_at,
                rating: p.rating != null && !Number.isNaN(Number(p.rating)) ? Number(p.rating) : 0,
                reviewsCount: p.reviews_count != null ? Number(p.reviews_count) : (p.reviewsCount != null ? Number(p.reviewsCount) : 0),
                inStock: (p.stock !== undefined ? p.stock > 0 : true) && p.status !== 'Out of Stock',
                stock: Number(p.stock ?? 0),
                sizes: p.sizes || [],
                colors: p.colors || [],
                image: p.image || 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800',
                images: p.images || [p.image || 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800'],
                description: p.description || '',
                features: p.features || ['Premium Quality Fabric', 'Tailored Fit', 'Wrinkle Resistant'],
                status: p.status || (p.stock < 10 ? 'Low Stock' : 'Active')
              });
            });

            if (!cancelled) setProducts(formatted);
          }
        }
      } catch (err) {
        console.log('Using local products data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const fetchApiCategories = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/categories`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.categories)) {
            const formatted = data.categories.map(c => ({
              id: c.id,
              name: c.name,
              count: c.count,
              img: c.img,
              link: c.link,
              isVisible: c.isVisible !== undefined ? Boolean(c.isVisible) : true
            }));
            
            if (!cancelled) setCategories(formatted);
          }
        }
      } catch (err) {
        console.log('Using local categories data');
      }
    };

    fetchApiProducts();
    fetchApiCategories();
    window.addEventListener('products-updated', fetchApiProducts);
    window.addEventListener('focus', fetchApiProducts);
    return () => {
      cancelled = true;
      window.removeEventListener('products-updated', fetchApiProducts);
      window.removeEventListener('focus', fetchApiProducts);
    };
  }, [pathname]);

  const getAuthToken = () => {
    try {
      const user = localStorage.getItem('shophub_user');
      if (user) {
        const parsed = JSON.parse(user);
        return parsed.token || '';
      }
    } catch {
      return '';
    }
    return '';
  };

  const attachCatalogSlugs = product => {
    const parent = mensCatalog.catalogTree.find(p=>p.name===product.category);
    const child = parent?.children.find(s=>s.name===product.subCategory);
    const type = child?.children.find(t=>t.name===product.productType);
    return {...product,categorySlug:parent?.slug,subcategorySlug:child?.slug,productTypeSlug:type?.slug};
  };
  // Add Product — persist to the backend before updating the local state
  const addProduct = async (productData) => {
    const attributes = productData.attributes || [];
    const newProduct = normalizeProduct({
      id: Date.now(),
      attributes,
      title: productData.title || productData.name,
      price: Number(productData.price) || 0,
      originalPrice: Number(productData.originalPrice ?? productData.original_price) || 0,
      category: productData.category || 'Topwear',
      subCategory: productData.subCategory || productData.category || 'General',
      productType: productData.productType || '', fit: productData.fit || '', occasion: productData.occasion || '',
      rating: 5.0,
      reviewsCount: 0,
      inStock: productData.status !== 'Out of Stock' && Number(productData.stock) > 0,
      stock: Number(productData.stock ?? 0),
      sku: productData.sku || `SKU-${Date.now().toString().slice(-4)}`,
      sizes: productData.sizes || [],
      colors: productData.colors || [],
      image: productData.image || 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800',
      images: [productData.image || 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800'],
      description: productData.description || 'Premium high quality fabric product.',
      features: productData.features || ['Premium Quality Fabric', 'Modern Tailored Fit', '100% Satisfaction Guarantee'],
      status: productData.status || (Number(productData.stock) < 10 ? 'Low Stock' : 'Active'),
      createdAt: new Date().toISOString()
    });

    try {
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: productData.title || productData.name,
          attributes: productData.attributes || [],
          variants: productData.variants,
          sku: productData.sku,
          category_name: newProduct.category,
          subcategory: newProduct.subCategory,
          product_type: newProduct.productType, fit: newProduct.fit, occasion: newProduct.occasion,
          price: productData.price,
          original_price: productData.originalPrice,
          stock: productData.stock,
          image: productData.image,
          description: productData.description,
          status: productData.status,
        })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || `Product could not be saved (HTTP ${res.status})`);
      }

      if (resData.productId) newProduct.id = resData.productId;
      Object.assign(newProduct, normalizeProduct({ ...newProduct, attributes: resData.attributes || [] }));
      if (resData.product) Object.assign(newProduct, normalizeProduct({ ...newProduct, ...resData.product, title: resData.product.name, originalPrice: resData.product.original_price }));
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Backend is not reachable. Start the server and try again.');
      }
      throw error;
    }

    setProducts(prev => [attachCatalogSlugs(newProduct), ...prev]);
    return newProduct;
  };

  const mutateCatalog = async (path, method, body) => {
    const response = await fetch(API_BASE_URL + path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getAuthToken() },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Catalog could not be saved.');
    return data;
  };
  const updateProduct = async (id, fields) => {
    const current = products.find(p => String(p.id) === String(id));
    const product = normalizeProduct({
      ...current,
      ...fields,
      categorySlug: undefined,
      subcategorySlug: undefined,
      productTypeSlug: undefined,

    });
    const saved = await mutateCatalog('/products/' + id, 'PUT', {
      attributes: product.attributes,
      variants: fields.variants,
      name: product.title, sku: product.sku, category_name: product.category,
      product_type: product.productType, fit: product.fit, occasion: product.occasion,
      subcategory: product.subCategory, price: product.price, original_price: product.originalPrice,
      stock: product.stock, image: product.image, description: product.description, status: product.status
    });
    const updatedAttributes = saved.attributes ?? product.attributes ?? current?.attributes ?? [];

    setProducts(prev => prev.map(p => String(p.id) === String(id) ? attachCatalogSlugs(normalizeProduct({
      ...product,
      ...saved.product,
      originalPrice: saved.product?.original_price,
      attributes: updatedAttributes,

    })) : p));
  };
  const deleteProduct = async id => {
    await mutateCatalog('/products/' + id, 'DELETE');
    setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
  };
  const addCategory = async category => {
    const data = await mutateCatalog('/categories', 'POST', category);
    setCategories(prev => [...prev, data.category]);
    return data.category;
  };
  const updateCategory = async (id, fields) => {
    await mutateCatalog('/categories/' + id, 'PUT', fields);
    setCategories(prev => prev.map(c => String(c.id) === String(id) ? { ...c, ...fields } : c));
  };
  const deleteCategory = async id => {
    await mutateCatalog('/categories/' + id, 'DELETE');
    setCategories(prev => prev.filter(c => String(c.id) !== String(id)));
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        setProducts,
        categories,
        setCategories,
        ...bannerCatalog,
        ...mensCatalog,
        loading,
        addProduct,
        updateProduct,
        deleteProduct,
        addCategory,
        updateCategory,
        deleteCategory
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
