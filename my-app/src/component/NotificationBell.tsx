import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiShoppingBag,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiPackage,
  FiRefreshCw,
  FiVolume2,
  FiVolumeX,
  FiCheck,
  FiTrash2,
  FiMonitor,
} from 'react-icons/fi';
import { useNotifications, type NotificationItem } from '../context/NotificationContext';

function getRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'NEW_ORDER':
      return { icon: FiShoppingBag, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'PAYMENT_SUCCESS':
      return { icon: FiCheckCircle, color: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'PAYMENT_FAILED':
      return { icon: FiXCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    case 'LOW_STOCK':
      return { icon: FiAlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    case 'OUT_OF_STOCK':
      return { icon: FiPackage, color: 'text-red-600 bg-red-50 border-red-200' };
    case 'RETURN_REQUEST':
      return { icon: FiRefreshCw, color: 'text-purple-600 bg-purple-50 border-purple-200' };
    default:
      return { icon: FiBell, color: 'text-slate-600 bg-slate-50 border-slate-200' };
  }
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    soundEnabled,
    browserPermission,
    filter,
    setFilter,
    markAsRead,
    markAllAsRead,
    toggleSound,
    requestBrowserPermission,
    clearAllLocal,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }
    setIsOpen(false);

    // Navigate to appropriate admin page based on notification type
    if (item.type === 'NEW_ORDER' || item.type === 'PAYMENT_SUCCESS' || item.type === 'PAYMENT_FAILED') {
      navigate('/admin/orders');
    } else if (item.type === 'LOW_STOCK' || item.type === 'OUT_OF_STOCK') {
      navigate('/admin/inventory');
    } else if (item.type === 'RETURN_REQUEST') {
      navigate('/admin/returns');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95"
        aria-label="Notifications"
        title="Admin Notifications"
      >
        <FiBell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleSound}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                title={soundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
              >
                {soundEnabled ? <FiVolume2 size={16} /> : <FiVolumeX size={16} className="text-red-500" />}
              </button>

              {browserPermission !== 'granted' && (
                <button
                  onClick={requestBrowserPermission}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  title="Enable Desktop Notifications"
                >
                  <FiMonitor size={16} />
                </button>
              )}

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                  title="Mark all as read"
                >
                  <FiCheck size={14} /> Read all
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 bg-white">
            <button
              onClick={() => setFilter('all')}
              className={`py-2 px-3 text-xs font-bold transition border-b-2 ${
                filter === 'all'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`py-2 px-3 text-xs font-bold transition border-b-2 ${
                filter === 'unread'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <FiBell className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No notifications found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Everything is up to date!</p>
              </div>
            ) : (
              notifications.map((item) => {
                const { icon: IconComponent, color } = getNotificationIcon(item.type);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-slate-50 relative ${
                      !item.is_read ? 'bg-slate-50/70' : 'bg-white'
                    }`}
                  >
                    {!item.is_read && (
                      <span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-blue-600" />
                    )}
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${color}`}
                    >
                      <IconComponent size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0">
                          {getRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                        {item.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={clearAllLocal}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 px-2 py-1 rounded transition"
            >
              <FiTrash2 size={13} /> Clear all
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/admin/orders');
              }}
              className="text-[11px] font-bold text-slate-900 hover:underline px-2 py-1"
            >
              View dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
