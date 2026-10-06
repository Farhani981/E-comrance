import AdminFormPage from '../../component/AdminFormPage';
import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiSearch, FiTag, FiEye, FiEyeOff, FiPackage, FiStar } from 'react-icons/fi';
import DeleteConfirmModal from '../../component/DeleteConfirmModal';
import ImageUploadInput from '../../component/ImageUploadInput';
import { useAdminAlert } from '../../context/AdminAlertContext';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';

export default function ManageCollections() {
  const { showAlert } = useAdminAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch collections from backend
  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const [formData, setFormData] = useState({
    name: '', description: '', badge: '', image: '', productCount: ''
  });

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.badge || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAuthToken = () => {
    try {
      const user = localStorage.getItem('shophub_user');
      if (user) return JSON.parse(user).token || '';
    } catch { return ''; }
    return '';
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
        const token = getAuthToken();
        const res = await fetch(`/api/collections/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to delete collection');
        }
        setCollections(collections.filter(c => c.id !== deleteTarget.id));
        setDeleteTarget(null);
        showAlert({ type: 'success', title: 'Collection Deleted', message: 'Collection successfully deleted.' });
      } catch (error) {
        showAlert({ type: 'error', title: 'Database Error', message: error.message });
      }
    }
  };

  const toggleActive = async (id) => {
    const collection = collections.find(c => c.id === id);
    if (!collection) return;

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/collections/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          ...collection,
          isActive: !collection.isActive
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update status');
      }
      setCollections(collections.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
      showAlert({ type: 'info', title: 'Status Updated', message: `Collection "${collection.name}" status updated.` });
    } catch (error) {
      showAlert({ type: 'error', title: 'Database Error', message: error.message });
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', badge: '', image: '', productCount: '' });
    setShowForm(true);
  };

  const openEditForm = (collection) => {
    setEditingId(collection.id);
    setFormData({
      name: collection.name,
      description: collection.description || '',
      badge: collection.badge || '',
      image: collection.image || '',
      productCount: String(collection.productCount || 0),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      showAlert({ type: 'warning', title: 'Name Required', message: 'Collection name is required!' });
      return;
    }

    try {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      };

      if (editingId) {
        const res = await fetch(`/api/collections/${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            ...formData,
            productCount: Number(formData.productCount) || 0
          })
        });
        
        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.message || 'Failed to update collection');
        }
        
        setCollections(collections.map(c => c.id === editingId
          ? { ...c, ...formData, productCount: Number(formData.productCount) || 0 }
          : c
        ));
      } else {
        const res = await fetch(`/api/collections`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...formData,
            productCount: Number(formData.productCount) || 0,
            isActive: true
          })
        });
        
        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.message || 'Failed to create collection');
        }
        
        const data = await res.json();
        setCollections([data.collection, ...collections]);
      }
      
      showAlert({
        type: 'success',
        title: editingId ? 'Collection Updated' : 'Collection Created',
        message: `Collection "${formData.name}" successfully saved.`,
      });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      showAlert({ type: 'error', title: 'Database Error', message: error.message });
    }
  };

  const badgeColors = {
    SALE: 'bg-red-100 text-red-700',
    NEW: 'bg-slate-100 text-slate-700',
    POPULAR: 'bg-slate-100 text-slate-700',
    FESTIVE: 'bg-slate-100 text-slate-700',
    VALUE: 'bg-emerald-100 text-emerald-700',
    PREMIUM: 'bg-slate-800 text-white',
  };

  const activeCount = collections.filter(c => c.isActive).length;
  const totalProducts = collections.reduce((sum, c) => sum + c.productCount, 0);

  if (showForm) return (
    <AdminFormPage backLabel="Back to collections" onBack={() => setShowForm(false)}>
          <div className="w-full bg-white">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h1 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Collection' : 'Add New Collection'}
              </h1>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">Collection Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Summer Sale 2026"
                  className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">Description</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Collection description..."
                  className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">Badge Text</label>
                  <select
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <option value="">Select Badge</option>
                    <option value="SALE">SALE</option>
                    <option value="NEW">NEW</option>
                    <option value="POPULAR">POPULAR</option>
                    <option value="FESTIVE">FESTIVE</option>
                    <option value="VALUE">VALUE</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">Product Count</label>
                  <input
                    type="number"
                    value={formData.productCount}
                    onChange={(e) => setFormData({ ...formData, productCount: e.target.value })}
                    placeholder="e.g. 24"
                    className="w-full px-4 py-2.5 text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>
              <ImageUploadInput
                label="Cover Image"
                value={formData.image}
                onChange={(img) => setFormData({ ...formData, image: img })}
                helperText="Upload collection cover photo from device or paste web link (Automatically compressed)"
              />
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-900 rounded-lg hover:bg-slate-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-semibold transition"
              >
                {editingId ? 'Update Collection' : 'Add Collection'}
              </button>
            </div>
          </div>
    </AdminFormPage>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Collections Management</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">Manage featured collections and special promotional offers</p>
        </div>
        <button
          onClick={openAddForm}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-white hover:text-blue-600 font-semibold text-sm flex items-center justify-center gap-2 transition shadow-xs active:scale-98"
        >
          <FiPlus size={18} />
          Add New Collection
        </button>
      </div>

      {/* Stats Cards — uniform MetricGrid + StatCard */}
      <MetricGrid cols={4}>
        <StatCard label="Total Collections" value={collections.length} icon={<FiTag size={20} />} accent={ACCENT_COLORS[0]} />
        <StatCard label="Active Collections" value={activeCount} icon={<FiEye size={20} />} accent={ACCENT_COLORS[1]} />
        <StatCard label="Inactive" value={collections.length - activeCount} icon={<FiEyeOff size={20} />} accent={ACCENT_COLORS[3]} />
        <StatCard label="Products in Collections" value={totalProducts} icon={<FiPackage size={20} />} accent={ACCENT_COLORS[2]} />
      </MetricGrid>

      {/* Search & Collection Cards Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6">
        <div className="flex gap-4 items-center mb-6">
          <div className="w-full relative">
            <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search collections by name or badge..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-800 text-sm"
            />
          </div>
        </div>

        {/* Collection Cards */}
        {filteredCollections.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FiTag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No collections found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredCollections.map((collection) => (
              <div
                key={collection.id}
                className={`rounded-2xl border overflow-hidden transition-all group ${collection.isActive
                  ? 'border-slate-200 bg-white hover:shadow-xl hover:-translate-y-1'
                  : 'border-slate-300 bg-slate-50/90 shadow-2xs'
                  }`}
              >
                {/* Cover Image */}
                <div className={`relative h-40 bg-slate-100 overflow-hidden transition-opacity ${
                  collection.isActive ? 'opacity-100' : 'opacity-50 grayscale-[40%]'
                }`}>
                  {collection.image ? (
                    <img
                      src={collection.image}
                      alt={collection.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FiTag className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />

                  {/* Badge */}
                  <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full ${badgeColors[collection.badge] || 'bg-slate-200 text-slate-600'
                    }`}>
                    {collection.badge}
                  </span>

                  {/* Status */}
                  <span className={`absolute top-3 right-3 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${collection.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                    }`}>
                    {collection.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>

                  {/* Product Count */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                    <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <FiPackage size={11} />
                      {collection.productCount} Products
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-slate-900 text-base truncate">{collection.name}</h3>
                    {!collection.isActive && (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-2 mb-4 leading-relaxed">
                    {collection.description}
                  </p>

                  {/* Actions (Always 100% visible) */}
                  <div className="flex gap-2 border-t border-slate-200 pt-3">
                    <button
                      onClick={() => toggleActive(collection.id)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${collection.isActive
                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                        : 'text-slate-900 bg-slate-200 hover:bg-slate-300 border border-slate-300'
                        }`}
                      title={collection.isActive ? 'Deactivate Collection' : 'Activate Collection'}
                    >
                      {collection.isActive ? <><FiEye size={13} /> Active</> : <><FiEyeOff size={13} /> Activate</>}
                    </button>
                    <button
                      onClick={() => openEditForm(collection)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-slate-700 bg-slate-100 hover:bg-slate-900 hover:text-white border border-slate-200 transition"
                      title="Edit Collection"
                    >
                      <FiEdit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(collection)}
                      className="py-2 px-3 rounded-lg text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 transition"
                      title="Delete Collection"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}


      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Collection"
        message="Are you sure you want to delete this collection? All products linked to this collection will be unlinked."
        itemName={deleteTarget?.name}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
