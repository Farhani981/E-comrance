import useStoreInfo, { shippingDescription } from '../hooks/useStoreInfo';
import React, { useState } from 'react';
import { FiChevronDown, FiHelpCircle, FiSearch } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function Faq() {
  const settings = useStoreInfo();
  const [openIndex, setOpenIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      q: 'How long does delivery take across Pakistan?',
      a: 'Standard shipping takes 2 to 4 business days for major cities like Lahore, Karachi, Islamabad, and Rawalpindi. Remote locations may take 3-5 business days.'
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We offer Cash on Delivery (COD) nationwide, as well as Visa & MasterCard online card payments.'
    },
    {
      q: 'How do I return or exchange an item?',
      a: `We offer a 7-day hassle-free return and exchange policy. Contact our support team on WhatsApp (${settings?.whatsapp ?? '+92 300 1234567'}) or email ${settings?.contactEmail ?? 'support@shophub.com.pk'} with your Order ID.`
    },
    {
      q: 'How can I track my order status?',
      a: 'You can check your order status on the Order History & Tracking page using your Order ID (e.g., SH-849201).'
    },
    {
      q: 'Are all products 100% original and high quality?',
      a: 'Yes, absolutely. We source high-grade materials (Egyptian cotton, full-grain leather, UV-400 optics) and inspect every single item prior to dispatch.'
    },
    {
      q: 'What is the minimum order for Free Shipping?',
      a: shippingDescription(settings)
    }
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      
      {/* Page Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase">
          <FiHelpCircle /> FAQs & Knowledge Base
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
          Frequently Asked Questions
        </h1>
        <p className="text-slate-600 text-sm">
          Find instant answers to common questions about shipping, returns, sizing, and order tracking.
        </p>

        {/* Search input */}
        <div className="relative max-w-md mx-auto mt-6">
          <input
            type="text"
            placeholder="Type keyword e.g. delivery, returns, size..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-4 pr-10 text-sm focus:outline-none focus:border-amber-500 shadow-sm"
          />
          <FiSearch className="absolute right-3.5 top-3.5 text-slate-400 w-5 h-5" />
        </div>
      </div>

      {/* Accordion FAQ List */}
      <div className="space-y-4">
        {filteredFaqs.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm">No FAQs found matching "{searchQuery}".</p>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between font-bold text-slate-900 text-base focus:outline-none hover:bg-slate-50 transition gap-4"
                >
                  <span>{faq.q}</span>
                  <FiChevronDown
                    className={`w-5 h-5 text-amber-500 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-slate-600 text-sm leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Contact Prompt */}
      <div className="mt-12 text-center bg-amber-50 rounded-3xl p-8 border border-amber-200">
        <h3 className="font-bold text-slate-900 text-lg mb-1">Still have questions?</h3>
        <p className="text-slate-600 text-xs mb-4">Can't find what you're looking for? Reach out directly to our friendly support team.</p>
        <Link
          to="/contact"
          className="bg-slate-900 hover:bg-amber-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition inline-block shadow-md"
        >
          Contact Customer Care
        </Link>
      </div>

    </div>
  );
}
