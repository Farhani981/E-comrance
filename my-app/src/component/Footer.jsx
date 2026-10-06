import useStoreInfo from '../hooks/useStoreInfo';
import React from "react";
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const Footer = () => {
  const settings = useStoreInfo();
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Main Grid Section */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          
          <div className="shrink-0 lg:col-span-2">
            <div className="flex items-center gap-3">
              <img src={(typeof settings?.logo === 'string' && settings.logo.trim() !== '') ? settings.logo : logo} alt={settings?.storeName || 'ShopHub'} className="h-12 w-auto object-contain" />
              <Link to="/" className="text-3xl font-bold tracking-tight text-white no-underline">
                {settings?.storeName || 'ShopHub'}
              </Link>
            </div>
            <p className="mt-4 max-w-sm text-sm text-gray-400">
              Your trusted online destination for premium men's clothing, footwear, traditional attire, and lifestyle accessories across Pakistan.
            </p>
            <div className="mt-6 flex gap-4">
              {/* Social Links */}
              {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>}
              {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>}
              {settings?.tiktok && <a href={settings.tiktok} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white">TikTok</a>}
            </div>
          </div>

          {/* Shop Categories */}
          <div>
            <p className="font-semibold text-white tracking-wider uppercase text-sm">Shop Catalog</p>
            <ul className="mt-4 space-y-2.5 text-sm p-0 m-0 list-none">
              <li><Link to="/shop" className="hover:text-white transition no-underline text-gray-400">New Arrivals</Link></li>
              <li><Link to="/shop?category=Topwear" className="hover:text-white transition no-underline text-gray-400">Topwear Shirts</Link></li>
              <li><Link to="/shop?category=Bottomwear" className="hover:text-white transition no-underline text-gray-400">Bottomwear Jeans</Link></li>
              <li><Link to="/shop?category=Eastern Wear" className="hover:text-white transition no-underline text-gray-400">Eastern Suits</Link></li>
              <li><Link to="/shop?category=Footwear" className="hover:text-white transition no-underline text-gray-400">Men's Footwear</Link></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <p className="font-semibold text-white tracking-wider uppercase text-sm">Customer Care</p>
            <ul className="mt-4 space-y-2.5 text-sm p-0 m-0 list-none">
              <li><Link to="/orders" className="hover:text-white transition no-underline text-gray-400">Track Your Order</Link></li>
              <li><Link to="/policies?tab=shipping" className="hover:text-white transition no-underline text-gray-400">Shipping Policy</Link></li>
              <li><Link to="/policies?tab=returns" className="hover:text-white transition no-underline text-gray-400">Returns & Exchanges</Link></li>
              <li><Link to="/faq" className="hover:text-white transition no-underline text-gray-400">FAQs</Link></li>
              <li><Link to="/contact" className="hover:text-white transition no-underline text-gray-400">Contact Us</Link></li>
            </ul>
          </div>

          {/* Quick Links & Legal */}
          <div>
            <p className="font-semibold text-white tracking-wider uppercase text-sm">Company & Legal</p>
            <ul className="mt-4 space-y-2.5 text-sm p-0 m-0 list-none">
              <li><Link to="/about" className="hover:text-white transition no-underline text-gray-400">About Us</Link></li>
              <li><Link to="/policies?tab=privacy" className="hover:text-white transition no-underline text-gray-400">Privacy Policy</Link></li>
              <li><Link to="/policies?tab=terms" className="hover:text-white transition no-underline text-gray-400">Terms of Service</Link></li>
              <li><Link to="/account" className="hover:text-white transition no-underline text-gray-400">My Account</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Payment Badges */}
        <div className="mt-12 border-t border-gray-800 pt-8 sm:flex sm:items-center sm:justify-between text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} {settings?.storeName || 'ShopHub'} Inc. All rights reserved.</p>
          
          <div className="mt-4 sm:mt-0 flex gap-4 text-gray-400 font-semibold">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>EasyPaisa / JazzCash</span>
            <span>Cash on Delivery</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;