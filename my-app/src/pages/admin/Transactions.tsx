import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSearch,
  FiRefreshCw,
  FiX,
  FiFileText,
  FiAlertTriangle,
  FiFilter,
  FiEye,
  FiTag
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';

interface Transaction {
  order_id: string | number;
  transaction_id?: string;
  customer_name: string;
  email?: string;
  phone?: string;
  total_amount: number | string;
  payment_method: string;
  payment_status: string;
  order_status?: string;
  created_at: string;
  transaction_type?: string;
  return_status?: string | null;
  refund_amount?: number | string | null;
}

interface RefundRequest {
  id: number;
  order_id: string;
  reason: string;
  status: string;
  refund_amount: number | string;
  refund_reference: string;
  admin_notes: string;
  created_at: string;
  customer_name: string;
  email: string;
  total_amount: number | string;
  payment_method: string;
  payment_status: string;
}

interface Stats {
  totalTransactions: number;
  successfulAmount: number;
  pendingAmount: number;
  failedAmount: number;
}

// Helpers
export const formatTxnId = (txn: Transaction) => {
  if (txn.transaction_id && txn.transaction_id.startsWith('TXN-') && txn.transaction_id.length > 8) {
    return txn.transaction_id;
  }
  const year = txn.created_at ? new Date(txn.created_at).getFullYear() : 2026;
  const pad = String(txn.order_id || '1').padStart(5, '0');
  return `TXN-${year}-${pad}`;
};

export const formatOrderId = (orderId: string | number) => {
  const str = String(orderId || '');
  if (str.startsWith('ORD-')) return str;
  return `ORD-${str}`;
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Sep 16, 2026';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return dateStr;
  }
};

export const formatMoney = (val: number | string) => {
  const num = Math.round(Number(val) || 0);
  return `Rs. ${num.toLocaleString('en-PK')}`;
};

export const formatMethod = (method: string) => {
  if (!method) return 'Cash';
  const m = method.toLowerCase();
  if (m.includes('card') || m.includes('stripe')) return 'Card';
  if (m.includes('jazz')) return 'JazzCash';
  if (m.includes('easy') || m.includes('paisa')) return 'EasyPaisa';
  if (m.includes('cod') || m.includes('cash')) return 'Cash';
  return method;
};

export const getTransactionType = (txn: Transaction): 'Payment' | 'Refund' => {
  if (txn.transaction_type) {
    return txn.transaction_type.toLowerCase() === 'refund' ? 'Refund' : 'Payment';
  }
  const s = (txn.payment_status || '').toLowerCase();
  if (s === 'refunded' || txn.return_status === 'Refunded') {
    return 'Refund';
  }
  return 'Payment';
};

