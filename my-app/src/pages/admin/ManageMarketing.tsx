import React, { useEffect, useState, useCallback } from 'react';
import {
  FiTag,
  FiShoppingBag,
  FiUsers,
  FiSend,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiClock,
  FiPercent,
  FiDollarSign,
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle
} from 'react-icons/fi';
import MetricGrid, { StatCard } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { useAuth } from '../../context/AuthContext';

interface Campaign {
  id: number;
  title: string;
  description: string;
  type: string;
  discount_rule: string;
  banner_url: string;
  starts_at: string;
  ends_at: string;
  target_segment: string;
  is_active: boolean | number;
}

interface Segment {
  name: string;
  criteria: string;
  count: number;
  badge: string;
}

interface AbandonedCart {
  id: string;
  customer_name: string;
  email: string;
  phone: string;
  total_amount: number | string;
  created_at: string;
  item_count: number;
  items_preview: string;
}

export default function ManageMarketing() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'abandoned' | 'segments'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    type: 'Seasonal Discount',
    discount_rule: '',
    banner_url: '',
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16),
    target_segment: 'All Customers',
  });

  const fetchMarketingData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketing', {
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCampaigns(data.campaigns || []);
        setSegments(data.segments || []);
        setAbandonedCarts(data.abandonedCarts || []);
      } else {
        throw new Error(data.message || 'Failed to load marketing data.');
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || 'Error fetching marketing overview.', 'error', 'Marketing Error');
    } finally {
      setLoading(false);
    }
  }, [user?.token, showAlert]);

  useEffect(() => {
    fetchMarketingData();
  }, [fetchMarketingData]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/marketing/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify(newCampaign),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert('Promotional campaign created successfully.', 'success', 'Created');
        setIsCreatingCampaign(false);
        fetchMarketingData();
      } else {
        throw new Error(data.message || 'Failed to create campaign.');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Creation Error');
    }
  };

  const toggleCampaignActive = async (campaign: Campaign) => {
    try {
      const nextActive = !Boolean(campaign.is_active);
      const res = await fetch(`/api/admin/marketing/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (res.ok) {
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, is_active: nextActive } : c));
        showAlert(`Campaign is now ${nextActive ? 'Active' : 'Paused'}.`, 'success', 'Status Updated');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Update Failed');
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!window.confirm('Delete this marketing campaign?')) return;
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      if (res.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        showAlert('Campaign deleted successfully.', 'success', 'Deleted');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Delete Failed');
    }
  };

  const handleRecoverCart = async (orderId: string) => {
    setRecoveringId(orderId);
    try {
      const res = await fetch(`/api/admin/marketing/abandoned-carts/${orderId}/recover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(data.message, 'success', 'Reminder Sent');
      } else {
        throw new Error(data.message || 'Could not send recovery reminder.');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Recovery Failed');
    } finally {
      setRecoveringId(null);
    }
  };

  const totalAbandonedValue = abandonedCarts.reduce((acc, cur) => acc + Number(cur.total_amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FiPercent className="text-amber-500" /> Marketing & Promotions Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Grow sales with promotional campaigns, customer segmentation, and automated abandoned cart recovery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreatingCampaign(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition shadow-sm"
          >
            <FiPlus /> New Campaign
          </button>
          <button
            onClick={fetchMarketingData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <MetricGrid cols={4}>
        <StatCard
          label="Active Campaigns"
          value={String(campaigns.filter(c => Boolean(c.is_active)).length)}
          icon={<FiTag size={20} />}
          sub="Live on storefront"
          accent="amber"
        />
        <StatCard
          label="Abandoned Carts"
          value={String(abandonedCarts.length)}
          icon={<FiShoppingBag size={20} />}
          sub="Uncompleted checkouts"
          accent="purple"
        />
        <StatCard
          label="Recoverable Value"
          value={`Rs. ${totalAbandonedValue.toLocaleString()}`}
          icon={<FiDollarSign size={20} />}
          sub="Potential revenue"
          accent="emerald"
        />
        <StatCard
          label="Customer Segments"
          value={String(segments.length)}
          icon={<FiUsers size={20} />}
          sub="VIP, repeat & inactive"
          accent="blue"
        />
      </MetricGrid>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'campaigns'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiTag /> Promotional Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('abandoned')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'abandoned'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiShoppingBag /> Abandoned Carts Recovery ({abandonedCarts.length})
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'segments'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiUsers /> Customer Segments ({segments.length})
        </button>
      </div>

      {/* Tab 1: Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const isActive = Boolean(camp.is_active);
            return (
              <div
                key={camp.id}
                className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden flex flex-col justify-between ${
                  isActive ? 'border-slate-200' : 'border-slate-200/60 opacity-70 bg-slate-50'
                }`}
              >
                <div>
                  {camp.banner_url && (
                    <div className="h-36 w-full overflow-hidden relative">
                      <img src={camp.banner_url} alt={camp.title} className="w-full h-full object-cover" />
                      <span className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-white text-[10px] font-extrabold uppercase px-2 py-1 rounded-md">
                        {camp.type}
                      </span>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-extrabold text-slate-900 text-base">{camp.title}</h3>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{camp.description}</p>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Offer Rule:</span>
                        <span className="font-bold text-amber-700">{camp.discount_rule}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Audience:</span>
                        <span className="font-semibold text-slate-700">{camp.target_segment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Valid Until:</span>
                        <span className="font-semibold text-slate-700">
                          {new Date(camp.ends_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <button
                    onClick={() => toggleCampaignActive(camp)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                      isActive
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {isActive ? 'Pause Campaign' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 p-1.5 transition"
                    title="Delete Campaign"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Abandoned Carts */}
      {activeTab === 'abandoned' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Uncompleted Customer Checkout Sessions</h3>
              <p className="text-xs text-slate-500">Reach out to customers who started checkout but did not complete payment.</p>
            </div>
          </div>
          {abandonedCarts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FiCheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-sm font-semibold">Great job! No pending abandoned carts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold">Order Ref</th>
                    <th className="py-3 px-4 font-bold">Customer</th>
                    <th className="py-3 px-4 font-bold">Items Abandoned</th>
                    <th className="py-3 px-4 font-bold">Total Cart Value</th>
                    <th className="py-3 px-4 font-bold">Date Initiated</th>
                    <th className="py-3 px-4 font-bold text-right">Recovery Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {abandonedCarts.map((cart) => (
                    <tr key={cart.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">#{cart.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{cart.customer_name}</div>
                        <div className="text-xs text-slate-400">{cart.email || cart.phone || 'No direct contact'}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600 text-xs">
                        <span className="font-bold text-black mr-1">({cart.item_count} items):</span>
                        {cart.items_preview}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        Rs. {Number(cart.total_amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(cart.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          disabled={recoveringId === cart.id}
                          onClick={() => handleRecoverCart(cart.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-black hover:bg-slate-800 text-white rounded-xl transition disabled:opacity-50"
                        >
                          <FiSend size={12} /> {recoveringId === cart.id ? 'Sending...' : 'Send Reminder'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Customer Segments */}
      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {segments.map((seg) => (
            <div key={seg.name} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-block mb-3 ${seg.badge}`}>
                  {seg.name}
                </span>
                <div className="text-3xl font-extrabold text-slate-900 mb-1">{seg.count}</div>
                <p className="text-xs text-slate-500 mb-4">{seg.criteria}</p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600">Dynamic Live Segment</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      {isCreatingCampaign && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Launch New Marketing Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Campaign Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid Mega Discount Special"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Campaign Type</label>
                  <select
                    value={newCampaign.type}
                    onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                  >
                    <option value="Seasonal Discount">Seasonal Discount</option>
                    <option value="Flash Sale">Flash Sale</option>
                    <option value="Free Shipping">Free Shipping</option>
                    <option value="Cart Recovery">Cart Recovery</option>
                    <option value="Holiday Special">Holiday Special</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Offer Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 25% Off"
                    value={newCampaign.discount_rule}
                    onChange={(e) => setNewCampaign({ ...newCampaign, discount_rule: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Promotional Banner Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newCampaign.banner_url}
                  onChange={(e) => setNewCampaign({ ...newCampaign, banner_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Target Customer Segment</label>
                <select
                  value={newCampaign.target_segment}
                  onChange={(e) => setNewCampaign({ ...newCampaign, target_segment: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                >
                  <option value="All Customers">All Customers</option>
                  <option value="VIP Customers">VIP Champions (High Spenders)</option>
                  <option value="Repeat Buyers">Repeat Buyers</option>
                  <option value="First-time Visitors">First-time Visitors</option>
                  <option value="Inactive Customers">Inactive Leads</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Description / Campaign Copy</label>
                <textarea
                  rows={2}
                  placeholder="Brief details about what is special in this promotional campaign..."
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-slate-800 transition"
                >
                  Publish Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
