import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import OrderTrackingModal from '../component/OrderTrackingModal';
import {
  FiCheckCircle,
  FiPackage,
  FiTruck,
  FiArrowLeft,
  FiHome,
  FiFileText,
  FiShoppingBag
} from 'react-icons/fi';

export default function OrderSuccess() {
  const location = useLocation();
  const order = location.state?.order;
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  // State missing hone par Fallback View
  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-10 max-w-md mx-auto border border-slate-100 shadow-sm flex flex-col items-center">
          <FiCheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Confirmed!</h2>
          <p className="text-slate-500 text-sm mb-6">Your order has been placed successfully.</p>
          <div className="flex gap-3">
            <Link to="/orders" className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-5 py-2.5 rounded-xl transition text-sm inline-flex items-center gap-1.5">
              <FiPackage /> View Orders
            </Link>
            <Link to="/" className="bg-black hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm inline-flex items-center gap-1.5">
              <FiHome /> Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Safe Property Mapping (Backend aur Frontend Key Mismatches Guard)
  const customerName = order.customer?.fullName 
    || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() 
    || order.customer_name 
    || 'Valued Customer';

  const orderId = order.orderId || order.id || 'N/A';
  const orderDate = order.date || (order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString());
  const paymentMethod = order.customer?.paymentMethod || order.payment_method || 'Cash on Delivery';
  const totalAmount = Number(order.grandTotal || order.totalAmount || order.total_amount || 0);
  const itemsList = order.items || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 text-center">

        {/* Animated Badge */}
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
          <FiCheckCircle className="w-10 h-10" />
        </div>

        <span className="text-sm font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block mb-2">
          Order Placed Successfully
        </span>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mb-2">
          Thank You For Your Order!
        </h1>

        <p className="text-slate-500 text-sm max-w-lg mx-auto mb-6">
          We have confirmed your order details. You can track this order in your profile order history.
        </p>

        {/* Order Receipt Details Card */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-left mb-8 max-w-2xl mx-auto">

          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200">
            <div>
              <span className="text-sm text-slate-400 font-medium block">Order Reference ID:</span>
              <span className="text-lg font-bold text-slate-900">{orderId}</span>
            </div>
            <div className="text-right">
              <span className="text-sm text-slate-400 font-medium block">Date:</span>
              <span className="text-sm font-semibold text-slate-700">{orderDate}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm mb-6">
            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiPackage className="text-amber-500" /> Shipping Address
              </h4>
              <p className="font-semibold text-slate-700">{customerName}</p>
              <p className="text-slate-500">{order.customer?.address || order.address}</p>
              <p className="text-slate-500">{order.customer?.city || order.city}</p>
              <p className="text-slate-500">Phone: {order.customer?.phone || order.phone || 'N/A'}</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiTruck className="text-amber-500" /> Payment & Delivery
              </h4>
              <p className="text-slate-600">
                Method: <span className="font-bold text-slate-800 uppercase">{paymentMethod}</span>
              </p>
              <p className="text-slate-600 mt-1">
                Estimated Delivery: <span className="font-bold text-emerald-600">2 - 4 Business Days</span>
              </p>
            </div>
          </div>

          {/* Ordered Items Breakdown */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3 flex items-center gap-1">
              <FiFileText className="text-amber-500" /> Summary Items ({itemsList.length})
            </h4>

            <div className="space-y-2 mb-4">
              {itemsList.map((item, index) => {
                const title = item.title || item.name || item.product_name || 'Product';
                const price = Number(item.price || 0);
                const quantity = Number(item.quantity || 1);

                return (
                  <div key={item.id || index} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700 font-medium truncate max-w-[250px]">
                      {title} (x{quantity})
                    </span>
                    <span className="font-bold text-slate-900">Rs. {(price * quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-center font-extrabold text-slate-900 text-sm">
              <span>{paymentMethod.toLowerCase().includes('cash') || paymentMethod.toLowerCase().includes('cod') ? 'Payable on Delivery:' : 'Total Paid:'}</span>
              <span className="text-emerald-600 text-lg">Rs. {totalAmount.toFixed(2)}</span>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => setIsTrackingOpen(true)}
            className="bg-slate-900 hover:bg-black text-white font-semibold px-6 py-3.5 rounded-xl transition shadow-md inline-flex items-center gap-2 text-sm active:scale-95"
          >
            <FiPackage className="w-4 h-4 text-amber-400" /> Track Order Status
          </button>

          <Link
            to={`/orders?order=${encodeURIComponent(orderId)}`}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-6 py-3.5 rounded-xl transition inline-flex items-center gap-2 text-sm"
          >
            <FiTruck className="w-4 h-4" /> Full Tracking Page
          </Link>

          <Link
            to="/"
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3.5 rounded-xl transition inline-flex items-center gap-2 text-sm"
          >
            <FiShoppingBag className="w-4 h-4" /> Continue Shopping
          </Link>
        </div>

      </div>

      {/* Modern Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={isTrackingOpen}
        order={{
          id: orderId,
          order_status: order.order_status || 'Pending',
          city: order.customer?.city || order.city,
          created_at: order.created_at || new Date().toISOString(),
          customer_name: customerName,
          carrier: 'FedEx',
          total_amount: totalAmount,
          items: itemsList,
        }}
        onClose={() => setIsTrackingOpen(false)}
      />
    </div>
  );
}