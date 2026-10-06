import { submitContact } from '../utils/contact';
import useStoreInfo from '../hooks/useStoreInfo';
import React, { useState, useRef } from 'react';
import {
  FiMail,
  FiPhone,
  FiMapPin,
  FiClock,
  FiSend,
  FiCheckCircle,
  FiHelpCircle
} from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function Contact() {
  const settings = useStoreInfo();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setSending(true); setError(''); setSubmitted(false);
    try {
      await submitContact(formData);
      setSubmitted(true); setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (e) { setError(e.message || 'Unable to submit your message. Please try again.'); }
    finally { inFlight.current = false; setSending(false); }
  };



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
          Get in Touch With Us
        </h1>
        <p className="text-slate-600 text-sm sm:text-base">
          Have a question about an order, sizing, shipping, or returns? Our customer care team is here to assist you 24/7.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* LEFT COLUMN: Contact Cards */}
        <div className="space-y-6">

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
              <FiPhone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Phone & WhatsApp</h3>
              <p className="text-slate-600 text-xs mb-1">{settings?.contactPhone ?? '+92 300 1234567'}</p>
              {settings?.whatsapp && settings.whatsapp !== settings.contactPhone && <p className="text-slate-600 text-xs mb-1">WhatsApp: {settings.whatsapp}</p>}
              <p className="text-slate-400 text-[11px]">Mon - Sat: 9:00 AM - 9:00 PM</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
              <FiMail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Email Support</h3>
              <p className="text-slate-600 text-xs mb-1">{settings?.contactEmail ?? 'support@shophub.com.pk'}</p>
              <p className="text-slate-400 text-[11px]">Average response time: 2 hours</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
              <FiMapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Head Office</h3>
              <p className="text-slate-600 text-xs">
                {settings?.address ?? 'Plot #45, Main Boulevard, Gulberg III, Lahore, Pakistan'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 text-center">
            <FiHelpCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h4 className="font-bold text-slate-900 text-sm mb-1">Looking for Instant Answers?</h4>
            <p className="text-xs text-slate-500 mb-3">Check out our frequently asked questions for immediate help.</p>
            <Link to="/faq" className="text-xs font-bold text-amber-600 hover:underline">
              View FAQs Page →
            </Link>
          </div>

        </div>

        {/* RIGHT 2 COLUMNS: Contact Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Send Us a Message</h2>

            {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
            {submitted && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-medium animate-bounce">
                <FiCheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                Thank you! Your message has been received and is available to our team.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Farhan Ali"
                    maxLength={100}
                    disabled={sending}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-slate-800 focus:bg-slate-50 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="farhan@example.com"
                    maxLength={255}
                    disabled={sending}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-slate-800 focus:bg-slate-50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Order status inquiry, product question, etc."
                  maxLength={200}
                  disabled={sending}
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-slate-800 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Message *
                </label>
                <textarea
                  required
                  rows="4"
                  placeholder="Write your message here in detail..."
                  maxLength={5000}
                  disabled={sending}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-slate-800 focus:bg-white transition resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="bg-black hover:bg-slate-800 text-white font-bold py-3.5 px-8 rounded-xl transition shadow-md flex items-center gap-2"
              >
                <FiSend /> {sending ? 'Submitting...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
