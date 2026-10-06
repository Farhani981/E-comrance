import React, { useEffect, useState } from 'react';
import {
  FiLayout,
  FiImage,
  FiHelpCircle,
  FiFileText,
  FiShare2,
  FiCheckCircle,
  FiSave,
  FiPlus,
  FiTrash2,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiExternalLink
} from 'react-icons/fi';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { useAuth } from '../../context/AuthContext';
import MetricGrid, { StatCard } from '../../component/MetricGrid';

interface Banner {
  id: number;
  title: string;
  description?: string;
  buttonText?: string;
  image: string;
  isActive: boolean;
  position?: number;
}

interface FaqItem {
  id: number;
  q: string;
  a: string;
  category: string;
}

const DEFAULT_FAQS: FaqItem[] = [
  { id: 1, q: 'What payment methods do you accept?', a: 'We accept Cash on Delivery (COD) across Pakistan, as well as Visa, MasterCard, and local debit/credit cards.', category: 'Payments' },
  { id: 2, q: 'How long does nationwide delivery take?', a: 'Deliveries to Lahore, Karachi, and Islamabad take 1-3 business days. Other cities and remote regions take 3-5 days.', category: 'Shipping' },
  { id: 3, q: 'What is your return or exchange policy?', a: 'We offer a hassle-free 7-day return and exchange policy for unworn items in original packaging with tags intact.', category: 'Returns' },
  { id: 4, q: 'How can I track my dispatched parcel?', a: 'Use your Order ID on our Track Order page or click the courier tracking link sent via order status update.', category: 'Orders' },
];

