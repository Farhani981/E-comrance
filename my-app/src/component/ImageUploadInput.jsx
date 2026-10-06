import React, { useState, useRef } from 'react';
import { FiUploadCloud, FiLink, FiX, FiCheck } from 'react-icons/fi';
import { MAX_IMAGE_BYTES, IMAGE_TYPES, validateImageFile, validateImageReference } from '../../../shared/images.js';

const getDataUrlBytes = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
};

export default function ImageUploadInput({
  maxDimension = 1600,
  quality = 0.88,
  maxOutputBytes = MAX_IMAGE_BYTES,
  label = 'Product Image',
  value = '',
  onChange,
  required = false,
  helperText = 'Recommended size: 800x800px. Images are resized and compressed automatically.'
}) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url'
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Handle file conversion to Base64
  const processFile = (file) => {
    setError('');
    if (!file) return;

    try { validateImageFile(file); }
    catch (err) { setError(err.message); return; }

    // Decode directly from the file without a full-size base64 copy.
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const outputLimit = Math.min(maxOutputBytes, MAX_IMAGE_BYTES);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image processing is unavailable. Please try another browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let outputQuality = quality;
        let compressedImage = canvas.toDataURL('image/jpeg', outputQuality);
        while (getDataUrlBytes(compressedImage) > outputLimit && outputQuality > 0.25) {
          outputQuality = Math.max(0.25, outputQuality - 0.1);
          compressedImage = canvas.toDataURL('image/jpeg', outputQuality);
        }
        while (getDataUrlBytes(compressedImage) > outputLimit && Math.max(canvas.width, canvas.height) > 1) {
          canvas.width = Math.max(1, Math.floor(canvas.width * 0.8));
          canvas.height = Math.max(1, Math.floor(canvas.height * 0.8));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          compressedImage = canvas.toDataURL('image/jpeg', outputQuality);
        }
        if (getDataUrlBytes(compressedImage) > outputLimit) {
          throw new Error('Unable to compress this image enough. Please use a smaller image.');
        }
        validateImageReference(compressedImage, { maxBytes: Math.min(maxOutputBytes, MAX_IMAGE_BYTES) });
        if (onChange) onChange(compressedImage);
      } catch (err) {
        setError(err.message || 'Could not process this image. Please try another photo.');
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('This image could not be decoded. Use a JPG, PNG or WebP image.');
    };
    image.src = objectUrl;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleRemove = () => {
    if (onChange) onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError('');
  };

  return (
    <div className="space-y-2">
      {/* Label and Tab Switcher */}
      <div className="flex items-center justify-between">
        <label className="block font-semibold text-slate-700 text-xs">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiUploadCloud size={12} /> Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
              activeTab === 'url'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiLink size={12} /> Image URL
          </button>
        </div>
      </div>

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Mode 1: Direct File Upload & Drag-and-Drop */}
      {activeTab === 'upload' && (
        <div>
          {!value ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-black bg-slate-100 scale-[1.01]'
                  : 'border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <FiUploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Click to browse or drag & drop image
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PNG, JPG, WebP, GIF · Maximum 5 MiB · Automatically compressed
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-4">
              <img
                src={value}
                alt="Uploaded preview"
                className="w-20 h-20 object-cover rounded-xl border border-slate-200 bg-white shrink-0 shadow-xs"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mb-1">
                  <FiCheck size={11} /> Image Ready
                </span>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {value.startsWith('data:image') ? 'Uploaded from device' : value}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-slate-800 hover:text-black bg-slate-200 hover:bg-slate-300 px-2.5 py-1 rounded-lg transition"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <FiX size={12} /> Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Web Image URL Input */}
      {activeTab === 'url' && (
        <div className="space-y-3">
          <div className="relative">
            <FiLink className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={value}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (nextValue.startsWith('data:')) {
                  try { validateImageReference(nextValue, { maxBytes: Math.min(maxOutputBytes, MAX_IMAGE_BYTES) }); }
                  catch (err) { setError(err.message); return; }
                }
                if (nextValue.startsWith('data:') && getDataUrlBytes(nextValue) > maxOutputBytes) {
                  setError('This embedded image is too large. Use Upload File to compress it automatically.');
                  return;
                }
                setError('');
                if (onChange) onChange(nextValue);
              }}
              className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm text-slate-900"
            />
            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          {value && (
            <div className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-xl bg-slate-50">
              <img
                src={value}
                alt="URL Preview"
                className="w-14 h-14 object-cover rounded-lg border border-slate-200 bg-white shrink-0 shadow-xs"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-600 block">URL Image Preview</span>
                <span className="text-[11px] text-slate-400 truncate block">{value}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      )}

      {/* Helper text */}
      {helperText && !error && (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      )}
    </div>
  );
}
