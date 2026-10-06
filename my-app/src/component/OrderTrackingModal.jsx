import React, { useState } from 'react';
import { 
  FiX, 
  FiPackage, 
  FiCalendar, 
  FiClock, 
  FiCheck, 
  FiTruck, 
  FiPhone, 
  FiMail, 
  FiAlertCircle 
} from 'react-icons/fi';

export default function OrderTrackingModal({ order, isOpen, onClose }) {
  const [showContactModal, setShowContactModal] = useState(false);

  if (!isOpen || !order) return null;

  const status = order.order_status || 'Pending';
  const isCancelled = status === 'Cancelled';
  const orderId = order.id || 'N/A';
  const carrier = order.carrier || 'FedEx';
  const trackingNumber = order.tracking_number || (order.transaction_id ? String(order.transaction_id).slice(-10) : `4221${String(orderId).replace(/\D/g, '').slice(-6).padStart(6, '7362')}`);

  // Base timestamps calculations from order date
  const orderDate = order.created_at ? new Date(order.created_at) : new Date();
  
  const formatDate = (d) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const addDays = (date, days) => {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res;
  };

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

  // Status mapping to 4 tracking stages
  // Stages: 0 = Packaging, 1 = Shipped, 2 = Left Shipping Facility (In transit), 3 = Delivered
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
  const destinationLocation = order.city ? `${order.city}, PK` : 'Customer Address';

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
      description: `Package enroute ${order.city || 'destination'}`,
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

  // Route percentage
  const routePercent = isCancelled ? 0 : activeStageIndex === 3 ? 100 : activeStageIndex === 2 ? 65 : activeStageIndex === 1 ? 35 : 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn">
      <div 
        className="bg-white w-full max-w-md sm:max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Track order #{orderId}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Tracking number <span className="font-semibold text-slate-700">#{trackingNumber}</span> ({carrier})
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition shrink-0 ml-3"
            aria-label="Close track order modal"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-slate-800 text-sm">
          
          {/* Top 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Status Card */}
            <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                  isCancelled ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  <FiPackage />
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">Status</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-800 capitalize truncate">
                {displayStatus}
              </p>
            </div>

            {/* Estimated Delivery Card */}
            <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-xs shrink-0">
                  <FiCalendar />
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">Estimated delivery</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                {isCancelled ? 'Cancelled' : estDeliveryDate}
              </p>
            </div>

            {/* Last Updated Card */}
            <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-xs shrink-0">
                  <FiClock />
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">Last updated</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                {lastUpdatedDate}
              </p>
            </div>
          </div>

          {/* Shipping Route Card */}
          <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-4 sm:p-5">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-4">
              Shipping route ({carrier})
            </h3>
            
            <div className="flex items-center justify-between text-xs gap-3">
              {/* Origin */}
              <div className="w-28 shrink-0">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">From</p>
                <p className="font-bold text-slate-800 truncate mt-0.5">{originLocation}</p>
              </div>

              {/* Visual Progress Bar & Vehicle Icon */}
              <div className="flex-1 relative flex items-center justify-center px-1">
                {/* Track Line */}
                <div className="w-full h-1 bg-slate-200 rounded-full relative">
                  <div 
                    className="h-full bg-sky-400 rounded-full transition-all duration-700" 
                    style={{ width: `${routePercent}%` }}
                  />
                </div>
                {/* Moving Carrier Vehicle Icon */}
                <div 
                  className="absolute -top-3.5 transition-all duration-700"
                  style={{ left: `calc(${routePercent}% - 14px)` }}
                >
                  <div className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
                    <FiTruck size={13} />
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div className="w-28 shrink-0 text-right">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">To</p>
                <p className="font-bold text-slate-800 truncate mt-0.5">{destinationLocation}</p>
              </div>
            </div>
          </div>

          {/* Tracking History */}
          <div className="pt-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-4">
              Tracking history
            </h3>

            {isCancelled ? (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 flex items-center gap-2">
                <FiAlertCircle size={16} className="shrink-0" />
                <span>This order was cancelled. Shipping and fulfillment have stopped.</span>
              </div>
            ) : (
              <div className="relative pl-1">
                {historySteps.map((step, idx) => {
                  const isCompleted = step.stageIndex <= activeStageIndex;
                  const isCurrent = step.stageIndex === activeStageIndex;
                  const isLast = idx === historySteps.length - 1;

                  return (
                    <div key={step.title} className="relative flex items-start gap-4 pb-6 last:pb-0">
                      {/* Vertical line connecting icons */}
                      {!isLast && (
                        <div 
                          className={`absolute left-3 top-6 bottom-0 w-0.5 ${
                            step.stageIndex < activeStageIndex ? 'bg-emerald-500' : 'bg-slate-200'
                          }`} 
                        />
                      )}

                      {/* Step Circle Indicator */}
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

                      {/* Step Details */}
                      <div className="flex-1 -mt-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-xs sm:text-sm font-bold ${
                            isCompleted ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {step.title}
                          </h4>
                          <span className={`text-[11px] font-medium shrink-0 ${
                            isCompleted ? 'text-slate-500' : 'text-slate-300'
                          }`}>
                            {step.date}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${
                          isCompleted ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {step.description}
                        </p>
                        <p className={`text-[11px] font-medium mt-0.5 ${
                          isCompleted ? 'text-slate-500' : 'text-slate-300'
                        }`}>
                          {step.location}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition active:scale-95"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="px-6 py-2.5 rounded-full bg-black hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition shadow-xs active:scale-95 flex items-center gap-1.5"
          >
            Contact carrier
          </button>
        </div>
      </div>

      {/* Quick Contact Carrier Sub-dialog */}
      {showContactModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Contact {carrier}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Quote tracking number <strong className="text-slate-800">#{trackingNumber}</strong> when connecting with logistics support.
            </p>
            
            <div className="space-y-2.5 mb-5 text-xs">
              <a 
                href="tel:+923001234567" 
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200/80 transition"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <FiPhone size={14} />
                </div>
                <span>Call Helpline (+92 300 1234567)</span>
              </a>
              <a 
                href={`mailto:support@${carrier.toLowerCase()}.com?subject=Tracking Inquiry ${trackingNumber}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200/80 transition"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                  <FiMail size={14} />
                </div>
                <span>Email Carrier Support</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowContactModal(false)}
              className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
