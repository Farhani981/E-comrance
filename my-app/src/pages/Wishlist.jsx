import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import {
  FiTrash2,
  FiShoppingCart,
  FiHeart,
  FiArrowLeft,
  FiStar,
  FiCheckCircle
} from 'react-icons/fi';

export default function Wishlist() {
  // 1. Wishlist aur Cart Context se functions aur state nikalein
  const { wishlist, toggleWishlist, loading, error, retry } = useWishlist();
  const { addToCart } = useCart();

  // 2. Move to Cart Function: Cart me add karein aur Wishlist se remove kar dein
  const handleMoveToCart = async (product) => {
    if (await addToCart(product, 1)) await toggleWishlist(product);
  };

  // 3. Agar Wishlist Khali hai (Empty State View)
  if (loading || error) return <div className="p-10 text-center">{error || 'Loading saved wishlist...'}{error && <button onClick={retry} className="ml-4 underline">Retry</button>}</div>;
  if (wishlist.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-10 md:p-16 max-w-lg mx-auto border border-slate-100 shadow-sm flex flex-col items-center">

          {/* Heart Icon Badge */}
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <FiHeart className="w-12 h-12" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
            Your Wishlist is Empty
          </h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Aap ne abhi tak koi item wishlist me save nahi kiya. Apni pasandida items ko bookmark karne ke liye explore karein!
          </p>

          <Link
            to="/"
            className="bg-black hover:bg-slate-800 text-white font-semibold px-8 py-3.5 rounded-xl transition shadow-md hover:shadow-lg inline-flex items-center gap-2"
          >
            <FiArrowLeft className="w-5 h-5" /> Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            My Wishlist
            <span className="text-sm font-semibold bg-red-100 text-red-600 px-3 py-1 rounded-full">
              {wishlist.length} {wishlist.length === 1 ? 'Item' : 'Items'}
            </span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Save your favorite items and move them to cart whenever you are ready!
          </p>
        </div>

        <Link
          to="/"
          className="text-black hover:text-slate-800 text-sm font-semibold inline-flex items-center gap-1.5 transition"
        >
          <FiArrowLeft /> Back to Shop
        </Link>
      </div>

      {/* Wishlist Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {wishlist.map((product) => {
          // Discount calculation
          const discountPercent = product.originalPrice
            ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
            : 0;

          return (
            <div
              key={product.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between group relative"
            >

              {/* Delete Button (Top Right) */}
              <button
                onClick={() => toggleWishlist(product)}
                className="absolute top-6 right-6 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow hover:bg-red-500 hover:text-white transition text-slate-400"
                title="Remove from Wishlist"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>

              <div>
                {/* Product Image Link */}
                <div className="relative aspect-3/4 w-full overflow-hidden rounded-xl mb-3 bg-slate-100 group">
                  <Link to={`/product/${product.id}`}>
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition duration-500"
                    />
                  </Link>

                  {/* Discount Badge */}
                  {discountPercent > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">
                      -{discountPercent}%
                    </span>
                  )}
                </div>

                {/* Category & Title */}
                <span className="text-[11px] font-bold tracking-wider uppercase text-black block mb-1">
                  {product.category}
                </span>

                <Link
                  to={`/product/${product.id}`}
                  className="font-semibold text-slate-800 text-base hover:text-black block truncate mb-1"
                >
                  {product.title}
                </Link>

                {/* Rating Display */}
                <div className="flex items-center gap-1.5 mb-3 text-xs">
                  <div className="flex items-center text-amber-400">
                    <FiStar className="fill-amber-400 w-3.5 h-3.5" />
                    <span className="font-bold text-slate-700 ml-1">{product.rating}</span>
                  </div>
                  <span className="text-slate-400">({product.reviewsCount})</span>
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-lg font-bold text-slate-900">${product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-slate-400 line-through">${product.originalPrice.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex gap-2">

                {/* Move to Cart Button */}
                <button
                  onClick={() => handleMoveToCart(product)}
                  className="flex-1 bg-black hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <FiShoppingCart className="w-4 h-4" /> Move to Cart
                </button>

                {/* Remove Button */}
                <button
                  onClick={() => toggleWishlist(product)}
                  className="p-2.5 text-slate-400 hover:text-red-500 border border-slate-200 rounded-xl hover:bg-red-50 transition"
                  title="Remove"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
