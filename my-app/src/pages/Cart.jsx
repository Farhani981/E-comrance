import React from 'react';
import useCartQuote from '../hooks/useCartQuote';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { FiTrash2, FiPlus, FiMinus, FiArrowLeft, FiShoppingBag } from 'react-icons/fi';

export default function Cart() {
  const { notices, loading: cartLoading, error: cartError, retry: retryCart, cart, updateQuantity, removeFromCart, couponCode } = useCart();

  const { quote, quoteLoading, quoteError } = useCartQuote(cart, couponCode);
  const subtotal = quote?.subtotal || 0;
  const shipping = quote?.shipping || 0;
  const total = quote?.grandTotal || 0;

  if (cartLoading || cartError) return <div className="p-10 text-center">{cartError || 'Loading saved cart...'}{cartError && <button onClick={retryCart} className="ml-4 underline">Retry</button>}</div>;
  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full border border-slate-200 shadow-sm flex flex-col items-center">
          {notices.length > 0 && <p role="status" className="mb-4 text-amber-800">{[...new Set(notices)].join(' ')}</p>}
          <FiShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Your Shopping Cart is Empty</h2>
          <p className="text-slate-500 text-sm mb-6">You have no items in your cart. Start exploring our catalog to add products.</p>
          <Link
            to="/shop"
            className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition flex items-center gap-2 shadow-md"
          >
            <FiArrowLeft /> Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {notices.length > 0 && <p role="status" className="mb-4 text-amber-800">{[...new Set(notices)].join(' ')}</p>}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8">Shopping Cart ({cart.length})</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Products List Section */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => {
            const key = item.variantId || item.id;

            return (
              <div key={key} className="flex flex-col sm:flex-row items-center justify-between border border-slate-200 p-4 rounded-2xl shadow-sm gap-4 bg-white">
                <img src={item.image} alt={item.title} className="w-20 h-20 object-cover rounded-xl border border-slate-100 shrink-0" />

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h3 className="font-extrabold text-slate-900  text-sm">{item.title}</h3>

                  {/* Variant Attributes (Size & Color) */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-sm">
                    {item.selectedSize && (
                      <span className="bg-slate-100 text-slate-700 font-semibold   px-2 py-0.5 rounded-md border border-slate-200">
                        Size: {item.selectedSize}
                      </span>
                    )}
                    {item.selectedColor && (
                      <span className="bg-slate-100 text-slate-700 font-semibold   px-2 py-0.5 rounded-md border border-slate-200">
                        Color: {item.selectedColor}
                      </span>
                    )}
                  </div>

                  <p className="text-amber-600 font-extrabold text-base mt-1 text-black">Rs.{quote?.lines.find(line => line.id === item.id && (line.productVariantId || null) === (item.productVariantId || null))?.price ?? '?'}</p>
                </div>

                {/* Quantity Controls (Decrement fixed) */}
                <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 p-0.5">
                  <button
                    onClick={() => updateQuantity(key, item.quantity - 1)}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-black hover:text-white transition active:scale-95"
                    title="Decrease Quantity"
                  >
                    <FiMinus className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-3 font-bold text-slate-800 text-sm">{item.quantity}</span>

                  <button
                    onClick={() => updateQuantity(key, item.quantity + 1)}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-black hover:text-white transition active:scale-95"
                    title="Increase Quantity"
                  >
                    <FiPlus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete Item Button */}
                <button
                  onClick={() => removeFromCart(key)}
                  className="text-slate-400 hover:text-red-500 p-2 transition rounded-xl hover:bg-red-50"
                  title="Remove Item"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Order Summary / Bill Section */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 h-fit">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-slate-200">Order Summary {quote && `(${quote.currency})`}</h2>

          {quoteLoading && <p role="status">Updating totals?</p>}
          {quoteError && <p role="alert" className="text-red-600">{quoteError}</p>}
          <div className="space-y-3 border-b border-slate-200 pb-4 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-extrabold text-slate-900">{quote ? `Rs.${subtotal.toFixed(2)}` : '?'}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-bold text-slate-800">{!quote ? '?' : shipping === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `Rs.${shipping.toFixed(2)}`}</span>
            </div>
          </div>

          {!!quote?.discountAmount && <div className="flex justify-between text-sm"><span>{quote.promotionName || 'Discount'}</span><span>-Rs.{quote.discountAmount.toFixed(2)}</span></div>}
          <div className="flex justify-between text-base font-extrabold text-slate-900 my-4">
            <span>Grand Total</span>
            <span className="text-black text-xl">{quote ? `Rs.${total.toFixed(2)}` : '?'}</span>
          </div>

          <Link
            to="/checkout"
            aria-disabled={!quote || quoteLoading || !!quoteError}
            onClick={event => { if (!quote || quoteLoading || quoteError) event.preventDefault(); }}
            className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition active:scale-95 text-center block no-underline shadow-md"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}