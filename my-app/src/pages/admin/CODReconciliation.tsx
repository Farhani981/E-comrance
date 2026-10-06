import { useState, useEffect, useCallback } from 'react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiLayers,
  FiRefreshCw,
  FiCheck,
  FiDollarSign,
  FiPlus,
  FiFileText,
  FiX,
  FiEye,
  FiHelpCircle,
  FiInbox
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import MetricGrid, { StatCard } from '../../component/MetricGrid';
import { formatMoney, formatDate, formatDateTime, getSettlementStatusBadge } from './CODTransactions';

export default function CODReconciliation() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const token = user?.token || '';

  // Data state
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'batches' | 'discrepancies'>('batches');

  // Modals
  const [reconcilingBatch, setReconcilingBatch] = useState<any | null>(null);
  const [reconciliationRef, setReconciliationRef] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [reconcilingSubmitting, setReconcilingSubmitting] = useState(false);

  // Discrepancy Resolution Modal
  const [resolvingItem, setResolvingItem] = useState<any | null>(null);
  const [resolutionType, setResolutionType] = useState('Charge Correction');
  const [resolutionAmount, setResolutionAmount] = useState('');
  const [resolutionReason, setResolutionReason] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);

  // Flag Discrepancy Modal
  const [flaggingBatch, setFlaggingBatch] = useState<any | null>(null);
  const [flagReason, setFlagReason] = useState('Payment Shortage');
  const [flagNotes, setFlagNotes] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  const fetchReconciliationData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/cod/reconciliation', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Failed to load reconciliation data');
      }
      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Server error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReconciliationData();
  }, [fetchReconciliationData]);

  // Handle Submit Formal Reconciliation
  const handleConfirmReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingBatch || reconcilingSubmitting) return;

    if (!reconciliationRef.trim()) {
      showAlert('Reconciliation Reference or Bank deposit confirmation is required.', 'warning', 'Reference Required');
      return;
    }

    setReconcilingSubmitting(true);
    try {
      const res = await fetch('/api/admin/cod/reconciliation/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          settlement_id: reconcilingBatch.id,
          reconciliation_reference: reconciliationRef.trim(),
          notes: reconciliationNotes.trim() || null
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Reconciliation failed');
      }

      showAlert(`Settlement ${reconcilingBatch.settlement_number} successfully marked as Reconciled.`, 'success', 'Reconciled');
      setReconcilingBatch(null);
      setReconciliationRef('');
      setReconciliationNotes('');
      fetchReconciliationData(true);
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    } finally {
      setReconcilingSubmitting(false);
    }
  };

  // Handle Flag Discrepancy
  const handleConfirmFlagDiscrepancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flaggingBatch || flagSubmitting) return;

    setFlagSubmitting(true);
    try {
      const res = await fetch('/api/admin/cod/reconciliation/discrepancy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          settlement_id: flaggingBatch.id,
          reason: flagReason,
          notes: flagNotes.trim() || null
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Flagging failed');
      }

      showAlert(`Discrepancy recorded for ${flaggingBatch.settlement_number}.`, 'warning', 'Discrepancy Flagged');
      setFlaggingBatch(null);
      setFlagNotes('');
      fetchReconciliationData(true);
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    } finally {
      setFlagSubmitting(false);
    }
  };

  // Handle Resolve Discrepancy
  const handleConfirmResolveDiscrepancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingItem || resolutionSubmitting) return;

    if (!resolutionReason.trim()) {
      showAlert('Resolution reason is required.', 'warning', 'Missing Reason');
      return;
    }

    setResolutionSubmitting(true);
    try {
      const isTxn = Boolean(resolvingItem.transaction_id);
      const payload: any = {
        adjustment_type: resolutionType,
        adjustment_amount: Number(resolutionAmount) || 0,
        reason: resolutionReason.trim(),
        notes: resolutionNotes.trim() || null,
      };

      if (isTxn) {
        payload.cod_transaction_id = resolvingItem.id;
      } else {
        payload.settlement_id = resolvingItem.id;
      }

      const res = await fetch('/api/admin/cod/reconciliation/resolve-discrepancy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Resolution failed');
      }

      showAlert('Discrepancy resolved with financial adjustment.', 'success', 'Discrepancy Resolved');
      setResolvingItem(null);
      setResolutionAmount('');
      setResolutionReason('');
      setResolutionNotes('');
      fetchReconciliationData(true);
    } catch (err: any) {
      showAlert(err.message, 'error', 'Resolution Failed');
    } finally {
      setResolutionSubmitting(false);
    }
  };

  const comp = data?.comparison;

  return (
    <div className="space-y-6 pb-12 bg-white">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-teal-50 text-teal-700 rounded-2xl">
            <FiCheckCircle size={22} />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Finance Reconciliation</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Three-way comparison: Store COD Records vs Courier Settlement Advice vs Bank Received
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchReconciliationData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* 2. Three-Way Reconciliation Comparison Cards */}
      {comp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Store Expected */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>1. Store COD Expected</span>
              <FiDollarSign className="text-slate-400" size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatMoney(comp.storeExpectedSettlement)}
            </div>
            <p className="text-[11px] text-slate-500">
              Total COD Booked: {formatMoney(comp.storeCodTotal)} less courier fees ({formatMoney(comp.storeChargesTotal)})
            </p>
          </div>

          {/* Card 2: Courier Settled Amount */}
          <div className="bg-indigo-50/50 border border-indigo-200 p-5 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700 uppercase tracking-wider">
              <span>2. Courier Reported Remittance</span>
              <FiLayers className="text-indigo-500" size={16} />
            </div>
            <div className="text-2xl font-black text-indigo-950">
              {formatMoney(comp.courierExpectedTotal)}
            </div>
            <p className="text-[11px] text-indigo-700">
              Recorded across all courier settlement batches
            </p>
          </div>

          {/* Card 3: Actual Bank Received & Variance */}
          <div className={`p-5 rounded-2xl border shadow-xs space-y-2 ${
            Math.abs(comp.totalDifference) > 0.01 ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/50 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className={Math.abs(comp.totalDifference) > 0.01 ? 'text-rose-800' : 'text-emerald-800'}>
                3. Actual Received & Variance
              </span>
              <FiCheckCircle className={Math.abs(comp.totalDifference) > 0.01 ? 'text-rose-500' : 'text-emerald-500'} size={16} />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatMoney(comp.actualBankReceivedTotal)}
            </div>
            <div className="text-[11px] font-bold">
              {Math.abs(comp.totalDifference) < 0.01 ? (
                <span className="text-emerald-700">✅ Fully balanced (Difference: Rs. 0)</span>
              ) : (
                <span className="text-rose-700">
                  ⚠️ Net Variance: {comp.totalDifference < 0 ? `- Rs. ${Math.abs(comp.totalDifference).toLocaleString()}` : `+ Rs. ${comp.totalDifference.toLocaleString()}`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'batches'
              ? 'border-black text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <FiLayers size={14} /> Settlement Batches ({data?.batches?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discrepancies')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'discrepancies'
              ? 'border-black text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <FiAlertTriangle size={14} /> Discrepant Transactions ({data?.discrepantTransactions?.length || 0})
        </button>
      </div>

      {/* 4. Tab 1: Settlement Batches Awaiting Reconciliation */}
      {activeTab === 'batches' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs font-semibold">Loading batches...</div>
          ) : (data?.batches || []).length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FiCheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-700">No Pending Batches</p>
              <p className="text-xs">All courier settlement batches are reconciled and balanced.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-3.5">Batch #</th>
                    <th className="p-3.5">Courier</th>
                    <th className="p-3.5">Settlement Date</th>
                    <th className="p-3.5">Bank Reference</th>
                    <th className="p-3.5 text-center">Orders</th>
                    <th className="p-3.5 text-right">Expected</th>
                    <th className="p-3.5 text-right">Actual Received</th>
                    <th className="p-3.5 text-right">Difference</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.batches.map((b: any) => {
                    const diff = Number(b.difference || 0);
                    const isReconciled = b.settlement_status === 'Reconciled';

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-slate-900">{b.settlement_number}</td>
                        <td className="p-3.5 font-semibold text-slate-800">{b.courier_name}</td>
                        <td className="p-3.5 text-slate-600">{formatDate(b.settlement_date)}</td>
                        <td className="p-3.5 font-mono text-slate-700">{b.bank_reference}</td>
                        <td className="p-3.5 text-center font-bold text-slate-900">{b.total_orders}</td>
                        <td className="p-3.5 text-right font-bold text-indigo-900">{formatMoney(b.expected_settlement)}</td>
                        <td className="p-3.5 text-right font-bold text-emerald-800">{formatMoney(b.actual_settlement)}</td>

                        <td className="p-3.5 text-right font-bold">
                          {Math.abs(diff) < 0.01 ? (
                            <span className="text-emerald-600">Rs. 0</span>
                          ) : (
                            <span className="text-rose-600 font-extrabold">
                              {diff < 0 ? `- Rs. ${Math.abs(diff).toLocaleString()}` : `+ Rs. ${diff.toLocaleString()}`}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${getSettlementStatusBadge(b.settlement_status)}`}>
                            {b.settlement_status}
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isReconciled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReconcilingBatch(b);
                                  setReconciliationRef(b.bank_reference || '');
                                  setReconciliationNotes('');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition shadow-xs"
                              >
                                Reconcile
                              </button>
                            )}

                            {Math.abs(diff) > 0.01 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setResolvingItem(b);
                                  setResolutionAmount(String(Math.abs(diff)));
                                  setResolutionReason('');
                                  setResolutionNotes('');
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] transition"
                              >
                                Resolve
                              </button>
                            )}

                            {!isReconciled && b.settlement_status !== 'Discrepancy' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFlaggingBatch(b);
                                  setFlagReason('Payment Shortage');
                                  setFlagNotes('');
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition"
                              >
                                Flag
                              </button>
                            )}
                          </div>
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

      {/* 5. Tab 2: Discrepant Transactions */}
      {activeTab === 'discrepancies' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {(data?.discrepantTransactions || []).length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FiCheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-700">No Discrepancies</p>
              <p className="text-xs">There are no outstanding order-level variances.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-3.5">Transaction ID</th>
                    <th className="p-3.5">Order ID</th>
                    <th className="p-3.5">Courier & Tracking</th>
                    <th className="p-3.5 text-right">COD Amount</th>
                    <th className="p-3.5 text-right">Charges</th>
                    <th className="p-3.5 text-right">Deductions</th>
                    <th className="p-3.5 text-right">Expected</th>
                    <th className="p-3.5 text-right">Actual</th>
                    <th className="p-3.5 text-right">Difference</th>
                    <th className="p-3.5">Batch Number</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.discrepantTransactions.map((t: any) => {
                    const diff = Number(t.difference || 0);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-slate-900">{t.transaction_id}</td>
                        <td className="p-3.5 font-mono text-slate-700">#{t.order_id}</td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-800 block">{t.courier_name}</span>
                          <span className="text-[11px] font-mono text-slate-400">{t.tracking_number || '—'}</span>
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-900">{formatMoney(t.cod_amount)}</td>
                        <td className="p-3.5 text-right text-slate-500">- {formatMoney(t.courier_charges)}</td>
                        <td className="p-3.5 text-right text-slate-500">- {formatMoney(t.other_deductions)}</td>
                        <td className="p-3.5 text-right font-bold text-indigo-900">{formatMoney(t.expected_settlement)}</td>
                        <td className="p-3.5 text-right font-bold text-emerald-800">{formatMoney(t.actual_settlement)}</td>

                        <td className="p-3.5 text-right font-black text-rose-600">
                          {diff < 0 ? `- Rs. ${Math.abs(diff).toLocaleString()}` : `+ Rs. ${diff.toLocaleString()}`}
                        </td>

                        <td className="p-3.5 font-mono text-slate-600">{t.settlement_number || 'Unbatched'}</td>

                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingItem(t);
                              setResolutionAmount(String(Math.abs(diff)));
                              setResolutionReason('');
                              setResolutionNotes('');
                            }}
                            className="px-2.5 py-1 bg-black hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] transition shadow-xs"
                          >
                            Resolve Discrepancy
                          </button>
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

      {/* 6. MODAL: FORMAL RECONCILIATION */}
      {reconcilingBatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <FiCheckCircle size={18} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Reconcile Settlement Batch</h3>
                  <p className="text-xs text-slate-500 font-mono">{reconcilingBatch.settlement_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReconcilingBatch(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReconcile} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1 text-emerald-950">
                <div className="flex justify-between">
                  <span>Courier:</span>
                  <span className="font-bold">{reconcilingBatch.courier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Actual Received Amount:</span>
                  <span className="font-bold text-sm text-emerald-800">{formatMoney(reconcilingBatch.actual_settlement)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Number of Orders Settled:</span>
                  <span>{reconcilingBatch.total_orders} orders</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Reconciliation Reference / Bank Confirmation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REC-2026-HBL-9912 or Bank Ref"
                  value={reconciliationRef}
                  onChange={(e) => setReconciliationRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Audit Notes / Approver Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional verification remarks..."
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReconcilingBatch(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reconcilingSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {reconcilingSubmitting ? 'Reconciling...' : 'Confirm Reconciled'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: RESOLVE DISCREPANCY */}
      {resolvingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-base">Resolve Financial Discrepancy</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {resolvingItem.settlement_number || resolvingItem.transaction_id || `Order #${resolvingItem.order_id}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmResolveDiscrepancy} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed">
                ⚠️ Resolving this discrepancy creates an immutable <strong>Adjustment record</strong> in the audit trail without silently altering historical order or transaction amounts.
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Adjustment Category *</label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black"
                >
                  <option value="Charge Correction">Courier Charge Correction / Overcharge</option>
                  <option value="Weight Discrepancy">Weight Discrepancy Surcharge</option>
                  <option value="Lost Package">Lost / Damaged In-Transit Claim</option>
                  <option value="Cash Shortage">Doorstep Cash Shortage</option>
                  <option value="Settlement Waiver">Management Settlement Waiver</option>
                  <option value="Other">Other Verified Adjustment</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Adjustment Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 200.00"
                  value={resolutionAmount}
                  onChange={(e) => setResolutionAmount(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Audit Justification & Reason *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="State the verified rationale for this discrepancy resolution..."
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResolvingItem(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolutionSubmitting}
                  className="px-5 py-2 bg-black hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {resolutionSubmitting ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: FLAG DISCREPANCY */}
      {flaggingBatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-base">Flag Discrepancy</h3>
                <p className="text-xs text-slate-500 font-mono">{flaggingBatch.settlement_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setFlaggingBatch(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmFlagDiscrepancy} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Discrepancy Reason *</label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black"
                >
                  <option value="Payment Shortage">Courier Remitted Less than Expected</option>
                  <option value="Excess Payment">Courier Remitted More than Expected</option>
                  <option value="Unmatched Tracking Numbers">Unmatched Tracking / Advice Numbers</option>
                  <option value="Unauthorized Courier Charges">Unauthorized Courier Deductions</option>
                  <option value="Missing Orders">Missing Orders in Remittance Advice</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Additional Notes</label>
                <textarea
                  rows={3}
                  placeholder="Details regarding the discrepancy..."
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setFlaggingBatch(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={flagSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {flagSubmitting ? 'Flagging...' : 'Flag Discrepancy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
