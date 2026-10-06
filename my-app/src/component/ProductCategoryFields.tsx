import { useProducts } from '../context/ProductContext';
type Node = { id: number; name: string; slug: string; children: Node[] };
export default function ProductCategoryFields({ category, subCategory, productType = '', fit = '', occasion = '', onChange }: {
    category: string; subCategory: string; productType?: string; fit?: string; occasion?: string;
    onChange: (category: string, subCategory: string, productType: string, fit: string, occasion: string) => void;
}) {
    const { catalogTree, catalogLoading, catalogError, refreshCatalog, fits, occasions } = useProducts();
    const tree = catalogTree as Node[];
    const parent = tree.find(p => p.name === category), child = parent?.children.find(s => s.name === subCategory);
    const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100';
    return <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <legend className="px-2 text-sm font-bold">Men’s catalog placement</legend>
        {catalogError && <p role="alert" className="text-xs text-red-700">{catalogError}
             <button type="button" onClick={refreshCatalog} className="underline">Retry</button>
             </p>}
        {catalogLoading && <p role="status" className="text-xs text-slate-500">Loading category options…</p>}
        <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">1. Parent category / Navbar section *
                <select required disabled={!tree.length} value={category} onChange={e => onChange(e.target.value, '', '', fit, occasion)} className={inputClass}><option value="">Select parent category</option>{category && !parent && <option disabled value={category}>{category} — select a current category</option>}{tree.map(p => <option key={p.id}>{p.name}</option>)}</select></label>
            <label className="text-xs font-semibold">2. Sub-category *
                <select required disabled={!parent} value={subCategory} onChange={e => onChange(category, e.target.value, '', fit, occasion)} className={inputClass}><option value="">Select sub-category</option>{subCategory && !child && <option disabled value={subCategory}>{subCategory} — select a current option</option>}{parent?.children.map(s => <option key={s.id}>{s.name}</option>)}</select></label>
            {child && child.children && child.children.length > 0 && (
                <label className="text-xs font-semibold sm:col-span-2">3. Product type
                    <select value={productType} onChange={e => onChange(category, subCategory, e.target.value, fit, occasion)} className={inputClass}>
                        <option value="">Select product type (optional)</option>
                        {child.children.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                </label>
            )}
            <label className="text-xs font-semibold">Fit
                <select value={fit} onChange={e => onChange(category, subCategory, productType, e.target.value, occasion)} className={inputClass}><option value="">Not applicable / not specified</option>{fits.map((v: string) => <option key={v}>{v}</option>)}</select></label>
            <label className="text-xs font-semibold">Occasion
                <select value={occasion} onChange={e => onChange(category, subCategory, productType, fit, e.target.value)} className={inputClass}><option value="">Not specified</option>{occasions.map((v: string) => <option key={v}>{v}</option>)}</select></label>
        </div>
        {child && <p className="text-xs font-semibold text-emerald-800" role="status">Appears in: {category} → {subCategory}{productType && ` → ${productType}`}</p>}
    </fieldset>;
}
