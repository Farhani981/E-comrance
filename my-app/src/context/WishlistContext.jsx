import React, { createContext, useContext } from 'react';
import useShoppingStore from '../hooks/useShoppingStore';
const WishlistContext = createContext();
export const WishlistProvider = ({ children }) => {
  const store = useShoppingStore('wishlist');
  const wishlist = store.items;
  const isInWishlist = id => wishlist.some(item => item.id === id);
  const toggleWishlist = async product => {
    const exists = isInWishlist(product.id);
    if (store.authenticated) return store.mutate({ action: exists ? 'remove' : 'add', item: { id: product.id } });
    return store.setGuest(previous => exists ? previous.filter(item => item.id !== product.id) : [...previous, product]);
  };
  return <WishlistContext.Provider value={{ wishlist, toggleWishlist, isInWishlist, wishlistCount: wishlist.length, loading: store.loading, error: store.error, retry: store.reload }}>{children}</WishlistContext.Provider>;
};
export const useWishlist = () => useContext(WishlistContext);
