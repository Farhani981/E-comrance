import useShoppingStore from '../hooks/useShoppingStore';
import { normalizeStock } from '../../../shared/stock.js';
import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [couponCode, setCouponCode] = useState('');
  // `cartBump` increments whenever an item is added so UI (badge pop) can react.
  const [cartBump, setCartBump] = useState(0);
  const store = useShoppingStore('cart');
  const cart = store.items;
  const setCart = store.setGuest;
  const notifyAdd = () => setCartBump((n) => n + 1);

  // Add to Cart with size & color support
  const addToCart = async (product, quantityToAdd = 1, selectedSize = '', selectedColor = '') => {
    if (!Number.isSafeInteger(quantityToAdd) || quantityToAdd < 1) return false;
    if (!store.authenticated && !normalizeStock(product).inStock) { window.alert('This product is out of stock.'); return false; }
    if (product.hasVariants) {
      const available = (product.variants || []).filter(variant => store.authenticated || (variant.isActive && variant.stockQuantity > 0));
      const selected = product.productVariantId
        ? available.find(variant => variant.id === product.productVariantId)
        : available.find(variant => variant.options.every(option => {
          const attribute = product.attributes.find(item => item.id === option.attributeId);
          if (attribute?.type === 'color' && selectedColor) return option.label === selectedColor;
          if (['size', 'sizes'].includes(attribute?.name.toLowerCase()) && selectedSize) return option.label === selectedSize;
          return true;
        }));
      if (!selected) { window.alert('This combination is unavailable. Please choose another option on the product page.'); return false; }
      const quantityInCart = cart.find(item => item.productVariantId === selected.id)?.quantity || 0;
      if (!store.authenticated && quantityToAdd + quantityInCart > selected.stockQuantity) { window.alert(`Only ${selected.stockQuantity} units are available for this variant.`); return false; }
      product = { ...product, productVariantId: selected.id, variantOptions: selected.options, price: Number(selected.salePrice ?? selected.price), originalPrice: selected.salePrice != null ? Number(selected.price) : 0, image: selected.imageUrl, stock: selected.stockQuantity, sku: selected.sku };
      selectedSize = selected.options.find(option => ['size', 'sizes'].includes(product.attributes.find(a => a.id === option.attributeId)?.name.toLowerCase()))?.label || '';
      selectedColor = selected.options.find(option => product.attributes.find(a => a.id === option.attributeId)?.type === 'color')?.label || '';
    }
    if (store.authenticated) { notifyAdd(); return store.mutate({ action: 'add', item: { id: product.id, productVariantId: product.productVariantId || null, quantity: quantityToAdd } }); }
    const existingQuantity = cart.filter(p => p.id === product.id && (p.productVariantId || null) === (product.productVariantId || null)).reduce((sum, p) => sum + p.quantity, 0);
    if (existingQuantity + quantityToAdd > Number(product.stock)) { window.alert('Requested quantity exceeds available stock.'); return false; }
    const size = selectedSize || (product.sizes ? product.sizes[0] : 'Standard');
    const color = selectedColor || (product.colors ? product.colors[0]?.name : 'Default');
    const variantId = product.productVariantId ? `variant-${product.productVariantId}` : `product-${product.id}`;

    notifyAdd();
    return setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product.id && (item.productVariantId || null) === (product.productVariantId || null));
      if (existingIndex > -1) {
        const updatedCart = [...prevCart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: Math.min(updatedCart[existingIndex].quantity + quantityToAdd, Number(product.stock))
        };
        return updatedCart;
      }

      return [
        ...prevCart,
        {
          ...product,
          variantId,
          selectedSize: size,
          selectedColor: color,
          quantity: quantityToAdd
        }
      ];
    }).then?.(() => notifyAdd()) || notifyAdd();
  };

  // Update Item Quantity (Increment / Decrement)
  const updateQuantity = (variantId, newQuantity) => {
    if (!Number.isSafeInteger(newQuantity) || newQuantity < 0) return false;
    if (newQuantity <= 0) {
      removeFromCart(variantId);
      return;
    }

    const item = cart.find(item => item.variantId === variantId || item.id === variantId);
    if (!item) return false;
    if (store.authenticated) { notifyAdd(); return store.mutate({ action: 'set', item: { id: item.id, productVariantId: item.productVariantId, quantity: newQuantity } }); }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.variantId === variantId || item.id === variantId
          ? { ...item, quantity: Math.min(newQuantity, item.stock ?? newQuantity) }
          : item
      )
    );
  };

  // Remove from Cart
  const removeFromCart = (variantId) => {
    const item = cart.find(item => item.variantId === variantId || item.id === variantId);
    if (store.authenticated) return item ? store.mutate({ action: 'remove', item: { id: item.id, productVariantId: item.productVariantId } }) : false;
    setCart((prevCart) => prevCart.filter((item) => item.variantId !== variantId && item.id !== variantId));
  };

  // Clear Entire Cart
  const clearCart = (purchasedLines) => {
    if (store.authenticated) void store.reload();
    else if (purchasedLines) setCart(previous => previous.map(item => ({ ...item, quantity:item.quantity-(purchasedLines.find(line => line.id===item.id && (line.productVariantId || null)===(item.productVariantId || null))?.quantity || 0) })).filter(item => item.quantity>0));
    else setCart([]);
    setCouponCode('');
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        notices: store.notices, loading: store.loading, error: store.error, retry: store.reload,
        cartCount, cartBump, couponCode, setCouponCode
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
