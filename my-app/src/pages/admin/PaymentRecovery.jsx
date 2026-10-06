import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiSearch,
  FiRefreshCw,
  FiEye,
  FiCheck,
  FiX,
  FiFilter,
  FiShoppingCart,
  FiFileText,
  FiPackage,
  FiPhone,
  FiMail,
  FiMapPin
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';

export default function PaymentRecovery() {
  const { showAlert } = useAdminAlert();

  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    totalRecoverableAmount: 0,
    unpaidOrdersCount: 0,
    abandonedCheckoutsCount: 0,
    failedPaymentsCount: 0,
    totalItems: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterMethod, setFilterMethod] = useState('All');

  // Details Modal
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeItemId, setActiveItemId] = useState(null);

  // Safe Token retrieval
  const getAuthToken = () => {
    try {
      const user = JSON.parse(localStorage.getItem('shophub_user') || 'null');
      return user?.token || '';
    } catch {
      return '';
    }
  };

  // Fetch Recovery Queue Data
  const fetchData = useCallback(async (showToast = false) => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/orders/payments/admin/pending?page=1', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'The payment recovery queue could not be loaded.');
      }

      setRows(data.rows || []);
      if (data.stats) {
        setStats(data.stats);
      }

      if (showToast) {
        showAlert('Payment recovery data refreshed successfully.', 'success', 'Updated');
      }
    } catch (err) {
      console.error('Error fetching recovery data:', err);
      showAlert(err.message || 'Failed to load data.', 'error', 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mark as Recovered / Paid
  const handleRecover = async (item) => {
    setBusyId(item.id);
    try {
      const token = getAuthToken();
      const url = item.type === 'order'
        ? `/api/orders/payments/admin/order/${item.id}/recover`
        : `/api/orders/payments/admin/${item.id}/reconcile`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Payment could not be recovered.');
      }

      showAlert(data.message || `${item.id} payment recovered successfully!`, 'success', 'Recovered');

      // Update locally
      setRows((prev) => prev.filter((r) => r.id !== item.id));
      setStats((prev) => ({
        ...prev,
        totalRecoverableAmount: Math.max(0, prev.totalRecoverableAmount - Number(item.amount || 0)),
        unpaidOrdersCount: Math.max(0, prev.unpaidOrdersCount - 1),
        totalItems: Math.max(0, prev.totalItems - 1),
      }));

      if (selectedDetails && activeItemId === item.id) {
        setSelectedDetails(null);
      }
    } catch (err) {
      showAlert(err.message || 'Reconciliation failed', 'error', 'Error');
    } finally {
      setBusyId(null);
    }
  };

  // Cancel Order / Checkout
  const handleCancel = async (item) => {
    if (!window.confirm(`Do you want to cancel the transaction ${item.id}?`)) return;
    setBusyId(item.id);
    try {
      const token = getAuthToken();
      const url = item.type === 'order'
        ? `/api/orders/payments/admin/order/${item.id}/cancel`
        : `/api/orders/payments/admin/${item.id}/cancel`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Transaction could not be cancelled.');
      }

      showAlert(`${item.id} transaction cancelled successfully.`, 'info', 'Cancelled');
      setRows((prev) => prev.filter((r) => r.id !== item.id));
      if (selectedDetails && activeItemId === item.id) {
        setSelectedDetails(null);
      }
    } catch (err) {
      showAlert(err.message || 'Action failed', 'error', 'Error');
    } finally {
      setBusyId(null);
    }
  };

  // View Details
  const handleViewDetails = async (id) => {
    setActiveItemId(id);
    setDetailsLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/orders/payments/admin/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Details could not be loaded.');
      }
      setSelectedDetails(data);
    } catch (err) {
      showAlert(err.message || 'Details could not be loaded.', 'error', 'Error');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Format currency
  const formatMoney = (val) => {
    const num = Math.round(Number(val) || 0);
    return `Rs. ${num.toLocaleString('en-PK')}`;
  };

  // Format short money for KPI
  const formatKpiMoney = (num) => {
    const n = Number(num) || 0;
    if (n >= 1000000) return `Rs. ${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `Rs. ${(n / 1000).toFixed(1)}k`;
    return `Rs. ${n.toLocaleString()}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = searchTerm.toLowerCase().trim();
      const id = (r.id || '').toLowerCase();
      const name = (r.customer_name || '').toLowerCase();
      const email = (r.email || '').toLowerCase();
      const phone = (r.phone || '').toLowerCase();
      const method = (r.payment_method || '').toLowerCase();
      const state = (r.state || '').toLowerCase();

      const matchesSearch =
        !q || id.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q) || String(r.amount).includes(q);

      const matchesType = filterType === 'All' || r.type === filterType.toLowerCase();
      const matchesStatus = filterStatus === 'All' || state === filterStatus.toLowerCase();
      const matchesMethod = filterMethod === 'All' || method.includes(filterMethod.toLowerCase());

      return matchesSearch && matchesType && matchesStatus && matchesMethod;
    });
  }, [rows, searchTerm, filterType, filterStatus, filterMethod]);

  const getStatusBadge = (state) => {
    const s = (state || '').toLowerCase();
    switch (s) {
      case 'paid':
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'unpaid':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'pending':
      case 'awaiting_payment':
      case 'paid_pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
      case 'needs_review':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Payment Recovery</h1>
          <p className="text-slate-500 text-sm mt-1">
            Unpaid orders, pending payment collections, aur incomplete online checkout sessions ko track aur recover.
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchData(true);
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-black shadow-xs transition active:scale-95 self-start sm:self-auto"
        >
          <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-black' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </div>

      {/* KPI Stats Cards */}
      <MetricGrid cols={4}>
        <StatCard
          label="Total Recoverable"
          value={loading ? '...' : formatKpiMoney(stats.totalRecoverableAmount)}
          icon={<FiDollarSign size={20} />}
          accent={ACCENT_COLORS[0]}
        />
        <StatCard
          label="Unpaid Orders"
          value={loading ? '...' : stats.unpaidOrdersCount.toLocaleString()}
          icon={<FiClock size={20} />}
          accent={ACCENT_COLORS[3]}
        />
        <StatCard
          label="Abandoned Checkouts"
          value={loading ? '...' : stats.abandonedCheckoutsCount.toLocaleString()}
          icon={<FiShoppingCart size={20} />}
          accent={ACCENT_COLORS[1]}
        />
        <StatCard
          label="Needs Attention"
          value={loading ? '...' : stats.failedPaymentsCount.toLocaleString()}
          icon={<FiAlertTriangle size={20} />}
          accent={ACCENT_COLORS[6]}
        />
      </MetricGrid>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Order ID, Customer name, Phone, Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition"
            />
          </div>

          {/* Filter Source Type */}
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-400 shrink-0" size={16} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
            >
              <option value="All">All Sources</option>
              <option value="order">Unpaid Orders</option>
              <option value="checkout">Online Checkouts</option>
            </select>
          </div>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
          >
            <option value="All">All Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
            <option value="needs_review">Needs Review</option>
          </select>

          {/* Filter Method */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
          >
            <option value="All">All Methods</option>
            <option value="Cash">Cash on Delivery</option>
            <option value="Card">Card</option>
            <option value="Stripe">Stripe</option>
          </select>
        </div>

        {/* Recovery Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Reference / ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Method</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Issue / Note</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading payment recovery queue...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FiCheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="font-semibold text-slate-700">No any pending or unpaid payment!</p>
                    <p className="text-xs text-slate-400 mt-0.5">All payments are reconciled and up to date.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => {
                  const isBusy = busyId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Reference / ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{item.id}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${item.type === 'order'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                          >
                            {item.type}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 leading-tight">{item.customer_name || 'Customer'}</p>
                        <p className="text-xs text-slate-400">{item.phone || item.email || '-'}</p>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(item.amount)}
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">
                          {item.payment_method}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusBadge(
                            item.state
                          )}`}
                        >
                          {item.state}
                        </span>
                      </td>

                      {/* Issue / Note */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[200px] truncate" title={item.last_error_code}>
                        {item.last_error_code || 'Awaiting Payment Collection'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => handleViewDetails(item.id)}
                            className="p-1.5 bg-blue-600 text-white hover:text-blue-600 hover:bg-blue-300 rounded-lg transition border border-slate-200 shadow-xs"
                            title="View Customer & Items Details"
                          >
                            <FiEye size={15} />
                          </button>

                          {/* Recover / Mark Paid */}
                          <button
                            disabled={isBusy}
                            onClick={() => handleRecover(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50"
                            title="Mark as Paid / Recover Payment"
                          >
                            <FiCheck size={14} />
                            <span>{isBusy ? '...' : 'Recover'}</span>
                          </button>

                          {/* Cancel */}
                          <button
                            disabled={isBusy}
                            onClick={() => handleCancel(item)}
                            className="p-1.5 bg-red-600 text-white hover:text-red-600 hover:bg-red-300 rounded-lg transition border border-slate-200"
                            title="Cancel / Void"
                          >
                            <FiX size={15} />
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
      </div>

      {/* View Details Modal */}
      {(selectedDetails || detailsLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <FiFileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Recovery Details</h3>
                  <p className="text-xs font-mono text-slate-500">{activeItemId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
              {detailsLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                  Details are loading...
                </div>
              ) : selectedDetails ? (
                <>
                  {/* Amount Banner */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Total Amount</span>
                      <span className="text-2xl sm:text-3xl font-extrabold">{formatMoney(selectedDetails.quote?.grandTotal || 0)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getStatusBadge(selectedDetails.state)}`}>
                        {selectedDetails.state || 'Unpaid'}
                      </span>
                      <span className="text-[11px] text-slate-300">
                        {selectedDetails.type === 'order' ? 'Pending Order' : 'Checkout Session'}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <FiPackage className="text-slate-500" /> Customer Information
                    </h4>
                    <p className="font-semibold text-slate-800">{selectedDetails.customer?.name || 'Customer'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <FiMail className="text-slate-400" /> {selectedDetails.customer?.email || '-'}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <FiPhone className="text-slate-400" /> {selectedDetails.customer?.phone || '-'}
                      </p>
                    </div>
                    {selectedDetails.customer?.address && (
                      <p className="flex items-start gap-1.5 text-slate-600 pt-1 border-t border-slate-200/60">
                        <FiMapPin className="text-slate-400 shrink-0 mt-0.5" />
                        <span>{selectedDetails.customer.address}, {selectedDetails.customer.city}</span>
                      </p>
                    )}
                  </div>

                  {/* Order Items */}
                  {selectedDetails.quote?.lines && selectedDetails.quote.lines.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                        Ordered Items ({selectedDetails.quote.lines.length})
                      </h4>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {selectedDetails.quote.lines.map((line, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-slate-800">{line.name}</p>
                              <p className="text-[11px] text-slate-400">SKU: {line.sku || '—'} • Qty: {line.quantity}</p>
                            </div>
                            {line.price && (
                              <span className="font-bold text-slate-900">{formatMoney(line.price)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recovery Action inside modal */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block">Mark this Payment as Received?</span>
                      <span className="text-[11px] text-emerald-700">Order will be updated to "Paid" and recorded.</span>
                    </div>
                    <button
                      disabled={busyId === activeItemId}
                      onClick={() => {
                        const target = rows.find((r) => r.id === activeItemId);
                        if (target) handleRecover(target);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      {busyId === activeItemId ? 'Recovering...' : 'Mark as Paid'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedDetails(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-semibold transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
