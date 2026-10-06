import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiUser,
  FiPackage,
  FiMapPin,
  FiLogOut,
  FiEdit3,
  FiCheckCircle,
  FiLock,
  FiShoppingBag
} from 'react-icons/fi';

export default function Account() {
  const { user, orders, logout, updateUser, profileLoading, profileError, reloadProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || ''
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-10 max-w-md mx-auto border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4">
            <FiLock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-slate-500 text-sm mb-6">Please log in to view and manage your account profile and orders.</p>
          <Link
            to="/login"
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition shadow-md"
          >
            Sign In / Register
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (isSaving || profileLoading) return;
    setIsSaving(true); setSaveError(''); setSaveSuccess(false);
    try {
      await updateUser(formData);
      setIsEditing(false); setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error.message || 'Unable to save your profile. Please try again.');
    } finally { setIsSaving(false); }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-lg shrink-0">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{user.name}</h1>
            <p className="text-slate-300 text-sm mt-0.5">{user.email}</p>
            <span className="inline-block mt-2 bg-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full border border-amber-500/30">
              Verified Customer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/orders"
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-white/20 transition flex items-center gap-2"
          >
            <FiPackage /> My Orders ({orders.length})
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {profileLoading && <p role="status" className="mb-4 text-sm">Loading your saved profile?</p>}
      {profileError && <p role="alert" className="mb-4 text-sm text-red-600">{profileError} <button type="button" onClick={reloadProfile} disabled={profileLoading}>Retry</button></p>}
      {saveError && <p role="alert" className="mb-4 text-sm text-red-600">{saveError}</p>}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-sm font-medium animate-bounce">
          <FiCheckCircle className="w-5 h-5 text-emerald-600" /> Profile details updated successfully!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Personal Details & Address */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FiUser className="text-black" /> Account Settings & Address
              </h2>
              {!isEditing && (
                <button
                  disabled={profileLoading || !!profileError}
                  onClick={() => { setFormData({ name: user.name || '', email: user.email || '', phone: user.phone || '', address: user.address || '', city: user.city || '' }); setSaveError(''); setSaveSuccess(false); setIsEditing(true); }}
                  className="text-black hover:text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <FiEdit3 /> Edit Profile
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Default Delivery Address
                    </label>
                    <textarea
                      rows="2"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-slate-800 resize-none"
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving || profileLoading}
                    className="bg-black hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
                  >
                    {isSaving ? 'Saving?' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => { setIsEditing(false); setSaveError(''); }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Full Name</span>
                  <p className="font-semibold text-slate-800">{user.name}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Email Address</span>
                  <p className="font-semibold text-slate-800">{user.email}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Phone Number</span>
                  <p className="font-semibold text-slate-800">{user.phone || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block mb-1">City</span>
                  <p className="font-semibold text-slate-800">{user.city || 'Not set'}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Default Address</span>
                  <p className="font-semibold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {user.address || 'No default shipping address saved yet.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Orders Overview */}
        <div>
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FiPackage className="text-black" /> Recent Orders
              </h3>
              <Link to="/orders" className="text-xs font-bold text-black hover:underline">
                View All
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-6">
                <FiShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No orders placed yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 3).map((order, idx) => {
                  const orderId = order.id || order.orderId;
                  const orderStatus = order.order_status || order.status || 'Processing';
                  const orderTotal = order.total_amount != null ? Number(order.total_amount).toLocaleString() : (order.grandTotal || 0);
                  const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : (order.date || 'Recent');
                  return (
                    <div key={order.id || idx} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-900">{orderId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${orderStatus === 'Delivered' || orderStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                          {orderStatus}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{orderDate}</span>
                        <span className="font-extrabold text-slate-900">Rs.{orderTotal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
