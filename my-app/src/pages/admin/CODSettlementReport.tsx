import { useState, useEffect, useCallback } from 'react';
import {
  FiFileText,
  FiDownload,
  FiPrinter,
  FiFilter,
  FiSearch,
  FiCalendar,
  FiRefreshCw,
  FiDollarSign,
  FiTruck,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { formatMoney, formatDate, getPaymentStatusBadge, getSettlementStatusBadge } from './CODTransactions';

export default function CODSettlementReport() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const token = user?.token || '';

  // Data states
  const [rows, setRows] = useState<any[]>([]);
  const [couriersList, setCouriersList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [courier, setCourier] = useState('All');
  const [settlementStatus, setSettlementStatus] = useState('All');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [orderStatus, setOrderStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Couriers list
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

  // Fetch report rows
  const fetchReportData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const q = new URLSearchParams({
        courier,
        settlement_status: settlementStatus,
        payment_status: paymentStatus,
        order_status: orderStatus,
      });
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);

      const res = await fetch(`/api/admin/cod/reports?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load report');
      }
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message || 'Server error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courier, settlementStatus, paymentStatus, orderStatus, startDate, endDate, token]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Totals calculations
  const totals = rows.reduce((acc, r) => ({
    totalOrderAmount: acc.totalOrderAmount + Number(r.order_total || 0),
    totalCodCollected: acc.totalCodCollected + Number(r.cod_amount || 0),
    totalCharges: acc.totalCharges + Number(r.courier_charges || 0),
    totalDeductions: acc.totalDeductions + Number(r.other_deductions || 0),
    totalExpected: acc.totalExpected + Number(r.expected_settlement || 0),
    totalActual: acc.totalActual + Number(r.actual_settlement || 0),
    totalDiff: acc.totalDiff + Number(r.difference || 0),
  }), {
    totalOrderAmount: 0,
    totalCodCollected: 0,
    totalCharges: 0,
    totalDeductions: 0,
    totalExpected: 0,
    totalActual: 0,
    totalDiff: 0,
  });

  // Export CSV
  const handleExportCSV = () => {
    const q = new URLSearchParams({
      courier,
      settlement_status: settlementStatus,
      payment_status: paymentStatus,
      order_status: orderStatus,
      format: 'csv'
    });
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);

    window.open(`/api/admin/cod/reports?${q.toString()}`, '_blank');
  };

  // Export Excel (HTML Spreadsheet table format)
  const handleExportExcel = () => {
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><title>COD Settlement Report</title></head>
      <body>
        <h2>COD Settlement & Reconciliation Report</h2>
        <p>Export Date: ${new Date().toLocaleDateString('en-PK')} • Total Records: ${rows.length}</p>
        <table border="1" cellpadding="5" cellspacing="0">
          <thead>
            <tr style="background:#f1f5f9; font-weight:bold;">
              <th>Order ID</th>
              <th>Transaction ID</th>
              <th>Customer</th>
              <th>Courier</th>
              <th>Tracking No</th>
              <th>Order Amount</th>
              <th>COD Collected</th>
              <th>Charges</th>
              <th>Deductions</th>
              <th>Expected Settlement</th>
              <th>Actual Settlement</th>
              <th>Difference</th>
              <th>Settlement Status</th>
              <th>Payment Status</th>
              <th>Order Status</th>
              <th>Settlement Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.order_id}</td>
                <td>${r.transaction_id}</td>
                <td>${r.customer_name}</td>
                <td>${r.courier_name}</td>
                <td>${r.tracking_number || ''}</td>
                <td>${Number(r.order_total || 0).toFixed(2)}</td>
                <td>${Number(r.cod_amount || 0).toFixed(2)}</td>
                <td>${Number(r.courier_charges || 0).toFixed(2)}</td>
                <td>${Number(r.other_deductions || 0).toFixed(2)}</td>
                <td>${Number(r.expected_settlement || 0).toFixed(2)}</td>
                <td>${Number(r.actual_settlement || 0).toFixed(2)}</td>
                <td>${Number(r.difference || 0).toFixed(2)}</td>
                <td>${r.settlement_status}</td>
                <td>${r.payment_status}</td>
                <td>${r.order_status}</td>
                <td>${formatDate(r.settlement_date)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#e2e8f0; font-weight:bold;">
              <td colspan="5">Total Summary (${rows.length} records)</td>
              <td>${totals.totalOrderAmount.toFixed(2)}</td>
              <td>${totals.totalCodCollected.toFixed(2)}</td>
              <td>${totals.totalCharges.toFixed(2)}</td>
              <td>${totals.totalDeductions.toFixed(2)}</td>
              <td>${totals.totalExpected.toFixed(2)}</td>
              <td>${totals.totalActual.toFixed(2)}</td>
              <td>${totals.totalDiff.toFixed(2)}</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cod-settlement-report-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('Excel report downloaded successfully.', 'success', 'Downloaded');
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 bg-white print:p-0 print:space-y-4">
      {/* 1. Header (Hidden during print or styled cleanly) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-black text-white rounded-2xl">
            <FiFileText size={22} />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">COD Settlement Report</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Audit-ready reconciliation statements, deductions breakdown, and remittance verification
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchReportData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
          >
            <FiDownload size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition"
          >
            <FiDownload size={14} /> Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-black hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <FiPrinter size={14} /> Print Report
          </button>
        </div>
      </div>

      {/* Printable Title Banner */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <h1 className="text-2xl font-black text-slate-900">E-Commerce Store • COD Courier Settlement Report</h1>
        <p className="text-xs text-slate-600 mt-1">
          Generated: {new Date().toLocaleDateString('en-PK')} • Filter: Courier ({courier}), Settlement Status ({settlementStatus})
        </p>
      </div>

      {/* 2. Filter Bar (Hidden in print) */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs print:hidden">
        <div>
          <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase">Courier</label>
          <select
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
          >
            <option value="All">All Couriers</option>
            {couriersList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase">Settlement Status</label>
          <select
            value={settlementStatus}
            onChange={(e) => setSettlementStatus(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
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

        <div>
          <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase">Payment Status</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
          >
            <option value="All">All Payment Statuses</option>
            <option value="COD Pending">COD Pending</option>
            <option value="Collected by Courier">Collected by Courier</option>
            <option value="Settlement Pending">Settlement Pending</option>
            <option value="Partially Settled">Partially Settled</option>
            <option value="Settled">Settled</option>
            <option value="Reconciled">Reconciled</option>
            <option value="Discrepancy">Discrepancy</option>
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase">Order Status</label>
          <select
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-black"
          >
            <option value="All">All Order Statuses</option>
            <option value="Delivered">Delivered</option>
            <option value="Shipped">Shipped</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Returned">Returned</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-end gap-2 ml-auto">
          <div>
            <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase">Date From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase">Date To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Summary Aggregate Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Records</span>
          <span className="font-black text-sm text-slate-900">{rows.length}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Total COD</span>
          <span className="font-bold text-sm text-slate-900">{formatMoney(totals.totalCodCollected)}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Courier Charges</span>
          <span className="font-semibold text-sm text-slate-700">- {formatMoney(totals.totalCharges)}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Deductions</span>
          <span className="font-semibold text-sm text-slate-700">- {formatMoney(totals.totalDeductions)}</span>
        </div>
        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200">
          <span className="text-indigo-600 block text-[10px] uppercase font-bold">Expected</span>
          <span className="font-black text-sm text-indigo-950">{formatMoney(totals.totalExpected)}</span>
        </div>
        <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
          <span className="text-emerald-700 block text-[10px] uppercase font-bold">Actual Received</span>
          <span className="font-black text-sm text-emerald-950">{formatMoney(totals.totalActual)}</span>
        </div>
        <div className={`p-3 rounded-xl border ${Math.abs(totals.totalDiff) < 0.01 ? 'bg-slate-50 border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Difference</span>
          <span className={`font-black text-sm ${Math.abs(totals.totalDiff) < 0.01 ? 'text-slate-700' : 'text-rose-700'}`}>
            {formatMoney(totals.totalDiff)}
          </span>
        </div>
      </div>

      {/* 4. Report Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
        {error && <div className="p-4 bg-rose-50 text-rose-700 text-xs font-semibold">{error}</div>}

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">Generating report...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">No report records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs print:text-[10px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Courier</th>
                  <th className="p-3">Tracking No</th>
                  <th className="p-3 text-right">Order Total</th>
                  <th className="p-3 text-right">COD Collected</th>
                  <th className="p-3 text-right">Charges</th>
                  <th className="p-3 text-right">Deductions</th>
                  <th className="p-3 text-right">Expected</th>
                  <th className="p-3 text-right">Actual</th>
                  <th className="p-3 text-right">Diff</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Settlement Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => {
                  const diff = Number(r.difference || 0);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-mono font-bold text-slate-900">#{r.order_id}</td>
                      <td className="p-3 font-mono text-slate-600">{r.transaction_id}</td>
                      <td className="p-3 font-semibold text-slate-800 truncate max-w-[130px]">{r.customer_name}</td>
                      <td className="p-3 text-slate-700">{r.courier_name}</td>
                      <td className="p-3 font-mono text-slate-500">{r.tracking_number || '—'}</td>
                      <td className="p-3 text-right font-medium text-slate-600">{formatMoney(r.order_total)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatMoney(r.cod_amount)}</td>
                      <td className="p-3 text-right text-slate-500">- {formatMoney(r.courier_charges)}</td>
                      <td className="p-3 text-right text-slate-500">- {formatMoney(r.other_deductions)}</td>
                      <td className="p-3 text-right font-bold text-indigo-900">{formatMoney(r.expected_settlement)}</td>
                      <td className="p-3 text-right font-bold text-emerald-800">{formatMoney(r.actual_settlement)}</td>

                      <td className="p-3 text-right font-bold">
                        {Math.abs(diff) < 0.01 ? (
                          <span className="text-emerald-600">Rs. 0</span>
                        ) : diff < 0 ? (
                          <span className="text-rose-600 font-extrabold">- Rs. {Math.abs(diff).toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-700">+ Rs. {diff.toLocaleString()}</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${getSettlementStatusBadge(r.settlement_status)}`}>
                          {r.settlement_status}
                        </span>
                      </td>

                      <td className="p-3 text-slate-500">{formatDate(r.settlement_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td colSpan={5} className="p-3 text-xs uppercase tracking-wider">
                    Total Summary ({rows.length} rows)
                  </td>
                  <td className="p-3 text-right">{formatMoney(totals.totalOrderAmount)}</td>
                  <td className="p-3 text-right">{formatMoney(totals.totalCodCollected)}</td>
                  <td className="p-3 text-right text-slate-600">- {formatMoney(totals.totalCharges)}</td>
                  <td className="p-3 text-right text-slate-600">- {formatMoney(totals.totalDeductions)}</td>
                  <td className="p-3 text-right text-indigo-900">{formatMoney(totals.totalExpected)}</td>
                  <td className="p-3 text-right text-emerald-900">{formatMoney(totals.totalActual)}</td>
                  <td className="p-3 text-right text-rose-600">{formatMoney(totals.totalDiff)}</td>
                  <td colSpan={2} className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Print Signature Block */}
      <div className="hidden print:grid grid-cols-3 gap-8 pt-12 text-xs text-slate-600 border-t border-slate-300 mt-8">
        <div>
          <p className="font-bold text-slate-900">Prepared By:</p>
          <div className="h-12 border-b border-slate-300 mb-1"></div>
          <p>Finance Officer</p>
        </div>
        <div>
          <p className="font-bold text-slate-900">Verified By:</p>
          <div className="h-12 border-b border-slate-300 mb-1"></div>
          <p>Internal Auditor</p>
        </div>
        <div>
          <p className="font-bold text-slate-900">Approved By:</p>
          <div className="h-12 border-b border-slate-300 mb-1"></div>
          <p>Head of Finance</p>
        </div>
      </div>
    </div>
  );
}
