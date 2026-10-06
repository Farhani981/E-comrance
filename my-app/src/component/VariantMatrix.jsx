import { useState } from 'react';
import { variantCombinations, variantKey, generateVariantRows } from '../../../shared/variants';
import ImageUploadInput from './ImageUploadInput';

export default function VariantMatrix({ attributes, rows, onChange, defaults, reservedSkus = [] }) {
  const [error, setError] = useState('');
  function generate() {
    try {
      const combinations = variantCombinations(attributes);
      const keys = new Set(combinations.map(variantKey));
      if (rows.some(row => !keys.has(variantKey(row.options))) && !window.confirm('Removed combinations will be deactivated when you save. Continue?')) return;
      onChange(generateVariantRows(attributes, rows, defaults, reservedSkus));
      setError('');
    } catch (err) { setError(err.message); }
  }
  function update(index, field, value) {
    onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  return <section className="space-y-4 rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Variants ({rows.length})</h2><button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-white" onClick={generate}>{rows.length ? 'Update combinations' : 'Generate variants'}</button></div>
    <p className="text-xs text-slate-500">Set a regular price and stock for each option. Sale price is optional. New variants use the cover image.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {!rows.length && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><p className="font-semibold text-slate-700">Your variants will appear here</p><p className="mt-2 text-xs text-slate-500">Choose the options above, then click Generate variants.</p></div>}
    {!!rows.length && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Combination', 'Image', 'SKU', 'Price (PKR)', 'Sale (PKR)', 'Stock', 'Enabled'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>
      {rows.map((row, index) => {
        const title = row.options.map(option => option.label).join(' / ') || 'Default';
        return <tr key={variantKey(row.options)} className="border-t border-slate-200 align-top"><td className="p-2 font-semibold">{title}</td><td className="p-2"><details className="min-w-24"><summary className="cursor-pointer text-xs text-slate-600">{row.imageUrl ? <img src={row.imageUrl} alt={title} className="mb-1 h-12 w-12 rounded-lg border border-slate-200 object-cover" /> : null}Edit image</summary><div className="mt-2 w-52"><ImageUploadInput label={`${title} image`} value={row.imageUrl} onChange={value => update(index, 'imageUrl', value)} /></div></details></td>
          {['sku', 'price', 'salePrice', 'stockQuantity'].map(field => <td className="p-2" key={field}><input aria-label={`${title} ${field}`} className="w-28 rounded-lg border border-slate-200 p-2" type={field === 'sku' ? 'text' : 'number'} min="0" step={field === 'stockQuantity' ? '1' : '0.01'} value={row[field] ?? ''} onChange={event => update(index, field, event.target.value)} required={field !== 'salePrice'} /></td>)}
          <td className="p-2"><input aria-label={`Enable ${title}`} type="checkbox" checked={row.isActive !== false} onChange={event => update(index, 'isActive', event.target.checked)} /></td></tr>;
      })}
    </tbody></table></div>}
  </section>;
}
