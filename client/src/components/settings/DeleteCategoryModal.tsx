import { useState } from 'react';
import { Modal } from '../ui/Modal';
import type { CategoryGroup } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reassignTo: string) => void;
  categoryName: string;
  categoryId: string;
  transactionCount: number;
  groups: CategoryGroup[];
}

export function DeleteCategoryModal({ isOpen, onClose, onConfirm, categoryName, categoryId, transactionCount, groups }: Props) {
  const [reassignTo, setReassignTo] = useState('');

  const otherCategories = groups.flatMap((g) =>
    g.categories.filter((c) => c.id !== categoryId).map((c) => ({ ...c, groupName: g.name }))
  );

  function handleConfirm() {
    if (!reassignTo) return;
    onConfirm(reassignTo);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Category" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{categoryName}</span> has{' '}
          <span className="font-medium text-gray-900">{transactionCount}</span> transaction{transactionCount !== 1 ? 's' : ''}.
          Choose a category to reassign them to before deleting.
        </p>
        <p className="text-xs text-amber-600">Budget allocations for this category will be removed.</p>
        <select
          value={reassignTo}
          onChange={(e) => setReassignTo(e.target.value)}
          className="block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a category...</option>
          {groups.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {g.categories
                .filter((c) => c.id !== categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!reassignTo}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
        >
          Reassign & Delete
        </button>
      </div>
    </Modal>
  );
}
