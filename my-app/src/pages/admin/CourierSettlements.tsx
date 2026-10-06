import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiLayers,
  FiPlus,
  FiSearch,
  FiFilter,
  FiEye,
  FiRefreshCw,
  FiCalendar,
  FiDollarSign,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiTruck,
  FiCheck,
  FiInbox,
  FiFileText
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import MetricGrid, { StatCard } from '../../component/MetricGrid';
import { formatMoney, formatDate, formatDateTime, getSettlementStatusBadge } from './CODTransactions';

interface SettlementBatch {
  id: number;
  settlement_number: string;
  courier_id?: number | null;
  courier_name: string;
  settlement_date: string;
  bank_reference: string;
  total_orders: number;
  total_cod_collected: number | string;
  total_courier_charges: number | string;
  total_other_deductions: number | string;
  expected_settlement: number | string;
  actual_settlement: number | string;
  difference: number | string;
  settlement_status: string;
  notes?: string | null;
  attachment_url?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  reconciled_by?: number | null;
  reconciled_by_name?: string | null;
  reconciled_at?: string | null;
  reconciliation_reference?: string | null;
  created_at: string;
  items?: any[];
  adjustments?: any[];
  auditLogs?: any[];
}

interface UnsettledOrder {
  id: number;
  transaction_id: string;
  order_id: string;
  customer_name: string;
  courier_name: string;
  tracking_number?: string;
  cod_amount: number | string;
  courier_charges: number | string;
  other_deductions: number | string;
  expected_settlement: number | string;
  delivery_date?: string;
}

