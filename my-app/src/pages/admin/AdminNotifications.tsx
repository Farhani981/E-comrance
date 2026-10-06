import React, { useEffect, useState, useCallback } from 'react';
import {
  FiBell,
  FiShoppingBag,
  FiDollarSign,
  FiBox,
  FiMessageSquare,
  FiCheckCircle,
  FiTrash2,
  FiRefreshCw,
  FiFilter,
  FiExternalLink,
  FiClock,
  FiAlertTriangle,
  FiInfo
} from 'react-icons/fi';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { useAuth } from '../../context/AuthContext';
import MetricGrid, { StatCard } from '../../component/MetricGrid';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?limit=50&filter=${unreadOnly ? 'unread' : 'all'}`, {
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.data || []);
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  }, [user?.token, unreadOnly, showAlert]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/admin/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        showAlert('All notifications marked as read.', 'success', 'Updated');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    }
  };

  // Filtered notifications
  const filtered = notifications.filter(n => {
    if (typeFilter === 'ORDERS') return n.type?.includes('ORDER');
    if (typeFilter === 'PAYMENTS') return n.type?.includes('PAYMENT') || n.type?.includes('REFUND');
    if (typeFilter === 'STOCK') return n.type?.includes('STOCK') || n.type?.includes('INVENTORY');
    if (typeFilter === 'CUSTOMERS') return n.type?.includes('CONTACT') || n.type?.includes('MESSAGE') || n.type?.includes('RETURN');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const orderAlertsCount = notifications.filter(n => n.type?.includes('ORDER')).length;
  const stockAlertsCount = notifications.filter(n => n.type?.includes('STOCK')).length;
  const paymentAlertsCount = notifications.filter(n => n.type?.includes('PAYMENT') || n.type?.includes('REFUND')).length;

  const getTypeIcon = (type: string) => {
    if (type?.includes('ORDER')) return <FiShoppingBag className="text-blue-500" size={18} />;
    if (type?.includes('PAYMENT') || type?.includes('REFUND')) return <FiDollarSign className="text-emerald-500" size={18} />;
    if (type?.includes('STOCK')) return <FiBox className="text-amber-500" size={18} />;
    return <FiMessageSquare className="text-purple-500" size={18} />;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FiBell className="text-amber-500" /> Notifications & Alerts Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time feed of incoming orders, payment confirmations, stock alerts, and customer messages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          >
            <FiCheckCircle /> Mark All as Read
          </button>
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition shadow-sm"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <MetricGrid cols={4}>
        <StatCard
          label="Unread Alerts"
          value={String(unreadCount)}
          icon={<FiBell size={20} />}
          sub="Requires attention"
          accent="rose"
        />
        <StatCard
          label="Order Notifications"
          value={String(orderAlertsCount)}
          icon={<FiShoppingBag size={20} />}
          sub="New purchases"
          accent="blue"
        />
        <StatCard
          label="Inventory & Stock Alerts"
          value={String(stockAlertsCount)}
          icon={<FiBox size={20} />}
          sub="Low & out-of-stock"
          accent="amber"
        />
        <StatCard
          label="Payment Events"
          value={String(paymentAlertsCount)}
          icon={<FiDollarSign size={20} />}
          sub="Paid & refunds"
          accent="emerald"
        />
      </MetricGrid>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: 'All Alerts' },
            { key: 'ORDERS', label: 'Orders' },
            { key: 'PAYMENTS', label: 'Payments' },
            { key: 'STOCK', label: 'Stock & Inventory' },
            { key: 'CUSTOMERS', label: 'Customer Inquiries' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                typeFilter === tab.key
                  ? 'bg-black text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="w-4 h-4 accent-black rounded"
          />
          Show Unread Only
        </label>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FiCheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-60" />
            <p className="text-sm font-semibold">All caught up! No notifications found in this category.</p>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={`p-4 sm:p-5 flex items-start gap-4 transition hover:bg-slate-50/80 ${
                !item.is_read ? 'bg-amber-50/20' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                {getTypeIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className={`text-sm ${!item.is_read ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {item.title}
                  </h4>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getPriorityBadge(item.priority)}`}>
                    {item.priority}
                  </span>
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  )}
                </div>

                <p className="text-xs text-slate-600 mb-2">{item.message}</p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <FiClock size={12} /> {new Date(item.created_at).toLocaleString()}
                  </span>

                  {item.metadata?.orderId && (
                    <a
                      href={`/admin/orders?search=${encodeURIComponent(item.metadata.orderId)}`}
                      className="font-bold text-black hover:underline flex items-center gap-1"
                    >
                      View Order #{item.metadata.orderId} <FiExternalLink size={10} />
                    </a>
                  )}

                  {item.metadata?.productId && (
                    <a
                      href={`/admin/inventory?search=${encodeURIComponent(item.metadata.productName || '')}`}
                      className="font-bold text-amber-700 hover:underline flex items-center gap-1"
                    >
                      Check Inventory <FiExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>

              {!item.is_read && (
                <button
                  onClick={() => markAsRead(item.id)}
                  className="text-xs font-bold text-slate-500 hover:text-black px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white shrink-0"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
