import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import OrderReturnActions from '../component/OrderReturnActions';
import OrderTrackingModal from '../component/OrderTrackingModal';
import { 
  FiPackage, 
  FiSearch, 
  FiTruck, 
  FiCheck, 
  FiArrowLeft, 
  FiShoppingBag, 
  FiMapPin, 
  FiFileText, 
  FiCalendar, 
  FiClock, 
  FiAlertCircle,
  FiPhone,
  FiMail
} from 'react-icons/fi';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState(null);
  const [publicTrackedOrder, setPublicTrackedOrder] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);

  const markCancelled = id => {
    setOrders(current => current.map(order => order.id === id ? { ...order, order_status: 'Cancelled' } : order));
    if (publicTrackedOrder?.id === id) {
      setPublicTrackedOrder(prev => ({ ...prev, order_status: 'Cancelled' }));
    }
  };

  const orderParam = searchParams.get('order');

  useEffect(() => {
    if (orderParam) setSearchQuery(orderParam);
  }, [orderParam]);

  useEffect(() => {
    const fetchUserOrders = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('shophub_user') || 'null');
        const token = user?.token || '';
        const res = await fetch('/api/orders/my-orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setOrders(data.orders);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserOrders();
  }, []);

  // If order param exists but order not found in logged-in user's list (or guest user), fetch directly from public track API
  useEffect(() => {
    if (!orderParam) {
      setPublicTrackedOrder(null);
      return;
    }

    const localFound = orders.find(o => o.id?.toLowerCase() === orderParam.toLowerCase());
    if (localFound) {
      setPublicTrackedOrder(localFound);
      return;
    }

    const fetchPublicTrack = async () => {
      setTrackingLoading(true);
      try {
        const res = await fetch(`/api/orders/track/${encodeURIComponent(orderParam)}`);
        const data = await res.json();
        if (data.success && data.order) {
          setPublicTrackedOrder(data.order);
        }
      } catch (err) {
        console.error('Error fetching public track:', err);
      } finally {
        setTrackingLoading(false);
      }
    };

    fetchPublicTrack();
  }, [orderParam, orders]);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = searchQuery === '' || o.id?.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'delivered') return matchesSearch && (o.order_status === 'Delivered' || o.order_status === 'Completed');
    if (activeTab === 'processing') return matchesSearch && (o.order_status === 'Processing' || o.order_status === 'Pending');
    return matchesSearch;
  });

  if (loading || trackingLoading) return <div className="p-12 text-center text-slate-500 font-semibold">Loading Order Tracking...</div>;

  const trackedOrder = publicTrackedOrder || (orderParam ? orders.find((o) => o.id?.toLowerCase() === orderParam.toLowerCase()) : null);

  if (trackedOrder) {
    const status = trackedOrder.order_status || 'Pending';
    const isCancelled = status === 'Cancelled';
    const carrier = trackedOrder.carrier || 'FedEx';
    const trackingNumber = trackedOrder.tracking_number || (trackedOrder.transaction_id ? String(trackedOrder.transaction_id).slice(-10) : `4221${String(trackedOrder.id).replace(/\D/g, '').slice(-6).padStart(6, '7362')}`);
    
    const orderDate = trackedOrder.created_at ? new Date(trackedOrder.created_at) : new Date();
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

    const estDeliveryDate = formatDate(addDays(orderDate, 5));
    const lastUpdatedDate = formatDate(
      status === 'Delivered' || status === 'Completed'
        ? addDays(orderDate, 5)
        : status === 'Shipped'
        ? addDays(orderDate, 3)
        : status === 'Processing'
        ? addDays(orderDate, 1)
        : orderDate
    );

    let activeStageIndex = 0;
    if (status === 'Processing') activeStageIndex = 1;
    else if (status === 'Shipped') activeStageIndex = 2;
    else if (status === 'Delivered' || status === 'Completed') activeStageIndex = 3;

    const displayStatus = isCancelled 
      ? 'Cancelled' 
      : status === 'Delivered' || status === 'Completed'
      ? 'Delivered'
      : status === 'Shipped'
      ? 'In transit'
      : status === 'Processing'
      ? 'Shipped'
      : 'Packaging';

    const originLocation = 'Lahore Hub, PK';
    const destinationLocation = trackedOrder.city ? `${trackedOrder.city}, PK` : 'Customer Delivery Address';

    const historySteps = [
      {
        title: 'Packaging',
        description: 'Package arrived at sorting facility',
        location: originLocation,
        date: formatDate(orderDate),
        stageIndex: 0,
      },
      {
        title: 'Shipped',
        description: 'Package arrived at shipping facility',
        location: 'Central Logistics Hub',
        date: formatDate(addDays(orderDate, 1)),
        stageIndex: 1,
      },
      {
        title: 'Left shipping facility',
        description: `Package enroute ${trackedOrder.city || 'destination'}`,
        location: 'In transit',
        date: formatDate(addDays(orderDate, 3)),
        stageIndex: 2,
      },
      {
        title: 'Delivered',
        description: `Package at ${destinationLocation}`,
        location: destinationLocation,
        date: estDeliveryDate,
        stageIndex: 3,
      },
    ];

    const routePercent = isCancelled ? 0 : activeStageIndex === 3 ? 100 : activeStageIndex === 2 ? 65 : activeStageIndex === 1 ? 35 : 10;

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6">
          <Link 
            to="/orders" 
            onClick={() => { setSearchQuery(''); setPublicTrackedOrder(null); }} 
            className="text-slate-600 hover:text-slate-900 text-sm font-semibold inline-flex items-center gap-2"
          >
            <FiArrowLeft /> Back to All Orders
          </Link>
          <button
            onClick={() => setSelectedTrackingOrder(trackedOrder)}
            className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1.5"
          >
            <FiTruck className="text-amber-500" /> View in Popup Modal
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 sm:px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Track order #{trackedOrder.id}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Tracking number <span className="font-bold text-slate-800">#{trackingNumber}</span> ({carrier})
              </p>
            </div>
            <span className={`self-start sm:self-auto px-3.5 py-1.5 rounded-full text-xs font-bold ${
              isCancelled ? 'bg-red-100 text-red-700' : status === 'Delivered' || status === 'Completed'
                ? 'bg-emerald-100 text-emerald-700' : status === 'Shipped'
                ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'
            }`}>{status}</span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Top 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                  isCancelled ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  <FiPackage size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">Status</p>
                  <p className="text-sm font-bold text-slate-800 capitalize truncate">{displayStatus}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-sm shrink-0">
                  <FiCalendar size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">Estimated delivery date</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{isCancelled ? 'Cancelled' : estDeliveryDate}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-sm shrink-0">
                  <FiClock size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">Last updated</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{lastUpdatedDate}</p>
                </div>
              </div>
            </div>

            {/* Shipping Route Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-5">
                Shipping route ({carrier})
              </h3>
              
              <div className="flex items-center justify-between text-xs gap-3">
                <div className="w-32 shrink-0">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">From</p>
                  <p className="font-bold text-slate-800 truncate mt-0.5">{originLocation}</p>
                </div>

                <div className="flex-1 relative flex items-center justify-center px-2">
                  <div className="w-full h-1.5 bg-slate-200 rounded-full relative">
                    <div 
                      className="h-full bg-sky-500 rounded-full transition-all duration-700" 
                      style={{ width: `${routePercent}%` }}
                    />
                  </div>
                  <div 
                    className="absolute -top-3.5 transition-all duration-700"
                    style={{ left: `calc(${routePercent}% - 14px)` }}
                  >
                    <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
                      <FiTruck size={15} />
                    </div>
                  </div>
                </div>

                <div className="w-32 shrink-0 text-right">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">To</p>
                  <p className="font-bold text-slate-800 truncate mt-0.5">{destinationLocation}</p>
                </div>
              </div>
            </div>

            {/* Tracking History */}
            <div className="pt-2">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                Tracking history
              </h3>

              {isCancelled ? (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 flex items-center gap-2">
                  <FiAlertCircle size={16} className="shrink-0" />
                  <span>This order was cancelled. Delivery process has ended.</span>
                </div>
              ) : (
                <div className="relative pl-1">
                  {historySteps.map((step, idx) => {
                    const isCompleted = step.stageIndex <= activeStageIndex;
                    const isCurrent = step.stageIndex === activeStageIndex;
                    const isLast = idx === historySteps.length - 1;

                    return (
                      <div key={step.title} className="relative flex items-start gap-4 pb-7 last:pb-2">
                        {!isLast && (
                          <div 
                            className={`absolute left-3 top-6 bottom-0 w-0.5 ${
                              step.stageIndex < activeStageIndex ? 'bg-emerald-500' : 'bg-slate-200'
                            }`} 
                          />
                        )}

                        <div className="relative z-10 shrink-0">
                          {isCompleted ? (
                            <div className={`w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs ${
                              isCurrent ? 'ring-4 ring-emerald-100' : ''
                            }`}>
                              <FiCheck size={13} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-slate-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 -mt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-sm font-bold ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                              {step.title}
                            </h4>
                            <span className={`text-xs font-medium shrink-0 ${isCompleted ? 'text-slate-500' : 'text-slate-300'}`}>
                              {step.date}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
                            {step.description}
                          </p>
                          <p className={`text-xs font-medium mt-0.5 ${isCompleted ? 'text-slate-500' : 'text-slate-300'}`}>
                            {step.location}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Link
                to="/orders"
                onClick={() => { setSearchQuery(''); setPublicTrackedOrder(null); }}
                className="px-6 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition active:scale-95 inline-block"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => setShowContactDialog(true)}
                className="px-6 py-2.5 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                Contact carrier
              </button>
            </div>

            {/* Invoice & Shipping Address */}
            <div className="grid lg:grid-cols-[1fr_280px] pt-6 border-t border-slate-100">
              <div className="pr-0 lg:pr-6 pb-6 lg:pb-0">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <FiFileText className="text-amber-500" /> Invoice Breakdown
                </h3>
                <OrderReturnActions order={trackedOrder} onCancelled={() => markCancelled(trackedOrder.id)} />
                <div className="border border-slate-200 rounded-2xl overflow-hidden mt-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_70px_100px] bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                    <span>Product</span><span className="text-center">Qty</span><span className="text-right">Price</span>
                  </div>
                  {trackedOrder.items?.map((item, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_70px_100px] items-center px-4 py-3 border-t border-slate-100 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.image || 'https://via.placeholder.com/64?text=Product'}
                          alt={item.product_name || 'Product'}
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <span className="text-slate-700 truncate text-xs font-semibold">{item.product_name}</span>
                      </div>
                      <span className="text-center text-slate-500 text-xs">{item.quantity}</span>
                      <span className="text-right font-bold text-slate-800 text-xs">Rs. {(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 font-extrabold text-slate-900 text-sm">
                    <span>Total Amount</span>
                    <span>Rs. {Number(trackedOrder.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 h-fit">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3 text-xs uppercase tracking-wider">
                  <FiMapPin className="text-amber-500" /> Delivery Address
                </h3>
                <p className="font-bold text-slate-800 text-sm">{trackedOrder.customer_name}</p>
                <p className="text-xs text-slate-500 mt-1">{trackedOrder.address}</p>
                <p className="text-xs text-slate-500">{trackedOrder.city}</p>
                <p className="text-xs text-slate-500 mt-2 font-medium">{trackedOrder.phone || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Carrier Dialog */}
        {showContactDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Contact {carrier}</h3>
              <p className="text-xs text-slate-500 mb-4">Quote tracking number <strong>#{trackingNumber}</strong> for assistance.</p>
              <div className="space-y-2 mb-4 text-xs">
                <a href="tel:+923001234567" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition">
                  <FiPhone className="text-emerald-600" /> Call Helpline (+92 300 1234567)
                </a>
                <a href={`mailto:support@${carrier.toLowerCase()}.com`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition">
                  <FiMail className="text-sky-600" /> Email Support
                </a>
              </div>
              <button onClick={() => setShowContactDialog(false)} className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition">Close</button>
            </div>
          </div>
        )}

        {/* Modal if toggled */}
        <OrderTrackingModal
          isOpen={!!selectedTrackingOrder}
          order={selectedTrackingOrder}
          onClose={() => setSelectedTrackingOrder(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FiPackage className="text-amber-500" /> Order History & Tracking
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track your parcel delivery status and view detailed receipt summaries</p>
        </div>
        <Link to="/shop" className="text-amber-600 hover:text-amber-700 text-sm font-semibold inline-flex items-center gap-1.5">
          <FiArrowLeft /> Back to Shopping
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="flex gap-2 w-full md:w-auto">
          {['all', 'processing', 'delivered'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition ${
                activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {tab === 'all' ? 'All Orders' : tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search Order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-xs focus:outline-none focus:border-amber-500"
          />
          <FiSearch className="absolute right-2.5 top-2.5 text-slate-400 w-4 h-4" />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-md mx-auto">
          <FiShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-1">No Orders Found</h3>
          <p className="text-slate-500 text-xs mb-6">Your search query did not match any order.</p>
          <Link to="/shop" className="bg-black hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-block">
            Explore Shop Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const status = order.order_status || 'Pending';
            return (
              <div key={order.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-6">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Order ID</span>
                    <h3 className="text-lg font-extrabold text-slate-900">{order.id}</h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block">Order Date</span>
                      <span className="font-semibold text-slate-700">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Total Amount</span>
                      <span className="font-extrabold text-slate-900 text-sm">Rs. {order.total_amount}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full font-bold ${
                      status === 'Delivered' || status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : status === 'Shipped'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <OrderReturnActions order={order} onCancelled={() => markCancelled(order.id)} />
                    <div className="flex items-center gap-2.5 ml-auto">
                      <Link
                        to={`/orders?order=${encodeURIComponent(order.id)}`}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition inline-flex items-center gap-1.5"
                      >
                        <FiFileText className="w-3.5 h-3.5 text-slate-500" /> Full Invoice
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSelectedTrackingOrder(order)}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 active:scale-95"
                      >
                        <FiTruck className="w-3.5 h-3.5 text-amber-400" /> Track Order Status
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <img src={item.image || 'https://via.placeholder.com/60'} alt={item.product_name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-slate-800 truncate">{item.product_name}</h5>
                          <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
                          <span className="text-xs font-extrabold text-black block mt-0.5">Rs. {item.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Track Order Modal Popup */}
      <OrderTrackingModal
        isOpen={!!selectedTrackingOrder}
        order={selectedTrackingOrder}
        onClose={() => setSelectedTrackingOrder(null)}
      />
    </div>
  );
}
