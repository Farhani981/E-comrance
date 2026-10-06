import React, { useEffect, useState } from 'react';
import {
  FiTag,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiExternalLink,
  FiCheckCircle,
  FiRefreshCw
} from 'react-icons/fi';
import { useAdminAlert } from '../../context/AdminAlertContext';
import MetricGrid, { StatCard } from '../../component/MetricGrid';

interface Brand {
  id: number;
  name: string;
  logo: string;
  website: string;
  featured: boolean;
  productCount: number;
}

const DEFAULT_BRANDS: Brand[] = [
  { id: 1, name: 'Royal Tag', logo: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=200&q=80', website: 'https://royaltag.com.pk', featured: true, productCount: 24 },
  { id: 2, name: 'Cambridge', logo: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=200&q=80', website: 'https://thecambridgeshop.com', featured: true, productCount: 18 },
  { id: 3, name: 'Charcoal', logo: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200&q=80', website: 'https://charcoal.com.pk', featured: true, productCount: 32 },
  { id: 4, name: 'Outfitters Men', logo: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=200&q=80', website: 'https://outfitters.com.pk', featured: false, productCount: 15 },
  { id: 5, name: 'Uniworth Dress', logo: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=200&q=80', website: 'https://uniworthdress.com', featured: true, productCount: 12 },
];

export default function ManageBrands() {
  const { showAlert } = useAdminAlert();
  const [brands, setBrands] = useState<Brand[]>(() => {
    try {
      const saved = localStorage.getItem('shophub_admin_brands');
      return saved ? JSON.parse(saved) : DEFAULT_BRANDS;
    } catch {
      return DEFAULT_BRANDS;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    website: '',
    featured: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    let updated: Brand[];
    if (editingBrand) {
      updated = brands.map(b => b.id === editingBrand.id ? { ...b, ...formData } : b);
      showAlert(`Brand "${formData.name}" updated successfully.`, 'success', 'Updated');
    } else {
      updated = [...brands, { ...formData, id: Date.now(), productCount: 0 }];
      showAlert(`Brand "${formData.name}" added to catalog.`, 'success', 'Added');
    }

    setBrands(updated);
    localStorage.setItem('shophub_admin_brands', JSON.stringify(updated));
    setIsModalOpen(false);
    setEditingBrand(null);
    setFormData({ name: '', logo: '', website: '', featured: true });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this brand?')) return;
    const updated = brands.filter(b => b.id !== id);
    setBrands(updated);
    localStorage.setItem('shophub_admin_brands', JSON.stringify(updated));
    showAlert('Brand removed.', 'success', 'Deleted');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FiTag className="text-amber-500" /> Brands Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage partner fashion labels, brand logos, and storefront brand carousel associations.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBrand(null);
            setFormData({ name: '', logo: '', website: '', featured: true });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition shadow-sm self-start"
        >
          <FiPlus /> Add New Brand
        </button>
      </div>

      {/* Metrics */}
      <MetricGrid cols={3}>
        <StatCard
          label="Total Catalog Brands"
          value={String(brands.length)}
          icon={<FiTag size={20} />}
          sub="Fashion labels"
          accent="blue"
        />
        <StatCard
          label="Featured in Carousel"
          value={String(brands.filter(b => b.featured).length)}
          icon={<FiCheckCircle size={20} />}
          sub="Homepage partners"
          accent="amber"
        />
        <StatCard
          label="Catalog Products Linked"
          value={String(brands.reduce((acc, b) => acc + (b.productCount || 0), 0))}
          icon={<FiTag size={20} />}
          sub="Across all brands"
          accent="emerald"
        />
      </MetricGrid>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {brands.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="h-28 w-full bg-slate-50 rounded-xl flex items-center justify-center p-3 mb-4 border border-slate-100 overflow-hidden">
                {b.logo ? (
                  <img src={b.logo} alt={b.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="font-extrabold text-slate-400 text-xl">{b.name}</span>
                )}
              </div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-extrabold text-slate-900 text-base">{b.name}</h3>
                {b.featured && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Featured
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">{b.productCount || 0} Products in catalog</p>
              {b.website && (
                <a
                  href={b.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-500 hover:text-black flex items-center gap-1 mb-4 truncate"
                >
                  <FiExternalLink size={12} /> {b.website.replace('https://', '')}
                </a>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setEditingBrand(b);
                  setFormData({ name: b.name, logo: b.logo, website: b.website, featured: b.featured });
                  setIsModalOpen(true);
                }}
                className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1"
              >
                <FiEdit2 /> Edit
              </button>
              <button
                onClick={() => handleDelete(b.id)}
                className="text-xs font-bold text-slate-400 hover:text-red-500 p-1"
                title="Delete Brand"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {editingBrand ? 'Edit Fashion Brand' : 'Add New Catalog Brand'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Tag"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Logo URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Official Website</label>
                <input
                  type="url"
                  placeholder="https://brand.com.pk"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="w-4 h-4 accent-black rounded"
                />
                Show on Homepage Logo Carousel
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-slate-800 transition"
                >
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
