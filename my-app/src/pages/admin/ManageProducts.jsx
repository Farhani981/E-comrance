import AdminFormPage from '../../component/AdminFormPage';
import ProductCategoryFields from '../../component/ProductCategoryFields';
import ProductAttributeFields from '../../component/ProductAttributeFields';
import VariantMatrix from '../../component/VariantMatrix';
import { validateVariants, variantKey, variantCombinations, retainCompatibleVariants } from '../../../../shared/variants';
import { useState } from 'react';
import { 
  FiPlus, 
  FiTrash2, 
  FiEdit2, 
  FiSearch, 
  FiAlertCircle, 
  FiPackage, 
  FiCheckCircle, 
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import { useProducts } from '../../context/ProductContext';
import { useAdminAlert } from '../../context/AdminAlertContext';
import DeleteConfirmModal from '../../component/DeleteConfirmModal';
import ImageUploadInput from '../../component/ImageUploadInput';

export default function ManageProducts() {
  const { products, addProduct, updateProduct, deleteProduct, catalogTree, catalogError } = useProducts();
  const { showAlert } = useAdminAlert();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [variantRows, setVariantRows] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);

  // Editor page state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    attributes: [],
    title: '',
    price: '',
    category: '',
    subCategory: '',
    productType: '', fit: '', occasion: '',
    stock: '',
    sku: '',
    image: '',
    description: '',
    status: 'Active',
  });

  const showToast = (msg, type = 'success', title = 'Inventory') => {
    showAlert({ message: msg, type, title });
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const title = p.title || p.name || '';
    const sku = p.sku || '';
    const category = p.category || '';
    const subCategory = p.subCategory || '';
    const status = p.status || (p.stock < 10 ? 'Low Stock' : 'Active');

    const matchesSearch =
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subCategory.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'All' || category === filterCategory || subCategory === filterCategory;
    const matchesStatus = filterStatus === 'All' || status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Open the add page
  const openAddModal = () => {
    setVariantRows([]);
    setHasVariants(true);
    setEditingId(null);
    setFormData({
      attributes: [],
      title: '',
      price: '',
      category: '',
      subCategory: '',
      productType: '', fit: '', occasion: '',
      stock: '25',
      sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
      image: '',
      description: '',
      status: 'Active',
    });
    setShowModal(true);
  };

  // Open the edit page
  const openEditModal = (product) => {
    setHasVariants(Boolean(product.hasVariants));
    const keys = new Set(variantCombinations(product.attributes || []).map(variantKey));
    setVariantRows((product.variants || []).filter(row => keys.has(variantKey(row.options))));
    setEditingId(product.id);
    setFormData({
      attributes: product.attributes || [],
      title: product.title || product.name || '',
      price: product.price ? String(product.price) : '',
      category: product.category || 'Topwear',
      subCategory: product.subCategory || '',
      productType: product.productType || '', fit: product.fit || '', occasion: product.occasion || '',
      stock: product.stock !== undefined ? String(product.stock) : '10',
      sku: product.sku || `SKU-${product.id}`,
      image: product.image || '',
      description: product.description || '',
      status: product.status || (product.stock < 10 ? 'Low Stock' : 'Active'),
    });
    setShowModal(true);
  };

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (hasVariants) {
      try { validateVariants(formData.attributes, variantRows, products.find(product => product.id === editingId)?.variants || []); }
      catch (error) { showToast(error.message, 'error', 'Variants'); return; }
    }
    if (!formData.title.trim()) {
      showAlert({
        type: 'warning',
        title: 'Title Required',
        message: 'Please enter a product title/name.',
      });
      return;
    }
    if (!hasVariants && (!formData.price || Number(formData.price) <= 0)) {
      showAlert({
        type: 'warning',
        title: 'Invalid Price',
        message: 'Please enter a valid product price greater than 0.',
      });
      return;
    }

    if (catalogError || !catalogTree.find(p => p.name === formData.category)?.children.some(s => s.name === formData.subCategory)) {
      showToast('Select a navbar department and its product subcategory.', 'error', 'Category Required');
      return;
    }
    const resolvedSubCategory = formData.subCategory;



    const pricedRows = variantRows.filter(row => row.isActive !== false);
    const lowestVariant = [...(pricedRows.length ? pricedRows : variantRows)].sort((a, b) => Number(a.salePrice === '' || a.salePrice == null ? a.price : a.salePrice) - Number(b.salePrice === '' || b.salePrice == null ? b.price : b.salePrice))[0];
    const payload = {
      ...(hasVariants ? { variants: variantRows } : {}),
      attributes: formData.attributes,
      title: formData.title.trim(),
      name: formData.title.trim(),
      price: hasVariants ? Number(lowestVariant.salePrice === '' || lowestVariant.salePrice == null ? lowestVariant.price : lowestVariant.salePrice) : Number(formData.price),
      originalPrice: hasVariants ? (lowestVariant.salePrice === '' || lowestVariant.salePrice == null ? null : Number(lowestVariant.price)) : null,
      category: formData.category,
      subCategory: resolvedSubCategory,
      productType: formData.productType, fit: formData.fit, occasion: formData.occasion,
      stock: hasVariants ? pricedRows.reduce((sum, row) => sum + Number(row.stockQuantity || 0), 0) : Number(formData.stock) || 0,
      sku: formData.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      image: formData.image.trim() || 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800',
      description: formData.description.trim() || 'Premium high quality fabric product.',
      status: formData.status,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        showToast(`Product "${payload.title}" updated successfully!`);
      } else {
        await addProduct(payload);
        showToast(`Product "${payload.title}" added successfully!`);
      }

      setShowModal(false);
    } catch (error) {
      showToast(error.message || 'Product could not be saved.', 'error', 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  // Confirm delete handler
  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
      await deleteProduct(deleteTarget.id);
      showToast(`Product "${deleteTarget.title || deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      } catch (error) { showToast(error.message, 'error', 'Delete Failed'); }
    }
  };

  // Calculated Stats
  const totalProducts = products.length;
  const lowStockCount = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) < 10).length;
  const outOfStockCount = products.filter((p) => Number(p.stock) <= 0).length;
  const inStockCount = products.filter((p) => Number(p.stock) >= 10).length;

  // Category & Subcategory standard hierarchy


  // Available unique categories
  const categoryOptions = catalogTree.map(p => p.name);

  if (showModal) return (
    <AdminFormPage backLabel="Back to products" onBack={() => setShowModal(false)}>
          <div 
            className="w-full rounded-2xl bg-slate-50/70"
          >
            {/* Page Header */}
            <div className="flex items-center justify-between px-6 py-6 shrink-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {editingId ? 'Edit Product' : 'Add New Product'}
                </h1>
                <p className="text-xs text-slate-500">
                  {editingId ? 'Modify product details and inventory' : 'Enter product information to publish to store'}
                </p>
              </div>
            </div>

            {/* Page Body */}
            <form onSubmit={handleSubmit} className="px-4 pb-5 sm:px-6 space-y-5 text-slate-800 text-sm">

              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                  <div><h2 className="text-base font-bold">Product image</h2><p className="mt-1 text-xs text-slate-500">Give your product a great first impression.</p></div>
              {/* Direct Image Upload / URL Input */}
              <ImageUploadInput
                label="Cover image"
                value={formData.image}
                onChange={(img) => setFormData({ ...formData, image: img })}
                helperText="Upload product photo from your device or paste web link (Automatically compressed)"
              />


                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                  <h2 className="text-base font-bold">Product details</h2>
              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                  Product Title / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Classic White Oxford Cotton Shirt"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-900"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Describe product quality, fabric, fit, and details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-900 resize-none"
                />
              </div>

              {/* Stock & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!hasVariants && <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    disabled={hasVariants}
                    value={hasVariants ? variantRows.filter(row => row.isActive !== false).reduce((sum, row) => sum + Number(row.stockQuantity || 0), 0) : formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-900"
                  />
                </div>}

                <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                    Product Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-900 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>
              </div>


                </section>
              </div>
              <div className="rounded-2xl bg-white">              <ProductCategoryFields category={formData.category} subCategory={formData.subCategory} productType={formData.productType} fit={formData.fit} occasion={formData.occasion} onChange={(category, subCategory, productType, fit, occasion) => setFormData(prev => ({ ...prev, category, subCategory, productType, fit, occasion }))} />
</div>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-base font-bold">Pricing & inventory</h2><p className="mt-1 text-xs text-slate-500">{hasVariants ? 'Manage prices and stock for each combination below.' : 'Set the selling price and inventory for your product.'}</p></div>
                  {!hasVariants && <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50" onClick={() => setHasVariants(true)}>Add variants</button>}
                  {hasVariants && !editingId && !variantRows.length && <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50" onClick={() => setHasVariants(false)}>Use simple product</button>}
                </div>
                {!hasVariants && <>
              {/* Selling Price */}
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                  Selling Price (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 2499"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-900"
                />
                <p className="text-xs text-slate-400 mt-1">To apply a discount on this product, use the <strong>Discounts</strong> module from the sidebar.</p>
              </div>

              {/* SKU Code */}
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1.5">
                  SKU Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. SKU-104"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-900"
                />
              </div>
</>}
                <ProductAttributeFields value={formData.attributes} onChange={attributes => { setFormData(previous => ({ ...previous, attributes })); setVariantRows(rows => retainCompatibleVariants(attributes, rows)); }} />
                {hasVariants && <VariantMatrix attributes={formData.attributes} rows={variantRows} onChange={setVariantRows} defaults={formData} reservedSkus={products.flatMap(product => [product.sku, ...(product.variants || []).map(variant => variant.sku)])} />}
              </section>

              {/* Page Footer */}
              <div className="sticky bottom-3 z-10 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 sm:flex-none sm:min-w-40 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-none sm:min-w-40 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-900 text-white font-semibold text-sm shadow-xs transition flex items-center justify-center gap-2"
                >
                  <FiCheckCircle size={16} />
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
    </AdminFormPage>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Product Management</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Add, update, manage inventory and control featured store products
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-xs active:scale-98"
        >
          <FiPlus size={18} />
          Add New Product
        </button>
      </div>

      {/* Stats Cards — uniform MetricGrid + StatCard */}
      <MetricGrid cols={4}>
        <StatCard label="Total Products" value={totalProducts} icon={<FiPackage size={20} />} accent={ACCENT_COLORS[0]} />
        <StatCard label="In Stock" value={inStockCount} icon={<FiCheckCircle size={20} />} accent={ACCENT_COLORS[1]} />
        <StatCard label="Low Stock Items" value={lowStockCount} icon={<FiAlertCircle size={20} />} accent={ACCENT_COLORS[3]} />
        <StatCard label="Out of Stock" value={outOfStockCount} icon={<FiAlertCircle size={20} />} accent={ACCENT_COLORS[6]} />
      </MetricGrid>

      {/* ─── INVENTORY ALERTS CARD ─── */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-slate-500/15 text-slate-700 shrink-0 mt-0.5">
                <FiAlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-200/60 px-2 py-0.5 rounded">
                    Stock Alerts
                  </span>
                  {lowStockCount > 0 && (
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {lowStockCount} Low Stock
                    </span>
                  )}
                  {outOfStockCount > 0 && (
                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      {outOfStockCount} Out of Stock
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {lowStockCount > 0 && outOfStockCount > 0
                    ? `${lowStockCount} product(s) are low on stock and ${outOfStockCount} item(s) are completely out of stock.`
                    : lowStockCount > 0
                    ? `${lowStockCount} product(s) are running low on stock (< 10 units remaining).`
                    : `${outOfStockCount} product(s) are currently out of stock.`}
                </p>
                <p className="text-xs text-slate-500">
                  Quickly filter or update inventory to maintain smooth checkout for customers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {lowStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('Low Stock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterStatus === 'Low Stock'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  Filter Low Stock
                </button>
              )}
              {outOfStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('Out of Stock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterStatus === 'Out of Stock'
                      ? 'bg-rose-700 text-white'
                      : 'bg-rose-100 hover:bg-rose-200 text-rose-900'
                  }`}
                >
                  Filter Out of Stock
                </button>
              )}
              {filterStatus !== 'All' && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('All')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm text-slate-800"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
            >
              <option value="All">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 hidden md:table-cell">SKU</th>
                <th className="py-3 px-4 text-center">Category</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-center hidden sm:table-cell">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm font-medium">
                    <FiPackage className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No products found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const title = product.title || product.name || 'Unnamed Product';
                  const sku = product.sku || `SKU-${product.id}`;
                  const stockNum = Number(product.stock) || 0;
                  const price = Number(product.price) || 0;
                  const status = product.status || (stockNum <= 0 ? 'Out of Stock' : stockNum < 10 ? 'Low Stock' : 'Active');

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Name & Image */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <img
                            src={product.image || 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800'}
                            alt={title}
                            className="w-11 h-11 rounded-lg object-contain border border-slate-200 shrink-0 bg-slate-100"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-xs">{title}</p>
                            <p className="text-xs text-slate-400 md:hidden font-mono">{sku}</p>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs hidden md:table-cell">
                        {sku}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="bg-slate-50 text-slate-700 border border-slate-200/60 px-2.5 py-1 rounded-full text-[11px] font-semibold inline-block">
                          {product.category || 'General'}
                        </span>
                        {product.subCategory && product.subCategory !== product.category && (
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                            {product.subCategory}
                          </span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        Rs. {price.toLocaleString()}
                        {product.originalPrice > price && (
                          <span className="block text-[10px] text-slate-400 line-through font-normal">
                            Rs. {Number(product.originalPrice).toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            stockNum > 20
                              ? 'bg-emerald-50 text-emerald-700'
                              : stockNum > 0
                              ? 'bg-slate-50 text-slate-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {stockNum} units
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : status === 'Low Stock'
                              ? 'bg-slate-50 text-slate-700 border border-slate-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-2 bg-slate-600 text-white hover:text-slate-600 hover:bg-slate-50 border border-slate-200/60 rounded-lg transition"
                            title="Edit Product"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="p-2 bg-red-600 text-white hover:text-red-600 hover:bg-rose-50 border border-rose-200/60 rounded-lg transition"
                            title="Delete Product"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD / EDIT PRODUCT MODAL ─── */}


      {/* Delete Confirmation Modal Card */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Product"
        message="Are you sure you want to delete this product? It will immediately be removed from the store, shop, and featured products."
        itemName={deleteTarget?.title || deleteTarget?.name}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Delete Product"
        cancelText="Cancel"
      />
    </div>
  );
}
