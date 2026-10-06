import { matchesCategory, catalogKey } from '../utils/catalog';
import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import {
  FiHeart,
  FiShoppingBag,
  FiX,
  FiPlus,
  FiMinus,
  FiCheck
} from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';

export default function Shop() {
  const { products, loading, catalogTree, fits, occasions } = useProducts();

  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const subParam = searchParams.get('subcategory') || searchParams.get('sub') || '';
  const typeParam = searchParams.get('type') || '';
  const fitParam = searchParams.get('fit') || '';
  const occasionParam = searchParams.get('occasion') || '';
  const searchParam = searchParams.get('search') || '';

  // Filter & Display States
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [selectedColorFilter, setSelectedColorFilter] = useState('');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState('');
  const [selectedSeason, setSelectedSeason] = useState(occasionParam);
  const [selectedFitType, setSelectedFitType] = useState(fitParam);
  const [maxPrice, setMaxPrice] = useState(null);
  const [sortBy, setSortBy] = useState('');
  const [gridCols, setGridCols] = useState(4); // 1, 2, or 4 columns
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Accordion open states
  const [openAccordions, setOpenAccordions] = useState({
    productType: true,
    color: false,
    size: false,
    season: false,
    price: false,
    gender: false,
    fitType: false,
    sort: false,
  });

  const toggleAccordion = (section) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Card color state per product ID
  const [productColorSelections, setProductColorSelections] = useState({});

  // Context Hooks
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  // URL Query Parameter sync
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSearchQuery(searchParam);
    setSelectedColorFilter('');
    setSelectedSizeFilter('');
    setMaxPrice(null);
    setSelectedFitType(fitParam);
    setSelectedSeason(occasionParam);
  }, [categoryParam, subParam, typeParam, searchParam, fitParam, occasionParam]);

  // Handle color swatch click per card
  const handleSelectColor = (productId, colorName) => {
    setProductColorSelections((prev) => ({
      ...prev,
      [productId]: colorName,
    }));
  };

  // Filtering & Sorting Logic
  // ─── Filtering & Sorting Logic ───────────────────────────────────
  // Supports ?category=Topwear  → filters by category OR subCategory
  // Supports ?sub=Shirts        → drill-down filter by exact subCategory
  // Supports ?search=keyword    → full text search
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const pCat = (p.category || '').toLowerCase().trim();
        const pSub = (p.subCategory || '').toLowerCase().trim();
        if (!matchesCategory(p, selectedCategory, subParam, typeParam)) return false;

        if (selectedFitType && p.fit !== selectedFitType) return false;
        if (selectedSeason && p.occasion !== selectedSeason) return false;
        // Color filter
        if (selectedColorFilter) {
          const hasColor = p.colors?.some(
            (c) => c.name.toLowerCase() === selectedColorFilter.toLowerCase()
          );
          if (!hasColor) return false;
        }

        // Size filter
        if (selectedSizeFilter) {
          const hasSize = p.sizes?.includes(selectedSizeFilter);
          if (!hasSize) return false;
        }

        // Price filter
        if (maxPrice !== null && p.price > maxPrice) return false;

        // Search query filter
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase();
          const matchTitle = (p.title || '').toLowerCase().includes(query);
          const matchDesc = (p.description || '').toLowerCase().includes(query);
          const matchCategory = pCat.includes(query);
          const matchSubCat = pSub.includes(query);
          if (!matchTitle && !matchDesc && !matchCategory && !matchSubCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'lowToHigh') return a.price - b.price;
        if (sortBy === 'highToLow') return b.price - a.price;
        if (sortBy === 'rating') return b.rating - a.rating;
        return 0;
      });
  }, [selectedCategory, subParam, typeParam, selectedFitType, selectedSeason, selectedColorFilter, selectedSizeFilter, maxPrice, searchQuery, sortBy, products]);

  // Reset All Filters
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setSelectedColorFilter('');
    setSelectedSizeFilter('');
    setSelectedSeason('');
    setSelectedFitType('');
    setMaxPrice(null);
    setSortBy('');
    setSearchParams({});
  };

  const categoryFilters = [{ id: 'all', name: 'All Products' }, ...catalogTree.map(p => ({ id: p.slug, name: p.name }))];
  const parentNode = catalogTree.find(p=>p.slug===catalogKey(categoryParam));
  const subNode = parentNode?.children.find(s=>s.slug===catalogKey(subParam));
  const typeNode = subNode?.children.find(t=>t.slug===typeParam);
  const pageTitle = typeNode?.name || subNode?.name || parentNode?.name || (selectedCategory === 'all' ? 'All Collection' : selectedCategory);
  const priceCeiling = Math.max(15000, ...products.map(p => Number(p.price) || 0));
  const allColors = ['Navy Blue', 'Off White', 'Charcoal', 'Olive Green', 'Jet Black', 'Cream White', 'Tan Brown'];
  const allSizes = ['S', 'M', 'L', 'XL', '40', '41', '42', '43'];
  const seasons = occasions;
  const fitTypes = fits;
  const sortOptions = [
    { label: 'Price: Low to High', value: 'lowToHigh' },
    { label: 'Price: High to Low', value: 'highToLow' },
    { label: 'Highest Rated', value: 'rating' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen pb-16">

      {/* 1. ELEGANT BREADCRUMB HEADER */}
      <div className="bg-white border-b border-slate-200 py-8 px-4 sm:px-6 lg:px-8 text-start shadow-xs">
        <nav className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2">
          <Link to="/" className="hover:text-slate-900 transition">Home</Link>
          {' / '}
          <Link to="/shop" className="hover:text-slate-900 transition">Shop</Link>
          {selectedCategory !== 'all' && (
            <>
              {' / '}
              <Link to={`/shop?category=${encodeURIComponent(selectedCategory)}`} className="hover:text-slate-900 transition">
                {parentNode?.name || selectedCategory}
              </Link>
            </>
          )}
          {subParam && (
            <>
              {' / '}
              <span className="text-slate-800">{subNode?.name || subParam}</span>
            </>
          )}
        </nav>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight uppercase">
          {pageTitle}
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl">
          Explore men?s essentials, selected for everyday wear and special occasions.
        </p>
      </div>

      {/* 2. CONTROL BAR (GRID SWITCHERS & FILTER ON THE RIGHT) */}
      <div className="sticky top-16 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">

          {/* Left: Item Count */}
          <div className="text-xs font-medium text-slate-500">
            Showing <strong className="text-slate-900 font-bold">{filteredProducts.length}</strong> Products
          </div>

          {/* Right: Grid Switchers (1, 2, 4 columns) & Filter Icon */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* 1 Column View Icon */}
            <button
              onClick={() => setGridCols(1)}
              className={`p-1.5 transition-colors ${gridCols === 1 ? 'text-black' : 'text-slate-300 hover:text-slate-600'}`}
              title="1 Column View"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={gridCols === 1 ? "2.5" : "1.8"}>
                <rect x="3" y="3" width="18" height="18" rx="1.5" />
              </svg>
            </button>

            {/* 2 Columns View Icon */}
            <button
              onClick={() => setGridCols(2)}
              className={`p-1.5 transition-colors ${gridCols === 2 ? 'text-black' : 'text-slate-300 hover:text-slate-600'}`}
              title="2 Columns View"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={gridCols === 2 ? "2.5" : "1.8"}>
                <rect x="3" y="3" width="18" height="18" rx="1.5" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </button>

            {/* 4 Columns View Icon */}
            <button
              onClick={() => setGridCols(4)}
              className={`p-1.5 transition-colors ${gridCols === 4 ? 'text-black' : 'text-slate-300 hover:text-slate-600'}`}
              title="Grid View"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={gridCols === 4 ? "2.5" : "1.8"}>
                <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
              </svg>
            </button>

            {/* Filter Toggle Button (Sliders Icon) */}
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="p-1.5 text-black hover:text-amber-600 transition-colors ml-1"
              title="Open Filter Drawer"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <circle cx="9" cy="6" r="2.5" fill="currentColor" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <circle cx="15" cy="12" r="2.5" fill="currentColor" />
                <line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="10" cy="18" r="2.5" fill="currentColor" />
              </svg>
            </button>

          </div>

        </div>
      </div>

      {/* 3. RIGHT SIDE SLIDE-OVER FILTER DRAWER */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsFilterDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-sm sm:max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

              {/* Drawer Top Header */}
              <div className="relative px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="w-5" />
                <h2 className="text-center font-bold text-sm text-slate-900 tracking-[0.2em] uppercase">
                  FILTER
                </h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-900 transition"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Drawer Body (Accordions) */}
              <div className="flex-1 overflow-y-auto px-6 divide-y divide-slate-100 font-sans text-xs">

                {/* 1. PRODUCT TYPE */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('productType')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.productType ? '- ' : '+ '} PRODUCT TYPE</span>
                  </button>
                  {openAccordions.productType && (
                    <div className="mt-3 space-y-2 pl-2">
                      {categoryFilters.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            if (cat.id === 'all') setSearchParams({});
                            else setSearchParams({ category: cat.id });
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between font-medium ${selectedCategory.toLowerCase() === cat.id.toLowerCase()
                            ? 'bg-slate-900 text-white font-bold'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span>{cat.name}</span>
                          {selectedCategory.toLowerCase() === cat.id.toLowerCase() && <FiCheck size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. COLOR */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('color')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.color ? '- ' : '+ '} COLOR</span>
                  </button>
                  {openAccordions.color && (
                    <div className="mt-3 flex flex-wrap gap-2 pl-2">
                      {allColors.map((color) => {
                        const isSelected = selectedColorFilter.toLowerCase() === color.toLowerCase();
                        return (
                          <button
                            key={color}
                            onClick={() => setSelectedColorFilter(isSelected ? '' : color)}
                            className={`px-3 py-2 rounded-lg font-medium transition border ${isSelected
                              ? 'bg-black text-white border-black font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                              }`}
                          >
                            {color}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. SIZE */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('size')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.size ? '- ' : '+ '} SIZE</span>
                  </button>
                  {openAccordions.size && (
                    <div className="mt-3 flex flex-wrap gap-2 pl-2">
                      {allSizes.map((sz) => {
                        const isSelected = selectedSizeFilter === sz;
                        return (
                          <button
                            key={sz}
                            onClick={() => setSelectedSizeFilter(isSelected ? '' : sz)}
                            className={`w-10 h-10 rounded-lg font-bold transition border flex items-center justify-center ${isSelected
                              ? 'bg-black text-white border-black'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                              }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. SEASON */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('season')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.season ? '- ' : '+ '} OCCASION</span>
                  </button>
                  {openAccordions.season && (
                    <div className="mt-3 space-y-1.5 pl-2">
                      {seasons.map((season) => (
                        <button
                          key={season}
                          onClick={() => setSelectedSeason(selectedSeason === season ? '' : season)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition font-medium ${selectedSeason === season
                            ? 'bg-slate-900 text-white font-bold'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          {season}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. PRICE */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('price')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.price ? '- ' : '+ '} PRICE</span>
                  </button>
                  {openAccordions.price && (
                    <div className="mt-3 px-2">
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-slate-400 uppercase">Max Price:</span>
                        <span className="text-black font-extrabold">Rs. {(maxPrice ?? priceCeiling).toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={priceCeiling}
                        step="500"
                        value={maxPrice ?? priceCeiling}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                        className="w-full accent-black cursor-pointer"
                      />
                      <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                        <span>Rs. 0</span>
                        <span>Rs. {priceCeiling.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. FIT TYPE */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('fitType')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.fitType ? '- ' : '+ '} FIT TYPE</span>
                  </button>
                  {openAccordions.fitType && (
                    <div className="mt-3 space-y-1.5 pl-2">
                      {fitTypes.map((fit) => (
                        <button
                          key={fit}
                          onClick={() => setSelectedFitType(selectedFitType === fit ? '' : fit)}
                          className={`w-full text-left px-3 py-2 rounded-lg font-medium transition ${selectedFitType === fit
                            ? 'bg-slate-900 text-white font-bold'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          {fit}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 8. SORT */}
                <div className="py-4">
                  <button
                    onClick={() => toggleAccordion('sort')}
                    className="w-full flex items-center justify-between text-left font-bold text-slate-900 tracking-wider uppercase py-1 hover:text-amber-600 transition"
                  >
                    <span>{openAccordions.sort ? '- ' : '+ '} SORT</span>
                  </button>
                  {openAccordions.sort && (
                    <div className="mt-3 space-y-1.5 pl-2">
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSortBy(sortBy === opt.value ? '' : opt.value)}
                          className={`w-full text-left px-3 py-2 rounded-lg font-medium transition flex items-center justify-between ${sortBy === opt.value
                            ? 'bg-slate-900 text-white font-bold'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span>{opt.label}</span>
                          {sortBy === opt.value && <FiCheck size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Bottom Sticky Action Buttons (Apply & Clear All) */}
              <div className="p-5 border-t border-slate-200 bg-white grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="bg-black hover:bg-neutral-800 text-white font-bold text-xs py-3.5 px-4 tracking-wider uppercase transition active:scale-95 text-center shadow-xs"
                >
                  Apply
                </button>
                <button
                  onClick={handleResetFilters}
                  className="bg-white border border-black text-black hover:bg-black hover:text-white font-bold text-xs py-3.5 px-4 tracking-wider uppercase transition active:scale-95 text-center shadow-xs"
                >
                  Clear All
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 4. PRODUCT CATALOG GRID WITH DYNAMIC COLUMNS (1, 2, 4) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {loading ? <p role="status" className="py-16 text-center text-slate-500">Loading products...</p> : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-12">
            <FiShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-1">No Products Found</h3>
            <p className="text-slate-500 text-xs mb-6">There are no items matching your current selected filters.</p>
            <button
              onClick={handleResetFilters}
              className="bg-black text-white font-bold text-xs px-6 py-3 rounded-lg hover:bg-neutral-800 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-1 sm:gap-2 ${gridCols === 1
              ? 'grid-cols-1 max-w-7xl mx-auto'
              : gridCols === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              }`}
          >
            {filteredProducts.map((product) => {
              const isWishlisted = isInWishlist(product.id);
              const discountPercent = product.originalPrice
                ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                : 0;

              const activeColorName = productColorSelections[product.id] || (product.colors ? product.colors[0]?.name : '');

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition duration-300 flex flex-col justify-between group relative max-w-full"
                >

                  {/* Top Wishlist Icon */}
                  <button
                    onClick={() => toggleWishlist(product)}
                    className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-md p-2 rounded-full shadow hover:scale-110 transition active:scale-95 text-slate-700"
                    title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    {isWishlisted ? (
                      <FaHeart className="w-4 h-4 text-red-500" />
                    ) : (
                      <FiHeart className="w-4 h-4 hover:text-red-500 transition" />
                    )}
                  </button>

                  <div>
                    {/* TALL PORTRAIT IMAGE DISPLAY */}
                    <div className="relative aspect-3/4 w-full overflow-hidden bg-slate-100 group">
                      <Link to={`/product/${product.id}`}>
                        <img
                          src={(typeof product.image === 'string' && product.image.trim() !== '') ? product.image : 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800'}
                          alt={product.title || 'Product'}
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition duration-500"
                        />
                      </Link>

                      {/* Discount Tag */}
                      {discountPercent > 0 && (
                        <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-sm uppercase tracking-wider shadow-sm">
                          -{discountPercent}% OFF
                        </span>
                      )}

                      {/* Hover Quick Size Selection Bar */}
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/90 backdrop-blur-md p-2.5 transform translate-y-full group-hover:translate-y-0 transition duration-300 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider hidden sm:inline">Sizes:</span>
                        <div className="flex gap-1.5 mx-auto sm:mx-0">
                          {product.sizes?.slice(0, 4).map((sz) => (
                            <button
                              key={sz}
                              onClick={() => addToCart(product, 1, sz, activeColorName)}
                              className="bg-white/10 hover:bg-black text-white font-bold text-[11px] w-7 h-7 rounded flex items-center justify-center transition"
                              title={`Add Size ${sz} to Bag`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* PRODUCT INFORMATION */}
                    <div className="p-4">

                      {/* Color Swatches Bar */}
                      {product.colors && product.colors.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {product.colors.map((c, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectColor(product.id, c.name)}
                              style={{ backgroundColor: c.hex }}
                              className={`w-3.5 h-3.5 rounded-full border border-slate-300 transition-transform ${activeColorName === c.name ? 'scale-125 ring-1 ring-amber-500 border-white' : 'hover:scale-110 opacity-80'
                                }`}
                              title={c.name}
                            />
                          ))}
                          <span className="text-[10px] text-slate-400 font-semibold ml-1">{activeColorName}</span>
                        </div>
                      )}

                      {/* Title */}
                      <Link
                        to={`/product/${product.id}`}
                        className="font-bold text-slate-800 text-sm hover:text-black block line-clamp-2 leading-snug mb-2 no-underline"
                      >
                        {product.title}
                      </Link>

                      {/* PKR Price */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-extrabold text-slate-900">
                          Rs {product.price.toLocaleString()}
                        </span>
                        {product.originalPrice > product.price && (
                          <span className="text-xs text-slate-400 line-through">
                            Rs {product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* BOTTOM ACTION BUTTON */}
                  <div className="p-4 pt-0">
                    <button
                      onClick={() => addToCart(product, 1, product.sizes?.[0] || 'M', activeColorName)}
                      className="w-full bg-black hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-xs uppercase tracking-wider"
                    >
                      <FiShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}