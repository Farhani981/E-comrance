import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FiAward, 
  FiTruck, 
  FiShield, 
  FiUsers, 
  FiShoppingBag,
  FiArrowRight
} from 'react-icons/fi';
import logo from '../assets/logo.png';

export default function About() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      
      {/* Hero Header Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-extrabold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
          <FiAward /> Premium Men's Lifestyle & Fashion
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
          Redefining Quality & Elegance for Modern Men
        </h1>
        <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
          ShopHub is Pakistan’s leading curated online store dedicated to high-quality men's apparel, footwear, leather goods, traditional attire, and tech accessories.
        </p>
      </div>

      {/* Brand Values Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm hover:shadow-xl transition group">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-500 group-hover:text-white transition">
            <FiShield className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">100% Original Products</h3>
          <p className="text-slate-500 text-sm">
            We partner directly with verified master craftsmen and brands to ensure zero compromise on material & stitching quality.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm hover:shadow-xl transition group">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-500 group-hover:text-white transition">
            <FiTruck className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Express Countrywide Delivery</h3>
          <p className="text-slate-500 text-sm">
            Fast 2-4 business day delivery across Karachi, Lahore, Islamabad, Rawalpindi, and 100+ cities nationwide.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm hover:shadow-xl transition group">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-500 group-hover:text-white transition">
            <FiUsers className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">50,000+ Happy Customers</h3>
          <p className="text-slate-500 text-sm">
            Trusted by thousands of satisfied buyers with a 7-day hassle-free return and exchange policy.
          </p>
        </div>

      </div>

      {/* Stats Counter Section */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 mb-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        <div>
          <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 block mb-1">500+</span>
          <span className="text-xs sm:text-sm text-slate-400 font-medium uppercase tracking-wider">Products Catalog</span>
        </div>
        <div>
          <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 block mb-1">99.4%</span>
          <span className="text-xs sm:text-sm text-slate-400 font-medium uppercase tracking-wider">Positive Reviews</span>
        </div>
        <div>
          <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 block mb-1">24/7</span>
          <span className="text-xs sm:text-sm text-slate-400 font-medium uppercase tracking-wider">Customer Support</span>
        </div>
        <div>
          <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 block mb-1">7 Days</span>
          <span className="text-xs sm:text-sm text-slate-400 font-medium uppercase tracking-wider">Easy Exchange</span>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-amber-100 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-200">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Ready to Upgrade Your Wardrobe?</h2>
          <p className="text-slate-700 text-sm">Explore our newest arrivals and claim 10% OFF your first purchase with code WELCOME10.</p>
        </div>
        <Link
          to="/shop"
          className="bg-slate-900 hover:bg-amber-600 text-white font-bold px-8 py-3.5 rounded-xl transition shadow-lg shrink-0 inline-flex items-center gap-2"
        >
          Shop New Arrivals <FiArrowRight />
        </Link>
      </div>

    </div>
  );
}
