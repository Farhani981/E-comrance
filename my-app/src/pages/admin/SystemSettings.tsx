import { operationsRequest } from './operationsShared';
import ImageUploadInput from '../../component/ImageUploadInput';
import { Link } from 'react-router-dom';
import { FiSettings, FiCheck, FiTruck, FiGlobe, FiBell, FiCreditCard, FiPercent } from 'react-icons/fi';
import { useState, useEffect } from 'react';

export default function SystemSettings() {
  // Store Info
  const [storeName, setStoreName] = useState('ShopHub');
  const [storeTagline, setStoreTagline] = useState('Premium Men\'s Fashion & Lifestyle');
  const [contactEmail, setContactEmail] = useState('support@shophub.com.pk');
  const [contactPhone, setContactPhone] = useState('+92 300 1234567');
  const [whatsapp, setWhatsapp] = useState('+92 300 1234567');
  const [address, setAddress] = useState('Plot #45, Main Boulevard, Gulberg III, Lahore, Pakistan');
  const [currency, setCurrency] = useState('PKR');

  // Social Media
  const [facebook, setFacebook] = useState('https://facebook.com/shophub.pk');
  const [instagram, setInstagram] = useState('https://instagram.com/shophub.pk');
  const [tiktok, setTiktok] = useState('');

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');

  // Shipping
  const [shippingFee, setShippingFee] = useState('200');
  const [freeShippingAbove, setFreeShippingAbove] = useState('2000');
  const [estimatedDays, setEstimatedDays] = useState('3-5');
  const [deliveryCities, setDeliveryCities] = useState('Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta');

  // Payment Methods
  const [codEnabled, setCodEnabled] = useState(true);
  const [easyPaisaEnabled, setEasyPaisaEnabled] = useState(true);
  const [jazzCashEnabled, setJazzCashEnabled] = useState(true);
  const [bankTransfer, setBankTransfer] = useState(true);

  // Notifications
  const [orderNotif, setOrderNotif] = useState(true);
  const [lowStockNotif, setLowStockNotif] = useState(true);
  const [customerNotif, setCustomerNotif] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('store');

  const [logo, setLogo] = useState('');
  const [ready, setReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    operationsRequest('/settings').then(data => {
      if (!active) return;
      const s = data.settings;
      setFacebook(s.facebook || ''); setInstagram(s.instagram || ''); setTiktok(s.tiktok || '');
      setMetaTitle(s.metaTitle || ''); setMetaDescription(s.metaDescription || ''); setMetaKeywords(s.metaKeywords || '');
      setStoreName(s.storeName); setStoreTagline(s.storeTagline); setLogo(s.logo);
      setContactEmail(s.contactEmail); setContactPhone(s.contactPhone); setWhatsapp(s.whatsapp); setAddress(s.address); setCurrency(s.currency);
      setShippingFee(String(s.shippingFee)); setFreeShippingAbove(String(s.freeShippingAbove)); setLowStockThreshold(String(s.lowStockThreshold)); setReady(true);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [loadAttempt]);
  const handleSave = async () => {
    if (!ready || saving) return;
    setSaved(false); setError('');
    const settings = activeSection === 'store' ? { storeName, storeTagline, logo, contactEmail, contactPhone, whatsapp, address, currency }
      : activeSection === 'shipping' ? { shippingFee: shippingFee.trim() ? Number(shippingFee) : null, freeShippingAbove: freeShippingAbove.trim() ? Number(freeShippingAbove) : null }
      : activeSection === 'social' ? { facebook, instagram, tiktok, metaTitle, metaDescription, metaKeywords }
      : activeSection === 'notifications' ? { lowStockThreshold: lowStockThreshold.trim() ? Number(lowStockThreshold) : null } : null;
    if (!settings) { setError('These preview controls are not connected to a supported business service.'); return; }
    setSaving(true);
    try {
      await operationsRequest('/settings', { method: 'PATCH', body: JSON.stringify(settings) });
      setSaved(true); window.dispatchEvent(new Event('store-settings-updated'));
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings.'); }
    finally { setSaving(false); }
  };

  const sections = [
    { color: '#2563eb', id: 'store', label: 'Store Info', icon: <FiSettings size={16} /> },
    { color: '#059669', id: 'shipping', label: 'Shipping & Delivery', icon: <FiTruck size={16} /> },
    { color: '#7c3aed', id: 'payment', label: 'Payment Methods', icon: <FiCreditCard size={16} /> },
    { color: '#0891b2', id: 'social', label: 'Social & SEO', icon: <FiGlobe size={16} /> },
    { color: '#b45309', id: 'notifications', label: 'Notifications', icon: <FiBell size={16} /> },
    { color: '#db2777', id: 'coupons', label: 'Coupons & Discounts', icon: <FiPercent size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Store Settings</h1>
        <p className="text-slate-600 mt-1">Manage ShopHub store settings and system configurations</p>
      </div>

      {!ready && !error && <p role="status">Loading saved settings...</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}{!ready &&
       <button type="button" className="ml-3 font-semibold underline" onClick={() => { setError(''); setReady(false); setLoadAttempt(value => value + 1); }}>Retry loading settings
       </button>}
       </div>}
      {activeSection === 'payment' && <p className="text-sm text-slate-600">Preview only. These controls do not change payment processing.</p>}
      {/* Save Notification */}
      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-pulse">
          <FiCheck size={20} />
          <span className="font-medium">Settings saved successfully!</span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-pressed={activeSection === section.id}
            style={{ backgroundColor: activeSection === section.id ? section.color : `${section.color}10`, color:activeSection === section.id ? '#fff' : section.color, borderColor:`${section.color}40` }}
            onClick={() => { setActiveSection(section.id); setSaved(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeSection === section.id
                ? 'bg-slate-900 text-white shadow-xs font-bold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      {/* ─── STORE INFO ─── */}
      {activeSection === 'store' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FiSettings size={20} className="text-slate-500" />
            Store Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Store Name</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tagline</label>
              <input
                type="text"
                value={storeTagline}
                onChange={(e) => setStoreTagline(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Support Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp Number</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="PKR">PKR - Pakistani Rupee (Rs.)</option>

              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Business Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="mt-6"><ImageUploadInput label="Store Logo" value={logo} onChange={setLogo} /></div>
          <p className="mt-3 text-xs text-slate-500">PKR is the supported currency. No extra tax is charged.</p>
          <button
            disabled={!ready || saving || !['store', 'shipping', 'notifications', 'social'].includes(activeSection)}
            onClick={handleSave}
            style={{ backgroundColor:sections.find(section => section.id === activeSection)?.color }}
            className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Store Settings
          </button>
        </div>
      )}

      {/* ─── SHIPPING ─── */}
      {activeSection === 'shipping' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FiTruck size={20} className="text-slate-500" />
            Shipping & Delivery Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Standard Shipping Fee</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-900 font-medium text-sm">Rs.</span>
                <input
                  type="number"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Free Shipping Above</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-900 font-medium text-sm">Rs.</span>
                <input
                  type="number"
                  value={freeShippingAbove}
                  onChange={(e) => setFreeShippingAbove(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Applies to backend quotes: "Free Shipping on orders over Rs.{freeShippingAbove}" on storefront</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Delivery (Days, preview only)</label>
              <input
                type="text"
                readOnly
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                placeholder="e.g. 3-5"
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Cities (preview only)</label>
              <textarea
                rows={2}
                readOnly
                value={deliveryCities}
                onChange={(e) => setDeliveryCities(e.target.value)}
                placeholder="Comma-separated city names..."
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
              />
            </div>
          </div>

          {/* Shipping info card */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm font-medium text-slate-800">📦 Current Shipping Policy</p>
            <p className="text-xs text-slate-700 mt-1">
              Standard delivery: Rs. {shippingFee} | Free shipping on orders above Rs. {freeShippingAbove} | 
              Estimated delivery: {estimatedDays} business days | Cash on Delivery available nationwide
            </p>
          </div>

          <button
            disabled={!ready || saving || !['store', 'shipping', 'notifications', 'social'].includes(activeSection)}
            onClick={handleSave}
            style={{ backgroundColor:sections.find(section => section.id === activeSection)?.color }}
            className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Shipping Settings
          </button>
        </div>
      )}

      {/* ─── PAYMENT METHODS ─── */}
      {activeSection === 'payment' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FiCreditCard size={20} className="text-slate-500" />
            Payment Methods
          </h3>

          <div className="space-y-4">
            {[
              { label: 'Cash on Delivery (COD)', desc: 'Customer pays at delivery — most popular in Pakistan', enabled: codEnabled, setEnabled: setCodEnabled, icon: '💵' },
              { label: 'EasyPaisa', desc: 'Mobile wallet payment via Telenor EasyPaisa', enabled: easyPaisaEnabled, setEnabled: setEasyPaisaEnabled, icon: '📱' },
              { label: 'JazzCash', desc: 'Mobile payment via Jazz/Mobilink JazzCash wallet', enabled: jazzCashEnabled, setEnabled: setJazzCashEnabled, icon: '📲' },
              { label: 'Bank Transfer', desc: 'Direct bank account transfer (HBL, Meezan, UBL, etc.)', enabled: bankTransfer, setEnabled: setBankTransfer, icon: '🏦' },
            ].map((method, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{method.icon}</span>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{method.label}</p>
                    <p className="text-xs text-slate-500">{method.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => method.setEnabled(!method.enabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    method.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      method.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <button
            disabled={!ready || saving || !['store', 'shipping', 'notifications', 'social'].includes(activeSection)}
            onClick={handleSave}
            style={{ backgroundColor:sections.find(section => section.id === activeSection)?.color }}
            className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Payment Settings
          </button>
        </div>
      )}

      {/* ─── SOCIAL & SEO ─── */}
      {activeSection === 'social' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FiGlobe size={20} className="text-slate-500" />
            Social Media & SEO Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Facebook Page URL</label>
              <input
                type="url"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/..."
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Instagram Profile</label>
              <input
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">TikTok Profile</label>
              <input
                type="url"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="https://tiktok.com/@..."
                className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4">SEO Settings</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Meta Title</label>
                <input
                  type="text"
                  value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
                  className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">Recommended 50-60 characters for search engine rankings</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Meta Description</label>
                <textarea
                  rows={2}
                  value={metaDescription} onChange={e => setMetaDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">Recommended 150-160 characters for search results description</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Keywords</label>
                <input
                  type="text"
                  value={metaKeywords} onChange={e => setMetaKeywords(e.target.value)}
                  className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          </div>

          <button
            disabled={!ready || saving || !['store', 'shipping', 'notifications', 'social'].includes(activeSection)}
            onClick={handleSave}
            style={{ backgroundColor:sections.find(section => section.id === activeSection)?.color }}
            className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Social & SEO Settings
          </button>
        </div>
      )}

      {/* ─── NOTIFICATIONS ─── */}
      {activeSection === 'notifications' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FiBell size={20} className="text-slate-500" />
            Inventory Warning Threshold
          </h3>

          <p className="mb-4 text-sm text-slate-500">Only the inventory warning threshold is saved here. Notification delivery is not configured by these preview toggles.</p>
          <div className="space-y-4">
            {[
              { label: 'New Order Alerts', desc: 'Receive instant notifications whenever a new order is placed', enabled: orderNotif, setEnabled: setOrderNotif },
              { label: 'Low Stock Warnings', desc: 'Get alerts when any product stock drops below threshold', enabled: lowStockNotif, setEnabled: setLowStockNotif },
              { label: 'New Customer Registration', desc: 'Get notified when a new customer creates an account', enabled: customerNotif, setEnabled: setCustomerNotif },
            ].map((notif, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl  border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{notif.label}</p>
                  <p className="text-xs text-slate-500">{notif.desc}</p>
                </div>
                <button
                  disabled
                  onClick={() => notif.setEnabled(!notif.enabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notif.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      notif.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {lowStockNotif && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-sm font-medium text-slate-800 mb-2">Low Stock Threshold</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-24 px-3 py-2 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                />
                <span className="text-xs text-slate-700">units or fewer are marked low in Inventory; per-product thresholds override this default</span>
              </div>
            </div>
          )}

          <button
            disabled={!ready || saving || !['store', 'shipping', 'notifications', 'social'].includes(activeSection)}
            onClick={handleSave}
            style={{ backgroundColor:sections.find(section => section.id === activeSection)?.color }}
            className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Inventory Threshold
          </button>
        </div>
      )}

      {activeSection === 'coupons' && <div className="bg-white rounded-xl border border-slate-200 p-6"><p>Coupons and discounts are managed by the existing backend Promotions page.</p><Link to="/admin/coupons" className="underline">Manage Promotions</Link></div>}
    </div>
  );
}
