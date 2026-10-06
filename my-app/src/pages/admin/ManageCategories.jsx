import AdminFormPage from '../../component/AdminFormPage';
import ManageNavigation from './ManageNavigation';
import { useState } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiSearch, FiGrid, FiEye, FiEyeOff, FiLink } from 'react-icons/fi';
import ImageUploadInput from '../../component/ImageUploadInput';
import { useProducts } from '../../context/ProductContext';
import { useAdminAlert } from '../../context/AdminAlertContext';

const FALLBACK_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=600&auto=format&fit=crop';

export default function ManageCategories() {
  const { categories, setCategories, addCategory, updateCategory, deleteCategory } = useProducts();
  const { showAlert } = useAdminAlert();

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', count: '', img: '', link: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [brokenImages, setBrokenImages] = useState({});

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id) => {
    try {
      await deleteCategory(id);
      showAlert({
        type: 'success',
        title: 'Category Deleted',
        message: 'Category successfully removed.',
      });
    } catch (err) {
      console.error('Delete failed:', err);
      showAlert({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not delete category from database.',
      });
    }
    setDeleteConfirmId(null);
  };

  const toggleVisibility = async (id) => {
    const category = categories.find(c => c.id === id);
    if (category) {
      try {
        await updateCategory(id, { isVisible: category.isVisible === false });
        showAlert({
          type: 'info',
          title: 'Visibility Updated',
          message: `Category "${category.name}" is now ${category.isVisible === false ? 'visible' : 'hidden'}.`,
        });
      } catch (err) {
        console.error('Update visibility failed:', err);
      }
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ name: '', count: '', img: '', link: '' });
    setShowForm(true);
  };

  const openEditForm = (category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name || '',
      count: category.count || '',
      img: category.img || '',
      link: category.link || '',
    });
    setShowForm(true);
  };

  // Name ke change hone par Auto Link generate
  const handleNameChange = (e) => {
    const val = e.target.value;
    const autoLink = `/shop?category=${encodeURIComponent(val)}`;
    setFormData(prev => ({
      ...prev,
      name: val,
      link: !prev.link || prev.link === `/shop?category=${encodeURIComponent(prev.name)}` ? autoLink : prev.link
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.img) {
      showAlert({
        type: 'warning',
        title: 'Fields Required',
        message: 'Name aur Image URL required hain!',
      });
      return;
    }

    // Auto Link Fallback
    const finalData = {
      ...formData,
      link: formData.link || `/shop?category=${encodeURIComponent(formData.name)}`
    };

    setIsLoading(true);

    try {
      if (editingId) {
        await updateCategory(editingId, finalData);
        showAlert({
          type: 'success',
          title: 'Category Updated',
          message: `Category "${formData.name}" successfully updated!`,
        });
      } else {
        await addCategory({ ...finalData, isVisible: true });
        showAlert({
          type: 'success',
          title: 'Category Created',
          message: `Category "${formData.name}" successfully added to database!`,
        });
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Save failed:', err);
      showAlert({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Database error while saving category.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const visibleCount = categories.filter(c => c.isVisible !== false).length;
  const hiddenCount = categories.filter(c => c.isVisible === false).length;

  if (showForm) return (
    <AdminFormPage backLabel="Back to categories" onBack={() => setShowForm(false)}>
          <div className="w-full bg-white">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h1 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Category' : 'Add New Category'}
              </h1>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder="e.g. Casual Shirts"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Count</label>
                <input
                  type="text"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  placeholder="e.g. 140+ Products"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Shop Page Target Link</label>
                <input
                  type="text"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="e.g. /shop?category=Casual-Shirts"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
              <ImageUploadInput
                label="Category Image"
                value={formData.img}
                onChange={(img) => setFormData({ ...formData, img: img })}
                required
                helperText="Upload category image from device or paste web link (Automatically compressed)"
              />
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : editingId ? 'Update Category' : 'Add Category'}
              </button>
            </div>
          </div>
    </AdminFormPage>
  );

  return (
    <div className="space-y-6">
      <ManageNavigation />
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Categories Management</h1>
          <p className="text-slate-600 mt-1">Manage the categories displayed on the homepage.</p>
        </div>
        <button
          onClick={openAddForm}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-white hover:text-blue-600 font-medium flex items-center gap-2 transition shadow-sm"
        >
          <FiPlus size={18} />
          Add New Category
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Total Categories</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{categories.length}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg text-slate-600">
              <FiGrid className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Visible on Website</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{visibleCount}</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
              <FiEye className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Hidden Categories</p>
              <p className="text-3xl font-bold text-slate-600 mt-2">{hiddenCount}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg text-slate-600">
              <FiEyeOff className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex gap-4 items-center mb-6">
          <div className="flex-1 min-w-64 relative">
            <FiSearch className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search categories by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600"
            />
          </div>
        </div>

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FiGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No categories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className={`rounded-xl border overflow-hidden transition-all group ${category.isVisible !== false
                  ? 'border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5'
                  : 'border-slate-300 bg-slate-50/90 shadow-2xs'
                  }`}
              >
                {/* Image */}
                <div className={`relative h-36 overflow-hidden transition-opacity ${category.isVisible !== false ? 'opacity-100' : 'opacity-50 grayscale-40'} ${brokenImages[category.id] ? 'bg-gradient-to-br from-slate-100 to-slate-200' : 'bg-slate-100'}`}>
                  {brokenImages[category.id] ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[11px] font-semibold">No Image</span>
                    </div>
                  ) : (
                    <img
                      src={category.img || FALLBACK_CATEGORY_IMAGE}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => setBrokenImages(prev => ({ ...prev, [category.id]: true }))}
                    />
                  )}
                  <span className={`absolute top-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs ${category.isVisible !== false ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
                    {category.isVisible !== false ? 'VISIBLE' : 'HIDDEN'}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{category.name}</h3>
                    {category.isVisible === false && (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <span>{category.count}</span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-slate-600 truncate">
                      <FiLink size={10} />
                      {category.link || `/shop?category=${category.name}`}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 border-t border-slate-200 pt-3">
                    <button
                      onClick={() => toggleVisibility(category.id)}
                      className={`flex-1 p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${category.isVisible !== false
                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                        : 'text-slate-900 bg-slate-200 hover:bg-slate-300 border border-slate-300'
                        }`}
                      title={category.isVisible !== false ? 'Hide Category' : 'Show Category'}
                    >
                      {category.isVisible !== false ? <><FiEye size={13} /> Visible</> : <><FiEyeOff size={13} /> Show</>}
                    </button>
                    <button
                      onClick={() => openEditForm(category)}
                      className="flex-1 p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-slate-700 bg-slate-100 hover:bg-slate-900 hover:text-white border border-slate-200 transition"
                      title="Edit Category"
                    >
                      <FiEdit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(category.id)}
                      className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 transition"
                      title="Delete Category"
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
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Category?</h3>
              <p className="text-slate-500 mb-6 text-sm">
                This action cannot be undone. Are you sure you want to permanently delete this category from your database?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}