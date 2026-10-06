import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FiTag,
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
  FiCopy,
  FiCheck,
  FiCalendar,
  FiDollarSign,
  FiRefreshCw,
  FiUsers,
  FiLayers,
  FiGrid,
  FiAlertTriangle
} from 'react-icons/fi';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';
import DeleteConfirmModal from '../../component/DeleteConfirmModal';

interface Coupon {
  id: number;
  code: string;
  name: string;
  discount_type: 'Percentage' | 'Fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number;
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

interface CouponUsage {
  id: number;
  coupon_id: number;
  customer_email: string;
  customer_name?: string;
  order_id: string;
  discount_amount: number;
  total_amount?: number;
  created_at: string;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  image?: string;
  category_name?: string;
}

export default function ManageCoupons() {
  const { showAlert } = useAdminAlert();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    paused: 0,
    totalUsages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [viewingCoupon, setViewingCoupon] = useState<Coupon | null>(null);
  const [viewingUsages, setViewingUsages] = useState<CouponUsage[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discount_type: 'Percentage' as 'Percentage' | 'Fixed',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    per_customer_limit: '1',
    apply_to: 'All' as 'All' | 'Products' | 'Categories' | 'Collections',
    product_ids: [] as number[],
    category_ids: [] as string[],
    collection_ids: [] as number[],
    starts_at: '',
    ends_at: '',
  });

  // Target picker resources
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

  // Fetch Coupons
  const fetchCoupons = useCallback(async (showToast = false) => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/coupons', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load coupons');

