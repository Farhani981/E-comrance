import useStoreInfo, { shippingDescription } from '../hooks/useStoreInfo';
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiShield, FiTruck, FiRotateCcw, FiFileText } from 'react-icons/fi';

export default function Policies() {
  const settings = useStoreInfo();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'shipping';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      
      {/* Policy Selector Tabs */}
      <div className="flex flex-wrap gap-2 justify-center mb-10 pb-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'shipping'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FiTruck /> Shipping Policy
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'returns'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FiRotateCcw /> Returns & Exchanges
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'privacy'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FiShield /> Privacy Policy
        </button>

        <button
          onClick={() => setActiveTab('terms')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'terms'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FiFileText /> Terms of Service
        </button>
      </div>

      {/* Policy Content Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-6 text-slate-700 leading-relaxed text-sm">
        
        {activeTab === 'shipping' && (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <FiTruck className="text-amber-500" /> Shipping & Delivery Policy
            </h2>
            <p className="mb-4">
              ShopHub delivers products nationwide across Pakistan. We work with reliable courier partners to ensure safe and swift delivery.
            </p>
            <h3 className="font-bold text-slate-900 text-base mb-2">1. Delivery Timelines</h3>
            <ul className="list-disc pl-5 space-y-1.5 mb-4 text-xs sm:text-sm">
              <li><strong>Major Cities:</strong> 2 to 4 business days (Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad).</li>
              <li><strong>Other Cities & Rural Areas:</strong> 3 to 5 business days.</li>
            </ul>

            <h3 className="font-bold text-slate-900 text-base mb-2">2. Shipping Charges</h3>
            <p>
              {shippingDescription(settings)}
            </p>
          </div>
        )}

        {activeTab === 'returns' && (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <FiRotateCcw className="text-amber-500" /> Returns & Exchange Policy
            </h2>
            <p className="mb-4">
              We want you to be 100% satisfied with your purchase. If a product does not fit or arrives with a manufacturing defect, you can exchange or return it within 7 days.
            </p>
            <h3 className="font-bold text-slate-900 text-base mb-2">Conditions for Returns:</h3>
            <ul className="list-disc pl-5 space-y-1.5 mb-4 text-xs sm:text-sm">
              <li>Item must be unused, unwashed, and in its original packaging with all tags intact.</li>
              <li>Return request must be initiated within 7 days of receiving the package.</li>
              <li>Sale / Clearance items can only be exchanged for size adjustment.</li>
            </ul>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <FiShield className="text-amber-500" /> Privacy & Data Protection Policy
            </h2>
            <p className="mb-4">
              Your privacy is extremely important to us. We collect customer information solely to process orders, improve shopping experiences, and provide customer support.
            </p>
            <h3 className="font-bold text-slate-900 text-base mb-2">Information We Collect:</h3>
            <p className="text-xs sm:text-sm mb-4">
              Name, delivery address, email, phone number, and order details. We do NOT store payment card credentials on our servers.
            </p>
          </div>
        )}

        {activeTab === 'terms' && (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <FiFileText className="text-amber-500" /> Terms of Service
            </h2>
            <p className="mb-4">
              By accessing or making a purchase on ShopHub, you agree to comply with our standard ecommerce terms of service.
            </p>
            <p className="text-xs sm:text-sm">
              Prices and availability of products are subject to change without prior notice. We reserve the right to decline orders containing pricing errors or stock discrepancies.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