export default function Transactions() {
  const { showAlert } = useAdminAlert();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    successfulAmount: 0,
    pendingAmount: 0,
    failedAmount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterMethod, setFilterMethod] = useState('All');

  // View Details Modal State (Receipt removed)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Status updating state
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  // Helper: get auth token
  const getAuthToken = () => {
    try {
      const user = JSON.parse(localStorage.getItem('shophub_user') || 'null');
      return user?.token || '';
    } catch {
      return '';
    }
  };

  // Fetch all transactions and stats
  const fetchData = useCallback(async (showToast = false) => {
    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [txnRes, refRes] = await Promise.all([
        fetch('/api/admin/transactions', { headers }),
        fetch('/api/admin/transactions/refunds', { headers }),
      ]);

      const txnData = await txnRes.json();
      const refData = await refRes.json();

      if (txnRes.ok && txnData.success) {
        setTransactions(txnData.transactions || []);
        if (txnData.stats) setStats(txnData.stats);
      } else {
        throw new Error(txnData.message || 'Failed to load transactions.');
      }

      if (refRes.ok && refData.success) {
        setRefunds(refData.refunds || []);
      }

      if (showToast) {
        showAlert('Transaction data has been refreshed successfully.', 'success', 'Updated');
      }
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      showAlert(err.message || 'Failed to load data. Please try again.', 'error', 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle status update
  const handleStatusChange = async (orderId: string | number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/transactions/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update status. Please try again.');
      }

      showAlert(`Payment status for Order #${orderId} has been updated to "${newStatus}".`, 'success', 'Status Updated');
      
      // Update locally immediately
      setTransactions((prev) =>
        prev.map((t) => (t.order_id === orderId ? { ...t, payment_status: newStatus } : t))
      );
      if (selectedTransaction && selectedTransaction.order_id === orderId) {
        setSelectedTransaction((prev) => (prev ? { ...prev, payment_status: newStatus } : null));
      }

      fetchData(false);
    } catch (err: any) {
      showAlert(err.message || 'Failed to change status. Please try again.', 'error', 'Error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle refund action
  const handleRefundAction = async (refundId: number, action: 'approve' | 'reject') => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/transactions/refunds/${refundId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to process refund action. Please try again.');
      }

      showAlert(data.message || `Refund request has been ${action === 'approve' ? 'approved' : 'rejected'} successfully.`, 'success', 'Refund Processed');
      fetchData(false);
    } catch (err: any) {
      showAlert(err.message || 'Failed to process refund. Please try again.', 'error', 'Error');
    }
  };

  // Format short money for KPI
  const formatKpiMoney = (num: number) => {
    if (num >= 1000000) return `Rs. ${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `Rs. ${(num / 1000).toFixed(1)}k`;
    return `Rs. ${num.toLocaleString()}`;
  };

  // Status Badge styles
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'unpaid':
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'refunded':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'paid':
        return <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      case 'unpaid':
      case 'pending':
        return <FiClock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      case 'failed':
        return <FiXCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
      case 'refunded':
        return <FiRefreshCw className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
      default:
        return null;
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchTerm.toLowerCase().trim();
      const txnId = formatTxnId(t).toLowerCase();
      const ordId = formatOrderId(t.order_id).toLowerCase();
      const custName = (t.customer_name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      const method = formatMethod(t.payment_method).toLowerCase();
      const type = getTransactionType(t).toLowerCase();
      const status = (t.payment_status || '').toLowerCase();

      const matchesSearch =
        !q ||
        txnId.includes(q) ||
        ordId.includes(q) ||
        custName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        String(t.total_amount).includes(q);

      const matchesStatus = filterStatus === 'All' || status === filterStatus.toLowerCase();
      const matchesType = filterType === 'All' || type === filterType.toLowerCase();
      const matchesMethod = filterMethod === 'All' || method.includes(filterMethod.toLowerCase());

      return matchesSearch && matchesStatus && matchesType && matchesMethod;
    });
  }, [transactions, searchTerm, filterStatus, filterType, filterMethod]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500 text-sm mt-1">Live customer transactions, payments, reconciliations, and refunds tracking.</p>
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
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* KPI Stats Cards via MetricGrid */}
      <MetricGrid cols={4}>
        <StatCard
          label="Total Transactions"
          value={loading ? '...' : stats.totalTransactions.toLocaleString()}
          icon={<FiDollarSign size={20} />}
          accent={ACCENT_COLORS[0]}
        />
        <StatCard
          label="Successful (Paid)"
          value={loading ? '...' : formatKpiMoney(stats.successfulAmount)}
          icon={<FiCheckCircle size={20} />}
          accent={ACCENT_COLORS[1]}
        />
        <StatCard
          label="Pending / Unpaid"
          value={loading ? '...' : formatKpiMoney(stats.pendingAmount)}
          icon={<FiClock size={20} />}
          accent={ACCENT_COLORS[3]}
        />
        <StatCard
          label="Failed / Refunded"
          value={loading ? '...' : formatKpiMoney(stats.failedAmount)}
          icon={<FiXCircle size={20} />}
          accent={ACCENT_COLORS[6]}
        />
      </MetricGrid>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Transaction ID, Order ID, Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition"
            />
          </div>

          {/* Filter Type */}
          <div className="flex items-center gap-2">
            <FiTag className="text-slate-400 shrink-0" size={16} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
            >
              <option value="All">All Types</option>
              <option value="Payment">Payment</option>
              <option value="Refund">Refund</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-400 shrink-0" size={16} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Refunded">Refunded</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {/* Filter Method */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
          >
            <option value="All">All Methods</option>
            <option value="Card">Card</option>
            <option value="JazzCash">JazzCash</option>
            <option value="EasyPaisa">EasyPaisa</option>
            <option value="Cash">Cash on Delivery</option>
          </select>
        </div>

        {/* Transactions Table: Exact requested structure */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Method</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FiFileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => {
                  const txnId = formatTxnId(txn);
                  const orderId = formatOrderId(txn.order_id);
                  const formattedDate = formatDate(txn.created_at);
                  const method = formatMethod(txn.payment_method);
                  const type = getTransactionType(txn);
                  const isUpdating = updatingId === txn.order_id;

                  return (
                    <tr key={txn.order_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Transaction ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900">
                        {txnId}
                      </td>

                      {/* Order ID */}
                      <td className="py-3.5 px-4 font-semibold text-xs text-slate-700">
                        {orderId}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900">{txn.customer_name || 'Customer'}</span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {formattedDate}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(txn.total_amount)}
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">
                          {method}
                        </span>
                      </td>

                      {/* Status - read-only badge; update via View Details */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusBadge(
                            txn.payment_status
                          )}`}
                        >
                          {getStatusIcon(txn.payment_status)}
                          {txn.payment_status || 'Pending'}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${
                            type === 'Refund'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {type}
                        </span>
                      </td>

                      {/* Actions: 👁 View */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedTransaction(txn)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition active:scale-95 shadow-xs"
                          title="View Details"
                        >
                          <FiEye className="w-3.5 h-3.5 text-slate-600" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Refund Requests Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="text-amber-500 w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-lg">Refund & Return Requests</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {refunds.length}
            </span>
          </div>
        </div>

        {refunds.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <FiCheckCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No pending refund requests.</p>
            <p className="text-xs text-slate-400 mt-0.5">Customer return requests will appear here once submitted.</p>

          </div>
        ) : (
          <div className="space-y-3">
            {refunds.map((ref) => {
              const isPending = ref.status === 'Requested' || ref.status === 'Received';
              return (
                <div
                  key={ref.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 bg-slate-50/70 rounded-xl gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{formatOrderId(ref.order_id)}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-sm font-semibold text-slate-700">{ref.customer_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          ref.status === 'Refunded'
                            ? 'bg-purple-100 text-purple-700'
                            : ref.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {ref.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-semibold text-slate-800">Refund Amount:</span> {formatMoney(ref.refund_amount || ref.total_amount)}{' '}
                      | <span className="font-semibold text-slate-800">Reason:</span> {ref.reason}
                    </p>
                    {ref.refund_reference && (
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Ref: {ref.refund_reference}</p>
                    )}
                  </div>

                  {isPending ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRefundAction(ref.id, 'approve')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs active:scale-95"
                      >
                        Approve Refund
                      </button>
                      <button
                        onClick={() => handleRefundAction(ref.id, 'reject')}
                        className="px-3.5 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition active:scale-95"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 italic">
                      Processed as {ref.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Details Modal (Receipt option replaced with clean details view) */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <FiEye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Transaction Details</h3>
                  <p className="text-xs font-mono text-slate-500">{formatTxnId(selectedTransaction)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
              {/* Highlight Amount Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Transaction Amount</span>
                  <span className="text-2xl sm:text-3xl font-extrabold">{formatMoney(selectedTransaction.total_amount)}</span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    getTransactionType(selectedTransaction) === 'Refund'
                      ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                      : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                  }`}>
                    {getTransactionType(selectedTransaction)}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                    (selectedTransaction.payment_status || '').toLowerCase() === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                  }`}>
                    {selectedTransaction.payment_status || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Transaction ID</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">{formatTxnId(selectedTransaction)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Order ID</span>
                  <span className="font-bold text-slate-900 text-xs">{formatOrderId(selectedTransaction.order_id)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Customer Name</span>
                  <span className="font-semibold text-slate-900">{selectedTransaction.customer_name || 'Customer'}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Customer Contact</span>
                  <span className="font-medium text-slate-700">{selectedTransaction.phone || selectedTransaction.email || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Date & Time</span>
                  <span className="font-medium text-slate-800">{formatDateTime(selectedTransaction.created_at)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Payment Method</span>
                  <span className="font-semibold text-slate-900">{formatMethod(selectedTransaction.payment_method)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Order Status</span>
                  <span className="font-semibold text-slate-800">{selectedTransaction.order_status || 'Active'}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Transaction Type</span>
                  <span className="font-semibold text-slate-900">{getTransactionType(selectedTransaction)}</span>
                </div>
              </div>

              {/* Quick Status Update Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Update Payment Status</span>
                  <span className="text-[11px] text-slate-500">Change status directly for this transaction</span>
                </div>
                <select
                  disabled={updatingId === selectedTransaction.order_id}
                  value={selectedTransaction.payment_status || 'Pending'}
                  onChange={(e) => handleStatusChange(selectedTransaction.order_id, e.target.value)}
                  className={`text-xs font-bold px-3 py-2 rounded-lg border cursor-pointer focus:outline-none transition ${getStatusBadge(
                    selectedTransaction.payment_status
                  )}`}
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              {selectedTransaction.refund_amount && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900">
                  <span className="font-bold">Refund Info:</span> {formatMoney(selectedTransaction.refund_amount)} (Status: {selectedTransaction.return_status || 'Refunded'})
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedTransaction(null)}
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
