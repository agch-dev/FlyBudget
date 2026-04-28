import { useState, useRef, useEffect } from 'react';
import type { Payee } from '../../types';

interface PayeeValue {
  id: string | null;
  name: string;
}

interface Props {
  value: PayeeValue;
  onChange: (v: PayeeValue) => void;
  payees: Payee[];
  className?: string;
}

export function PayeeCombobox({ value, onChange, payees, className = '' }: Props) {
  const [query, setQuery] = useState(value.name);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value.name); }, [value.name]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = query
    ? payees.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : payees.slice(0, 8);

  const exactMatch = payees.find((p) => p.name.toLowerCase() === query.toLowerCase());

  function select(payee: Payee) {
    setQuery(payee.name);
    onChange({ id: payee.id, name: payee.name });
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setQuery(name);
    onChange({ id: null, name });
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder="Payee"
        className={`block w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none ${className}`}
      />
      {open && (filtered.length > 0 || (query && !exactMatch)) && (
        <div className="absolute z-30 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
              className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {p.name}
            </button>
          ))}
          {query && !exactMatch && (
            <div className="px-3 py-1.5 text-xs text-gray-400 border-t border-gray-100">
              New payee: "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
