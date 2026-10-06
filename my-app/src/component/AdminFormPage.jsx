import { useEffect, useRef } from 'react';
import { FiArrowLeft } from 'react-icons/fi';

export default function AdminFormPage({ backLabel, onBack, children }) {
  const pageRef = useRef(null);

  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: 'start' });
    pageRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section ref={pageRef} tabIndex={-1} aria-label={backLabel.replace('Back to ', '') + ' editor'} className="admin-form-page w-full min-w-0 min-h-[calc(100vh-10rem)] bg-white p-4 text-slate-900 outline-none sm:p-6">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4">
        <FiArrowLeft aria-hidden="true" /> {backLabel}
      </button>
      {children}
    </section>
  );
}
