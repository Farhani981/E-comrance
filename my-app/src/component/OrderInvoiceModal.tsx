import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPrinter,
  FiDownload,
  FiFileText,
  FiCheckCircle,
  FiX,
} from 'react-icons/fi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Order } from '../pages/admin/ManageOrders';

interface OrderInvoiceModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function OrderInvoiceModal({ order, onClose }: OrderInvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!order) return null;

  const formatMoney = (val: number | string | undefined) => {
    const num = Math.round(Number(val) || 0);
    return `Rs. ${num.toLocaleString('en-PK')}`;
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  const isOrderCOD = (ord: Order) => {
    const m = (ord.payment_method || '').toLowerCase();
    return m.includes('cash') || m.includes('cod');
  };

  const items = order.items || [];
  const calculatedSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0
  );
  const subtotal = order.subtotal !== undefined ? Number(order.subtotal) : calculatedSubtotal;
  const discountAmount = Number(order.discount_amount) || 0;
  const shippingAmount = Number(order.shipping_amount) || 0;
  const totalAmount = Number(order.total_amount) || 0;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Download Handler
  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;

      pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, margin, imgWidth, imgHeight);
      pdf.save(`Invoice-${order.id}.pdf`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('PDF Generation failed, falling back to print:', err);
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const modal = (
    <>
      {/* Print-specific CSS styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > *:not(#invoice-print-root) {
            display: none !important;
          }
          #invoice-print-root {
            position: static !important;
            display: block !important;
            height: auto !important;
            width: auto !important;
            background: none !important;
            backdrop-filter: none !important;
          }
          #invoice-print-root .invoice-shell,
          #invoice-print-root .invoice-scroll {
            position: static !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          #printable-invoice-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #printable-invoice-container table {
            break-inside: auto;
          }
          #printable-invoice-container tr,
          #printable-invoice-container img {
            break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="invoice-print-root"
        className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs"
      >
        <div className="invoice-shell absolute inset-0 flex flex-col bg-slate-100 overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200 no-print shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <FiFileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Order Invoice</h3>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    INV-{order.id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official billing record for order #{order.id}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              title="Close"
              className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback banner if downloaded */}
          {downloadSuccess && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 text-xs font-semibold text-emerald-800 flex items-center justify-between no-print shrink-0">
              <span className="flex items-center gap-1.5">
                <FiCheckCircle className="text-emerald-600 w-4 h-4" />
                Invoice downloaded successfully as Invoice-{order.id}.pdf
              </span>
            </div>
          )}

          {/* Modal Body: Scrollable Paper Canvas */}
          <div className="invoice-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 bg-slate-100">
            {/* The Actual Invoice Paper */}
            <div
              id="printable-invoice-container"
              ref={invoiceRef}
              className="mx-auto w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 md:p-10 text-slate-800 font-sans"
            >
              {/* Top Header: Brand & Invoice Meta */}
              <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pb-6 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/images/shophub-logo.png"
                      alt="ShopHub"
                      className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-100 p-0.5"
                    />
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900">ShopHub Store</h1>
                      <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">
                        E-Commerce & Retail
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 leading-relaxed">
                    <p>support@shophub.com</p>
                    <p>Lahore, Punjab, Pakistan</p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Official Tax Invoice
                  </span>
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="text-slate-500">
                      Invoice No:{' '}
                      <span className="font-mono font-bold text-slate-900">
                        INV-{order.id}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Order No:{' '}
                      <span className="font-mono font-bold text-slate-900">
                        #{order.id}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Order Date:{' '}
                      <span className="font-semibold text-slate-800">
                        {formatDateTime(order.created_at)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer & Billing / Shipping Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
                {/* Billed To / Customer */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Customer Information
                  </p>
                  <h4 className="text-sm font-bold text-slate-900">{order.customer_name || 'Valued Customer'}</h4>
                  <p className="text-xs text-slate-600">{order.email || 'No email provided'}</p>
                  {order.phone && <p className="text-xs text-slate-600">{order.phone}</p>}
                </div>

                {/* Shipping & Payment Meta */}
                <div className="space-y-2 text-xs sm:text-right">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Delivery Address
                    </p>
                    <p className="text-slate-800 font-medium">{order.address || 'Standard Delivery'}</p>
                    {order.city && <p className="text-slate-600 font-normal">City: {order.city}</p>}
                    <p className="text-slate-500">Country: Pakistan</p>
                  </div>

                  <div className="pt-2 sm:flex sm:justify-end sm:gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Payment Method
                      </span>
                      <span className="font-semibold text-slate-800">
                        {isOrderCOD(order) ? 'Cash on Delivery' : order.payment_method || 'Online Card'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Payment Status
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${order.payment_status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.payment_status === 'Failed'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        {order.payment_status || 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products & Line Items Table */}
              <div className="py-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Products & Pricing Summary
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Product Details</th>
                        <th className="py-3 px-4 text-center">SKU</th>
                        <th className="py-3 px-4 text-center">Qty</th>
                        <th className="py-3 px-4 text-right">Unit Price</th>
                        <th className="py-3 px-4 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No product details found for this order.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const unitPrice = Number(item.price) || 0;
                          const qty = Number(item.quantity) || 1;
                          const lineTotal = unitPrice * qty;

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-900 block">
                                  {item.product_name}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                                {item.sku || item.variant_sku || '-'}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-800">
                                {qty}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-600">
                                {formatMoney(unitPrice)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900">
                                {formatMoney(lineTotal)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Breakdown & Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 pb-6 border-b border-slate-200">
                {/* Notes / Terms */}
                <div className="text-xs text-slate-500 space-y-2">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Terms & Instructions
                  </p>
                  <p>
                    Thank you for shopping with ShopHub. Please retain this invoice for your records and any warranty claims.
                  </p>
                  {isOrderCOD(order) && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                      <strong>Cash on Delivery:</strong> Please pay the exact amount of{' '}
                      <strong>{formatMoney(totalAmount)}</strong> to the courier upon parcel delivery.
                    </div>
                  )}
                  {order.transaction_id && (
                    <p className="font-mono text-[11px] text-slate-400">
                      Txn Ref: {order.transaction_id}
                    </p>
                  )}
                </div>

                {/* Subtotal, Discounts, Shipping, Grand Total */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-800">{formatMoney(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}:</span>
                      <span className="font-semibold">- {formatMoney(discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600">
                    <span>Shipping Charges:</span>
                    <span className="font-semibold text-slate-800">
                      {shippingAmount === 0 ? 'Free Shipping' : formatMoney(shippingAmount)}
                    </span>
                  </div>

                  {order.tax_amount !== undefined && Number(order.tax_amount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax / Duties:</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(order.tax_amount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between pt-3 border-t border-slate-200 text-base font-black text-slate-900">
                    <span>Total Amount:</span>
                    <span className="text-indigo-700 font-black">{formatMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Invoice Footer Stamp */}
              <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
                <span>Computer generated invoice. No signature required.</span>
                <span>ShopHub E-Commerce Systems • All rights reserved</span>
              </div>
            </div>
          </div>

          {/* Modal Bottom Bar */}
          <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between no-print shrink-0">
            <div className="text-xs text-slate-500">
              Order status:{' '}
              <span className="font-semibold text-slate-800">{order.order_status}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-xl border border-slate-300 shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <FiPrinter className="w-3.5 h-3.5 text-slate-600" />
                <span>Print</span>
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleDownloadPDF}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <FiDownload className="w-3.5 h-3.5" />
                <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
