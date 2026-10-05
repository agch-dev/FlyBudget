import { create } from 'zustand';

export interface UndoCommand {
  /** What the change was, looked up whenever the toast shows it (so it follows the App Language) */
  description: () => string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MAX_STACK = 50;

interface UndoState {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  toastMessage: (() => string) | null;
  toastAction: 'undo' | 'redo' | null;
}

interface UndoActions {
  push: (cmd: UndoCommand) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearToast: () => void;
}

export const useUndoStore = create<UndoState & UndoActions>((set, get) => ({
  undoStack: [],
  redoStack: [],
  toastMessage: null,
  toastAction: null,

  push(cmd) {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_STACK - 1)), cmd],
      redoStack: [],
    }));
  },

  async undo() {
    const { undoStack, redoStack } = get();
    const cmd = undoStack[undoStack.length - 1];
    if (!cmd) return;
    set({ undoStack: undoStack.slice(0, -1) });
    try {
      await cmd.undo();
      set({
        redoStack: [...redoStack, cmd],
        toastMessage: cmd.description,
        toastAction: 'undo',
      });
    } catch {
      set((s) => ({ undoStack: [...s.undoStack, cmd] }));
    }
  },

  async redo() {
    const { undoStack, redoStack } = get();
    const cmd = redoStack[redoStack.length - 1];
    if (!cmd) return;
    set({ redoStack: redoStack.slice(0, -1) });
    try {
      await cmd.redo();
      set({
        undoStack: [...undoStack, cmd],
        toastMessage: cmd.description,
        toastAction: 'redo',
      });
    } catch {
      set((s) => ({ redoStack: [...s.redoStack, cmd] }));
    }
  },

  clearToast() {
    set({ toastMessage: null, toastAction: null });
  },
}));
