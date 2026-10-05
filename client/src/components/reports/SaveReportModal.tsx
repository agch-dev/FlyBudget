import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
  isUpdating?: boolean;
}

export default function SaveReportModal({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  isUpdating,
}: Props) {
  const { t } = useTranslation('reports');
  const [name, setName] = useState(initialName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdating ? t('builder.updateTitle') : t('builder.saveTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {t('builder.reportName')}
        </label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('builder.reportNamePlaceholder')}
          aria-label={t('builder.reportNameLabel')}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('ui.cancel', { ns: 'common' })}
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {isUpdating ? t('update') : t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
