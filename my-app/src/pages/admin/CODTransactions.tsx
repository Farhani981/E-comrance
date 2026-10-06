import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiDollarSign,
  FiTruck,
  FiSearch,
  FiFilter,
  FiEye,
  FiRefreshCw,
  FiPlus,
  FiX,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiLayers,
  FiExternalLink,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiCheck,
  FiUser,
  FiPackage,
  FiTrendingUp,
  FiInbox
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';

interface CODTransaction {
  id: number;
  transaction_id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  courier_id?: number | null;
  courier_name: string;
  tracking_number?: string | null;
  order_total: number | string;
  cod_amount: number | string;
  courier_charges: number | string;
  other_deductions: number | string;
  expected_settlement: number | string;
  actual_settlement: number | string;
  difference: number | string;
  payment_status: string;
  settlement_status: string;
  settlement_id?: number | null;
  settlement_number?: string | null;
  bank_reference?: string | null;
  delivery_date?: string | null;
  settlement_date?: string | null;
  reconciled_at?: string | null;
  reconciled_by?: number | null;
  reconciled_by_name?: string | null;
  reconciliation_reference?: string | null;
  notes?: string | null;
  order_status?: string;
  created_at: string;
  items?: any[];
  adjustments?: any[];
  auditLogs?: any[];
}

interface CODStats {
  totalCodOrders: number;
  codAmount: number;
  collectedByCourier: number;
  settlementPending: number;
  partiallySettled: number;
  settledAmount: number;
  reconciledAmount: number;
  outstandingAmount: number;
  totalDeductions: number;
  totalDiscrepancy: number;
  discrepancyCount: number;
}

export const formatMoney = (val: number | string | null | undefined) => {
  const num = Math.round(Number(val) || 0);
  return `Rs. ${num.toLocaleString('en-PK')}`;
};

export const formatDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(d);
  }
};

export const formatDateTime = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })} at ${dt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return String(d);
  }
};