export default function ManageWebsite() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();

  const [activeTab, setActiveTab] = useState<'banners' | 'sections' | 'faqs' | 'social'>('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>(() => {
    try {
      const saved = localStorage.getItem('shophub_admin_faqs');
      return saved ? JSON.parse(saved) : DEFAULT_FAQS;
    } catch {
      return DEFAULT_FAQS;
    }
  });

  const [sectionsConfig, setSectionsConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('shophub_sections_config');
      return saved ? JSON.parse(saved) : {
        topAnnouncement: true,
        announcementText: '✨ FREE EXPRESS DELIVERY ON ORDERS OVER RS. 2,000 NATIONWIDE!',
        showCategories: true,
        showFeaturedProducts: true,
        showPromotionalBanners: true,
        showLogoCarousel: true,
      };
    } catch {
      return {
        topAnnouncement: true,
        announcementText: '✨ FREE EXPRESS DELIVERY ON ORDERS OVER RS. 2,000 NATIONWIDE!',
        showCategories: true,
        showFeaturedProducts: true,
        showPromotionalBanners: true,
        showLogoCarousel: true,
      };
    }
  });

  const [socialConfig, setSocialConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('shophub_social_config');
      return saved ? JSON.parse(saved) : {
        whatsapp: '+92 300 1234567',
        facebook: 'https://facebook.com/shophub.pk',
        instagram: 'https://instagram.com/shophub.pk',
        tiktok: 'https://tiktok.com/@shophub.pk',
        footerDescription: "ShopHub is Pakistan's premier destination for contemporary men's lifestyle, apparel, footwear, and accessories.",
      };
    } catch {
      return {
        whatsapp: '+92 300 1234567',
        facebook: 'https://facebook.com/shophub.pk',
        instagram: 'https://instagram.com/shophub.pk',
        tiktok: 'https://tiktok.com/@shophub.pk',
        footerDescription: "ShopHub is Pakistan's premier destination for contemporary men's lifestyle, apparel, footwear, and accessories.",
      };
    }
  });

  const [isAddingFaq, setIsAddingFaq] = useState(false);
  const [newFaq, setNewFaq] = useState({ q: '', a: '', category: 'General' });

  // Fetch Banners from API
  useEffect(() => {
    fetch('/api/banners')
      .then(res => res.json())
      .then(data => {
        if (data.success) setBanners(data.banners || []);
      })
      .catch(console.error);
  }, []);

  const saveSections = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('shophub_sections_config', JSON.stringify(sectionsConfig));
    showAlert('Homepage section settings saved successfully.', 'success', 'Saved');
  };

  const saveSocial = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('shophub_social_config', JSON.stringify(socialConfig));
    showAlert('Footer & Social channels configuration saved.', 'success', 'Saved');
  };

  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaq.q.trim() || !newFaq.a.trim()) return;
    const updated = [...faqs, { ...newFaq, id: Date.now() }];
    setFaqs(updated);
    localStorage.setItem('shophub_admin_faqs', JSON.stringify(updated));
    showAlert('New FAQ question added successfully.', 'success', 'Added');
    setNewFaq({ q: '', a: '', category: 'General' });
    setIsAddingFaq(false);
  };

  const handleDeleteFaq = (id: number) => {
    const updated = faqs.filter(f => f.id !== id);
    setFaqs(updated);
    localStorage.setItem('shophub_admin_faqs', JSON.stringify(updated));
    showAlert('FAQ question removed.', 'success', 'Deleted');
  };

  const toggleBannerStatus = async (banner: Banner) => {
    try {
      const nextActive = !banner.isActive;
      const res = await fetch(`/api/banners/${banner.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`
        },
        body: JSON.stringify({ ...banner, isActive: nextActive })
      });
      if (res.ok) {
        setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, isActive: nextActive } : b));
        showAlert(`Banner is now ${nextActive ? 'Visible' : 'Hidden'}.`, 'success', 'Banner Updated');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FiLayout className="text-amber-500" /> Website Management & Content
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Control your storefront layout, hero campaign sliders, promotional cards, FAQs, and social links.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <MetricGrid cols={4}>
        <StatCard
          label="Hero Campaign Slides"
          value={String(banners.length)}
          icon={<FiImage size={20} />}
          sub="Live carousel items"
          accent="amber"
        />
        <StatCard
          label="Homepage Sections"
          value="5 Active"
          icon={<FiLayout size={20} />}
          sub="Announcement, Hero, Shop"
          accent="blue"
        />
        <StatCard
          label="Published FAQs"
          value={String(faqs.length)}
          icon={<FiHelpCircle size={20} />}
          sub="Customer help questions"
          accent="emerald"
        />
        <StatCard
          label="Social Channels"
          value="4 Connected"
          icon={<FiShare2 size={20} />}
          sub="WhatsApp, IG, FB, TikTok"
          accent="purple"
        />
      </MetricGrid>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'banners'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiImage /> Hero & Promotional Banners ({banners.length})
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'sections'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiLayout /> Homepage Layout & Sections
        </button>
        <button
          onClick={() => setActiveTab('faqs')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'faqs'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiHelpCircle /> FAQs Management ({faqs.length})
        </button>
        <button
          onClick={() => setActiveTab('social')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'social'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiShare2 /> Footer & Social Channels
        </button>
      </div>

      {/* Tab 1: Banners */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Storefront Hero Sliders</h3>
              <p className="text-xs text-slate-500">Manage high-resolution promotional banners displayed at the top of the homepage.</p>
            </div>
            <a
              href="/admin/banners"
              className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition inline-flex items-center gap-1.5"
            >
              Open Full Banner Editor <FiExternalLink />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {banners.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-44 w-full relative overflow-hidden bg-slate-100">
                    <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                    <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${
                      b.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {b.isActive ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h4 className="font-extrabold text-slate-900 text-base mb-1">{b.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{b.description || 'Campaign slide on homepage.'}</p>
                  </div>
                </div>
                <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <button
                    onClick={() => toggleBannerStatus(b)}
                    className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1"
                  >
                    {b.isActive ? <><FiEyeOff /> Hide Slide</> : <><FiEye /> Publish</>}
                  </button>
                  <span className="text-[11px] font-bold text-slate-400">Position #{b.position || 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Homepage Sections */}
      {activeTab === 'sections' && (
        <form onSubmit={saveSections} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-2xl">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-900 text-base">Homepage Sections Visibility</h3>
            <p className="text-xs text-slate-500">Toggle sections displayed on the main customer storefront landing page.</p>
          </div>

          <div>
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 text-sm block">Top Announcement Notification Bar</span>
                <span className="text-xs text-slate-400">Floating banner at the very top of all store pages</span>
              </div>
              <input
                type="checkbox"
                checked={sectionsConfig.topAnnouncement}
                onChange={(e) => setSectionsConfig({ ...sectionsConfig, topAnnouncement: e.target.checked })}
                className="w-5 h-5 accent-black rounded"
              />
            </label>
            {sectionsConfig.topAnnouncement && (
              <div className="mt-3 pl-2">
                <input
                  type="text"
                  value={sectionsConfig.announcementText}
                  onChange={(e) => setSectionsConfig({ ...sectionsConfig, announcementText: e.target.value })}
                  placeholder="Announcement text..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-black font-semibold text-slate-800"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 text-sm block">Featured Categories Grid</span>
                <span className="text-xs text-slate-400">Display top category thumbnails below hero slider</span>
              </div>
              <input
                type="checkbox"
                checked={sectionsConfig.showCategories}
                onChange={(e) => setSectionsConfig({ ...sectionsConfig, showCategories: e.target.checked })}
                className="w-5 h-5 accent-black rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 text-sm block">Featured & Trending Products</span>
                <span className="text-xs text-slate-400">Grid of top products with add-to-cart buttons</span>
              </div>
              <input
                type="checkbox"
                checked={sectionsConfig.showFeaturedProducts}
                onChange={(e) => setSectionsConfig({ ...sectionsConfig, showFeaturedProducts: e.target.checked })}
                className="w-5 h-5 accent-black rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 text-sm block">Two-Column Promotional Cards</span>
                <span className="text-xs text-slate-400">High-impact mid-page seasonal discount cards</span>
              </div>
              <input
                type="checkbox"
                checked={sectionsConfig.showPromotionalBanners}
                onChange={(e) => setSectionsConfig({ ...sectionsConfig, showPromotionalBanners: e.target.checked })}
                className="w-5 h-5 accent-black rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 text-sm block">Brand Logo Carousel</span>
                <span className="text-xs text-slate-400">Endless sliding carousel of trusted fashion brands</span>
              </div>
              <input
                type="checkbox"
                checked={sectionsConfig.showLogoCarousel}
                onChange={(e) => setSectionsConfig({ ...sectionsConfig, showLogoCarousel: e.target.checked })}
                className="w-5 h-5 accent-black rounded"
              />
            </label>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition flex items-center gap-2"
          >
            <FiSave /> Save Homepage Layout
          </button>
        </form>
      )}

      {/* Tab 3: FAQs */}
      {activeTab === 'faqs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Frequently Asked Questions (FAQ)</h3>
              <p className="text-xs text-slate-500">Manage answers displayed to customers on the /faq help page.</p>
            </div>
            <button
              onClick={() => setIsAddingFaq(true)}
              className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <FiPlus /> Add FAQ
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {faqs.map((faq) => (
              <div key={faq.id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {faq.category}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">{faq.q}</h4>
                  <p className="text-xs text-slate-600">{faq.a}</p>
                </div>
                <button
                  onClick={() => handleDeleteFaq(faq.id)}
                  className="text-slate-400 hover:text-red-500 p-1.5 transition"
                  title="Delete FAQ"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Add FAQ Modal */}
          {isAddingFaq && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Add New FAQ Question</h3>
                <form onSubmit={handleAddFaq} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Category</label>
                    <select
                      value={newFaq.category}
                      onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                    >
                      <option value="General">General Questions</option>
                      <option value="Orders">Orders & Tracking</option>
                      <option value="Shipping">Shipping & Delivery</option>
                      <option value="Payments">Payments & Cash on Delivery</option>
                      <option value="Returns">Returns & Refunds</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Question *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Can I open the parcel before paying?"
                      value={newFaq.q}
                      onChange={(e) => setNewFaq({ ...newFaq, q: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Answer *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Detailed answer provided to customer..."
                      value={newFaq.a}
                      onChange={(e) => setNewFaq({ ...newFaq, a: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddingFaq(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-slate-800 transition"
                    >
                      Publish FAQ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Footer & Social */}
      {activeTab === 'social' && (
        <form onSubmit={saveSocial} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-2xl">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-900 text-base">Social Media Channels & Footer Information</h3>
            <p className="text-xs text-slate-500">Update WhatsApp support numbers, official social handles, and footer bio.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">WhatsApp Customer Support Number</label>
            <input
              type="text"
              value={socialConfig.whatsapp}
              onChange={(e) => setSocialConfig({ ...socialConfig, whatsapp: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Facebook URL</label>
              <input
                type="url"
                value={socialConfig.facebook}
                onChange={(e) => setSocialConfig({ ...socialConfig, facebook: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Instagram URL</label>
              <input
                type="url"
                value={socialConfig.instagram}
                onChange={(e) => setSocialConfig({ ...socialConfig, instagram: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">TikTok Handle URL</label>
              <input
                type="url"
                value={socialConfig.tiktok}
                onChange={(e) => setSocialConfig({ ...socialConfig, tiktok: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Footer Brand Bio / About Summary</label>
            <textarea
              rows={3}
              value={socialConfig.footerDescription}
              onChange={(e) => setSocialConfig({ ...socialConfig, footerDescription: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition flex items-center gap-2"
          >
            <FiSave /> Save Social & Footer Settings
          </button>
        </form>
      )}
    </div>
  );
}
