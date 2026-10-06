import React from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowLeft, FiShoppingBag } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 md:p-16 max-w-lg w-full shadow-lg flex flex-col items-center">
        <div className="w-24 h-24 bg-slate-50 border border-slate-200 text-slate-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <FiAlertCircle className="w-12 h-12" />
        </div>

        <span className="text-6xl font-extrabold text-slate-900 mb-2">404</span>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Oops! The page you are looking for does not exist or has been moved.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="bg-black hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition shadow-md flex items-center gap-2 text-xs"
          >
            <FiArrowLeft /> Go to Home Page
          </Link>
          <Link
            to="/shop"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition shadow-md flex items-center gap-2 text-xs"
          >
            <FiShoppingBag /> Browse Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
