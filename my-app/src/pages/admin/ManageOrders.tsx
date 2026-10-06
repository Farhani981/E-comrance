import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
  FiShoppingBag,
  FiClock,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiFilter,
  FiEye,
  FiX,
  FiCalendar,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiDollarSign,
  FiAlertTriangle,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiInbox,
  FiCheck,
  FiAlertCircle,
  FiFileText,
  FiTruck,
  FiExternalLink,
  FiEdit2,
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import OrderInvoiceModal from '../../component/OrderInvoiceModal';
import { useAuth } from '../../context/AuthContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { getSettlementStatusBadge } from './CODTransactions';

export interface OrderItem {
  id: number;
  order_id: string;
  product_id?: number | null;
  product_variant_id?: number | null;
  product_name: string;
  price: number | string;
  quantity: number;
  image?: string;
  sku?: string;
  variant_sku?: string;
  variant_options?: any;
  available_stock?: number;
}

export interface Order {
  id: string;
  user_id?: number | null;
  customer_name: string;
  email: string;
  phone?: string;
  address: string;
  city?: string;
  total_amount: number | string;
  subtotal?: number | string;
  discount_amount?: number | string;
  shipping_amount?: number | string;
  tax_amount?: number | string;
  coupon_code?: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  transaction_id?: string | null;
  tracking_number?: string | null;
  courier_name?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  items?: OrderItem[];
}

const ORDER_STATUS_LIST = [
  'New',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Returned',
] as const;

