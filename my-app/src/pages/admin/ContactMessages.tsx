import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiMail,
  FiCalendar,
  FiSearch,
  FiFilter,
  FiEye,
  FiTrash2,
  FiCornerUpLeft,
  FiCheckCircle,
  FiClock,
  FiX,
  FiSend,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiInbox,
  FiAlertTriangle,
  FiExternalLink,
  FiShoppingBag,
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import { useAuth } from '../../context/AuthContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { useNotifications } from '../../context/NotificationContext';

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  reply_message?: string | null;
  replied_at?: string | null;
  status: 'Unread' | 'Read' | 'Replied';
  created_at: string;
  updated_at?: string;
  related_order_id?: string | null;
  related_order?: {
    id: string;
    total_amount: number | string;
    order_status: string;
    created_at: string;
  } | null;
}

interface MessageStats {
  total: number;
  unread: number;
  read: number;
  replied: number;
  today: number;
}

export default function ContactMessages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const { notifications } = useNotifications();
  const authToken = user?.token || '';

  // Data states
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    unread: 0,
    read: 0,
    replied: 0,
    today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  // Modals state
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<ContactMessage | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Delete confirmation
  const [deletingMessage, setDeletingMessage] = useState<ContactMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Messages from backend
  const fetchMessages = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const query = new URLSearchParams({
          page: String(currentPage),
          limit: String(pageSize),
          search: searchTerm.trim(),
          status: statusFilter,
          dateRange: dateFilter,
        });

        if (dateFilter === 'Custom') {
          if (customStartDate) query.append('startDate', customStartDate);
          if (customEndDate) query.append('endDate', customEndDate);
        }

        const res = await fetch(`/api/contact?${query.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to fetch contact messages.');
        }

        setMessages(data.messages || []);
        setTotalCount(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }

        if (isRefresh) {
          showAlert('Contact messages refreshed.', 'success', 'Updated');
        }
      } catch (err: any) {
        console.error('Error loading contact messages:', err);
        try {
          const local = JSON.parse(localStorage.getItem('shophub_contact_messages') || '[]');
          if (Array.isArray(local) && local.length > 0) {
            setMessages(local);
            setTotalCount(local.length);
            setStats({
              total: local.length,
              unread: local.filter((m: any) => m.status === 'Unread').length,
              read: local.filter((m: any) => m.status === 'Read').length,
              replied: local.filter((m: any) => m.status === 'Replied').length,
              today: local.length,
            });
            setError('');
          } else {
            setError(err.message || 'Could not load messages.');
          }
        } catch {
          setError(err.message || 'Could not load messages.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authToken, currentPage, pageSize, searchTerm, statusFilter, dateFilter, customStartDate, customEndDate, showAlert]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time listener: refresh if a new CONTACT_MESSAGE notification arrives
  useEffect(() => {
    if (notifications.length > 0 && notifications[0].type === 'CONTACT_MESSAGE') {
      fetchMessages(false);
    }
  }, [notifications, fetchMessages]);

  // Format Helpers
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  // Status Badge Styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Unread':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Read':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Replied':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Mark message as Read / Unread
  const handleToggleStatus = async (msg: ContactMessage, nextStatus: 'Read' | 'Unread') => {
    try {
      const res = await fetch(`/api/contact/${msg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update message status.');
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: nextStatus } : m))
      );

      setStats((prev) => {
        const unreadDelta = nextStatus === 'Read' ? -1 : 1;
        const readDelta = nextStatus === 'Read' ? 1 : -1;
        return {
          ...prev,
          unread: Math.max(0, prev.unread + unreadDelta),
          read: Math.max(0, prev.read + readDelta),
        };
      });

      if (selectedMessage && selectedMessage.id === msg.id) {
        setSelectedMessage((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      showAlert(err.message || 'Status update failed.', 'error', 'Error');
    }
  };

  // View Message Details (Auto marks as Read if currently Unread)
  const handleViewMessage = async (msg: ContactMessage) => {
    setSelectedMessage(msg);

    // Auto mark as Read if Unread
    if (msg.status === 'Unread') {
      handleToggleStatus(msg, 'Read');
    }

    // Fetch single message with detailed related order detection
    try {
      const res = await fetch(`/api/contact/${msg.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.message) {
        setSelectedMessage(data.message);
      }
    } catch (e) {
      console.error('Error loading message details:', e);
    }
  };

  // Open Reply Composer
  const handleOpenReply = (msg: ContactMessage) => {
    setReplyingMessage(msg);
    setReplySubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
    setReplyText('');
  };

  // Submit Support Reply
  const handleSendReply = async () => {
    if (!replyingMessage || !replyText.trim()) return;
    setSendingReply(true);

    try {
      const res = await fetch(`/api/contact/${replyingMessage.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          subject: replySubject,
          reply_message: replyText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send reply.');
      }

      showAlert(
        data.message || 'Reply sent successfully and message marked as Replied.',
        'success',
        'Reply Sent'
      );

      // Update local state to Replied
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyingMessage.id
            ? {
                ...m,
                status: 'Replied',
                reply_message: replyText.trim(),
                replied_at: new Date().toISOString(),
              }
            : m
        )
      );

      if (selectedMessage && selectedMessage.id === replyingMessage.id) {
        setSelectedMessage((prev) =>
          prev
            ? {
                ...prev,
                status: 'Replied',
                reply_message: replyText.trim(),
                replied_at: new Date().toISOString(),
              }
            : null
        );
      }

      setStats((prev) => ({
        ...prev,
        replied: prev.replied + 1,
        read: Math.max(0, prev.read - 1),
      }));

      setReplyingMessage(null);
    } catch (err: any) {
      showAlert(err.message || 'Failed to send reply.', 'error', 'Error');
    } finally {
      setSendingReply(false);
    }
  };

  // Delete Message Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingMessage) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/contact/${deletingMessage.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete message.');
      }

      showAlert('Message deleted successfully.', 'success', 'Deleted');

      setMessages((prev) => prev.filter((m) => m.id !== deletingMessage.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      if (selectedMessage?.id === deletingMessage.id) {
        setSelectedMessage(null);
      }

      setDeletingMessage(null);
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete message.', 'error', 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* 1. Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Contact Messages</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer inquiries, view message details, and send official email replies.</p>
        </div>

        <button
          type="button"
          onClick={() => fetchMessages(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-black shadow-xs transition active:scale-95 self-start sm:self-auto"
        >
          <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-black' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Messages'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <FiAlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <MetricGrid cols={4}>
        <StatCard
          label="Total Messages"
          value={loading ? '...' : stats.total.toLocaleString()}
          icon={<FiMail size={20} />}
          accent={ACCENT_COLORS[0]}
        />
        <StatCard
          label="Unread Messages"
          value={loading ? '...' : stats.unread.toLocaleString()}
          icon={<FiClock size={20} />}
          accent={ACCENT_COLORS[4]}
        />
        <StatCard
          label="Read Messages"
          value={loading ? '...' : stats.read.toLocaleString()}
          icon={<FiEye size={20} />}
          accent={ACCENT_COLORS[1]}
        />
        <StatCard
          label="Replied"
          value={loading ? '...' : stats.replied.toLocaleString()}
          icon={<FiCheckCircle size={20} />}
          accent={ACCENT_COLORS[3]}
        />
        <StatCard
          label="Received Today"
          value={loading ? '...' : stats.today.toLocaleString()}
          icon={<FiCalendar size={20} />}
          accent={ACCENT_COLORS[2]}
        />
      </MetricGrid>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Live Search Input */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by customer name, email, subject, or message content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-400 shrink-0" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Unread">Unread</option>
              <option value="Read">Read</option>
              <option value="Replied">Replied</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <FiCalendar className="text-slate-400 shrink-0" size={16} />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black cursor-pointer"
            >
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Custom">Custom Date</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs */}
        {dateFilter === 'Custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
            />
            <span className="text-xs font-bold text-slate-500 uppercase">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black"
            />
          </div>
        )}

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Found <strong className="text-slate-900">{totalCount}</strong> messages
          </span>
          {(searchTerm || statusFilter !== 'All' || dateFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setDateFilter('All');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-xs text-black font-semibold hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* 4. Desktop Messages Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Message Preview</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading messages...
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FiInbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No contact messages found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Customer inquiries from the contact form will appear here.</p>
                  </td>
                </tr>
              ) : (
                messages.map((msg) => {
                  const isUnread = msg.status === 'Unread';

                  return (
                    <tr
                      key={msg.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isUnread ? 'bg-amber-50/30 font-medium' : ''
                      }`}
                    >
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>}
                          <span className="font-semibold text-slate-900">{msg.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {msg.email}
                      </td>

                      {/* Subject with detected Order ID pill */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-xs truncate">
                          <span className="font-semibold text-slate-900 truncate">{msg.subject}</span>
                          {msg.related_order_id && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                              {msg.related_order_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Message Preview */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-sm truncate">
                        {msg.message}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                        {formatDate(msg.created_at)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusBadge(
                            msg.status
                          )}`}
                        >
                          {msg.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewMessage(msg)}
                            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition border border-slate-200"
                            title="View Message"
                          >
                            <FiEye size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReply(msg)}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition border border-blue-200"
                            title="Reply to Customer"
                          >
                            <FiCornerUpLeft size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleStatus(msg, msg.status === 'Read' ? 'Unread' : 'Read')
                            }
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition border border-slate-200 text-xs font-bold"
                            title={`Mark as ${msg.status === 'Read' ? 'Unread' : 'Read'}`}
                          >
                            {msg.status === 'Read' ? 'Mark Unread' : 'Mark Read'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingMessage(msg)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-rose-200"
                            title="Delete Message"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Mobile Messages List (Responsive Mobile View) */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              <FiInbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700">No contact messages</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-sm">{msg.name}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(
                      msg.status
                    )}`}
                  >
                    {msg.status}
                  </span>
                </div>

                <div>
                  <h5 className="font-bold text-xs text-slate-800">{msg.subject}</h5>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{msg.message}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>{formatDate(msg.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewMessage(msg)}
                      className="px-2.5 py-1 bg-slate-100 rounded-lg font-semibold text-slate-800"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenReply(msg)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 6. Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{messages.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-slate-900">{Math.min(currentPage * pageSize, totalCount)}</strong> of{' '}
            <strong className="text-slate-900">{totalCount}</strong> Messages
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <FiChevronLeft size={16} />
              </button>

              <span className="px-3 font-semibold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 7. MESSAGE DETAILS MODAL */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-800 rounded-2xl">
                  <FiMail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg sm:text-xl">{selectedMessage.subject}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(selectedMessage.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md border ${getStatusBadge(
                    selectedMessage.status
                  )}`}
                >
                  {selectedMessage.status}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
              {/* Customer Information Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Customer Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedMessage.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Email Address</span>
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {selectedMessage.email}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Phone Number</span>
                  <span className="font-medium text-slate-700">
                    {selectedMessage.phone || 'Not provided'}
                  </span>
                </div>
              </div>

              {/* Related Order Detection Box */}
              {(selectedMessage.related_order || selectedMessage.related_order_id) && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                      <FiShoppingBag size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-indigo-900 block">
                        Related Order: #{selectedMessage.related_order?.id || selectedMessage.related_order_id}
                      </span>
                      {selectedMessage.related_order && (
                        <span className="text-[11px] text-indigo-700">
                          Status: {selectedMessage.related_order.order_status} · Total: Rs. {Number(selectedMessage.related_order.total_amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMessage(null);
                      navigate('/admin/orders');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto"
                  >
                    <span>View Orders</span>
                    <FiExternalLink size={13} />
                  </button>
                </div>
              )}

              {/* Message Content Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Customer Message:
                </span>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedMessage.message}
                </p>
              </div>

              {/* Admin Reply Details if already replied */}
              {selectedMessage.reply_message && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <FiCheckCircle /> Official Support Reply Sent:
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      {formatDateTime(selectedMessage.replied_at || undefined)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-white p-3.5 rounded-xl border border-emerald-100">
                    {selectedMessage.reply_message}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  handleToggleStatus(
                    selectedMessage,
                    selectedMessage.status === 'Read' ? 'Unread' : 'Read'
                  )
                }
                className="text-xs font-semibold text-slate-600 hover:text-black underline"
              >
                Mark as {selectedMessage.status === 'Read' ? 'Unread' : 'Read'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenReply(selectedMessage)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <FiCornerUpLeft /> Reply to Customer
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. REPLY COMPOSER MODAL */}
      {replyingMessage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl p-6 sm:p-7 border border-slate-100 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
                  <FiCornerUpLeft size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Send Reply to Customer</h4>
                  <p className="text-xs text-slate-500">Customer will receive an official email response.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingMessage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Customer Email */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  disabled
                  value={replyingMessage.email}
                  className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold cursor-not-allowed"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:bg-white focus:border-black transition"
                />
              </div>

              {/* Reply Message Textarea */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Reply Message *
                </label>
                <textarea
                  rows={6}
                  placeholder="Type your official support reply here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-black transition resize-none leading-relaxed"
                ></textarea>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={sendingReply}
                onClick={() => setReplyingMessage(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingReply || !replyText.trim()}
                onClick={handleSendReply}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
              >
                <FiSend />
                {sendingReply ? 'Sending Email...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. DELETE CONFIRMATION MODAL */}
      {deletingMessage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                <FiAlertTriangle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Confirm Deletion</h4>
                <p className="text-xs text-slate-500">Contact message from {deletingMessage.name}</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingMessage(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