export const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case 'COD Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Collected by Courier':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Settlement Pending':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Partially Settled':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Settled':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Reconciled':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Discrepancy':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Refunded':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Failed / Uncollectable':
      return 'bg-slate-100 text-slate-600 border-slate-300';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export const getSettlementStatusBadge = (status: string) => {
  switch (status) {
    case 'Unsettled':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'Settlement Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Partially Settled':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Settled':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Reconciled':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Discrepancy':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export default function CODTransactions() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const token = user?.token || '';

  // Data states
  const [transactions, setTransactions] = useState<CODTransaction[]>([]);
  const [stats, setStats] = useState<CODStats | null>(null);
  const [couriersList, setCouriersList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [courierFilter, setCourierFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [settlementStatusFilter, setSettlementStatusFilter] = useState('All');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [reconciledFilter, setReconciledFilter] = useState('all');
  const [discrepancyFilter, setDiscrepancyFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Selection for Batch Settlement Creation
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [selectedTxn, setSelectedTxn] = useState<CODTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<CODTransaction | null>(null);

  // Adjustment form state
  const [adjType, setAdjType] = useState('Charge Correction');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjDocUrl, setAdjDocUrl] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  // Batch Settlement form state
  const [batchCourier, setBatchCourier] = useState('Trax Logistics');
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchBankRef, setBatchBankRef] = useState('');
  const [batchActualSettlement, setBatchActualSettlement] = useState('');
  const [batchIsPartial, setBatchIsPartial] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchAttachment, setBatchAttachment] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Fetch Couriers list
  useEffect(() => {
    fetch('/api/admin/cod/couriers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.couriers)) {
          setCouriersList(data.couriers);
        }
      })
      .catch(() => {});
  }, [token]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cod/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch {}
  }, [token]);

  // Fetch Transactions List
  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        courier: courierFilter,
        payment_status: paymentStatusFilter,
        settlement_status: settlementStatusFilter,
        order_status: orderStatusFilter,
        reconciled: reconciledFilter,
        discrepancy: discrepancyFilter,
      });

      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);

      const res = await fetch(`/api/admin/cod/transactions?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load COD transactions');
      }

      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, search, courierFilter, paymentStatusFilter, settlementStatusFilter, orderStatusFilter, reconciledFilter, discrepancyFilter, startDate, endDate, token]);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [fetchTransactions, fetchStats]);

  // Handle Preset Date changes
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = yest.toISOString().split('T')[0];
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'last7') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(d7.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'last30') {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(d30.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
    setPage(1);
  };

  // Open Transaction Details Modal
  const openTransactionDetails = async (txnId: number | string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/cod/transactions/${txnId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        setSelectedTxn(data.transaction);
      } else {
        throw new Error(data.message || 'Transaction details not found');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Lookup Failed');
    } finally {
      setDetailLoading(false);
    }
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Selected transactions summary for batch creation
  const selectedTransactions = useMemo(() => {
    return transactions.filter(t => selectedIds.includes(t.id));
  }, [transactions, selectedIds]);

  const selectedCalculations = useMemo(() => {
    const totalCod = selectedTransactions.reduce((acc, t) => acc + Number(t.cod_amount || 0), 0);
    const totalCharges = selectedTransactions.reduce((acc, t) => acc + Number(t.courier_charges || 0), 0);
    const totalDeductions = selectedTransactions.reduce((acc, t) => acc + Number(t.other_deductions || 0), 0);
    const expected = Math.max(0, totalCod - totalCharges - totalDeductions);
    return { totalCod, totalCharges, totalDeductions, expected };
  }, [selectedTransactions]);

  // Open Batch Settlement Modal
  const handleOpenBatchModal = () => {
    if (selectedTransactions.length === 0) return;
    const firstCourier = selectedTransactions[0]?.courier_name || 'Trax Logistics';
    setBatchCourier(firstCourier);
    setBatchActualSettlement(String(selectedCalculations.expected));
    setBatchIsPartial(false);
    setBatchBankRef('');
    setBatchNotes('');
    setShowBatchModal(true);
  };

  // Submit Batch Settlement
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchSubmitting) return;

    if (!batchBankRef.trim()) {
      showAlert('Bank Reference / Transaction ID is required for courier settlement.', 'warning', 'Missing Field');
      return;
    }

    const actual = Number(batchActualSettlement);
    if (isNaN(actual) || actual < 0) {
      showAlert('Enter a valid non-negative actual settlement amount.', 'warning', 'Invalid Amount');
      return;
    }

    setBatchSubmitting(true);
    try {
      const res = await fetch('/api/admin/cod/settlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          courier_name: batchCourier,
          settlement_date: batchDate,
          bank_reference: batchBankRef.trim(),
          transaction_ids: selectedIds,
          actual_settlement: actual,
          notes: batchNotes.trim() || null,
          attachment_url: batchAttachment.trim() || null,
          is_partial: batchIsPartial
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Settlement batch creation failed.');
      }

      showAlert(`Batch ${data.settlement_number} created with ${selectedIds.length} orders. Status: ${data.settlement_status}`, 'success', 'Settlement Recorded');
      setShowBatchModal(false);
      setSelectedIds([]);
      fetchTransactions(true);
      fetchStats();
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Submit Financial Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustmentModal || adjSubmitting) return;

    const amt = Number(adjAmount);
    if (isNaN(amt) || amt === 0) {
      showAlert('Please enter a valid adjustment amount.', 'warning', 'Invalid Amount');
      return;
    }
    if (!adjReason.trim()) {
      showAlert('Please provide a reason for the adjustment.', 'warning', 'Reason Required');
      return;
    }

    setAdjSubmitting(true);
    try {
      const res = await fetch(`/api/admin/cod/transactions/${showAdjustmentModal.id}/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          adjustment_type: adjType,
          amount: amt,
          reason: adjReason.trim(),
          document_url: adjDocUrl.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to add adjustment.');
      }

      showAlert(`Adjustment of Rs. ${amt} recorded for Order #${showAdjustmentModal.order_id}.`, 'success', 'Adjustment Added');
      setShowAdjustmentModal(null);
      setAdjAmount('');
      setAdjReason('');
      setAdjDocUrl('');
      fetchTransactions(true);
      fetchStats();
      if (selectedTxn && selectedTxn.id === showAdjustmentModal.id) {
        openTransactionDetails(showAdjustmentModal.id);
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Adjustment Failed');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // Tracking link helper
  const getTrackingUrl = (courier?: string | null, trk?: string | null) => {
    if (!trk) return null;
    const c = (courier || '').toLowerCase();
    if (c.includes('trax')) return `https://trax.pk/tracking?tracking_number=${encodeURIComponent(trk)}`;
    if (c.includes('tcs')) return `https://www.tcsexpress.com/tracking?tracking_no=${encodeURIComponent(trk)}`;
    if (c.includes('leopard')) return `https://leopardscourier.com/tracking/?track=${encodeURIComponent(trk)}`;
    if (c.includes('callcourier')) return `https://callcourier.com.pk/tracking/?cn=${encodeURIComponent(trk)}`;
    if (c.includes('postex')) return `https://postex.pk/tracking?cn=${encodeURIComponent(trk)}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${courier || 'Courier'} tracking ${trk}`)}`;
  };

  return (
    <div className="space-y-6 pb-12 bg-white">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <FiTruck size={22} />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">COD Transactions</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Cash on Delivery order settlements, courier remittances, and financial reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => { fetchTransactions(true); fetchStats(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleOpenBatchModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
            >
              <FiLayers size={14} />
              Create Settlement Batch ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      {stats && (
        <MetricGrid cols={4}>
          <StatCard
            label="Total COD Volume"
            value={formatMoney(stats.codAmount)}
            sub={`${stats.totalCodOrders} COD orders placed`}
            icon={<FiDollarSign size={20} />}
          />
          <StatCard
            label="Collected by Courier"
            value={formatMoney(stats.collectedByCourier)}
            sub="Delivered to customer, awaiting settlement"
            icon={<FiTruck size={20} />}
          />
          <StatCard
            label="Settled & Reconciled"
            value={formatMoney(stats.settledAmount)}
            sub={`Reconciled: ${formatMoney(stats.reconciledAmount)}`}
            icon={<FiCheckCircle size={20} />}
          />
          <StatCard
            label="Outstanding & Variance"
            value={formatMoney(stats.outstandingAmount)}
            sub={stats.discrepancyCount > 0 ? `⚠️ ${stats.discrepancyCount} discrepancy items (${formatMoney(stats.totalDiscrepancy)})` : 'All items balanced'}
            icon={<FiAlertTriangle size={20} />}
          />
        </MetricGrid>
      )}

      {/* 3. Filter Bar */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="col-span-1 sm:col-span-2 relative">
            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by Order ID, Transaction ID, Tracking #, Customer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-black transition"
            />
          </div>

          {/* Courier Filter */}
          <div>
            <select
              value={courierFilter}
              onChange={(e) => { setCourierFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
            >
              <option value="All">All Couriers</option>
              {couriersList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentStatusFilter}
              onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
            >
              <option value="All">All Payment Statuses</option>
              <option value="COD Pending">COD Pending</option>
              <option value="Collected by Courier">Collected by Courier</option>
              <option value="Settlement Pending">Settlement Pending</option>
              <option value="Partially Settled">Partially Settled</option>
              <option value="Settled">Settled</option>
              <option value="Reconciled">Reconciled</option>
              <option value="Discrepancy">Discrepancy</option>
              <option value="Refunded">Refunded</option>
              <option value="Failed / Uncollectable">Failed / Uncollectable</option>
            </select>
          </div>

          {/* Settlement Status Filter */}
          <div>
            <select
              value={settlementStatusFilter}
              onChange={(e) => { setSettlementStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
            >
              <option value="All">All Settlement Statuses</option>
              <option value="Unsettled">Unsettled</option>
              <option value="Settlement Pending">Settlement Pending</option>
              <option value="Partially Settled">Partially Settled</option>
              <option value="Settled">Settled</option>
              <option value="Reconciled">Reconciled</option>
              <option value="Discrepancy">Discrepancy</option>
            </select>
          </div>
        </div>

        {/* Secondary Row: Date Presets & Custom Dates */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <FiCalendar size={13} /> Date Range:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'last30', label: 'Last 30 Days' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePresetChange(p.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  datePreset === p.id ? 'bg-black text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); setPage(1); }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); setPage(1); }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
            />

            {/* Quick Discrepancy toggle */}
            <button
              type="button"
              onClick={() => {
                setDiscrepancyFilter(prev => prev === 'has_discrepancy' ? 'all' : 'has_discrepancy');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                discrepancyFilter === 'has_discrepancy'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ⚠️ Discrepancies Only
            </button>
          </div>
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <FiRefreshCw className="animate-spin" size={24} />
            <p className="text-xs font-medium">Loading COD transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <FiInbox size={36} />
            <p className="text-sm font-semibold text-slate-700">No COD Transactions Found</p>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              No orders matched the current filters. Adjust your search keywords or clear status filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === transactions.length && transactions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-black focus:ring-black"
                    />
                  </th>
                  <th className="p-3.5">Txn ID / Order ID</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Courier & Tracking</th>
                  <th className="p-3.5 text-right">Order Total</th>
                  <th className="p-3.5 text-right">COD Collected</th>
                  <th className="p-3.5 text-right">Deductions</th>
                  <th className="p-3.5 text-right">Expected</th>
                  <th className="p-3.5 text-right">Actual</th>
                  <th className="p-3.5 text-right">Diff</th>
                  <th className="p-3.5">Payment Status</th>
                  <th className="p-3.5">Settlement Status</th>
                  <th className="p-3.5">Delivered</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn) => {
                  const isSelected = selectedIds.includes(txn.id);
                  const diff = Number(txn.difference || 0);
                  const totalDeductions = Number(txn.courier_charges || 0) + Number(txn.other_deductions || 0);
                  const trackingUrl = getTrackingUrl(txn.courier_name, txn.tracking_number);

                  return (
                    <tr
                      key={txn.id}
                      className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(txn.id)}
                          className="rounded border-slate-300 text-black focus:ring-black"
                        />
                      </td>

                      {/* Transaction & Order ID */}
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-slate-900 block">{txn.transaction_id}</span>
                        <span className="text-[11px] text-slate-500 font-mono">#{txn.order_id}</span>
                      </td>

                      {/* Customer */}
                      <td className="p-3.5 max-w-[150px]">
                        <span className="font-bold text-slate-800 block truncate">{txn.customer_name}</span>
                        <span className="text-[11px] text-slate-400 block truncate">{txn.customer_phone || txn.customer_email}</span>
                      </td>

                      {/* Courier & Tracking */}
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800 block">{txn.courier_name || 'Standard Courier'}</span>
                        {txn.tracking_number ? (
                          trackingUrl ? (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-mono text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                            >
                              {txn.tracking_number} <FiExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-500">{txn.tracking_number}</span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No tracking yet</span>
                        )}
                      </td>

                      {/* Financials */}
                      <td className="p-3.5 text-right font-medium text-slate-600">{formatMoney(txn.order_total)}</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">{formatMoney(txn.cod_amount)}</td>
                      <td className="p-3.5 text-right text-slate-500">
                        <span>- {formatMoney(totalDeductions)}</span>
                        {Number(txn.other_deductions) > 0 && (
                          <span className="text-[10px] text-amber-600 block">(Adj: Rs. {txn.other_deductions})</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-bold text-indigo-900">{formatMoney(txn.expected_settlement)}</td>
                      <td className="p-3.5 text-right font-bold text-emerald-800">{formatMoney(txn.actual_settlement)}</td>

                      {/* Difference */}
                      <td className="p-3.5 text-right font-bold">
                        {Math.abs(diff) < 0.01 ? (
                          <span className="text-emerald-600">Rs. 0</span>
                        ) : diff < 0 ? (
                          <span className="text-rose-600 font-extrabold">- Rs. {Math.abs(diff).toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-700">+ Rs. {diff.toLocaleString()}</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="p-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${getPaymentStatusBadge(txn.payment_status)}`}>
                          {txn.payment_status}
                        </span>
                      </td>

                      {/* Settlement Status */}
                      <td className="p-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${getSettlementStatusBadge(txn.settlement_status)}`}>
                          {txn.settlement_status}
                        </span>
                        {txn.settlement_number && (
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            {txn.settlement_number}
                          </span>
                        )}
                      </td>

                      {/* Delivery Date */}
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {formatDate(txn.delivery_date)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openTransactionDetails(txn.id)}
                            title="View Transaction Details"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          >
                            <FiEye size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowAdjustmentModal(txn)}
                            title="Add Financial Adjustment"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition"
                          >
                            <FiPlus size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{transactions.length}</strong> of <strong className="text-slate-800">{totalCount}</strong> transactions
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <FiChevronLeft size={14} />
            </button>
            <span className="px-3 font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. MODAL: TRANSACTION DETAILS (Section 14 & 15 Audit Trail) */}
      {selectedTxn && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <FiDollarSign size={18} />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{selectedTxn.transaction_id}</h3>
                  <p className="text-xs text-slate-500 font-mono">Linked Order #{selectedTxn.order_id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Order & Customer Information */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  <FiUser size={13} /> Customer & Order Info
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer Name</span>
                    <span className="font-bold text-slate-900">{selectedTxn.customer_name}</span>
                    <span className="text-slate-500 block text-[11px]">{selectedTxn.customer_phone || selectedTxn.customer_email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Order Status</span>
                    <span className="font-semibold text-slate-800">{selectedTxn.order_status || 'Pending'}</span>
                    <span className="text-slate-400 block text-[11px]">Order Total: {formatMoney(selectedTxn.order_total)}</span>
                  </div>
                </div>
              </div>

              {/* Courier Information */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  <FiTruck size={13} /> Courier & Delivery Details
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Courier</span>
                    <span className="font-bold text-slate-900">{selectedTxn.courier_name || 'Standard Courier'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tracking #</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedTxn.tracking_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery Date</span>
                    <span className="font-medium text-slate-700">{formatDate(selectedTxn.delivery_date)}</span>
                  </div>
                </div>
              </div>

              {/* COD & Settlement Breakdown */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                  Financial Calculation Breakdown
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>COD Amount Collected:</span>
                    <span className="font-bold text-slate-900">{formatMoney(selectedTxn.cod_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Courier Delivery Charges:</span>
                    <span>- {formatMoney(selectedTxn.courier_charges)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Other Deductions & Adjustments:</span>
                    <span>- {formatMoney(selectedTxn.other_deductions)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-sm text-slate-900">
                    <span>Expected Settlement:</span>
                    <span className="text-indigo-900">{formatMoney(selectedTxn.expected_settlement)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-emerald-800">
                    <span>Actual Remitted Settlement:</span>
                    <span>{formatMoney(selectedTxn.actual_settlement)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 text-xs font-bold">
                    <span>Difference / Discrepancy:</span>
                    <span className={Number(selectedTxn.difference) === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {Number(selectedTxn.difference) === 0 ? 'Rs. 0 (Balanced)' : `${formatMoney(selectedTxn.difference)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Batch Info if linked */}
              {selectedTxn.settlement_number && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1.5">
                  <h4 className="font-bold text-emerald-900 text-xs">Linked Settlement Batch</h4>
                  <div className="grid grid-cols-2 gap-2 text-emerald-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block">Batch Number</span>
                      <span className="font-mono font-bold">{selectedTxn.settlement_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block">Bank Reference</span>
                      <span className="font-mono">{selectedTxn.bank_reference || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reconciliation Info if Reconciled */}
              {selectedTxn.settlement_status === 'Reconciled' && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-1 text-teal-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <FiCheckCircle className="text-teal-600" /> Formally Reconciled
                  </div>
                  <p className="text-[11px]">
                    Reconciled by <strong>{selectedTxn.reconciled_by_name || 'Admin'}</strong> on {formatDateTime(selectedTxn.reconciled_at)}.
                    Ref: <code>{selectedTxn.reconciliation_reference || 'Confirmed'}</code>
                  </p>
                </div>
              )}

              {/* Audit Trail Timeline */}
              {selectedTxn.auditLogs && selectedTxn.auditLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                    Financial Audit Trail
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/40">
                    {selectedTxn.auditLogs.map((log: any, idx: number) => (
                      <div key={idx} className="p-3 text-[11px]">
                        <div className="flex justify-between font-semibold text-slate-800">
                          <span>{log.action}</span>
                          <span className="text-slate-400 font-normal">{formatDateTime(log.created_at)}</span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{log.details}</p>
                        <span className="text-slate-400 text-[10px]">Actor: {log.actor_name || 'System'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: CREATE COURIER SETTLEMENT BATCH */}
      {showBatchModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-black text-white rounded-xl">
                  <FiLayers size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Create Courier Settlement Batch</h3>
                  <p className="text-xs text-slate-500">Consolidate {selectedIds.length} COD orders into a settlement remittance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Courier */}
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Courier Partner *</label>
                  <select
                    value={batchCourier}
                    onChange={(e) => setBatchCourier(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black"
                  >
                    {couriersList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Settlement Date */}
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Settlement Date *</label>
                  <input
                    type="date"
                    required
                    value={batchDate}
                    onChange={(e) => setBatchDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Bank Reference */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Bank Reference / Courier Advice No *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HBL-FT-992312 or TRX-REMIT-5521"
                  value={batchBankRef}
                  onChange={(e) => setBatchBankRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:border-black"
                />
              </div>

              {/* Automatic Calculations Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Total COD Collected ({selectedTransactions.length} orders):</span>
                  <span className="font-bold text-slate-900">{formatMoney(selectedCalculations.totalCod)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Courier Charges Deducted:</span>
                  <span>- {formatMoney(selectedCalculations.totalCharges)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Other Deductions & Adjustments:</span>
                  <span>- {formatMoney(selectedCalculations.totalDeductions)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-sm text-slate-900">
                  <span>Expected Settlement Amount:</span>
                  <span className="text-indigo-900">{formatMoney(selectedCalculations.expected)}</span>
                </div>
              </div>

              {/* Actual Settlement Input */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Actual Settlement Amount Received (Rs.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={batchActualSettlement}
                  onChange={(e) => setBatchActualSettlement(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:border-black"
                />
                {batchActualSettlement && (
                  <div className="mt-1 text-right text-[11px] font-bold">
                    Difference: {Number(batchActualSettlement) - selectedCalculations.expected === 0 ? (
                      <span className="text-emerald-600">Rs. 0 (Balanced Reconciled)</span>
                    ) : (
                      <span className="text-rose-600 font-black">
                        Rs. {(Number(batchActualSettlement) - selectedCalculations.expected).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Partial Settlement Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={batchIsPartial}
                  onChange={(e) => setBatchIsPartial(e.target.checked)}
                  className="rounded border-slate-300 text-black focus:ring-black"
                />
                <span className="font-semibold text-slate-700 text-xs">
                  This is a Partial Settlement (outstanding amount will remain pending)
                </span>
              </label>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional settlement remittance notes..."
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="px-5 py-2 bg-black hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {batchSubmitting ? 'Recording Batch...' : 'Confirm & Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: ADD FINANCIAL ADJUSTMENT */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-base">Add Financial Adjustment</h3>
                <p className="text-xs text-slate-500 font-mono">Order #{showAdjustmentModal.order_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Adjustment Type *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black"
                >
                  <option value="Charge Correction">Courier Charge Correction</option>
                  <option value="Weight Discrepancy">Weight Discrepancy Fee</option>
                  <option value="Return Fee">RTO / Return Fee</option>
                  <option value="Lost Package">Lost / Damaged Package</option>
                  <option value="Cash Shortage">Cash Shortage at Doorstep</option>
                  <option value="Other">Other Adjustment</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Adjustment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 150.00"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Reason / Explanation *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the audit justification for this adjustment..."
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjSubmitting}
                  className="px-5 py-2 bg-black hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {adjSubmitting ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
