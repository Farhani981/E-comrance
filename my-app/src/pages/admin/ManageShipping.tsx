import React, { useEffect, useState, useCallback } from 'react';
import {
  FiTruck,
  FiMapPin,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiRefreshCw,
  FiEdit2,
  FiExternalLink,
  FiDollarSign,
  FiClock,
  FiShield
} from 'react-icons/fi';
import MetricGrid, { StatCard } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { useAuth } from '../../context/AuthContext';

interface ShippingMethod {
  id: number;
  name: string;
  code: string;
  description: string;
  base_rate: number | string;
  free_above: number | string | null;
  estimated_days: string;
  is_active: boolean | number;
}

interface ShippingZone {
  id: number;
  name: string;
  regions: string;
  rate: number | string;
  estimated_days: string;
  is_active: boolean | number;
}

interface Courier {
  id: number;
  name: string;
  code: string;
  tracking_url_template: string;
  account_number: string;
  is_active: boolean | number;
}

export default function ManageShipping() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();

  const [activeTab, setActiveTab] = useState<'methods' | 'zones' | 'couriers' | 'dispatched'>('methods');
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [dispatchedOrders, setDispatchedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTracking, setSearchTracking] = useState('');
  const [editingItem, setEditingItem] = useState<{ type: 'method' | 'zone' | 'courier'; data: any } | null>(null);

  const fetchShippingData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shipping', {
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMethods(data.methods || []);
        setZones(data.zones || []);
        setCouriers(data.couriers || []);
        setDispatchedOrders(data.dispatchedOrders || []);
      } else {
        throw new Error(data.message || 'Failed to load shipping data.');
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || 'Error fetching shipping details.', 'error', 'Shipping Error');
    } finally {
      setLoading(false);
    }
  }, [user?.token, showAlert]);

  useEffect(() => {
    fetchShippingData();
  }, [fetchShippingData]);

  const toggleMethodActive = async (method: ShippingMethod) => {
    try {
      const nextActive = !Boolean(method.is_active);
      const res = await fetch(`/api/admin/shipping/methods/${method.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (res.ok) {
        setMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: nextActive } : m));
        showAlert(`${method.name} is now ${nextActive ? 'Active' : 'Disabled'}.`, 'success', 'Status Updated');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Update Failed');
    }
  };

  const toggleZoneActive = async (zone: ShippingZone) => {
    try {
      const nextActive = !Boolean(zone.is_active);
      const res = await fetch(`/api/admin/shipping/zones/${zone.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (res.ok) {
        setZones(prev => prev.map(z => z.id === zone.id ? { ...z, is_active: nextActive } : z));
        showAlert(`${zone.name} is now ${nextActive ? 'Active' : 'Disabled'}.`, 'success', 'Zone Updated');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Update Failed');
    }
  };

  const toggleCourierActive = async (courier: Courier) => {
    try {
      const nextActive = !Boolean(courier.is_active);
      const res = await fetch(`/api/admin/shipping/couriers/${courier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (res.ok) {
        setCouriers(prev => prev.map(c => c.id === courier.id ? { ...c, is_active: nextActive } : c));
        showAlert(`${courier.name} is now ${nextActive ? 'Active' : 'Disabled'}.`, 'success', 'Courier Updated');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Update Failed');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const endpoint = editingItem.type === 'method'
        ? `/api/admin/shipping/methods/${editingItem.data.id}`
        : editingItem.type === 'zone'
        ? `/api/admin/shipping/zones/${editingItem.data.id}`
        : `/api/admin/shipping/couriers/${editingItem.data.id}`;

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify(editingItem.data),
      });
      if (res.ok) {
        showAlert('Shipping settings saved successfully.', 'success', 'Saved');
        setEditingItem(null);
        fetchShippingData();
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Save Failed');
    }
  };

  const activeMethodsCount = methods.filter(m => Boolean(m.is_active)).length;
  const activeCouriersCount = couriers.filter(c => Boolean(c.is_active)).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FiTruck className="text-amber-500" /> Shipping & Logistics Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Configure nationwide delivery methods, shipping zones, courier partners, and tracking.
          </p>
        </div>
        <button
          onClick={fetchShippingData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm self-start"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Metrics Cards */}
      <MetricGrid cols={4}>
        <StatCard
          label="Active Shipping Methods"
          value={String(activeMethodsCount)}
          icon={<FiTruck size={20} />}
          sub="Standard, Express, COD"
          accent="amber"
        />
        <StatCard
          label="Coverage Zones"
          value={String(zones.length)}
          icon={<FiMapPin size={20} />}
          sub="All Pakistan regions"
          accent="blue"
        />
        <StatCard
          label="Integrated Couriers"
          value={String(activeCouriersCount)}
          icon={<FiShield size={20} />}
          sub="TCS, Leopards, Trax, PostEx"
          accent="emerald"
        />
        <StatCard
          label="Recent Tracked Dispatches"
          value={String(dispatchedOrders.length)}
          icon={<FiPackage size={20} />}
          sub="With active tracking codes"
          accent="purple"
        />
      </MetricGrid>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('methods')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'methods'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiTruck /> Shipping Methods ({methods.length})
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'zones'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiMapPin /> Delivery Zones & Rates ({zones.length})
        </button>
        <button
          onClick={() => setActiveTab('couriers')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'couriers'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiShield /> Courier Partners ({couriers.length})
        </button>
        <button
          onClick={() => setActiveTab('dispatched')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'dispatched'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiPackage /> Dispatched Tracking ({dispatchedOrders.length})
        </button>
      </div>

      {/* Tab 1: Shipping Methods */}
      {activeTab === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {methods.map((method) => {
            const isActive = Boolean(method.is_active);
            return (
              <div
                key={method.id}
                className={`p-6 rounded-2xl border transition bg-white shadow-sm flex flex-col justify-between ${
                  isActive ? 'border-slate-200' : 'border-slate-200/60 opacity-70 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                      <FiTruck className="text-amber-500" /> {method.name}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{method.description}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block uppercase">Base Shipping Fee</span>
                      <span className="font-extrabold text-slate-900 text-base">
                        {Number(method.base_rate) === 0 ? 'FREE' : `Rs. ${Number(method.base_rate).toLocaleString()}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block uppercase">Free Above Spend</span>
                      <span className="font-bold text-slate-700">
                        {method.free_above ? `Rs. ${Number(method.free_above).toLocaleString()}` : 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] font-bold text-slate-400 block uppercase">Estimated Delivery</span>
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <FiClock className="text-slate-400" /> {method.estimated_days}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setEditingItem({ type: 'method', data: { ...method } })}
                    className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1"
                  >
                    <FiEdit2 /> Edit Rates
                  </button>
                  <button
                    onClick={() => toggleMethodActive(method)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                      isActive
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {isActive ? 'Disable Method' : 'Enable Method'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Delivery Zones */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Geographical Delivery Zones</h3>
            <span className="text-xs text-slate-400">Nationwide courier coverage</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Zone Name</th>
                  <th className="py-3.5 px-4 font-bold">Cities / Regions Covered</th>
                  <th className="py-3.5 px-4 font-bold">Delivery Fee</th>
                  <th className="py-3.5 px-4 font-bold">Transit Time</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zones.map((zone) => {
                  const isActive = Boolean(zone.is_active);
                  return (
                    <tr key={zone.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <FiMapPin className="text-amber-500 shrink-0" /> {zone.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{zone.regions}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">Rs. {Number(zone.rate).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-slate-600">{zone.estimated_days}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => setEditingItem({ type: 'zone', data: { ...zone } })}
                          className="text-xs font-bold text-slate-600 hover:text-black p-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleZoneActive(zone)}
                          className={`text-xs font-bold underline ${
                            isActive ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Courier Partners */}
      {activeTab === 'couriers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {couriers.map((courier) => {
            const isActive = Boolean(courier.is_active);
            return (
              <div
                key={courier.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-extrabold text-slate-900 text-base">{courier.name}</h4>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isActive ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mb-3">Code: {courier.code.toUpperCase()}</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5 mb-4">
                    <div>
                      <span className="text-slate-400 font-medium block">Account / Merchant ID:</span>
                      <span className="font-bold text-slate-800">{courier.account_number || 'Default Portal'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Tracking URL Pattern:</span>
                      <span className="font-mono text-[11px] text-slate-600 truncate block">
                        {courier.tracking_url_template}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setEditingItem({ type: 'courier', data: { ...courier } })}
                    className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1"
                  >
                    <FiEdit2 /> Configure
                  </button>
                  <button
                    onClick={() => toggleCourierActive(courier)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg border transition ${
                      isActive
                        ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {isActive ? 'Disconnect' : 'Connect Partner'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 4: Dispatched Orders Tracking */}
      {activeTab === 'dispatched' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Real-time Order Tracking Console</h3>
              <p className="text-xs text-slate-500">Track and monitor orders dispatched with courier tracking codes.</p>
            </div>
            <div className="relative max-w-xs w-full">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Tracking or Order #..."
                value={searchTracking}
                onChange={(e) => setSearchTracking(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-black transition"
              />
            </div>
          </div>

          {dispatchedOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FiPackage className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No dispatched orders with tracking numbers yet.</p>
              <p className="text-xs text-slate-400 mt-1">When you mark orders as Shipped in Orders management, tracking codes will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold">Order ID</th>
                    <th className="py-3 px-4 font-bold">Customer</th>
                    <th className="py-3 px-4 font-bold">Destination</th>
                    <th className="py-3 px-4 font-bold">Courier</th>
                    <th className="py-3 px-4 font-bold">Tracking #</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Quick Track</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dispatchedOrders
                    .filter(o => !searchTracking || o.id.toLowerCase().includes(searchTracking.toLowerCase()) || (o.tracking_number || '').toLowerCase().includes(searchTracking.toLowerCase()))
                    .map((order) => {
                      const courier = couriers.find(c => c.name?.toLowerCase().includes((order.courier_name || '').toLowerCase()));
                      const trackUrl = courier
                        ? courier.tracking_url_template.replace('{TRACKING_NO}', encodeURIComponent(order.tracking_number || ''))
                        : `https://www.google.com/search?q=${encodeURIComponent((order.courier_name || '') + ' ' + (order.tracking_number || ''))}`;

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">#{order.id}</td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{order.customer_name}</td>
                          <td className="py-3 px-4 text-slate-500">{order.city || 'Pakistan'}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                              {order.courier_name || 'Standard Courier'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-bold text-black">{order.tracking_number}</td>
                          <td className="py-3 px-4">
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
                              {order.order_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={trackUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-black hover:underline"
                            >
                              Live Courier Portal <FiExternalLink />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Edit {editingItem.type === 'method' ? 'Shipping Method' : editingItem.type === 'zone' ? 'Delivery Zone' : 'Courier Partner'}
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.data.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              {editingItem.type === 'method' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Base Rate (Rs.)</label>
                      <input
                        type="number"
                        required
                        value={editingItem.data.base_rate ?? 200}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, base_rate: Number(e.target.value) } })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Free Above (Rs.)</label>
                      <input
                        type="number"
                        value={editingItem.data.free_above ?? ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, free_above: e.target.value ? Number(e.target.value) : null } })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Estimated Days</label>
                    <input
                      type="text"
                      value={editingItem.data.estimated_days || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, estimated_days: e.target.value } })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'zone' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Cities / Regions</label>
                    <textarea
                      rows={2}
                      value={editingItem.data.regions || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, regions: e.target.value } })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Zone Rate (Rs.)</label>
                      <input
                        type="number"
                        required
                        value={editingItem.data.rate ?? 200}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, rate: Number(e.target.value) } })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Delivery Time</label>
                      <input
                        type="text"
                        value={editingItem.data.estimated_days || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, estimated_days: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingItem.type === 'courier' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Merchant Account #</label>
                    <input
                      type="text"
                      value={editingItem.data.account_number || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, account_number: e.target.value } })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tracking URL Template</label>
                    <input
                      type="text"
                      value={editingItem.data.tracking_url_template || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, tracking_url_template: e.target.value } })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black font-mono text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-slate-800 transition"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
