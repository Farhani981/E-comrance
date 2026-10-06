import React from 'react';
import { FiTrash2, FiAlertTriangle, FiX } from 'react-icons/fi';

export default function DeleteConfirmModal({
  isOpen,
  title = 'Delete Confirmation',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = true,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-center transform transition-all animate-scaleUp overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          aria-label="Close"
        >
          <FiX size={18} />
        </button>

        {/* Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <FiTrash2 className="w-7 h-7" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          {title}
        </h3>

        {/* Description / Message */}
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          {message}
          {itemName && (
            <span className="block font-semibold text-slate-900 mt-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg max-w-xs mx-auto truncate">
              "{itemName}"
            </span>
          )}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-sm shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <FiTrash2 size={16} />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
