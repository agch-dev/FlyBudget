import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
  isUpdating?: boolean;
}

export default function SaveReportModal({ isOpen, onClose, onSave, initialName = '', isUpdating }: Props) {
  const [name, setName] = useState(initialName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isUpdating ? 'Update Report' : 'Save Report'} size="sm">
      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-text-secondary mb-1">Report Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Monthly Spending by Payee"
          autoFocus
          className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface text-text focus:border-brand-600 focus:ring-1 focus:ring-brand-600 focus:outline-none"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>
            {isUpdating ? 'Update' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
