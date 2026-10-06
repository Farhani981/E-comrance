import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import {
  FiHeart,
  FiShoppingCart,
  FiStar,
  FiCheckCircle,
  FiTruck,
  FiShield,
  FiRefreshCw,
  FiArrowLeft,
  FiMinus,
  FiPlus
} from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { operationsRequest } from './admin/operationsShared';

export default function ProductDetail() {
  // 1. URL me se product ID nikalne ke liye useParams hook
  const { id } = useParams();
  const { user } = useAuth();

  const { products } = useProducts();

  // 2. Cart aur Wishlist Context hooks se functions lena
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  // 3. ID match karke products list me se exact product dhoondna
  const baseProduct = products.find((p) => p.id === Number(id));

  // 4. Local States for Interactive Features
  const [selectedImage, setSelectedImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('features'); // 'features' ya 'reviews'
  const [addedNotice, setAddedNotice] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const selectedVariant = baseProduct?.variants?.find(variant => variant.isActive && variant.options.every(option => selectedOptions[option.attributeId] === option.label));
  const product = baseProduct?.hasVariants ? {
    ...baseProduct,
    price: selectedVariant ? Number(selectedVariant.salePrice ?? selectedVariant.price) : baseProduct.price,
    originalPrice: selectedVariant?.salePrice != null ? Number(selectedVariant.price) : 0,
    image: selectedVariant?.imageUrl || baseProduct.image,
    stock: selectedVariant?.stockQuantity || 0, inStock: baseProduct.status !== 'Out of Stock' && (selectedVariant?.stockQuantity || 0) > 0,
    sku: selectedVariant?.sku || '', productVariantId: selectedVariant?.id,
    variantOptions: selectedVariant?.options || []
  } : baseProduct;

  // Build unique variant image list for thumbnail gallery (for hasVariants products)
  const variantImages = baseProduct?.hasVariants
    ? [...new Map(
        (baseProduct.variants || [])
          .filter(v => v.isActive && v.imageUrl)
          .map(v => [v.imageUrl, v])
      ).values()].map(v => v.imageUrl)
    : [];

  // Review Modal States
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [reviewsList, setReviewsList] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setReviewsList([]); setReviewNotice('');
    operationsRequest(`/operations/reviews/product/${id}`).then(data => {
      if (!cancelled) setReviewsList(data.reviews);
    }).catch(error => { if (!cancelled) setReviewNotice(error.message); });
    return () => { cancelled = true; };
  }, [id]);
  const averageRating = reviewsList.length ? (reviewsList.reduce((sum, review) => sum + Number(review.rating), 0) / reviewsList.length).toFixed(1) : '0.0';

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!newReviewComment.trim()) return;

    if (reviewSaving) return;
    setReviewSaving(true); setReviewNotice('');
    try {
      const data = await operationsRequest(`/operations/reviews/product/${id}`, { method: 'POST', body: JSON.stringify({ rating: Number(newRating), comment: newReviewComment }) });
      setReviewNotice(data.message); setIsReviewModalOpen(false); setNewReviewComment('');
    } catch (error) { setReviewNotice(error.message); }
    finally { setReviewSaving(false); }
  };


  // 5. Jab bhi product ID change ho, states reset karein
  useEffect(() => {
    const product = baseProduct;
    if (product) {
      const first = product.variants?.find(variant => variant.isActive && variant.stockQuantity > 0) || product.variants?.find(variant => variant.isActive);
      setSelectedOptions(Object.fromEntries((first?.options || []).map(option => [option.attributeId, option.label])));
      // Initialize selectedImage to first variant's image (or product image)
      setSelectedImage(first?.imageUrl || product.image);
      setQuantity(1);
      setAddedNotice(false);

      // Dynamic Size Fallback Logic
      if (product.sizes && product.sizes.length > 0) {
        setSelectedSize(product.sizes[0]);
      } else {
        setSelectedSize('');
      }

      if (product.colors && product.colors.length > 0) {
        setSelectedColor(product.colors[0].name);
      } else {
        setSelectedColor('');
      }
    }
  }, [id, baseProduct]);

  // Sync selectedImage whenever the active variant changes (color click)
  useEffect(() => {
    if (selectedVariant?.imageUrl) {
      setSelectedImage(selectedVariant.imageUrl);
    }
  }, [selectedVariant]);

  // Agar product exist nahi karta (Wrong ID)
  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Product Not Found</h2>
        <p className="text-slate-500 mb-6">Aap jis product ko dhoond rahe hain wo exist nahi karta ya remove ho chuka hai.</p>
        <Link
          to="/"
          className="bg-black hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition inline-flex items-center gap-2"
        >
          <FiArrowLeft /> Back to Shopping
        </Link>
      </div>
    );
  }

  // Discount percentage calculation
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  // Check if item is already in Wishlist
  const isWishlisted = isInWishlist(product.id);

  // Cart Add Handler with feedback animation
  const handleAddToCart = async () => {
    if (!product.inStock || (product.hasVariants && !selectedVariant)) return;
    const added = await addToCart(product, quantity, selectedSize, selectedColor);
    if (added === false) return;
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  // Same category ke Related Products (Current product ko nikaal kar)
  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">

      {/* Breadcrumb Navigation (Ghar -> Category -> Product Title) */}
      <nav className="flex text-sm text-slate-500 mb-6 items-center gap-2 flex-wrap">
        <Link to="/" className="hover:text-amber-500 transition">Home</Link>
        <span>/</span>
        <span className="hover:text-amber-500 cursor-pointer">{product.category}</span>
        <span>/</span>
          <span className="text-slate-800 font-semibold truncate">{product.title}</span>
      </nav>

      {/* Product Main Detail Grid (Left: Images, Right: Info) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-8 lg:gap-12 xl:gap-14">

        {/* LEFT COLUMN: Image Gallery */}
        <div className="flex flex-col gap-4">

          {/* Determine which image list to show as thumbnails */}
          {/* For variant products: use each variant's unique imageUrl */}
          {/* For regular products: use product.images array */}
          {(() => {
            const thumbList = product.hasVariants
              ? variantImages
              : (product.images && product.images.length > 0 ? product.images : []);
            const currentImg = selectedImage || product.image;
            const showThumbs = thumbList.length > 1;

            return (
              <div className="flex gap-3">

                {/* Vertical Thumbnails Strip (left side) */}
                {showThumbs && (
                  <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '500px', minWidth: '72px', width: '72px' }}>
                    {thumbList.map((img, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedImage(img)}
                        className={`w-[68px] h-[68px] rounded-xl overflow-hidden border-2 transition-all duration-150 shrink-0 ${
                          currentImg === img
                            ? 'border-amber-500 shadow-md ring-1 ring-amber-300'
                            : 'border-slate-200 hover:border-amber-300 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`View ${index + 1}`}
                          className="w-full h-full object-cover bg-slate-50"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Large Main Display Image — fills container fully, no padding */}
                <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#f5f4f2]" style={{ height: '500px' }}>
                  <img
                    key={currentImg}
                    src={currentImg}
                    alt={product.title}
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />
                  {discountPercent > 0 && (
                    <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      -{discountPercent}% OFF
                    </span>
                  )}

                  {/* Quick Wishlist Icon Badge */}
                  <button
                    onClick={() => toggleWishlist(product)}
                    className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-md hover:scale-110 transition active:scale-95 text-slate-700"
                    title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    {isWishlisted ? (
                      <FaHeart className="w-5 h-5 text-red-500 animate-pulse" />
                    ) : (
                      <FiHeart className="w-5 h-5 hover:text-red-500 transition" />
                    )}
                  </button>
                </div>

              </div>
            );
          })()}
        </div>

        {/* RIGHT COLUMN: Product Details & Buying Actions */}
        <div className="flex min-w-0 flex-col lg:sticky lg:top-6 lg:self-start">

          {/* Category Badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500">
              {product.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 leading-tight mb-4">
            {product.title}
          </h1>

          {/* Ratings & Reviews Count */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center text-slate-500 gap-1.5">
              <FiStar className="fill-amber-400 text-amber-400 w-4 h-4" />
              <span className="text-xs font-bold text-slate-800">{product.rating}</span>
            </div>
            <span className="text-sm text-slate-500">
              ({reviewsList.length} Customer Reviews)
            </span>
          </div>

          {/* Price & Stock Display */}
          <div className="flex flex-wrap items-baseline gap-3 mb-7 pt-2 pb-6 border-b border-slate-100">
            <span className="text-3xl font-bold tracking-tight text-slate-950">
              Rs. {Number(product.price).toLocaleString('en-PK', { maximumFractionDigits: 2 })}
            </span>
            {product.originalPrice > product.price && (
              <span className="text-lg text-slate-400 line-through font-medium">
                Rs.{product.originalPrice}
              </span>
            )}
            {discountPercent > 0 && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                Save Rs.{(product.originalPrice - product.price)}
              </span>
            )}
            {product.inStock ? (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                <FiCheckCircle /> In Stock
              </span>
            ) : (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                Out of Stock
              </span>
            )}
          </div>

          {/* SIZE & COLOR SELECTION SECTION */}
          <div className="space-y-4 mb-6">

            {/* Color Selector */}
            {product.hasVariants && <div className="space-y-5">{product.attributes.map(attribute => (
              <fieldset key={attribute.id} className="border-0 p-0">
                <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{attribute.name}</legend>
                <div className="flex flex-wrap gap-3">{attribute.values.map(value => {
                  const selected = selectedOptions[attribute.id] === value.label;
                  const isColor = attribute.type === 'color';
                  return <button type="button" key={value.label} aria-label={value.label} title={isColor ? value.label : undefined} aria-pressed={selected}
                    className={isColor
                      ? `h-9 w-9 rounded-full border-0 shadow-sm transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900 ${selected ? 'ring-1 ring-slate-400 ring-offset-4' : ''}`
                      : `min-h-11 min-w-12 rounded-md border-0 px-4 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? 'bg-slate-900 font-semibold text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    style={isColor ? { backgroundColor: value.color || value.label } : undefined}
                    onClick={() => { setSelectedOptions(previous => ({ ...previous, [attribute.id]: value.label })); setQuantity(1); setAddedNotice(false); }}>
                    {!isColor && value.label}
                  </button>;
                })}</div>
              </fieldset>
            ))}<p className="text-sm text-slate-500">{selectedVariant ? `SKU: ${selectedVariant.sku} / ${product.inStock ? selectedVariant.stockQuantity : 0} available` : 'This combination is unavailable.'}</p></div>}
            {!product.hasVariants && product.attributes?.filter(attribute => attribute.type !== 'color' && !['size', 'sizes'].includes(attribute.name.toLowerCase())).map(attribute => (
              <div key={attribute.id} className="mb-4"><h3 className="mb-2 text-sm font-semibold">{attribute.name}</h3><div className="flex flex-wrap gap-2">{attribute.values.map(value => <span key={value.label} className="rounded-lg bg-slate-100 px-3 py-1 text-sm">{value.label}</span>)}</div></div>
            ))}
            {!product.hasVariants && Array.isArray(product.colors) && product.colors.length > 0 && (
              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  {product.colors.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColor(color.name)}
                      style={{ backgroundColor: color.hex }}
                      className={`w-8 h-8 rounded-full border-0 transition-transform ${selectedColor === color.name
                        ? 'scale-110 shadow-md ring-2 ring-slate-400 ring-offset-2'
                        : 'shadow-sm hover:scale-105'
                        }`}
                      title={color.name}
                      aria-label={color.name}
                      aria-pressed={selectedColor === color.name}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* SIZE SELECTOR SECTION */}
            {!product.hasVariants && Array.isArray(product.sizes) && product.sizes.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Select Size: <span className="text-amber-600 font-bold ml-1">{selectedSize}</span>
                  </label>

                  {/* Category based Size Guide Link (Optional) */}
                  <button
                    type="button"
                    onClick={() => alert("Sizing Guide: Shoe numbers are EU standard. Clothing sizes are Regular Fit.")}
                    className="text-sm font-medium text-amber-600 hover:underline"
                  >
                    Size Chart?
                  </button>
                </div>

                {/* Dynamic Grid / Flex Buttons */}
                <div className="flex flex-wrap gap-2.5">
                  {product.sizes.map((size) => {
                    const isSelected = selectedSize === size;

                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`min-w-[48px] h-11 px-3.5 rounded-xl text-sm font-bold transition-all duration-200 border-0 flex items-center justify-center ${isSelected
                          ? 'bg-black text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Description */}
          <p className="text-slate-600 leading-relaxed mb-6">
            {product.description}
          </p>

          {/* Quantity Counter & Add To Cart Button */}
          <div className="space-y-4 mb-8">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Select Quantity:
            </label>

            <div className="flex flex-nowrap items-stretch gap-4">

              {/* Quantity Counter Controls */}
              <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 p-1">
                <button
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-black hover:text-white transition active:scale-95"
                >
                  <FiMinus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-bold text-slate-800 text-lg">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((prev) => Math.min(product.stock, prev + 1))}
                  disabled={!product.inStock || quantity >= product.stock}
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-black hover:text-white transition active:scale-95"
                >
                  <FiPlus className="w-4 h-4" />
                </button>
              </div>

              {/* Add to Cart Primary Button */}
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className={`flex-1 min-w-[200px] h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${product.inStock
                  ? 'bg-black hover:bg-slate-800 text-white'
                  : 'bg-slate-300 cursor-not-allowed'
                  }`}
              >
                <FiShoppingCart className="w-5 h-5" />
                {addedNotice ? '✓ Added to Cart!' : `Add ${quantity} to Cart`}
              </button>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(product)}
                className={`h-12 px-4 rounded-xl border flex items-center justify-center gap-2 font-medium transition ${isWishlisted
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-300 hover:border-red-300 text-slate-700 hover:text-red-500'
                  }`}
              >
                {isWishlisted ? <FaHeart className="w-5 h-5 text-red-500" /> : <FiHeart className="w-5 h-5" />}
                <span className="hidden sm:inline">{isWishlisted ? 'Saved' : 'Wishlist'}</span>
              </button>

            </div>

            {/* Notification alert banner */}
            {addedNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-xl flex items-center gap-2 animate-bounce">
                <FiCheckCircle className="w-5 h-5 text-emerald-600" />
                Product successfully cart me add ho gaya hai! <Link to="/cart" className="underline font-bold ml-auto">View Cart</Link>
              </div>
            )}
          </div>

          {/* Extra E-Commerce Trust Badges */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-slate-600 text-xs">
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50">
              <FiTruck className="w-5 h-5 text-amber-500 mb-1" />
              <span className="font-semibold text-slate-800">Fast Delivery</span>
              <span className="text-[10px] text-slate-400">2-4 Business Days</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50">
              <FiShield className="w-5 h-5 text-amber-500 mb-1" />
              <span className="font-semibold text-slate-800">100% Original</span>
              <span className="text-[10px] text-slate-400">Guaranteed Quality</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50">
              <FiRefreshCw className="w-5 h-5 text-amber-500 mb-1" />
              <span className="font-semibold text-slate-800">Easy Returns</span>
              <span className="text-[10px] text-slate-400">7 Days Return Policy</span>
            </div>
          </div>

        </div>

      </div>

      {/* Tabs Section: Product Features & Specifications / Reviews */}
      <div className="mt-12 bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 gap-8 mb-6">
          <button
            onClick={() => setActiveTab('features')}
            className={`pb-3 font-semibold text-base transition border-b-2 ${activeTab === 'features'
              ? 'border-slate-800 text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            Features & Highlights
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 font-semibold text-base transition border-b-2 ${activeTab === 'reviews'
              ? 'border-slate-800 text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            Customer Reviews ({reviewsList.length})
          </button>
        </div>

        {/* Tab Content 1: Features List */}
        {activeTab === 'features' && (
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Key Specifications & Highlights</h3>
            {Array.isArray(product.features) && product.features.length > 0 ? (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {product.features.map((feat, index) => (
                  <li key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 text-slate-700 text-sm border border-slate-100">
                    <FiCheckCircle className="text-amber-500 w-5 h-5 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            ) : typeof product.features === 'string' && product.features.length > 0 ? (
              <p className="text-slate-600">{product.features}</p>
            ) : (
              <p className="text-slate-500 text-sm">Is product ki extra specifications available hain.</p>
            )}
          </div>
        )}

        {/* Tab Content 2: Customer Reviews Dynamic */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6">
              <div>
                <span className="text-3xl font-extrabold text-slate-900">{averageRating}</span>
                <span className="text-slate-500 text-sm"> out of 5.0</span>
                <p className="text-xs text-slate-500 mt-0.5">Based on {reviewsList.length} approved customer reviews</p>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="bg-black hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm active:scale-95"
              >
                Write a Review
              </button>
            </div>

            {/* Dynamic Review Comments List */}
            {reviewNotice && <p role="status" className="text-sm text-slate-600">{reviewNotice}</p>}
            <div className="space-y-3">
              {reviewsList.map((rev, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">{rev.name}</span>
                    <span className="text-xs text-slate-400">{new Date(rev.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex text-black gap-0.5">
                    {[...Array(rev.rating)].map((_, i) => (
                      <FiStar key={i} className="fill-amber-400 text-amber-400 w-3.5 h-3.5" />
                    ))}
                  </div>
                  <p className="text-slate-600 text-sm">{rev.comment}</p>
                </div>
              ))}
            </div>

            {/* Review Submission Modal */}
            {isReviewModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                    <h3 className="font-bold text-slate-900 text-lg">Write a Review</h3>
                    <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
                  </div>

                  <form onSubmit={handleAddReview} className="space-y-4">
                    <p className="text-sm text-slate-600">{user ? `Posting as ${user.name}. Reviews appear after approval.` : <Link to="/login" className="underline">Sign in to submit a review.</Link>}</p>
                    {reviewNotice && <p role="status" className="text-sm text-slate-600">{reviewNotice}</p>}

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Rating</label>
                      <select
                        value={newRating}
                        onChange={(e) => setNewRating(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-amber-500 font-bold text-slate-800"
                      >
                        <option value="5">5 Stars ⭐⭐⭐⭐⭐</option>
                        <option value="4">4 Stars ⭐⭐⭐⭐</option>
                        <option value="3">3 Stars ⭐⭐⭐</option>
                        <option value="2">2 Stars ⭐⭐</option>
                        <option value="1">1 Star ⭐</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Your Review *</label>
                      <textarea
                        required
                        maxLength={3000}
                        rows="3"
                        placeholder="Share your thoughts on size, fabric, and quality..."
                        value={newReviewComment}
                        onChange={(e) => setNewReviewComment(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-amber-500 resize-none"
                      ></textarea>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={!user || reviewSaving}
                        className="flex-1 bg-black hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition"
                      >
                        Submit Review
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsReviewModalOpen(false)}
                        className="bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}


      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((relProduct) => (
              <div
                key={relProduct.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between"
              >
                <div>
                  <Link to={`/product/${relProduct.id}`}>
                    <img
                      src={relProduct.image}
                      alt={relProduct.title}
                      className="w-full h-44 object-cover rounded-xl mb-3 hover:opacity-90 transition"
                    />
                  </Link>
                  <Link
                    to={`/product/${relProduct.id}`}
                    className="font-semibold text-slate-800 text-sm hover:text-amber-500 block truncate"
                  >
                    {relProduct.title}
                  </Link>
                  <p className="text-slate-400 text-xs mt-1">{relProduct.category}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <span className="font-bold text-amber-600">${relProduct.price.toFixed(2)}</span>
                  <Link
                    to={`/product/${relProduct.id}`}
                    className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-black hover:text-white px-3 py-1.5 rounded-lg transition"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
