import { beginPaymentRecovery, recoverPayment } from '../utils/paymentRecovery';
// src/components/StripeCheckoutForm.jsx
import React, { useState } from 'react';
import { checkoutItems } from '../../../shared/checkout.js';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { FiLoader } from 'react-icons/fi';

const StripeCheckoutForm = ({ totalAmount, customerDetails, cartItems, couponCode, disabled, token, onBusy, onPending, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!stripe || !elements || disabled || loading) return;

    setLoading(true); onBusy(true);
    let reference;
    setErrorMessage('');

    try {
      reference = beginPaymentRecovery();
      // 1. Backend se PaymentIntent Client Secret fetch karein
      const res = await fetch('/api/orders/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ amount: totalAmount, items: checkoutItems(cartItems), couponCode, customer: customerDetails, ...reference }),
      });

      const intentData = await res.json();
      if (!res.ok || !intentData.clientSecret) {
        throw new Error(intentData.message || 'Payment initialize nahi ho saka.');
      }

      // 2. Stripe Card Payment Confirm karein
      const result = await stripe.confirmCardPayment(intentData.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: customerDetails.fullName,
            email: customerDetails.email,
            phone: customerDetails.phone,
          },
        },
      });

      if (result.error) {
        setErrorMessage(result.error.message);
      } else if (result.paymentIntent.status === 'succeeded') {
        // 3. Payment Success callback call karein jo parent Checkout.jsx handle karega
        const recovered = await recoverPayment(reference, token);
        if (!recovered.success) throw new Error(recovered.message);
        await onSuccess(recovered);
        reference = null;
      }
    } catch (err) {
      setErrorMessage(err.message || 'Payment processing failed');
    } finally {
      setLoading(false); onBusy(false);
      if (reference) onPending(reference);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#1e293b',
                '::placeholder': { color: '#94a3b8' },
              },
            },
          }}
        />
      </div>

      {errorMessage && <p className="text-red-500 text-xs font-medium">{errorMessage}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || loading || disabled}
        className="w-full bg-black hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <FiLoader className="w-5 h-5 animate-spin" /> Processing Card...
          </>
        ) : (
          `Pay Rs. ${totalAmount.toFixed(2)}`
        )}
      </button>
    </div>
  );
};

export default StripeCheckoutForm;
