import { useState, useEffect, useRef } from 'react';
import { GripVertical, Pencil, Trash2, Plus, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useCategories,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useReorderGroups,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategories,
} from '../../hooks/useCategories';
import { getCategoryTransactionCount } from '../../api/categories';
import { ConfirmModal } from '../ui/ConfirmModal';
import { DeleteCategoryModal } from './DeleteCategoryModal';
import type { Category, CategoryGroup } from '../../types';

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => { inputRef.current?.select(); }, []);

  return (
    <input
      ref={inputRef}
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && text.trim()) { (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { cancelled.current = true; onCancel(); }
      }}
      onBlur={() => { if (!cancelled.current && text.trim()) onSave(text.trim()); else if (!cancelled.current) onCancel(); }}
      className="text-sm bg-surface border border-brand-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-600 w-48"
    />
  );
}

function SortableCategoryRow({
  cat,
  onRename,
  onDelete,
}: {
  cat: Category;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-light rounded-md group hover:border-border transition-all ml-6"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-text-disabled hover:text-text-tertiary cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <span className="text-sm text-text-secondary flex-1 min-w-0 truncate">{cat.name}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onRename(cat.id)} className="p-1 text-text-tertiary hover:text-brand-600 rounded hover:bg-brand-50 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(cat.id)} className="p-1 text-text-tertiary hover:text-negative rounded hover:bg-negative-subtle transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function SortableGroup({
  group,
  editingId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteGroup,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
}: {
  group: CategoryGroup;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onSaveEdit: (id: string, name: string) => void;
  onCancelEdit: () => void;
  onDeleteGroup: (id: string) => void;
  onAddCategory: (groupId: string) => void;
  onRenameCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories: (groupId: string, ids: string[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const [localCats, setLocalCats] = useState(group.categories);

  useEffect(() => { setLocalCats(group.categories); }, [group.categories]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleCatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localCats.findIndex((c) => c.id === active.id);
    const newIndex = localCats.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(localCats, oldIndex, newIndex);
    setLocalCats(reordered);
    onReorderCategories(group.id, reordered.map((c) => c.id));
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isEditingGroup = editingId === group.id;

  return (
    <div ref={setNodeRef} style={style} className="space-y-1.5">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-alt rounded-md group hover:bg-hover transition-colors">
        <button
          {...attributes}
          {...listeners}
          className="text-text-disabled hover:text-text-tertiary cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <button onClick={() => setCollapsed((c) => !c)} className="text-text-tertiary shrink-0">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          {isEditingGroup ? (
            <InlineEdit
              value={group.name}
              onSave={(name) => onSaveEdit(group.id, name)}
              onCancel={onCancelEdit}
            />
          ) : (
            <span className="text-xs font-medium text-text-tertiary">{group.name}</span>
          )}
        </div>
        {group.isIncome === 1 && (
          <span className="text-[10px] font-medium text-positive bg-positive-subtle px-1.5 py-0.5 rounded shrink-0">Income</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onAddCategory(group.id)} className="p-1 text-text-tertiary hover:text-brand-600 rounded hover:bg-brand-50 transition-colors" title="Add category">
            <Plus size={14} />
          </button>
          <button onClick={() => onStartEdit(group.id)} className="p-1 text-text-tertiary hover:text-brand-600 rounded hover:bg-brand-50 transition-colors" title="Rename group">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDeleteGroup(group.id)} className="p-1 text-text-tertiary hover:text-negative rounded hover:bg-negative-subtle transition-colors" title="Delete group">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
          <SortableContext items={localCats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {localCats.map((cat) =>
                editingId === cat.id ? (
                  <div key={cat.id} className="ml-6 px-3 py-2">
                    <InlineEdit
                      value={cat.name}
                      onSave={(name) => onSaveEdit(cat.id, name)}
                      onCancel={onCancelEdit}
                    />
                  </div>
                ) : (
                  <SortableCategoryRow
                    key={cat.id}
                    cat={cat}
                    onRename={onRenameCategory}
                    onDelete={onDeleteCategory}
                  />
                )
              )}
              {localCats.length === 0 && (
                <p className="ml-6 text-xs text-text-tertiary py-2 px-3">No categories yet.</p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export function CategoryManager() {
  const { data: groups = [], isLoading } = useCategories();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const reorderGroups = useReorderGroups();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategoryMut = useDeleteCategory();
  const reorderCategories = useReorderCategories();

  const [localGroups, setLocalGroups] = useState<CategoryGroup[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingGroupName, setAddingGroupName] = useState<string | null>(null);
  const [addingCategoryGroupId, setAddingCategoryGroupId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newGroupIsIncome, setNewGroupIsIncome] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleteCatState, setDeleteCatState] = useState<{ id: string; name: string; count: number } | null>(null);

  useEffect(() => { setLocalGroups(groups); }, [groups]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localGroups.findIndex((g) => g.id === active.id);
    const newIndex = localGroups.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(localGroups, oldIndex, newIndex);
    setLocalGroups(reordered);
    reorderGroups.mutate(reordered.map((g) => g.id));
  }

  function handleSaveEdit(id: string, name: string) {
    setEditingId(null);
    const isGroup = localGroups.some((g) => g.id === id);
    if (isGroup) {
      updateGroup.mutate({ id, data: { name } });
    } else {
      updateCategory.mutate({ id, data: { name } });
    }
  }

  function handleAddGroup() {
    if (!addingGroupName?.trim()) return;
    createGroup.mutate({ name: addingGroupName.trim(), isIncome: newGroupIsIncome ? 1 : 0 });
    setAddingGroupName(null);
    setNewGroupIsIncome(false);
  }

  function handleAddCategory() {
    if (!addingCategoryGroupId || !newCategoryName.trim()) return;
    createCategory.mutate({ groupId: addingCategoryGroupId, name: newCategoryName.trim() });
    setNewCategoryName('');
    setAddingCategoryGroupId(null);
  }

  async function handleDeleteCategoryClick(id: string) {
    const cat = localGroups.flatMap((g) => g.categories).find((c) => c.id === id);
    if (!cat) return;
    const { count } = await getCategoryTransactionCount(id);
    if (count > 0) {
      setDeleteCatState({ id, name: cat.name, count });
    } else {
      setDeleteCatState({ id, name: cat.name, count: 0 });
    }
  }

  function handleConfirmDeleteCategory(reassignTo?: string) {
    if (!deleteCatState) return;
    deleteCategoryMut.mutate({ id: deleteCatState.id, reassignTo });
    setDeleteCatState(null);
  }

  const deleteGroupTarget = localGroups.find((g) => g.id === deleteGroupId);

  if (isLoading) {
    return <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Category Groups & Categories</h2>
          <p className="text-xs text-text-tertiary mt-0.5">Drag to reorder. Click the pencil to rename.</p>
        </div>
        <button
          onClick={() => setAddingGroupName('')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors"
        >
          <Plus size={13} /> Add Group
        </button>
      </div>

      {addingGroupName !== null && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-md border border-brand-100">
          <input
            autoFocus
            value={addingGroupName}
            onChange={(e) => setAddingGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddGroup();
              if (e.key === 'Escape') setAddingGroupName(null);
            }}
            placeholder="Group name..."
            className="text-sm border border-border rounded px-2.5 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 flex-1"
          />
          <label className="flex items-center gap-1.5 text-xs text-text-secondary shrink-0">
            <input type="checkbox" checked={newGroupIsIncome} onChange={(e) => setNewGroupIsIncome(e.target.checked)} className="rounded" />
            Income group
          </label>
          <button onClick={handleAddGroup} disabled={!addingGroupName.trim()} className="p-1.5 text-positive hover:bg-positive-subtle rounded disabled:opacity-40 transition-colors">
            <Check size={16} />
          </button>
          <button onClick={() => setAddingGroupName(null)} className="p-1.5 text-text-tertiary hover:bg-hover rounded transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {addingCategoryGroupId !== null && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-md border border-brand-100 ml-6">
          <input
            autoFocus
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCategory();
              if (e.key === 'Escape') { setAddingCategoryGroupId(null); setNewCategoryName(''); }
            }}
            placeholder="Category name..."
            className="text-sm border border-border rounded px-2.5 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 flex-1"
          />
          <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="p-1.5 text-positive hover:bg-positive-subtle rounded disabled:opacity-40 transition-colors">
            <Check size={16} />
          </button>
          <button onClick={() => { setAddingCategoryGroupId(null); setNewCategoryName(''); }} className="p-1.5 text-text-tertiary hover:bg-hover rounded transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
        <SortableContext items={localGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {localGroups.map((group) => (
              <SortableGroup
                key={group.id}
                group={group}
                editingId={editingId}
                onStartEdit={setEditingId}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onDeleteGroup={(id) => setDeleteGroupId(id)}
                onAddCategory={(groupId) => setAddingCategoryGroupId(groupId)}
                onRenameCategory={setEditingId}
                onDeleteCategory={handleDeleteCategoryClick}
                onReorderCategories={(_groupId, ids) => reorderCategories.mutate(ids)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {localGroups.length === 0 && !addingGroupName && (
        <div className="flex flex-col items-center justify-center h-32 gap-3">
          <p className="text-sm text-text-tertiary">No category groups yet.</p>
          <button
            onClick={() => setAddingGroupName('')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-md hover:bg-brand-50 transition-colors"
          >
            <Plus size={13} /> Create your first group
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteGroupId !== null}
        onClose={() => setDeleteGroupId(null)}
        onConfirm={() => { if (deleteGroupId) deleteGroup.mutate(deleteGroupId); }}
        title="Delete Group"
        message={`Delete "${deleteGroupTarget?.name ?? ''}" and all its categories? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {deleteCatState && deleteCatState.count > 0 && (
        <DeleteCategoryModal
          isOpen
          onClose={() => setDeleteCatState(null)}
          onConfirm={(reassignTo) => handleConfirmDeleteCategory(reassignTo)}
          categoryName={deleteCatState.name}
          categoryId={deleteCatState.id}
          transactionCount={deleteCatState.count}
          groups={groups}
        />
      )}

      <ConfirmModal
        isOpen={deleteCatState !== null && deleteCatState.count === 0}
        onClose={() => setDeleteCatState(null)}
        onConfirm={() => handleConfirmDeleteCategory()}
        title="Delete Category"
        message={`Delete "${deleteCatState?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