const TIMELINE_STEPS = [
  { key: 'New', label: 'Order Placed' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Processing', label: 'Processing' },
  { key: 'Packed', label: 'Packed' },
  { key: 'Shipped', label: 'Shipped' },
  { key: 'Out for Delivery', label: 'Out for Delivery' },
  { key: 'Delivered', label: 'Delivered' },
];

export default function ManageOrders() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const authToken = user?.token || '';

  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderCodData, setOrderCodData] = useState<any | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [confirmingStatus, setConfirmingStatus] = useState<{
    orderId: string;
    targetStatus: string;
    isCOD: boolean;
  } | null>(null);

  // Fetch linked COD data when order modal opens
  useEffect(() => {
    if (!selectedOrder) {
      setOrderCodData(null);
      return;
    }
    const isCod = isOrderCOD(selectedOrder);
    if (isCod) {
      fetch(`/api/orders/${selectedOrder.id}/cod-details`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.cod) {
            setOrderCodData(data.cod);
          } else {
            setOrderCodData(null);
          }
        })
        .catch(() => setOrderCodData(null));
    } else {
      setOrderCodData(null);
    }
  }, [selectedOrder, authToken]);

  // Cancel order modal
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReasonCategory, setCancelReasonCategory] = useState('Customer Request');
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Shipping details modal
  const [shippingModalOrder, setShippingModalOrder] = useState<Order | null>(null);
  const [shippingCourier, setShippingCourier] = useState('Trax Logistics');
  const [customCourierName, setCustomCourierName] = useState('');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
  const [isMarkingShippedOnly, setIsMarkingShippedOnly] = useState(false);
  const [isSavingShipping, setIsSavingShipping] = useState(false);

  // Status updating indicator
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Active Action dropdown state (stores order id or null)
  const [activeActionOrderId, setActiveActionOrderId] = useState<string | null>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.action-dropdown-container')) {
        setActiveActionOrderId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveActionOrderId(null);
      }
    };

    if (activeActionOrderId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeActionOrderId]);

  // 1. Fetch Orders from Backend
  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Failed to fetch orders (HTTP ${res.status}).`);
      }
      setOrders(data.orders || []);
      if (isRefresh) {
        showAlert('Orders refreshed successfully.', 'success', 'Updated');
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Could not connect to the orders service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, showAlert]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Format Helpers
  const formatMoney = (val: number | string) => {
    const num = Math.round(Number(val) || 0);
    return `Rs. ${num.toLocaleString('en-PK')}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  const isOrderCOD = (order: Order) => {
    const m = (order.payment_method || '').toLowerCase();
    return m.includes('cash') || m.includes('cod');
  };

  // Status Badge Colors
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'New':
      case 'Pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Confirmed':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Processing':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Packed':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Shipped':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Out for Delivery':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Delivered':
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Returned':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPaymentStatusBadge = (status: string) => {
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
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Top Summary Counts
  const summaryStats = useMemo(() => {
    const total = orders.length;
    const newCount = orders.filter((o) => ['New', 'Pending'].includes(o.order_status)).length;
    const processing = orders.filter((o) => o.order_status === 'Processing').length;
    const delivered = orders.filter((o) => ['Delivered', 'Completed'].includes(o.order_status)).length;
    const cancelled = orders.filter((o) => o.order_status === 'Cancelled').length;
    const codPending = orders.filter(
      (o) => isOrderCOD(o) && ['Pending', 'Unpaid'].includes(o.payment_status) && o.order_status !== 'Cancelled'
    ).length;

    return { total, newCount, processing, delivered, cancelled, codPending };
  }, [orders]);

  // Filtering Logic
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        (order.customer_name || '').toLowerCase().includes(q) ||
        (order.phone || '').toLowerCase().includes(q) ||
        (order.email || '').toLowerCase().includes(q) ||
        (order.city || '').toLowerCase().includes(q);

      // 2. Status Filter
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'New'
          ? ['New', 'Pending'].includes(order.order_status)
          : order.order_status === statusFilter);

      // 3. Payment Method Filter
      const method = (order.payment_method || '').toLowerCase();
      const matchMethod =
        paymentMethodFilter === 'All' ||
        (paymentMethodFilter === 'Cash on Delivery'
          ? method.includes('cash') || method.includes('cod')
          : !method.includes('cash') && !method.includes('cod'));

      // 4. Payment Status Filter
      const pStatus = (order.payment_status || '').toLowerCase();
      const matchPaymentStatus =
        paymentStatusFilter === 'All' ||
        (paymentStatusFilter === 'Pending'
          ? ['pending', 'unpaid'].includes(pStatus)
          : pStatus === paymentStatusFilter.toLowerCase());

      // 5. Date Filter
      let matchDate = true;
      if (dateFilter !== 'All' && order.created_at) {
        const orderDate = new Date(order.created_at);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === 'Today') {
          matchDate = orderDate >= startOfToday;
        } else if (dateFilter === 'Yesterday') {
          const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
          matchDate = orderDate >= startOfYesterday && orderDate < startOfToday;
        } else if (dateFilter === 'Last 7 Days') {
          const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchDate = orderDate >= past7;
        } else if (dateFilter === 'Last 30 Days') {
          const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchDate = orderDate >= past30;
        } else if (dateFilter === 'Custom' && (customStartDate || customEndDate)) {
          if (customStartDate) {
            matchDate = matchDate && orderDate >= new Date(customStartDate);
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            matchDate = matchDate && orderDate <= end;
          }
        }
      }

      return matchSearch && matchStatus && matchMethod && matchPaymentStatus && matchDate;
    });
  }, [
    orders,
    searchTerm,
    statusFilter,
    paymentMethodFilter,
    paymentStatusFilter,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentMethodFilter, paymentStatusFilter, dateFilter, customStartDate, customEndDate]);

  // Tracking URL Helper
  const getCourierTrackingUrl = (courierName?: string | null, trackingNo?: string | null) => {
    if (!trackingNo) return null;
    const c = (courierName || '').toLowerCase();
    if (c.includes('trax')) return `https://trax.pk/tracking?tracking_number=${encodeURIComponent(trackingNo)}`;
    if (c.includes('tcs')) return `https://www.tcsexpress.com/tracking?tracking_no=${encodeURIComponent(trackingNo)}`;
    if (c.includes('leopard')) return `https://leopardscourier.com/tracking/?track=${encodeURIComponent(trackingNo)}`;
    if (c.includes('callcourier')) return `https://callcourier.com.pk/tracking/?cn=${encodeURIComponent(trackingNo)}`;
    if (c.includes('postex')) return `https://postex.pk/tracking?cn=${encodeURIComponent(trackingNo)}`;
    if (c.includes('mnp') || c.includes('m&p')) return `https://mulphilog.com/tracking?cn=${encodeURIComponent(trackingNo)}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'Courier'} tracking ${trackingNo}`)}`;
  };

  // Status Change Request Handlers
  const requestStatusChange = (order: Order, nextStatus: string) => {
    if (nextStatus === 'Cancelled') {
      setCancellingOrder(order);
      setCancelReasonCategory('Customer Request');
      setCancelCustomReason('');
      return;
    }

    // When status is Shipped, open Shipping Details modal to capture Courier and Tracking #
    if (nextStatus === 'Shipped') {
      setShippingModalOrder(order);
      setShippingCourier(order.courier_name || 'Trax Logistics');
      setCustomCourierName('');
      setShippingTrackingNumber(order.tracking_number || '');
      setIsMarkingShippedOnly(true);
      return;
    }

    // Confirmation for major milestone statuses
    if (['Delivered', 'Cancelled', 'Returned'].includes(nextStatus)) {
      setConfirmingStatus({
        orderId: order.id,
        targetStatus: nextStatus,
        isCOD: isOrderCOD(order),
      });
      return;
    }

    // Direct transition for intermediate steps
    applyStatusChange(order.id, nextStatus);
  };

  const applyStatusChange = async (
    orderId: string,
    nextStatus: string,
    optionalPaymentStatus?: string,
    cancelReason?: string,
    courierName?: string,
    trackingNumber?: string
  ) => {
    setUpdatingOrderId(orderId);
    try {
      const payload: any = { order_status: nextStatus };
      if (optionalPaymentStatus) payload.payment_status = optionalPaymentStatus;
      if (cancelReason) payload.cancellation_reason = cancelReason;
      if (courierName !== undefined) payload.courier_name = courierName;
      if (trackingNumber !== undefined) payload.tracking_number = trackingNumber;

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not update order status.');
      }

      showAlert(
        `Order #${orderId} status changed to "${nextStatus}".`,
        'success',
        'Order Updated'
      );

      // Update local state immediately
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            order_status: nextStatus,
            payment_status: optionalPaymentStatus || (nextStatus === 'Delivered' && isOrderCOD(o) ? 'Collected by Courier' : o.payment_status),
            cancellation_reason: cancelReason || o.cancellation_reason,
            courier_name: courierName !== undefined ? courierName : o.courier_name,
            tracking_number: trackingNumber !== undefined ? trackingNumber : o.tracking_number,
          };
        })
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                order_status: nextStatus,
                payment_status: optionalPaymentStatus || (nextStatus === 'Delivered' && isOrderCOD(prev) ? 'Collected by Courier' : prev.payment_status),
                cancellation_reason: cancelReason || prev.cancellation_reason,
                courier_name: courierName !== undefined ? courierName : prev.courier_name,
                tracking_number: trackingNumber !== undefined ? trackingNumber : prev.tracking_number,
              }
            : null
        );
      }
    } catch (err: any) {
      console.error('Status change error:', err);
      showAlert(err.message || 'Failed to update order status.', 'error', 'Error');
    } finally {
      setUpdatingOrderId(null);
      setConfirmingStatus(null);
      setShippingModalOrder(null);
    }
  };

  // Submit Shipping / Tracking Details from Modal
  const handleConfirmShippingModal = async () => {
    if (!shippingModalOrder) return;
    setIsSavingShipping(true);
    const finalCourier = shippingCourier === 'Other'
      ? (customCourierName.trim() || 'Other Courier')
      : shippingCourier;
    const finalTracking = shippingTrackingNumber.trim();

    try {
      if (isMarkingShippedOnly) {
        await applyStatusChange(
          shippingModalOrder.id,
          'Shipped',
          undefined,
          undefined,
          finalCourier,
          finalTracking
        );
      } else {
        const res = await fetch(`/api/orders/${shippingModalOrder.id}/shipping`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            courier_name: finalCourier,
            tracking_number: finalTracking,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to update shipping details.');
        }

        showAlert(
          `Shipping details updated for Order #${shippingModalOrder.id}.`,
          'success',
          'Shipping Updated'
        );

        setOrders((prev) =>
          prev.map((o) =>
            o.id === shippingModalOrder.id
              ? { ...o, courier_name: finalCourier, tracking_number: finalTracking }
              : o
          )
        );

        if (selectedOrder && selectedOrder.id === shippingModalOrder.id) {
          setSelectedOrder((prev) =>
            prev
              ? { ...prev, courier_name: finalCourier, tracking_number: finalTracking }
              : null
          );
        }
        setShippingModalOrder(null);
      }
    } catch (err: any) {
      console.error('Shipping update error:', err);
      showAlert(err.message || 'Failed to update courier details.', 'error', 'Error');
    } finally {
      setIsSavingShipping(false);
    }
  };

  // Submit Order Cancellation with Reason
  const handleCancelSubmit = async () => {
    if (!cancellingOrder) return;
    setIsCancelling(true);
    const finalReason = cancelReasonCategory === 'Other'
      ? (cancelCustomReason.trim() || 'Other reason')
      : cancelCustomReason.trim()
      ? `${cancelReasonCategory} - ${cancelCustomReason.trim()}`
      : cancelReasonCategory;

    await applyStatusChange(cancellingOrder.id, 'Cancelled', undefined, finalReason);
    setIsCancelling(false);
    setCancellingOrder(null);
  };

  // Timeline Step State Resolver
  const getTimelineStepStatus = (currentStatus: string, stepKey: string) => {
    if (currentStatus === 'Cancelled') return 'cancelled';
    if (currentStatus === 'Returned') return 'returned';

    const orderFlow = ['New', 'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Completed'];
    const currentIndex = orderFlow.indexOf(currentStatus);
    const stepIndex = orderFlow.indexOf(stepKey);

    if (currentStatus === stepKey || (stepKey === 'New' && currentStatus === 'Pending') || (stepKey === 'Delivered' && currentStatus === 'Completed')) {
      return 'current';
    }
    if (currentIndex >= stepIndex && currentIndex !== -1) {
      return 'completed';
    }
    return 'upcoming';
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Orders Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track all customer orders, delivery workflows, and COD payments.</p>
        </div>

        <button
          type="button"
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-black shadow-xs transition active:scale-95 self-start sm:self-auto"
        >
          <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-black' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Orders'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <MetricGrid cols={3}>
        <StatCard
          label="Total Orders"
          value={loading ? '...' : summaryStats.total.toLocaleString()}
          icon={<FiShoppingBag size={20} />}
          accent={ACCENT_COLORS[0]}
        />
        <StatCard
          label="New Orders"
          value={loading ? '...' : summaryStats.newCount.toLocaleString()}
          icon={<FiClock size={20} />}
          accent={ACCENT_COLORS[1]}
        />
        <StatCard
          label="Processing"
          value={loading ? '...' : summaryStats.processing.toLocaleString()}
          icon={<FiPackage size={20} />}
          accent={ACCENT_COLORS[2]}
        />
        <StatCard
          label="Delivered"
          value={loading ? '...' : summaryStats.delivered.toLocaleString()}
          icon={<FiCheckCircle size={20} />}
          accent={ACCENT_COLORS[3]}
        />
        <StatCard
          label="Cancelled"
          value={loading ? '...' : summaryStats.cancelled.toLocaleString()}
          icon={<FiXCircle size={20} />}
          accent={ACCENT_COLORS[6]}
        />
        <StatCard
          label="COD Pending"
          value={loading ? '...' : summaryStats.codPending.toLocaleString()}
          icon={<FiDollarSign size={20} />}
          accent={ACCENT_COLORS[4]}
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
              placeholder="Search by Order ID (#ORD-1052), customer name, phone, email..."
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
              <option value="All">All Order Statuses</option>
              {ORDER_STATUS_LIST.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black cursor-pointer"
          >
            <option value="All">All Payment Methods</option>
            <option value="Cash on Delivery">Cash on Delivery</option>
            <option value="Online Payment">Online Payment (Card/Stripe)</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black cursor-pointer"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Pending">Pending / Unpaid</option>
            <option value="Paid">Paid</option>
            <option value="Failed">Failed</option>
            <option value="Refunded">Refunded</option>
          </select>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <FiCalendar className="text-slate-400 shrink-0" size={16} />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black cursor-pointer"
            >
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (Shown if "Custom" selected) */}
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
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}

        {/* Active Filter Indicators & Count */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Found <strong className="text-slate-900">{filteredOrders.length}</strong> matching orders
          </span>
          {(searchTerm || statusFilter !== 'All' || paymentMethodFilter !== 'All' || paymentStatusFilter !== 'All' || dateFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setPaymentMethodFilter('All');
                setPaymentStatusFilter('All');
                setDateFilter('All');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-xs text-black font-semibold hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* 4. Orders Responsive Table (Desktop / Tablet) */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 min-h-[300px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Products</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Payment Method</th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-center">Order Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading orders...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <FiInbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No orders found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search or active filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const isCOD = isOrderCOD(order);
                  const itemCount = order.items?.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) || 0;
                  const isUpdating = updatingOrderId === order.id;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Order ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900">
                        {order.id}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 leading-tight">
                            {order.customer_name || 'Customer'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {order.city ? `${order.city} · ` : ''}
                            {order.phone || order.email}
                          </span>
                        </div>
                      </td>

                      {/* Products */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                        </span>
                      </td>

                      {/* Order Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {formatDate(order.created_at)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(order.total_amount)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">
                          {isCOD ? 'Cash on Delivery' : order.payment_method || 'Card'}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${getPaymentStatusBadge(
                            order.payment_status
                          )}`}
                        >
                          {order.payment_status || 'Pending'}
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <select
                            disabled={isUpdating || order.order_status === 'Cancelled'}
                            value={order.order_status}
                            onChange={(e) => requestStatusChange(order, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none transition ${getOrderStatusBadge(
                              order.order_status
                            )} ${isUpdating ? 'opacity-50' : ''}`}
                            title="Quick change order status"
                          >
                            {ORDER_STATUS_LIST.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Actions Dropdown */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="relative inline-block text-left action-dropdown-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionOrderId(
                                activeActionOrderId === order.id ? null : order.id
                              );
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition shadow-2xs cursor-pointer ${
                              activeActionOrderId === order.id
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200'
                            }`}
                            title="Order Actions"
                          >
                            <span>Action</span>
                            <FiChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                activeActionOrderId === order.id
                                  ? 'rotate-180 text-white'
                                  : 'text-slate-400'
                              }`}
                            />
                          </button>

                          {activeActionOrderId === order.id && (
                            <div
                              className={`absolute right-0 z-50 w-36 rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 ${
                                index >= paginatedOrders.length - 2 && paginatedOrders.length > 2
                                  ? 'bottom-full mb-1.5'
                                  : 'top-full mt-1.5'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionOrderId(null);
                                  setSelectedOrder(order);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                              >
                                <FiEye className="w-3.5 h-3.5 text-slate-500" />
                                <span>View Order</span>
                              </button>
                              <div className="h-px bg-slate-100 my-0.5" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionOrderId(null);
                                  setInvoiceOrder(order);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                              >
                                <FiFileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Invoice</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Mobile Orders Cards (Mobile-friendly responsive view) */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
              Loading orders...
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              <FiInbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700">No orders found</p>
            </div>
          ) : (
            paginatedOrders.map((order) => {
              const itemCount = order.items?.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) || 0;
              const isCOD = isOrderCOD(order);

              return (
                <div
                  key={order.id}
                  className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">{order.id}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getOrderStatusBadge(
                        order.order_status
                      )}`}
                    >
                      {order.order_status}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{order.customer_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {order.phone || order.email} {order.city ? `• ${order.city}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-base">{formatMoney(order.total_amount)}</p>
                      <p className="text-[11px] text-slate-500">{itemCount} items</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-medium">
                        {isCOD ? 'COD' : 'Online'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getPaymentStatusBadge(
                          order.payment_status
                        )}`}
                      >
                        {order.payment_status}
                      </span>
                    </div>

                    {/* Mobile Actions Dropdown */}
                    <div className="relative inline-block text-left action-dropdown-container">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionOrderId(
                            activeActionOrderId === `m-${order.id}` ? null : `m-${order.id}`
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition shadow-2xs cursor-pointer ${
                          activeActionOrderId === `m-${order.id}`
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-800 hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span>Action</span>
                        <FiChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            activeActionOrderId === `m-${order.id}`
                              ? 'rotate-180 text-white'
                              : 'text-slate-400'
                          }`}
                        />
                      </button>

                      {activeActionOrderId === `m-${order.id}` && (
                        <div className="absolute right-0 bottom-full mb-1.5 z-50 w-36 rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionOrderId(null);
                              setSelectedOrder(order);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <FiEye className="w-3.5 h-3.5 text-slate-500" />
                            <span>View Order</span>
                          </button>
                          <div className="h-px bg-slate-100 my-0.5" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionOrderId(null);
                              setInvoiceOrder(order);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                          >
                            <FiFileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Invoice</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 6. Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600">
          <div>
            Showing{' '}
            <strong className="text-slate-900">
              {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-900">
              {Math.min(currentPage * pageSize, filteredOrders.length)}
            </strong>{' '}
            of <strong className="text-slate-900">{filteredOrders.length}</strong> Orders
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

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                          currentPage === p
                            ? 'bg-black text-white'
                            : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    </Fragment>
                  );
                })}

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

      {/* 7. ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-800 rounded-2xl">
                  <FiShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-bold text-slate-900 text-lg sm:text-xl">
                      {selectedOrder.id}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${getOrderStatusBadge(
                        selectedOrder.order_status
                      )}`}
                    >
                      {selectedOrder.order_status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Placed on {formatDateTime(selectedOrder.created_at)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-800">
              {/* Visual Order Timeline */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                  Order Workflow Timeline
                </h4>

                {selectedOrder.order_status === 'Cancelled' ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                    <FiAlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">This order has been cancelled</strong>
                      {selectedOrder.cancellation_reason && (
                        <p className="mt-1 text-rose-700">
                          <strong>Reason:</strong> {selectedOrder.cancellation_reason}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {TIMELINE_STEPS.map((step) => {
                      const stepState = getTimelineStepStatus(selectedOrder.order_status, step.key);
                      const isDone = stepState === 'completed';
                      const isCurrent = stepState === 'current';

                      return (
                        <div
                          key={step.key}
                          className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                            isCurrent
                              ? 'bg-black text-white border-black shadow-xs'
                              : isDone
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-white text-slate-400 border-slate-200'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCurrent
                                ? 'bg-white text-black'
                                : isDone
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isDone ? <FiCheck size={12} /> : ''}
                          </div>
                          <span className="text-[11px] font-bold leading-tight mt-0.5">
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Customer Information & Delivery Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Details */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <FiUser size={15} /> Customer Details
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-base">{selectedOrder.customer_name}</h5>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p className="flex items-center gap-2">
                        <FiMail className="text-slate-400" /> {selectedOrder.email}
                      </p>
                      {selectedOrder.phone && (
                        <p className="flex items-center gap-2">
                          <FiPhone className="text-slate-400" /> {selectedOrder.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <FiMapPin size={15} /> Delivery Address
                  </div>
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">{selectedOrder.address || 'Address not provided'}</p>
                    {selectedOrder.city && <p className="text-slate-600 mt-1">City: {selectedOrder.city}</p>}
                    <p className="text-[11px] text-slate-400 mt-2">
                      Country: Pakistan (PK)
                    </p>
                  </div>
                </div>
              </div>

              {/* Products Breakdown with Live Stock Information */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FiPackage className="text-slate-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Products Ordered & Inventory Info
                    </h4>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedOrder.items?.length || 0} item line(s)
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {(selectedOrder.items || []).map((item, idx) => {
                    const price = Number(item.price) || 0;
                    const qty = Number(item.quantity) || 1;
                    const lineTotal = price * qty;
                    const stock = item.available_stock !== undefined ? Number(item.available_stock) : null;

                    return (
                      <div key={item.id || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={item.image || 'https://via.placeholder.com/80'}
                            alt={item.product_name}
                            className="w-14 h-14 object-cover rounded-xl border border-slate-200 bg-slate-50 shrink-0"
                          />
                          <div className="min-w-0">
                            <h5 className="font-bold text-sm text-slate-900 truncate">{item.product_name}</h5>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                              {item.sku && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                  SKU: {item.sku}
                                </span>
                              )}
                              <span>Qty: <strong className="text-slate-800">{qty}</strong></span>
                              <span>× {formatMoney(price)}</span>
                            </div>

                            {/* Inventory Live Stock Callout */}
                            <div className="mt-1.5 flex items-center gap-2 text-xs">
                              {stock !== null ? (
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[11px] ${
                                    stock <= 0
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : stock < 5
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  Available Stock: {stock} units
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Standard inventory</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            {formatMoney(lineTotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pricing Summary */}
                <div className="bg-slate-50/70 p-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  {selectedOrder.subtotal && (
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-800">{formatMoney(selectedOrder.subtotal)}</span>
                    </div>
                  )}
                  {Number(selectedOrder.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount ({selectedOrder.coupon_code || 'Promo'}):</span>
                      <span className="font-semibold">- {formatMoney(selectedOrder.discount_amount || 0)}</span>
                    </div>
                  )}
                  {selectedOrder.shipping_amount !== undefined && (
                    <div className="flex justify-between">
                      <span>Shipping Charges:</span>
                      <span className="font-semibold text-slate-800">
                        {Number(selectedOrder.shipping_amount) === 0 ? 'Free Shipping' : formatMoney(selectedOrder.shipping_amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-base text-emerald-700">{formatMoney(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Settlement Section (Requirement 11) */}
              {isOrderCOD(selectedOrder) ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <FiDollarSign size={16} className="text-emerald-600" />
                      Payment & Settlement Details
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${getPaymentStatusBadge(
                        orderCodData?.payment_status || selectedOrder.payment_status
                      )}`}
                    >
                      {orderCodData?.payment_status || selectedOrder.payment_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Payment Method</span>
                      <span className="font-bold text-slate-900">Cash on Delivery (COD)</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">COD Amount</span>
                      <span className="font-bold text-slate-900">{formatMoney(selectedOrder.total_amount)}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Courier</span>
                      <span className="font-bold text-slate-900">{selectedOrder.courier_name || orderCodData?.courier_name || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Tracking No</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedOrder.tracking_number || orderCodData?.tracking_number || 'Pending'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Payment Status</span>
                      <span className="font-bold text-slate-800">{orderCodData?.payment_status || selectedOrder.payment_status}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Expected Settlement</span>
                      <span className="font-bold text-indigo-900">
                        {orderCodData ? formatMoney(orderCodData.expected_settlement) : formatMoney(Number(selectedOrder.total_amount) - 200)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Actual Settlement</span>
                      <span className="font-bold text-emerald-800">
                        {orderCodData?.actual_settlement && Number(orderCodData.actual_settlement) > 0
                          ? formatMoney(orderCodData.actual_settlement)
                          : 'Pending Remittance'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Settlement Status</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getSettlementStatusBadge(orderCodData?.settlement_status || 'Unsettled')}`}>
                        {orderCodData?.settlement_status || 'Pending'}
                      </span>
                    </div>

                    {orderCodData?.settlement_number && (
                      <div>
                        <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Batch Reference</span>
                        <span className="font-mono font-semibold text-slate-700">{orderCodData.settlement_number}</span>
                      </div>
                    )}
                  </div>

                  {/* Settled / Reconciled Banner */}
                  {orderCodData && ['Settled', 'Reconciled', 'Partially Settled'].includes(orderCodData.settlement_status) ? (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1 text-emerald-800">
                          <FiCheckCircle size={14} /> Remittance Received
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-100 rounded text-emerald-900">
                          Status: {orderCodData.settlement_status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div>
                          <span className="text-emerald-700 block text-[10px] font-bold">Actual Settlement:</span>
                          <span className="font-bold text-emerald-950">{formatMoney(orderCodData.actual_settlement)}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 block text-[10px] font-bold">Settlement Date:</span>
                          <span>{formatDate(orderCodData.settlement_date)}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 block text-[10px] font-bold">Settlement Reference:</span>
                          <span className="font-mono">{orderCodData.bank_reference || orderCodData.settlement_number || 'Confirmed'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                      <div>
                        <span className="font-bold block">Settlement Pending</span>
                        <span className="text-[11px] text-amber-700">
                          COD payment is collected upon doorstep delivery and settled when courier remits payment batch.
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 bg-amber-100 rounded text-amber-900">
                        Pending Remittance
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <FiDollarSign size={15} /> Payment Information
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${getPaymentStatusBadge(
                        selectedOrder.payment_status
                      )}`}
                    >
                      {selectedOrder.payment_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Payment Method</span>
                      <span className="font-bold text-slate-900">
                        {selectedOrder.payment_method || 'Online Payment'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Transaction ID</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedOrder.transaction_id || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping / Courier Details Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <FiTruck size={14} /> Shipping & Courier
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShippingModalOrder(selectedOrder);
                      setShippingCourier(selectedOrder.courier_name || 'Trax Logistics');
                      setCustomCourierName('');
                      setShippingTrackingNumber(selectedOrder.tracking_number || '');
                      setIsMarkingShippedOnly(false);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-black px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                  >
                    <FiEdit2 size={11} /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Courier Company</span>
                    <span className="font-bold text-slate-900">{selectedOrder.courier_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">Tracking Number</span>
                    {selectedOrder.tracking_number ? (
                      <a
                        href={getCourierTrackingUrl(selectedOrder.courier_name, selectedOrder.tracking_number) || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        {selectedOrder.tracking_number} <FiExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="font-semibold text-slate-400 italic">Not assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Update Control Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Update Order Status</h5>
                    <p className="text-xs text-slate-500">
                      Progress order through fulfillment stages or cancel order.
                    </p>
                  </div>

                  {selectedOrder.order_status !== 'Cancelled' ? (
                    <div className="flex items-center gap-2">
                      <select
                        disabled={updatingOrderId === selectedOrder.id}
                        value={selectedOrder.order_status}
                        onChange={(e) => requestStatusChange(selectedOrder, e.target.value)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer focus:outline-none transition ${getOrderStatusBadge(
                          selectedOrder.order_status
                        )}`}
                      >
                        {ORDER_STATUS_LIST.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setCancellingOrder(selectedOrder);
                          setCancelReasonCategory('Customer Request');
                          setCancelCustomReason('');
                        }}
                        className="px-3 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        Cancel Order
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-rose-600 italic">
                      Order is permanently cancelled
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = selectedOrder;
                  setSelectedOrder(null);
                  setInvoiceOrder(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <FiFileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-semibold transition active:scale-95 shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. STATUS CHANGE CONFIRMATION MODAL */}
      {confirmingStatus && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <FiAlertTriangle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Confirm Status Change</h4>
                <p className="text-xs text-slate-500">Order #{confirmingStatus.orderId}</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Are you sure you want to mark this order as{' '}
              <strong className="text-slate-900 font-bold">"{confirmingStatus.targetStatus}"</strong>?
              {confirmingStatus.targetStatus === 'Delivered' && confirmingStatus.isCOD && (
                <span className="block mt-2 font-semibold text-indigo-800 bg-indigo-50 p-2.5 rounded-lg border border-indigo-200 text-xs">
                  ℹ️ Cash on Delivery: Marking as Delivered confirms that the courier collected payment at doorstep. Payment status will update to "Collected by Courier" (Settlement Pending) until courier remittance is reconciled.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingStatus(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  applyStatusChange(
                    confirmingStatus.orderId,
                    confirmingStatus.targetStatus,
                    confirmingStatus.targetStatus === 'Delivered' && confirmingStatus.isCOD ? 'Collected by Courier' : undefined
                  )
                }
                className="px-5 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition active:scale-95 shadow-sm"
              >
                Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. CANCEL ORDER MODAL WITH REASON SELECTION */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 sm:p-7 border border-slate-100 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                  <FiXCircle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Cancel Order</h4>
                  <p className="text-xs text-slate-500 font-mono">#{cancellingOrder.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              ⚠️ Cancelling this order will release reserved inventory back to active stock. If the customer has already paid, a refund record will be created.
            </div>

            {/* Cancellation Reason Options */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Select Reason for Cancellation *
              </label>

              {[
                'Customer Request',
                'Product Out of Stock',
                'Invalid Address',
                'Customer Unreachable',
                'Other',
              ].map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                    cancelReasonCategory === reason
                      ? 'border-black bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel_reason"
                    checked={cancelReasonCategory === reason}
                    onChange={() => setCancelReasonCategory(reason)}
                    className="accent-black"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {/* Custom Reason Textarea */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                {cancelReasonCategory === 'Other' ? 'Custom Reason *' : 'Additional Notes (Optional)'}
              </label>
              <textarea
                rows={3}
                placeholder="Enter cancellation notes..."
                value={cancelCustomReason}
                onChange={(e) => setCancelCustomReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-black transition resize-none"
              ></textarea>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isCancelling || (cancelReasonCategory === 'Other' && !cancelCustomReason.trim())}
                onClick={handleCancelSubmit}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 10. ORDER INVOICE MODAL */}
      {invoiceOrder && (
        <OrderInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}

      {/* 11. SHIPPING DETAILS MODAL */}
      {shippingModalOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                  <FiTruck size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {isMarkingShippedOnly ? 'Mark as Shipped — Add Courier Details' : 'Update Shipping Details'}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">Order #{shippingModalOrder.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShippingModalOrder(null); setIsSavingShipping(false); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {isMarkingShippedOnly && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  📦 Enter courier and tracking details before marking this order as <strong>Shipped</strong>. This helps customers track their package.
                </div>
              )}

              {/* Courier Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Courier Company *
                </label>
                <select
                  value={shippingCourier}
                  onChange={(e) => setShippingCourier(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-black transition"
                >
                  {['Trax Logistics', 'TCS Express', 'Leopards Courier', 'CallCourier', 'PostEx', 'M&P Logistics', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {shippingCourier === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter courier name..."
                    value={customCourierName}
                    onChange={(e) => setCustomCourierName(e.target.value)}
                    className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-black transition"
                  />
                )}
              </div>

              {/* Tracking Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Tracking Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TCS-123456789 or TRAX-0012345"
                  value={shippingTrackingNumber}
                  onChange={(e) => setShippingTrackingNumber(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-black transition"
                />
                {shippingTrackingNumber && (
                  <a
                    href={getCourierTrackingUrl(
                      shippingCourier === 'Other' ? customCourierName : shippingCourier,
                      shippingTrackingNumber
                    ) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    <FiExternalLink size={11} /> Preview tracking link
                  </a>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                disabled={isSavingShipping}
                onClick={() => { setShippingModalOrder(null); setIsSavingShipping(false); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
              >
                {isMarkingShippedOnly ? 'Skip / Cancel' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSavingShipping || (shippingCourier === 'Other' && !customCourierName.trim())}
                onClick={handleConfirmShippingModal}
                className="px-5 py-2.5 bg-black hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm flex items-center gap-2"
              >
                <FiTruck size={13} />
                {isSavingShipping
                  ? 'Saving...'
                  : isMarkingShippedOnly
                    ? 'Confirm Shipped'
                    : 'Save Shipping Details'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
