import { useState, useMemo } from 'react';
import { Trash2, GitMerge, Search } from 'lucide-react';
import { usePayees, useUpdatePayee, useDeletePayee, useMergePayees } from '../hooks/usePayees';
import { useCategories } from '../hooks/useCategories';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import type { PayeeWithCount } from '../types';

function MergeModal({
  selected,
  payees,
  onMerge,
  onClose,
}: {
  selected: string[];
  payees: PayeeWithCount[];
  onMerge: (keepId: string, mergeIds: string[]) => void;
  onClose: () => void;
}) {
  const [keepId, setKeepId] = useState(selected[0]);
  const selectedPayees = payees.filter(p => selected.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Merge Payees</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">Choose which payee name to keep. All transactions will be moved to the selected payee.</p>
          <div className="space-y-2">
            {selectedPayees.map(p => (
              <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${keepId === p.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="keepId" value={p.id} checked={keepId === p.id} onChange={() => setKeepId(p.id)} className="accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.transactionCount} transaction{p.transactionCount !== 1 ? 's' : ''}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { onMerge(keepId, selected.filter(id => id !== keepId)); onClose(); }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Merge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PayeesPage() {
  const { data: payees = [], isLoading } = usePayees();
  const { data: groups = [] } = useCategories();
  const updatePayee = useUpdatePayee();
  const deletePayee = useDeletePayee();
  const mergePayees = useMergePayees();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);

  const allCategories = useMemo(
    () => (groups as any[]).flatMap((g: any) => g.categories.map((c: any) => ({ ...c, groupName: g.name }))),
    [groups],
  );

  const filtered = useMemo(
    () => payees.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [payees, search],
  );

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEditName(p: PayeeWithCount) {
    setEditingId(p.id);
    setEditingName(p.name);
  }

  function commitEditName(id: string) {
    if (editingName.trim()) updatePayee.mutate({ id, name: editingName.trim() });
    setEditingId(null);
  }

  function handleCategoryChange(id: string, categoryId: string) {
    updatePayee.mutate({ id, defaultCategoryId: categoryId || null });
  }

  function handleMerge(keepId: string, mergeIds: string[]) {
    mergePayees.mutate({ keepId, mergeIds }, { onSuccess: () => setSelected(new Set()) });
  }

  const deleteTarget = payees.find(p => p.id === deleteId);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-b from-white to-slate-50/50 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-800">Payees</h1>
          <div className="flex items-center gap-2">
            {selected.size >= 2 && (
              <button
                onClick={() => setShowMerge(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <GitMerge size={13} />
                Merge {selected.size} payees
              </button>
            )}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search payees…"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            {search ? 'No payees match your search.' : 'No payees yet. They\'re created automatically from transactions.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(filtered.map(p => p.id)) : new Set())}
                    className="accent-blue-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Default Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Transactions</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className={`group hover:bg-gray-50 transition-colors ${selected.has(p.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-blue-600" />
                  </td>
                  <td className="px-4 py-3">
                    {editingId === p.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => commitEditName(p.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEditName(p.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full max-w-xs"
                      />
                    ) : (
                      <span
                        className="text-sm font-medium text-gray-900 cursor-text hover:text-blue-700 transition-colors"
                        onDoubleClick={() => startEditName(p)}
                        title="Double-click to rename"
                      >
                        {p.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.defaultCategoryId ?? ''}
                      onChange={e => handleCategoryChange(p.id, e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[220px]"
                    >
                      <option value="">No default</option>
                      {allCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.groupName} → {c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">{p.transactionCount}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Merge modal */}
      {showMerge && (
        <MergeModal
          selected={[...selected]}
          payees={payees}
          onMerge={handleMerge}
          onClose={() => setShowMerge(false)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deletePayee.mutate(deleteId); }}
        title="Delete Payee"
        message={`Delete "${deleteTarget?.name}"? This will remove the payee from all their transactions.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
