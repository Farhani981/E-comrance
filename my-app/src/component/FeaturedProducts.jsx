import React from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useCart } from '../context/CartContext';

export default function FeaturedProducts() {
  const { products } = useProducts();
  const { addToCart } = useCart();

  return (
    
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-start mb-10">
        <h2 className="text-3xl font-bold text-slate-800">Featured Products</h2>
        <p className="text-slate-500 text-sm mt-1">Explore our top selling products and exclusive deals</p>
      </div>

      {(!products || products.length === 0) ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">No products available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border border-slate-200 rounded-2xl shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 ease-in-out group flex flex-col justify-between h-full bg-white overflow-hidden"
            >
              {/* TOP CONTENT SECTION */}
              <div>
                <Link to={`/product/${product.id}`} className="relative block overflow-hidden rounded-t-2xl">
                  <div className="w-full h-62.5 overflow-hidden bg-slate-50">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover object-center transition duration-300 cursor-pointer"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800';
                      }}
                    />
                  </div>
                  {product.originalPrice > product.price && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </span>
                  )}
                </Link>

                {/* Category Badge */}
                {product.category && (
                  <span className="inline-block text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full mb-1 mt-4 ml-4">
                    {product.category}
                  </span>
                )}

                {/* Title with fixed minimum height */}
                <Link
                  to={`/product/${product.id}`}
                  className="font-semibold text-slate-800 text-base hover:text-black block line-clamp-2 min-h-[2.8rem] leading-snug px-4"
                >
                  {product.title}
                </Link>

                {/* Description with line clamp and min height */}
                <p className="text-slate-500 text-xs mt-2 line-clamp-2 min-h-8 px-4">
                  {product.description}
                </p>
              </div>

              {/* BOTTOM PRICE & BUTTON SECTION */}
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 px-4 pb-4">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-black">
                    Rs.{Number(product.price || 0).toLocaleString()}
                  </span>
                  {product.originalPrice > product.price && (
                    <span className="text-xs text-slate-500 line-through">
                      Rs.{Number(product.originalPrice || 0).toLocaleString()}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => addToCart(product)}
                  className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition active:scale-95 shadow-sm"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