      setCoupons(data.coupons || []);
      if (data.stats) setStats(data.stats);
      if (showToast) showAlert('Coupons list updated.', 'success', 'Refreshed');
    } catch (err: any) {
      showAlert(err.message || 'Could not load coupons.', 'error', 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  // Fetch Targets for pickers
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
    fetchCoupons();
    fetchPickerData();
  }, [fetchCoupons, fetchPickerData]);

  // Code generator
  const generateCouponCode = () => {
    const prefixes = ['SAVE', 'PROMO', 'DEAL', 'SHOP', 'SPECIAL', 'FLASH'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(10 + Math.random() * 90);
    const code = `${prefix}${number}`;
    setFormData(prev => ({ ...prev, code }));
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingCoupon(null);
    const now = new Date();
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const formatDateTimeInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      code: '',
      name: '',
      discount_type: 'Percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount_amount: '',
      usage_limit: '',
      per_customer_limit: '1',
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

  // Open Edit Form
  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);

    const formatDateTimeInput = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      code: coupon.code,
      name: coupon.name,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_order_amount: coupon.min_order_amount ? String(coupon.min_order_amount) : '',
      max_discount_amount: coupon.max_discount_amount ? String(coupon.max_discount_amount) : '',
      usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : '',
      per_customer_limit: String(coupon.per_customer_limit || 1),
      apply_to: coupon.apply_to,
      product_ids: coupon.product_ids || [],
      category_ids: coupon.category_ids || [],
      collection_ids: coupon.collection_ids || [],
      starts_at: formatDateTimeInput(coupon.starts_at),
      ends_at: formatDateTimeInput(coupon.ends_at),
    });
    setProductPickerSearch('');
    setShowFormModal(true);
  };

  // Save Coupon (Create or Update)
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return showAlert('Coupon name is required.', 'warning', 'Validation');
    }
    if (!editingCoupon && !formData.code.trim()) {
      return showAlert('Coupon code is required.', 'warning', 'Validation');
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

    try {
      const token = getAuthToken();
      const method = editingCoupon ? 'PUT' : 'POST';
      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons';

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
        editingCoupon ? 'Coupon updated successfully.' : 'Coupon created successfully.',
        'success',
        'Success'
      );
      setShowFormModal(false);
      fetchCoupons();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save coupon.', 'error', 'Error');
    }
  };

  // Toggle Pause / Activate
  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/coupons/${coupon.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not update status');

      showAlert(data.message, 'success', 'Status Changed');
      fetchCoupons();
    } catch (err: any) {
      showAlert(err.message || 'Status toggle failed.', 'error', 'Error');
    }
  };

  // Delete Coupon
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/coupons/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');

      showAlert('Coupon deleted successfully.', 'success', 'Deleted');
      setDeleteTarget(null);
      fetchCoupons();
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete coupon.', 'error', 'Error');
    }
  };

  // View Details & Usages
  const handleViewDetails = async (coupon: Coupon) => {
    setViewingCoupon(coupon);
    setViewingUsages([]);
    setUsagesLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setViewingCoupon(data.coupon);
        setViewingUsages(data.usages || []);
      }
    } catch (err) {
      console.error('Error fetching coupon details:', err);
    } finally {
      setUsagesLoading(false);
    }
  };

  // Copy Code to Clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered Coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter(c => {
      const matchesSearch =
        !searchTerm ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === 'All' || c.effective_status.toLowerCase() === filterStatus.toLowerCase();

      const matchesType =
        filterType === 'All' || c.discount_type.toLowerCase() === filterType.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [coupons, searchTerm, filterStatus, filterType]);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Coupons Management</h1>
          <p className="text-slate-500 text-sm mt-1">Create, schedule, and track customer promotional coupon codes.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchCoupons(true);
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
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <MetricGrid cols={5}>
        <div onClick={() => setFilterStatus('All')} className="cursor-pointer">
          <StatCard
            label="Total Coupons"
            value={loading ? '...' : stats.total.toLocaleString()}
            icon={<FiTag size={20} />}
            accent={ACCENT_COLORS[0]}
          />
        </div>
        <div onClick={() => setFilterStatus('Active')} className="cursor-pointer">
          <StatCard
            label="Active Coupons"
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

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search coupon code or name..."
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

          {/* Filter Discount Type */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
          >
            <option value="All">All Types</option>
            <option value="Percentage">Percentage (%)</option>
            <option value="Fixed">Fixed Amount (Rs.)</option>
          </select>
        </div>

        {/* Coupons Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Coupon Code</th>
                <th className="py-3 px-4">Campaign Name</th>
                <th className="py-3 px-4 text-center">Discount</th>
                <th className="py-3 px-4 text-center">Min Order</th>
                <th className="py-3 px-4 text-center">Usage</th>
                <th className="py-3 px-4">Validity</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading coupons...
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FiTag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No coupons found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Create your first coupon to offer discounts to customers.</p>
                  </td>
                </tr>
              ) : (
                filteredCoupons.map(coupon => {
                  const isPercentage = coupon.discount_type === 'Percentage';
                  const usageDisplay = coupon.usage_limit
                    ? `${coupon.usage_count} / ${coupon.usage_limit}`
                    : `${coupon.usage_count} / ∞`;
                  const usageRatio = coupon.usage_limit
                    ? Math.min(100, Math.round((coupon.usage_count / coupon.usage_limit) * 100))
                    : 0;

                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-xs">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          <span>{coupon.code}</span>
                          <button
                            onClick={() => handleCopyCode(coupon.code)}
                            title="Copy code"
                            className="text-slate-400 hover:text-black transition"
                          >
                            {copiedCode === coupon.code ? <FiCheck className="text-emerald-600" size={13} /> : <FiCopy size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* Name & Target */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{coupon.name}</div>
                        <div className="text-[11px] text-slate-400">Applies to: {coupon.apply_to}</div>
                      </td>

                      {/* Discount Value */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md font-bold text-xs bg-purple-50 text-purple-700 border border-purple-200">
                          {isPercentage ? `${coupon.discount_value}% OFF` : `Rs. ${Number(coupon.discount_value).toLocaleString('en-PK')} OFF`}
                        </span>
                      </td>

                      {/* Min Order */}
                      <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-700">
                        {Number(coupon.min_order_amount) > 0 ? `Rs. ${Number(coupon.min_order_amount).toLocaleString('en-PK')}` : 'None'}
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="text-xs font-semibold text-slate-800">{usageDisplay}</div>
                        {coupon.usage_limit && (
                          <div className="w-16 mx-auto bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-slate-900 h-1.5 rounded-full" style={{ width: `${usageRatio}%` }} />
                          </div>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div>{new Date(coupon.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(coupon.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${getStatusBadge(coupon.effective_status)}`}>
                          {coupon.effective_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(coupon)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="View details & usages"
                          >
                            <FiEye size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(coupon)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Edit coupon"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(coupon)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title={coupon.is_paused ? 'Activate' : 'Pause'}
                          >
                            {coupon.is_paused ? <FiPlayCircle className="text-emerald-600" size={15} /> : <FiPauseCircle className="text-amber-600" size={15} />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(coupon)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete coupon"
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
                  <FiTag size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure promotional discount codes and restriction rules.</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Code & Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Coupon Code *</label>
                    {!editingCoupon && (
                      <button
                        type="button"
                        onClick={generateCouponCode}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                      >
                        + Generate
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={!!editingCoupon}
                    placeholder="e.g. SAVE20"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:bg-white focus:border-black uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Campaign Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Summer Sale Promo"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                    required
                  />
                </div>
              </div>

              {/* Discount Type & Value */}
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
                    {formData.discount_type === 'Percentage' ? 'Discount Percentage (%) *' : 'Discount Amount (Rs.) *'}
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

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Minimum Cart Subtotal (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 (No minimum)"
                    value={formData.min_order_amount}
                    onChange={e => setFormData({ ...formData, min_order_amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Maximum Discount Cap (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional cap for % discounts"
                    value={formData.max_discount_amount}
                    onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formData.usage_limit}
                    onChange={e => setFormData({ ...formData, usage_limit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Per-Customer Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formData.per_customer_limit}
                    onChange={e => setFormData({ ...formData, per_customer_limit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-black"
                  />
                </div>
              </div>

              {/* Apply To Rules */}
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

              {/* Specific Products Multi-Select */}
              {formData.apply_to === 'Products' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Eligible Products</span>
                    <span className="text-xs text-slate-500">{formData.product_ids.length} selected</span>
                  </div>

                  {/* Product Search */}
                  <input
                    type="text"
                    placeholder="Filter products..."
                    value={productPickerSearch}
                    onChange={e => setProductPickerSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-black"
                  />

                  {/* Selected Chips */}
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

                  {/* Searchable Options List */}
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                    {availableProducts
                      .filter(p => p.name.toLowerCase().includes(productPickerSearch.toLowerCase()))
                      .map(p => {
                        const checked = formData.product_ids.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer text-xs"
                          >
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
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Select Eligible Categories</span>
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
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Select Eligible Collections</span>
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

              {/* Validity Dates */}
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
                  {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS & USAGE LOGS MODAL */}
      {viewingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl font-bold font-mono text-sm">
                  {viewingCoupon.code}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{viewingCoupon.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getStatusBadge(viewingCoupon.effective_status)}`}>
                    {viewingCoupon.effective_status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingCoupon(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Discount</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {viewingCoupon.discount_type === 'Percentage' ? `${viewingCoupon.discount_value}% OFF` : `Rs. ${viewingCoupon.discount_value}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Min Spend</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {viewingCoupon.min_order_amount > 0 ? `Rs. ${Number(viewingCoupon.min_order_amount).toLocaleString()}` : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Usages</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {viewingCoupon.usage_count} {viewingCoupon.usage_limit ? `/ ${viewingCoupon.usage_limit}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Per Customer</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {viewingCoupon.per_customer_limit || 1} max
                  </span>
                </div>
              </div>

              {/* Usages History */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">Usage History ({viewingUsages.length})</h4>
                {usagesLoading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading usage history...</div>
                ) : viewingUsages.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    This coupon has not been redeemed yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {viewingUsages.map(u => (
                      <div key={u.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <span className="font-bold text-slate-900">{u.order_id}</span>
                          <span className="text-slate-400 mx-1.5">•</span>
                          <span className="text-slate-600">{u.customer_name || u.customer_email}</span>
                        </div>
                        <div className="text-right font-mono font-bold text-purple-700">
                          -Rs. {Number(u.discount_amount).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingCoupon(null)}
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
        title="Delete Coupon"
        message={`Are you sure you want to delete coupon "${deleteTarget?.code}"? Historical orders that used this coupon will be safely preserved.`}
        itemName={deleteTarget?.code}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
