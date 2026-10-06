import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FiPercent,
  FiPlus,
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiPauseCircle,
  FiPlayCircle,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiX,
  FiRefreshCw,
  FiLayers,
  FiGrid,
  FiTag,
  FiAlertTriangle,
  FiBox
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';
import DeleteConfirmModal from '../../component/DeleteConfirmModal';

interface Discount {
  id: number;
  name: string;
  discount_type: 'Percentage' | 'Fixed';
  discount_value: number;
  apply_to: 'All' | 'Products' | 'Categories' | 'Collections';
  product_ids: number[];
  category_ids: string[];
  collection_ids: number[];
  starts_at: string;
  ends_at: string;
  is_paused: boolean;
  effective_status: 'Active' | 'Scheduled' | 'Expired' | 'Paused' | 'Deleted';
  created_at: string;
}

interface AffectedProduct {
  id: number;
  name: string;
  sku?: string;
  image?: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountPercent: number;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  image?: string;
  category_name?: string;
}

export default function ManageDiscounts() {
  const { showAlert } = useAdminAlert();

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    paused: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterApplyTo, setFilterApplyTo] = useState('All');

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [viewingDiscount, setViewingDiscount] = useState<Discount | null>(null);
  const [affectedProducts, setAffectedProducts] = useState<AffectedProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    discount_type: 'Percentage' as 'Percentage' | 'Fixed',
    discount_value: '',
    apply_to: 'All' as 'All' | 'Products' | 'Categories' | 'Collections',
    product_ids: [] as number[],
    category_ids: [] as string[],
    collection_ids: [] as number[],
    starts_at: '',
    ends_at: '',
  });

  // Reference data for pickers
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [availableCategories, setAvailableCategories] = useState<{ id: number; name: string }[]>([]);
  const [availableCollections, setAvailableCollections] = useState<{ id: number; name: string }[]>([]);
  const [productPickerSearch, setProductPickerSearch] = useState('');

  const getAuthToken = () => {
    try {
      const user = JSON.parse(localStorage.getItem('shophub_user') || 'null');
      return user?.token || '';
    } catch {
      return '';
    }
  };

  // Fetch Discounts
  const fetchDiscounts = useCallback(async (showToast = false) => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/discounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load discounts');

      setDiscounts(data.discounts || []);
      if (data.stats) setStats(data.stats);
      if (showToast) showAlert('Discounts list refreshed.', 'success', 'Refreshed');
    } catch (err: any) {
      showAlert(err.message || 'Could not load discounts.', 'error', 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  // Fetch picker options
  const fetchPickerData = useCallback(async () => {
    try {
      const [prodRes, catRes, colRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/collections'),
      ]);
      const [prodData, catData, colData] = await Promise.all([
        prodRes.json().catch(() => ({})),
        catRes.json().catch(() => ({})),
        colRes.json().catch(() => ({})),
      ]);

      if (prodData.products) setAvailableProducts(prodData.products);
      if (catData.categories) setAvailableCategories(catData.categories);
      if (colData.collections) setAvailableCollections(colData.collections);
    } catch (e) {
      console.error('Failed to load picker reference data:', e);
    }
  }, []);

  useEffect(() => {
    fetchDiscounts();
    fetchPickerData();
  }, [fetchDiscounts, fetchPickerData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingDiscount(null);
    const now = new Date();
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const formatDateTimeInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      name: '',
      discount_type: 'Percentage',
      discount_value: '',
      apply_to: 'All',
      product_ids: [],
      category_ids: [],
      collection_ids: [],
      starts_at: formatDateTimeInput(now),
      ends_at: formatDateTimeInput(nextMonth),
    });
    setProductPickerSearch('');
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (discount: Discount) => {
    setEditingDiscount(discount);

    const formatDateTimeInput = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      name: discount.name,
      discount_type: discount.discount_type,
      discount_value: String(discount.discount_value),
      apply_to: discount.apply_to,
      product_ids: discount.product_ids || [],
      category_ids: discount.category_ids || [],
      collection_ids: discount.collection_ids || [],
      starts_at: formatDateTimeInput(discount.starts_at),
      ends_at: formatDateTimeInput(discount.ends_at),
    });
    setProductPickerSearch('');
    setShowFormModal(true);
  };

  // Save Discount
  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return showAlert('Discount name is required.', 'warning', 'Validation');
    }
    const val = Number(formData.discount_value);
    if (!val || val <= 0) {
      return showAlert('Discount value must be greater than 0.', 'warning', 'Validation');
    }
    if (formData.discount_type === 'Percentage' && val > 100) {
      return showAlert('Percentage discount cannot exceed 100%.', 'warning', 'Validation');
    }
    if (!formData.starts_at || !formData.ends_at) {
      return showAlert('Start and End dates are required.', 'warning', 'Validation');
    }
    if (new Date(formData.ends_at) < new Date(formData.starts_at)) {
      return showAlert('End date must be after Start date.', 'warning', 'Validation');
    }

    if (editingDiscount?.effective_status === 'Active') {
      const proceed = window.confirm(
        'This discount is currently active. Changing it may immediately affect customer prices across the store. Continue?'
      );
      if (!proceed) return;
    }

    try {
      const token = getAuthToken();
      const method = editingDiscount ? 'PUT' : 'POST';
      const url = editingDiscount ? `/api/admin/discounts/${editingDiscount.id}` : '/api/admin/discounts';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Operation failed');

      showAlert(
        editingDiscount ? 'Discount updated successfully.' : 'Discount created successfully.',
        'success',
        'Success'
      );
      setShowFormModal(false);
      fetchDiscounts();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save discount.', 'error', 'Error');
    }
  };

  // Toggle Pause / Activate
  const handleToggleStatus = async (discount: Discount) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/discounts/${discount.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not update status');

      showAlert(data.message, 'success', 'Status Changed');
      fetchDiscounts();
    } catch (err: any) {
      showAlert(err.message || 'Status toggle failed.', 'error', 'Error');
    }
  };

  // Delete Discount
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/discounts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');

      showAlert('Discount deleted successfully.', 'success', 'Deleted');
      setDeleteTarget(null);
      fetchDiscounts();
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete discount.', 'error', 'Error');
    }
  };

  // View Details & Affected Products Preview
  const handleViewDetails = async (discount: Discount) => {
    setViewingDiscount(discount);
    setAffectedProducts([]);
    setProductsLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setViewingDiscount(data.discount);
        setAffectedProducts(data.affectedProducts || []);
      }
    } catch (err) {
      console.error('Error fetching discount details:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  // Filtered Discounts
  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      const matchesSearch =
        !searchTerm ||
        d.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === 'All' || d.effective_status.toLowerCase() === filterStatus.toLowerCase();

      const matchesType =
        filterType === 'All' || d.discount_type.toLowerCase() === filterType.toLowerCase();

      const matchesApplyTo =
        filterApplyTo === 'All' || d.apply_to.toLowerCase() === filterApplyTo.toLowerCase();

      return matchesSearch && matchesStatus && matchesType && matchesApplyTo;
    });
  }, [discounts, searchTerm, filterStatus, filterType, filterApplyTo]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Scheduled':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Paused':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Expired':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Discount Management</h1>
          <p className="text-slate-500 text-sm mt-1">Create and schedule automatic discounts for products, categories, and collections.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchDiscounts(true);
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95"
          >
            <FiPlus className="w-4 h-4" />
            <span>Create Discount</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <MetricGrid cols={5}>
        <div onClick={() => setFilterStatus('All')} className="cursor-pointer">
          <StatCard
            label="Total Discounts"
            value={loading ? '...' : stats.total.toLocaleString()}
            icon={<FiPercent size={20} />}
            accent={ACCENT_COLORS[0]}
          />
        </div>
        <div onClick={() => setFilterStatus('Active')} className="cursor-pointer">
          <StatCard
            label="Active"
            value={loading ? '...' : stats.active.toLocaleString()}
            icon={<FiCheckCircle size={20} />}
            accent={ACCENT_COLORS[1]}
          />
        </div>
        <div onClick={() => setFilterStatus('Scheduled')} className="cursor-pointer">
          <StatCard
            label="Scheduled"
            value={loading ? '...' : stats.scheduled.toLocaleString()}
            icon={<FiClock size={20} />}
            accent={ACCENT_COLORS[2]}
          />
        </div>
        <div onClick={() => setFilterStatus('Expired')} className="cursor-pointer">
          <StatCard
            label="Expired"
            value={loading ? '...' : stats.expired.toLocaleString()}
            icon={<FiAlertCircle size={20} />}
            accent={ACCENT_COLORS[5]}
          />
        </div>
        <div onClick={() => setFilterStatus('Paused')} className="cursor-pointer">
          <StatCard
            label="Paused"
            value={loading ? '...' : stats.paused.toLocaleString()}
            icon={<FiPauseCircle size={20} />}
            accent={ACCENT_COLORS[3]}
          />
        </div>
      </MetricGrid>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search discount promotion by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition"
            />
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-400 shrink-0" size={16} />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Expired">Expired</option>
              <option value="Paused">Paused</option>
            </select>
          </div>

          {/* Filter Type */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
          >
            <option value="All">All Types</option>
            <option value="Percentage">Percentage (%)</option>
            <option value="Fixed">Fixed Amount (Rs.)</option>
          </select>

          {/* Filter Applies To */}
          <select
            value={filterApplyTo}
            onChange={e => setFilterApplyTo(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
          >
            <option value="All">All Targets</option>
            <option value="Products">Specific Products</option>
            <option value="Categories">Categories</option>
            <option value="Collections">Collections</option>
          </select>
        </div>

        {/* Discounts Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Discount Name</th>
                <th className="py-3 px-4">Applies To</th>
                <th className="py-3 px-4">Target Summary</th>
                <th className="py-3 px-4 text-center">Discount</th>
                <th className="py-3 px-4">Schedule</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading discounts...
                  </td>
                </tr>
              ) : filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FiPercent className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No discounts found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Create your first automatic promotional discount rule.</p>
                  </td>
                </tr>
              ) : (
                filteredDiscounts.map(discount => {
                  const isPercentage = discount.discount_type === 'Percentage';
                  let targetSummary = 'Storewide (All Products)';
                  if (discount.apply_to === 'Products') {
                    targetSummary = `${discount.product_ids?.length || 0} Specific Products`;
                  } else if (discount.apply_to === 'Categories') {
                    targetSummary = `${discount.category_ids?.length || 0} Categories`;
                  } else if (discount.apply_to === 'Collections') {
                    targetSummary = `${discount.collection_ids?.length || 0} Collections`;
                  }

                  return (
                    <tr key={discount.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {discount.name}
                      </td>

                      {/* Applies To */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md font-semibold text-xs bg-slate-100 text-slate-700 border border-slate-200">
                          {discount.apply_to === 'All' ? 'All Products' : discount.apply_to}
                        </span>
                      </td>

                      {/* Target Summary */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                        {targetSummary}
                      </td>

                      {/* Value */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {isPercentage ? `${discount.discount_value}% OFF` : `Rs. ${Number(discount.discount_value).toLocaleString()} OFF`}
                        </span>
                      </td>

                      {/* Schedule */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div>{new Date(discount.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(discount.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${getStatusBadge(discount.effective_status)}`}>
                          {discount.effective_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(discount)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="View impacted products & prices"
                          >
                            <FiEye size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(discount)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Edit discount"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(discount)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title={discount.is_paused ? 'Activate' : 'Pause'}
                          >
                            {discount.is_paused ? <FiPlayCircle className="text-emerald-600" size={15} /> : <FiPauseCircle className="text-amber-600" size={15} />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(discount)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete discount"
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

      {/* CREATE / EDIT MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <FiPercent size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {editingDiscount ? `Edit Discount: ${editingDiscount.name}` : 'Create Automatic Discount'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure promotional discount rules applied automatically across the catalog.</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {editingDiscount?.effective_status === 'Active' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
                  <FiAlertTriangle className="text-amber-600 shrink-0" size={16} />
                  <span>This discount is currently active. Saving updates will immediately adjust prices for browsing customers.</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Discount Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Clearance Sale - 20% OFF"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                  required
                />
              </div>

              {/* Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Discount Type</label>
                  <select
                    value={formData.discount_type}
                    onChange={e => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
                  >
                    <option value="Percentage">Percentage (% OFF)</option>
                    <option value="Fixed">Fixed Amount (Rs. OFF)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {formData.discount_type === 'Percentage' ? 'Discount Value (%) *' : 'Discount Amount (Rs.) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.discount_type === 'Percentage' ? '100' : undefined}
                    placeholder={formData.discount_type === 'Percentage' ? '20' : '500'}
                    value={formData.discount_value}
                    onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:bg-white focus:border-black"
                    required
                  />
                </div>
              </div>

              {/* Apply To */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Applies To</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['All', 'Products', 'Categories', 'Collections'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFormData({ ...formData, apply_to: option })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition text-center ${
                        formData.apply_to === option
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {option === 'All' ? 'All Products' : option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Products Picker */}
              {formData.apply_to === 'Products' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Discounted Products</span>
                    <span className="text-xs text-slate-500">{formData.product_ids.length} selected</span>
                  </div>

                  <input
                    type="text"
                    placeholder="Search products by title..."
                    value={productPickerSearch}
                    onChange={e => setProductPickerSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-black"
                  />

                  {formData.product_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                      {formData.product_ids.map(id => {
                        const prod = availableProducts.find(p => p.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          >
                            <span className="truncate max-w-[120px]">{prod?.name || `Product #${id}`}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  product_ids: formData.product_ids.filter(item => item !== id),
                                })
                              }
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <FiX size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                    {availableProducts
                      .filter(p => p.name.toLowerCase().includes(productPickerSearch.toLowerCase()))
                      .map(p => {
                        const checked = formData.product_ids.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setFormData({
                                  ...formData,
                                  product_ids: checked
                                    ? formData.product_ids.filter(id => id !== p.id)
                                    : [...formData.product_ids, p.id],
                                });
                              }}
                              className="rounded border-slate-300 text-black focus:ring-black"
                            />
                            <span className="font-medium text-slate-800 flex-1 truncate">{p.name}</span>
                            <span className="text-slate-400 font-mono">Rs. {p.price.toLocaleString()}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Specific Categories */}
              {formData.apply_to === 'Categories' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Select Discounted Categories</span>
                  <div className="grid grid-cols-2 gap-2">
                    {availableCategories.map(cat => {
                      const checked = formData.category_ids.includes(String(cat.id)) || formData.category_ids.includes(cat.name);
                      return (
                        <label key={cat.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const idStr = String(cat.id);
                              setFormData({
                                ...formData,
                                category_ids: checked
                                  ? formData.category_ids.filter(c => c !== idStr && c !== cat.name)
                                  : [...formData.category_ids, idStr],
                              });
                            }}
                          />
                          <span>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Specific Collections */}
              {formData.apply_to === 'Collections' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Select Discounted Collections</span>
                  <div className="grid grid-cols-2 gap-2">
                    {availableCollections.map(col => {
                      const checked = formData.collection_ids.includes(col.id);
                      return (
                        <label key={col.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setFormData({
                                ...formData,
                                collection_ids: checked
                                  ? formData.collection_ids.filter(c => c !== col.id)
                                  : [...formData.collection_ids, col.id],
                              });
                            }}
                          />
                          <span>{col.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Schedule Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={e => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">End Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={e => setFormData({ ...formData, ends_at: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                    required
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95"
                >
                  {editingDiscount ? 'Update Discount' : 'Create Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS & IMPACTED PRODUCTS MODAL */}
      {viewingDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm">
                  <FiPercent size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{viewingDiscount.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getStatusBadge(viewingDiscount.effective_status)}`}>
                    {viewingDiscount.effective_status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingDiscount(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Discount Value</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {viewingDiscount.discount_type === 'Percentage' ? `${viewingDiscount.discount_value}% OFF` : `Rs. ${viewingDiscount.discount_value} OFF`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Applies To</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {viewingDiscount.apply_to === 'All' ? 'All Products' : viewingDiscount.apply_to}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Active Period</span>
                  <span className="font-medium text-slate-800 text-xs">
                    {new Date(viewingDiscount.starts_at).toLocaleDateString()} → {new Date(viewingDiscount.ends_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Impacted Products Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Impacted Products Preview ({affectedProducts.length})
                </h4>

                {productsLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading product price impact...</div>
                ) : affectedProducts.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No products currently matching this discount filter.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {affectedProducts.map(p => (
                      <div key={p.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {typeof p.image === 'string' && p.image.trim() !== '' && (
                            <img src={p.image} alt={p.name} className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">{p.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">Original: Rs. {p.originalPrice.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-emerald-700 font-bold text-sm block">Rs. {p.finalPrice.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                            Save Rs. {p.discountAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingDiscount(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Discount"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Deleting will immediately remove this promotional discount from eligible products.`}
        itemName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
