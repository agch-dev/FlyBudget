import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2, Redo2, X } from 'lucide-react';
import { useUndoStore } from '../../store/undoStore';

export function UndoToast() {
  const { t } = useTranslation();
  const message = useUndoStore((s) => s.toastMessage);
  const action = useUndoStore((s) => s.toastAction);
  const clearToast = useUndoStore((s) => s.clearToast);
  const undo = useUndoStore((s) => s.undo);
  const redo = useUndoStore((s) => s.redo);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(clearToast, 4000);
    return () => clearTimeout(timer);
  }, [message, clearToast]);

  if (!message) return null;

  const isUndo = action === 'undo';
  const text = { message: message() };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-text text-surface rounded-lg shadow-lg px-4 py-2.5 text-sm">
      {isUndo ? <Undo2 size={14} /> : <Redo2 size={14} />}
      <span>{isUndo ? t('undo.undid', text) : t('undo.redid', text)}</span>
      <button
        onClick={() => {
          clearToast();
          isUndo ? redo() : undo();
        }}
        className="ml-1 font-medium text-brand-300 hover:text-brand-200 transition-colors"
      >
        {isUndo ? t('undo.redo') : t('undo.undo')}
      </button>
      <button
        onClick={clearToast}
        aria-label={t('undo.dismiss')}
        className="ml-1 text-surface/60 hover:text-surface transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
