import { readPaymentRecovery, recoverPayment, paymentStorageKey } from '../utils/paymentRecovery';
import React, { useState, useEffect } from 'react';
import { checkoutItems } from '../../../shared/checkout.js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCheckoutForm from './StripeCheckoutForm';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  FiLock,
  FiTruck,
  FiCreditCard,
  FiCheckCircle,
  FiArrowLeft,
  FiShoppingBag,
  FiLoader
} from 'react-icons/fi';
import { FaCcVisa, FaCcMastercard } from 'react-icons/fa';
import useCartQuote from '../hooks/useCartQuote';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY) : null;

export default function Checkout() {
  const { loading: cartLoading, error: cartError, retry: retryCart, cart, clearCart, couponCode: appliedCode, setCouponCode: setAppliedCode } = useCart();
  const { user, addOrder } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(() => readPaymentRecovery());
  const [recoveryMessage, setRecoveryMessage] = useState('');

  // Form Data State
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    paymentMethod: 'cod' // 'cod' or 'card'
  });

  // Sync state if user data loads asynchronously
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
        address: prev.address || user.address || '',
        city: prev.city || user.city || ''
      }));
    }
  }, [user]);

  // Promo / Coupon Code State
  const [coupon, setCoupon] = useState(appliedCode);
  const { quote, quoteLoading, quoteError } = useCartQuote(cart, appliedCode);
  const couponMessage = quote?.promotionName ? `Applied: ${quote.promotionName}` : '';

  // Order Calculations
  const subtotal = quote?.subtotal || 0;
  const discountAmount = quote?.discountAmount || 0;
  const appliedDiscount = discountAmount;
  const shipping = quote?.shipping || 0;
  const grandTotal = quote?.grandTotal || 0;

  const handleCardPaymentSuccess = async response => {
    const finalOrderDetails = { orderId: response.orderId, customer: response.customer, items: response.quote.lines, ...response.quote, paymentMethod: 'Credit/Debit Card', date: new Date().toLocaleDateString('en-US') };
    localStorage.removeItem(paymentStorageKey); setPendingPayment(null);
    addOrder?.(finalOrderDetails); clearCart(response.quote.lines);
    navigate('/order-success', { state: { order: finalOrderDetails } });
  };

  const retryPayment = async action => {
    if (isSubmitting) return;
    setIsSubmitting(true); setRecoveryMessage('');
    try {
      const result = await recoverPayment(pendingPayment, user?.token, action);
      if (result.canceled) { localStorage.removeItem(paymentStorageKey); setPendingPayment(null); }
      else if (result.success) await handleCardPaymentSuccess(result);
      else setRecoveryMessage(result.message);
    } catch (error) { setRecoveryMessage(error.message); }
    finally { setIsSubmitting(false); }
  };

  // Handle Input Changes
  const handleInputChange = (e) => {
    if (isSubmitting) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Coupon Apply Handler
  const handleApplyCoupon = (e) => {
    e.preventDefault();
    setAppliedCode(coupon.trim().toUpperCase());
  };

  // Place Order Submit Handler (For COD)
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (isSubmitting || quoteLoading || quoteError || !quote || formData.paymentMethod !== 'cod') return;

    setIsSubmitting(true);

    const idempotencyKey = 'cod_' + (user?.id || 'guest') + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    const orderPayload = {
      idempotencyKey,
      customer: {
        firstName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
      },
      items: checkoutItems(cart),
      couponCode: appliedCode,
      totalAmount: grandTotal,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'COD Pending',
      transactionId: null,
      userId: user?.id || null,
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify(orderPayload)
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Order save nahi ho saka.');
      }

      const finalOrderDetails = {
        orderId: responseData.orderId,
        customer: formData,
        items: responseData.quote.lines,
        ...responseData.quote,
        paymentMethod: orderPayload.paymentMethod,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };

      if (addOrder) {
        addOrder(finalOrderDetails);
      }

      clearCart();
      navigate('/order-success', { state: { order: finalOrderDetails } });
    } catch (error) {
      console.error('Order submission error:', error);
      alert(error.message || 'Order place karne me masala aaya. Dobara try karein.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingPayment) return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold">Complete your previous checkout</h1>
      <p>Your payment reference is saved. Check its status before starting another payment. If payment succeeded, this retries the order without charging again.</p>
      <p className="text-sm break-all">Checkout reference: {pendingPayment.checkoutId}</p>
      <p className="text-sm">Sign in to the original account if this checkout was started while signed in.</p>
      {recoveryMessage && <p role="status" className="text-amber-800">{recoveryMessage}</p>}
      <button disabled={isSubmitting} onClick={() => retryPayment('reconcile')} className="rounded-xl bg-black text-white p-3 disabled:opacity-50">{isSubmitting ? 'Checking...' : 'Check payment / Retry order'}</button>
      <button disabled={isSubmitting} onClick={() => retryPayment('cancel')} className="block underline">Cancel only if payment has not succeeded</button>
      <p className="text-sm text-slate-500">Paid checkouts remain recoverable on the server. Contact support with this reference if recovery remains pending. No refund is implied.</p>
    </div>
  );

  if (cartLoading || cartError) return <div className="p-10 text-center">{cartError || 'Loading saved cart...'}{cartError && <button onClick={retryCart} className="ml-4 underline">Retry</button>}</div>;

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-10 max-w-md mx-auto border border-slate-200 shadow-sm flex flex-col items-center">
          <FiShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">No Items to Checkout</h2>
          <p className="text-slate-500 text-sm mb-6">There are currently no items in your cart.</p>
          <Link to="/shop" className="bg-black hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition inline-flex items-center gap-2 shadow-md">
            <FiArrowLeft /> Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
          <FiLock className="text-black" /> Secure Checkout
        </h1>
        <Link to="/cart" className="text-slate-600 hover:text-black text-sm font-semibold inline-flex items-center gap-1">
          <FiArrowLeft /> Return to Cart
        </Link>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Shipping & Payment Options */}
        <div className="lg:col-span-2 space-y-8">

          {/* Shipping Form */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FiTruck className="text-black" /> 1. Shipping Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="Enter Your Name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="e.g. user@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="e.g. 03001234567"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  placeholder="e.g. Lahore, Karachi, Islamabad"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Complete Delivery Address *
                </label>
                <textarea
                  name="address"
                  required
                  rows="3"
                  placeholder="House #, Street #, Sector/Area, City"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-black focus:bg-white transition resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FiCreditCard className="text-black" /> 2. Select Payment Method
            </h2>

            <div className="space-y-4">
              {/* Cash on Delivery Option */}
              <label
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition ${formData.paymentMethod === 'cod' ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={formData.paymentMethod === 'cod'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-black accent-black focus:ring-black"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-sm">Cash on Delivery (COD)</span>
                    <span className="text-slate-500 text-xs">Pay cash when package arrives</span>
                  </div>
                </div>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md">Popular</span>
              </label>

              {/* Credit/Debit Card Option */}
              <label
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition ${formData.paymentMethod === 'card' ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-black accent-black focus:ring-black"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-sm">Credit / Debit Card</span>
                    <span className="text-slate-500 text-xs">Visa, Mastercard, 1LINK</span>
                  </div>
                </div>
                <div className="flex items-center gap-2" aria-label="Accepted cards: Visa, Mastercard, and 1LINK">
                  <FaCcVisa className="w-8 h-6 text-[#1a1f71]" title="Visa" />
                  <FaCcMastercard className="w-8 h-6 text-[#eb001b]" title="Mastercard" />
                  <span className="inline-flex h-6 items-center rounded border border-[#075aa8] bg-white px-1.5 text-[9px] font-extrabold tracking-tight text-[#075aa8]" title="1LINK">
                    1LINK
                  </span>
                </div>
              </label>

              {/* Stripe Form Container */}
              {formData.paymentMethod === 'card' && stripePromise && (
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 mt-2">
                  <Elements stripe={stripePromise}>
                    <StripeCheckoutForm
                      totalAmount={grandTotal}
                      customerDetails={formData}
                      cartItems={cart}
                      token={user?.token}
                      onBusy={setIsSubmitting}
                      onPending={setPendingPayment}
                      couponCode={appliedCode}
                      disabled={quoteLoading || !!quoteError || !quote}
                      onSuccess={handleCardPaymentSuccess}
                    />
                  </Elements>
                </div>
              )}
              {formData.paymentMethod === 'card' && !stripePromise && (
                <p className="text-sm text-slate-600">Card payment is currently unavailable. Please choose cash on delivery.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Order Summary & Action Button */}
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 sticky top-24">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-3 border-b border-slate-200">
              Order Summary ({cart.length})
            </h2>

            {/* Cart Items List */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1 mb-4 divide-y divide-slate-200/60">
              {cart.map((item, idx) => (
                <div key={item.variantId || `${item.id}-${item.selectedSize}-${idx}`} className="flex items-center gap-3 pt-3 first:pt-0">
                  <img src={item.image} alt={item.title} className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{item.title}</h4>
                    <p className="text-[14px] text-slate-500">
                      Qty: {item.quantity} {item.selectedSize ? `| Size: ${item.selectedSize}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    Rs.{((quote?.lines.find(line => line.id === item.id && (line.productVariantId || null) === (item.productVariantId || null))?.price || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Promo Code Section */}
            <div className="mb-4 pt-3 border-t border-slate-200">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Promo Code:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="bg-black hover:bg-slate-800 text-white text-sm font-bold px-3 py-2 rounded-xl transition"
                >
                  Apply
                </button>
              </div>
              {couponMessage && (
                <p className={`text-[11px] font-medium mt-1.5 ${appliedDiscount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {couponMessage}
                </p>
              )}
              {quoteLoading && <p role="status" className="mt-2 text-sm text-slate-500">Updating totals...</p>}
              {quoteError && <p role="alert" className="mt-2 text-sm text-red-600">{quoteError}</p>}
              {appliedCode && (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold underline"
                  onClick={() => { setAppliedCode(''); setCoupon(''); }}
                >
                  Remove coupon
                </button>
              )}
            </div>

            {/* Summary Breakdown */}
            <div className="space-y-2.5 text-xs text-slate-600 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-bold text-sm text-slate-800">{quote ? `Rs.${subtotal.toFixed(2)}` : '?'}</span>
              </div>

              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium text-sm">
                  <span>Coupon Discount</span>
                  <span>-Rs.{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span>Shipping Fee</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {!quote ? '?' : shipping === 0 ? <span className="text-emerald-600 text-sm">FREE</span> : `Rs.${shipping.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-4 mt-4 border-t border-slate-300">
              <span>Grand Total</span>
              <span className="text-black text-xl">{quote ? `Rs.${grandTotal.toFixed(2)}` : '?'}</span>
            </div>

            {/* COD Submit Button (Hidden or Disabled when Card Option is Selected) */}
            {formData.paymentMethod === 'cod' ? (
              <button
                type="submit"
                disabled={isSubmitting || quoteLoading || !!quoteError || !quote}
                className="w-full mt-6 bg-black hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <FiLoader className="w-5 h-5 animate-spin" /> Processing Order...
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="w-5 h-5" /> Place COD Order
                  </>
                )}
              </button>
            ) : (
              <p className="mt-6 text-xs text-center text-slate-500 border border-slate-200 rounded-xl p-3 bg-white">
                Complete your payment details in step 2 above to finalize your card order.
              </p>
            )}

            <p className="text-[10px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1">
              <FiLock /> Safe & Secure Encrypted Checkout
            </p>
          </div>
        </div>

      </form>
    </div>
  );
}