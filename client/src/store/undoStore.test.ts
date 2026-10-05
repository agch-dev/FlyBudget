import { describe, expect, it } from 'vitest';
import { setLanguage, t } from '../i18n';
import { useUndoStore } from './undoStore';

describe('the undo toast', () => {
  it('names what was undone in the language shown now, not the one of the change', async () => {
    useUndoStore.getState().push({
      description: () => t('undo.action.createRule'),
      undo: async () => {},
      redo: async () => {},
    });
    await useUndoStore.getState().undo();
    expect(useUndoStore.getState().toastMessage?.()).toBe('Create rule');

    setLanguage('es');
    expect(useUndoStore.getState().toastMessage?.()).toBe('Crear regla');

    await useUndoStore.getState().redo();
    expect(useUndoStore.getState().toastMessage?.()).toBe('Crear regla');
  });
});