export default function CourierSettlements() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const token = user?.token || '';

  // Data states
  const [settlements, setSettlements] = useState<SettlementBatch[]>([]);
  const [couriersList, setCouriersList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [courierFilter, setCourierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Modals
  const [selectedBatch, setSelectedBatch] = useState<SettlementBatch | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Batch Form State
  const [batchCourier, setBatchCourier] = useState('Trax Logistics');
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchBankRef, setBatchBankRef] = useState('');
  const [batchActual, setBatchActual] = useState('');
  const [batchIsPartial, setBatchIsPartial] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchAttachment, setBatchAttachment] = useState('');
  const [unsettledOrders, setUnsettledOrders] = useState<UnsettledOrder[]>([]);
  const [loadingUnsettled, setLoadingUnsettled] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load couriers
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

  // Fetch Settlements
  const fetchSettlements = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        courier: courierFilter,
        status: statusFilter,
      });
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);

      const res = await fetch(`/api/admin/cod/settlements?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch settlements');
      }

      setSettlements(data.settlements || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, search, courierFilter, statusFilter, startDate, endDate, token]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Fetch Unsettled Orders when Create Modal opens or Courier changes
  useEffect(() => {
    if (!showCreateModal) return;
    setLoadingUnsettled(true);

    fetch(`/api/admin/cod/unsettled-orders?courier_name=${encodeURIComponent(batchCourier)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.transactions)) {
          setUnsettledOrders(data.transactions);
          // By default, select all available orders for this courier
          setSelectedOrderIds(data.transactions.map((t: any) => t.id));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUnsettled(false));
  }, [showCreateModal, batchCourier, token]);

  // Selected orders summary calculations in modal
  const selectedSummary = useMemo(() => {
    const chosen = unsettledOrders.filter(o => selectedOrderIds.includes(o.id));
    const totalCod = chosen.reduce((acc, o) => acc + Number(o.cod_amount || 0), 0);
    const totalCharges = chosen.reduce((acc, o) => acc + Number(o.courier_charges || 0), 0);
    const totalDeductions = chosen.reduce((acc, o) => acc + Number(o.other_deductions || 0), 0);
    const expected = Math.max(0, totalCod - totalCharges - totalDeductions);
    return { totalCod, totalCharges, totalDeductions, expected, count: chosen.length };
  }, [unsettledOrders, selectedOrderIds]);

  // Sync default actual settlement with expected
  useEffect(() => {
    if (selectedSummary.expected > 0 && !batchActual) {
      setBatchActual(String(selectedSummary.expected));
    }
  }, [selectedSummary.expected, batchActual]);

  // Open Details Modal
  const openBatchDetails = async (id: number | string) => {
    setBatchLoading(true);
    try {
      const res = await fetch(`/api/admin/cod/settlements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.settlement) {
        setSelectedBatch(data.settlement);
      } else {
        throw new Error(data.message || 'Settlement batch not found');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    } finally {
      setBatchLoading(false);
    }
  };

  // Submit Settlement Batch Creation
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (selectedOrderIds.length === 0) {
      showAlert('Please select at least one delivered COD order to settle.', 'warning', 'No Orders Selected');
      return;
    }
    if (!batchBankRef.trim()) {
      showAlert('Bank Reference / Advice No is required.', 'warning', 'Missing Reference');
      return;
    }

    const actual = Number(batchActual);
    if (isNaN(actual) || actual < 0) {
      showAlert('Please enter a valid actual settlement amount.', 'warning', 'Invalid Amount');
      return;
    }

    setSubmitting(true);
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
          transaction_ids: selectedOrderIds,
          actual_settlement: actual,
          notes: batchNotes.trim() || null,
          attachment_url: batchAttachment.trim() || null,
          is_partial: batchIsPartial
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Creation failed');
      }

      showAlert(`Settlement batch ${data.settlement_number} created successfully.`, 'success', 'Settlement Recorded');
      setShowCreateModal(false);
      setBatchBankRef('');
      setBatchActual('');
      setBatchNotes('');
      fetchSettlements(true);
    } catch (err: any) {
      showAlert(err.message, 'error', 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics summary from current list
  const metrics = useMemo(() => {
    const totalExpected = settlements.reduce((acc, s) => acc + Number(s.expected_settlement || 0), 0);
    const totalActual = settlements.reduce((acc, s) => acc + Number(s.actual_settlement || 0), 0);
    const totalDiff = settlements.reduce((acc, s) => acc + Number(s.difference || 0), 0);
    const discrepancies = settlements.filter(s => Math.abs(Number(s.difference || 0)) > 0.01).length;
    return { totalExpected, totalActual, totalDiff, discrepancies };
  }, [settlements]);

  return (
    <div className="space-y-6 pb-12 bg-white">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-black text-white rounded-2xl">
            <FiLayers size={22} />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Courier Settlements</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Create and manage settlement batches remitted by courier partners
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchSettlements(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
          >
            <FiPlus size={15} />
            Create Settlement Batch
          </button>
        </div>
      </div>

      {/* 2. Metrics Grid */}
      <MetricGrid cols={4}>
        <StatCard
          label="Total Settled Batches"
          value={String(totalCount)}
          sub="Courier remittance batches recorded"
          icon={<FiLayers size={20} />}
        />
        <StatCard
          label="Expected Settlement"
          value={formatMoney(metrics.totalExpected)}
          sub="Calculated COD less charges"
          icon={<FiDollarSign size={20} />}
        />
        <StatCard
          label="Actual Received"
          value={formatMoney(metrics.totalActual)}
          sub="Deposited into store bank accounts"
          icon={<FiCheckCircle size={20} />}
        />
        <StatCard
          label="Net Discrepancies"
          value={formatMoney(metrics.totalDiff)}
          sub={metrics.discrepancies > 0 ? `⚠️ ${metrics.discrepancies} batches have variances` : 'All batches reconciled'}
          icon={<FiAlertTriangle size={20} />}
        />
      </MetricGrid>

      {/* 3. Filters */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <FiSearch className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search batch #, reference, courier..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
            />
          </div>

          {/* Courier Filter */}
          <select
            value={courierFilter}
            onChange={(e) => { setCourierFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
          >
            <option value="All">All Couriers</option>
            {couriersList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
          >
            <option value="All">All Statuses</option>
            <option value="Settlement Pending">Settlement Pending</option>
            <option value="Partially Settled">Partially Settled</option>
            <option value="Settled">Settled</option>
            <option value="Reconciled">Reconciled</option>
            <option value="Discrepancy">Discrepancy</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 text-rose-700 text-xs font-semibold">{error}</div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <FiRefreshCw className="animate-spin" size={24} />
            <p className="text-xs font-medium">Loading settlement batches...</p>
          </div>
        ) : settlements.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <FiInbox size={36} />
            <p className="text-sm font-semibold text-slate-700">No Courier Settlements Found</p>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Click "Create Settlement Batch" above to record a new payment remittance from your courier partner.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-3.5">Settlement ID</th>
                  <th className="p-3.5">Courier</th>
                  <th className="p-3.5">Settlement Date</th>
                  <th className="p-3.5">Bank Reference</th>
                  <th className="p-3.5 text-center">Orders</th>
                  <th className="p-3.5 text-right">COD Collected</th>
                  <th className="p-3.5 text-right">Charges</th>
                  <th className="p-3.5 text-right">Deductions</th>
                  <th className="p-3.5 text-right">Expected</th>
                  <th className="p-3.5 text-right">Actual Received</th>
                  <th className="p-3.5 text-right">Difference</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((batch) => {
                  const diff = Number(batch.difference || 0);

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-slate-900">{batch.settlement_number}</td>
                      <td className="p-3.5 font-semibold text-slate-800">{batch.courier_name}</td>
                      <td className="p-3.5 text-slate-600">{formatDate(batch.settlement_date)}</td>
                      <td className="p-3.5 font-mono text-slate-700">{batch.bank_reference}</td>
                      <td className="p-3.5 text-center font-bold text-slate-900">{batch.total_orders}</td>
                      <td className="p-3.5 text-right font-medium text-slate-700">{formatMoney(batch.total_cod_collected)}</td>
                      <td className="p-3.5 text-right text-slate-500">- {formatMoney(batch.total_courier_charges)}</td>
                      <td className="p-3.5 text-right text-slate-500">- {formatMoney(batch.total_other_deductions)}</td>
                      <td className="p-3.5 text-right font-bold text-indigo-900">{formatMoney(batch.expected_settlement)}</td>
                      <td className="p-3.5 text-right font-bold text-emerald-800">{formatMoney(batch.actual_settlement)}</td>

                      <td className="p-3.5 text-right font-bold">
                        {Math.abs(diff) < 0.01 ? (
                          <span className="text-emerald-600">Rs. 0</span>
                        ) : diff < 0 ? (
                          <span className="text-rose-600 font-extrabold">- Rs. {Math.abs(diff).toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-700">+ Rs. {diff.toLocaleString()}</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${getSettlementStatusBadge(batch.settlement_status)}`}>
                          {batch.settlement_status}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => openBatchDetails(batch.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition"
                        >
                          <FiEye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{settlements.length}</strong> of <strong className="text-slate-800">{totalCount}</strong> batches
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100"
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
              className="p-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100"
            >
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. MODAL: CREATE SETTLEMENT BATCH */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-black text-white rounded-xl">
                  <FiLayers size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Create Courier Settlement Batch</h3>
                  <p className="text-xs text-slate-500">Reconcile delivered orders remitted by courier</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Courier */}
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Courier Partner *</label>
                  <select
                    value={batchCourier}
                    onChange={(e) => {
                      setBatchCourier(e.target.value);
                      setSelectedOrderIds([]);
                      setBatchActual('');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black"
                  >
                    {couriersList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
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

                {/* Bank Reference */}
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Bank Reference / Advice # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HBL-FT-449102"
                    value={batchBankRef}
                    onChange={(e) => setBatchBankRef(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Order Selection Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                    Select Delivered Orders to Settle ({selectedOrderIds.length} selected)
                  </span>
                  {unsettledOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedOrderIds.length === unsettledOrders.length) setSelectedOrderIds([]);
                        else setSelectedOrderIds(unsettledOrders.map(o => o.id));
                      }}
                      className="text-xs text-indigo-600 hover:underline font-semibold"
                    >
                      {selectedOrderIds.length === unsettledOrders.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/40">
                  {loadingUnsettled ? (
                    <div className="p-8 text-center text-slate-400">Loading unsettled orders...</div>
                  ) : unsettledOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      No unsettled COD orders found for <strong>{batchCourier}</strong>.
                    </div>
                  ) : (
                    unsettledOrders.map((ord) => {
                      const isChecked = selectedOrderIds.includes(ord.id);
                      return (
                        <div
                          key={ord.id}
                          onClick={() => {
                            setSelectedOrderIds(prev => prev.includes(ord.id) ? prev.filter(x => x !== ord.id) : [...prev, ord.id]);
                          }}
                          className={`p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 transition ${
                            isChecked ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-black focus:ring-black"
                            />
                            <div>
                              <span className="font-mono font-bold text-slate-900 block">{ord.transaction_id}</span>
                              <span className="text-[11px] text-slate-500">Order #{ord.order_id} • {ord.customer_name}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-slate-900 block">{formatMoney(ord.cod_amount)}</span>
                            <span className="text-[10px] text-slate-400">
                              Charges: {formatMoney(ord.courier_charges)} • Net: {formatMoney(ord.expected_settlement)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Automatic Calculation Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Total COD Collected ({selectedSummary.count} orders):</span>
                  <span className="font-bold text-slate-900">{formatMoney(selectedSummary.totalCod)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Total Courier Delivery Charges:</span>
                  <span>- {formatMoney(selectedSummary.totalCharges)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Other Deductions:</span>
                  <span>- {formatMoney(selectedSummary.totalDeductions)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                  <span>Expected Settlement Amount:</span>
                  <span className="text-indigo-900">{formatMoney(selectedSummary.expected)}</span>
                </div>
              </div>

              {/* Actual Settlement & Difference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Actual Received Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter amount credited by bank..."
                    value={batchActual}
                    onChange={(e) => setBatchActual(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Calculated Difference
                  </label>
                  <div className="p-2.5 bg-slate-100 rounded-xl font-mono font-bold text-sm">
                    {batchActual ? (
                      Number(batchActual) - selectedSummary.expected === 0 ? (
                        <span className="text-emerald-700">Rs. 0 (Balanced / Reconciled)</span>
                      ) : (
                        <span className="text-rose-600">
                          Rs. {(Number(batchActual) - selectedSummary.expected).toLocaleString()}
                        </span>
                      )
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              {/* Partial Settlement Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={batchIsPartial}
                  onChange={(e) => setBatchIsPartial(e.target.checked)}
                  className="rounded border-slate-300 text-black focus:ring-black"
                />
                <span className="font-semibold text-slate-700 text-xs">
                  Mark as Partial Settlement (remaining balance will stay outstanding)
                </span>
              </label>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Remittance Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or remarks..."
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedOrderIds.length === 0}
                  className="px-5 py-2 bg-black hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {submitting ? 'Recording Batch...' : 'Record Settlement Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: VIEW BATCH DETAILS */}
      {selectedBatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-black text-white rounded-xl">
                  <FiLayers size={18} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{selectedBatch.settlement_number}</h3>
                  <p className="text-xs text-slate-500">{selectedBatch.courier_name} • Ref: {selectedBatch.bank_reference}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Financial Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Settlement Date:</span>
                  <span className="font-semibold text-slate-800">{formatDate(selectedBatch.settlement_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Orders:</span>
                  <span className="font-bold text-slate-900">{selectedBatch.total_orders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total COD Collected:</span>
                  <span className="font-bold text-slate-900">{formatMoney(selectedBatch.total_cod_collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Courier Charges:</span>
                  <span>- {formatMoney(selectedBatch.total_courier_charges)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Other Deductions:</span>
                  <span>- {formatMoney(selectedBatch.total_other_deductions)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-sm text-slate-900">
                  <span>Expected Settlement:</span>
                  <span className="text-indigo-900">{formatMoney(selectedBatch.expected_settlement)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-emerald-800">
                  <span>Actual Received:</span>
                  <span>{formatMoney(selectedBatch.actual_settlement)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span>Difference:</span>
                  <span className={Number(selectedBatch.difference) === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {Number(selectedBatch.difference) === 0 ? 'Rs. 0' : formatMoney(selectedBatch.difference)}
                  </span>
                </div>
              </div>

              {/* Itemized Orders */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                  Itemized Orders in Batch ({selectedBatch.items?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {(selectedBatch.items || []).map((it: any) => (
                    <div key={it.id} className="p-3 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{it.transaction_id}</span>
                        <span className="text-slate-500 block">Order #{it.order_id} • {it.customer_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{formatMoney(it.cod_amount)}</span>
                        <span className="text-[10px] text-emerald-700">Actual: {formatMoney(it.actual_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Trail */}
              {selectedBatch.auditLogs && selectedBatch.auditLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                    Settlement Audit Logs
                  </h4>
                  <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50/40">
                    {selectedBatch.auditLogs.map((log: any, idx: number) => (
                      <div key={idx} className="p-3 text-[11px]">
                        <div className="flex justify-between font-semibold text-slate-800">
                          <span>{log.action}</span>
                          <span className="text-slate-400 font-normal">{formatDateTime(log.created_at)}</span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{log.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
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
