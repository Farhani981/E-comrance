import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProductAttributeFields({ value, onChange }) {
  const { user } = useAuth();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/attributes', { headers: { Authorization: `Bearer ${user.token}` } });
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Attributes API unavailable. Restart the backend and retry.');
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load attributes.');
        if (!cancelled) { setAttributes(data.attributes); setError(''); }
      } catch (err) { if (!cancelled) setError(err.message); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user.token, attempt]);

  function toggle(attribute, option) {
    const current = value.find(item => item.id === attribute.id);
    const selected = current?.values || [];
    const next = selected.some(item => item.label === option.label)
      ? selected.filter(item => item.label !== option.label) : [...selected, option];
    onChange([...value.filter(item => item.id !== attribute.id), ...(next.length ? [{ ...attribute, values: next }] : [])]);
  }
  const unavailable = value.filter(selected => !attributes.some(attribute => attribute.id === selected.id && selected.values.every(option => attribute.values.some(item => item.label === option.label))));
  return <section className="space-y-4 rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Product attributes</h2><Link to="/admin/attributes" target="_blank" rel="noreferrer" className="text-xs font-semibold underline">Manage attributes (new tab)</Link></div>
    <p className="text-xs text-slate-500">Select the values available for this product. You can choose multiple colors, sizes, or other options.</p>
    {loading && <p role="status">Loading attributes...</p>}
    {error && <p role="alert" className="text-red-600">{error} Existing selections are kept.</p>}
    <button type="button" onClick={() => { setLoading(true); setAttempt(previous => previous + 1); }} className="text-xs font-semibold underline">Reload attributes</button>
    {!loading && !error && !attributes.length && <p className="text-slate-500">No attributes yet. Create Color or Size using Manage attributes, then reload this list.</p>}
    {!loading && !error && unavailable.map(item => <div key={item.id} className="rounded-lg bg-amber-50 p-3"><p>Some saved values for {item.name} are no longer available. Remove this selection and choose the current values before saving.</p><button type="button" className="mt-2 underline" onClick={() => onChange(value.filter(selected => selected.id !== item.id))}>Remove {item.name} selection</button></div>)}
    {attributes.map(attribute => <fieldset key={attribute.id} className="space-y-2"><legend className="mb-2 font-semibold">{attribute.name}</legend><div className="flex flex-wrap gap-2">{attribute.values.map(option => {
      const checked = !!value.find(item => item.id === attribute.id)?.values.some(item => item.label === option.label);
      return <label key={option.label} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${checked ? 'border-slate-900 bg-slate-100' : 'border-slate-200'}`}><input type="checkbox" checked={checked} onChange={() => toggle(attribute, option)} />{attribute.type === 'color' && <span className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: option.color }} />}{option.label}</label>;
    })}</div></fieldset>)}
  </section>;
}
