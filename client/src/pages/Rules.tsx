import { useState, useEffect } from 'react';
import { GripVertical, Pencil, Trash2, Plus, Play } from 'lucide-react';
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
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useReorderRules, useRunRules } from '../hooks/useRules';
import { useCategories } from '../hooks/useCategories';
import { usePayees } from '../hooks/usePayees';
import { previewRules } from '../api/rules';
import { formatCurrency } from '../utils/currency';
import { format, parseISO } from 'date-fns';
import { AddRuleModal } from '../components/rules/AddRuleModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import type { Rule, RuleCondition, RuleAction, RunRulesPreviewItem } from '../types';

// --- Summary helpers ---
function conditionSummary(conditions: RuleCondition[]): string {
  if (!conditions.length) return 'No conditions';
  const c = conditions[0];
  const fieldLabel = c.field === 'payee_name' ? 'Payee' : c.field === 'amount' ? 'Amount' : 'Notes';
  const opLabel = c.op.replace('_', ' ');
  const summary = `${fieldLabel} ${opLabel} "${c.value}"`;
  return conditions.length > 1 ? `${summary} +${conditions.length - 1} more` : summary;
}

function actionSummary(actions: RuleAction[], categories: any[], payees: any[]): string {
  if (!actions.length) return 'No actions';
  const a = actions[0];
  let val = a.value;
  if (a.field === 'category_id') {
    val = categories.find((c: any) => c.id === a.value)?.name ?? a.value;
  } else if (a.field === 'payee_id') {
    val = payees.find((p: any) => p.id === a.value)?.name ?? a.value;
  }
  const label = a.field === 'category_id' ? 'Category' : a.field === 'payee_id' ? 'Payee' : 'Notes';
  const summary = `Set ${label} → ${val}`;
  return actions.length > 1 ? `${summary} +${actions.length - 1} more` : summary;
}

// --- Run Rules Preview Modal ---
function RunRulesPreviewModal({
  items,
  onConfirm,
  onClose,
  running,
}: {
  items: RunRulesPreviewItem[];
  onConfirm: () => void;
  onClose: () => void;
  running: boolean;
}) {
  const shown = items.slice(0, 10);
  const extra = items.length - shown.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Run Rules Preview</h2>
        </div>
        <div className="px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No uncategorized transactions match any rules.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-semibold text-gray-900">{items.length}</span> transaction{items.length !== 1 ? 's' : ''} will be updated:
              </p>
              <div className="rounded-lg border border-gray-100 overflow-hidden mb-3">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Payee</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">New Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {shown.map(item => (
                      <tr key={item.transactionId}>
                        <td className="px-3 py-2 text-xs text-gray-500">{format(parseISO(item.date), 'MMM d')}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 max-w-[140px] truncate">{item.payeeName ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(item.amount)}</td>
                        <td className="px-3 py-2 text-xs font-medium text-emerald-700">{item.newCategoryName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {extra > 0 && (
                  <div className="px-3 py-2 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                    + {extra} more
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          {items.length > 0 && (
            <button
              onClick={onConfirm}
              disabled={running}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {running ? 'Applying…' : `Apply ${items.length} Change${items.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sortable rule row ---
function SortableRuleRow({
  rule,
  categories,
  payees,
  onEdit,
  onDelete,
}: {
  rule: Rule;
  categories: any[];
  payees: any[];
  onEdit: (rule: Rule) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });

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
      className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-lg group hover:border-gray-200 hover:shadow-sm transition-all"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">If</p>
          <p className="text-sm text-gray-700 truncate">{conditionSummary(rule.conditions)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Then</p>
          <p className="text-sm text-gray-700 truncate">{actionSummary(rule.actions, categories, payees)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(rule)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// --- Rules page ---
export default function RulesPage() {
  const { data: rulesData = [], isLoading } = useRules();
  const { data: groups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const reorderRules = useReorderRules();
  const runRules = useRunRules();

  const [localRules, setLocalRules] = useState<Rule[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<RunRulesPreviewItem[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => { setLocalRules(rulesData); }, [rulesData]);

  const allCategories = (groups as any[]).flatMap((g: any) =>
    g.categories.map((c: any) => ({ ...c, groupName: g.name }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localRules.findIndex(r => r.id === active.id);
    const newIndex = localRules.findIndex(r => r.id === over.id);
    const reordered = arrayMove(localRules, oldIndex, newIndex);
    setLocalRules(reordered);
    reorderRules.mutate(reordered.map(r => r.id));
  }

  function handleSaveNew(conditions: RuleCondition[], actions: RuleAction[]) {
    createRule.mutate({ conditions, actions, sortOrder: localRules.length });
  }

  function handleSaveEdit(conditions: RuleCondition[], actions: RuleAction[]) {
    if (!editRule) return;
    updateRule.mutate({ id: editRule.id, conditions, actions });
    setEditRule(null);
  }

  async function handleRunRulesClick() {
    setPreviewing(true);
    try {
      const items = await previewRules();
      setPreviewItems(items);
    } finally {
      setPreviewing(false);
    }
  }

  function handleConfirmRun() {
    runRules.mutate(undefined, {
      onSuccess: () => setPreviewItems(null),
    });
  }

  const deleteTarget = localRules.find(r => r.id === deleteId);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rules</h1>
            <p className="text-xs text-gray-400 mt-0.5">Rules run automatically on new transactions and can be applied to existing ones.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunRulesClick}
              disabled={previewing || localRules.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={12} />
              {previewing ? 'Loading…' : 'Run Rules'}
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={13} />
              Add Rule
            </button>
          </div>
        </div>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div>
        ) : localRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <p className="text-sm text-gray-400">No rules yet. Add one to start auto-categorizing transactions.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus size={13} /> Add your first rule
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localRules.map(r => r.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {localRules.map(rule => (
                  <SortableRuleRow
                    key={rule.id}
                    rule={rule}
                    categories={allCategories}
                    payees={payees}
                    onEdit={r => { setEditRule(r); }}
                    onDelete={id => setDeleteId(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add rule modal */}
      <AddRuleModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleSaveNew}
      />

      {/* Edit rule modal */}
      {editRule && (
        <AddRuleModal
          isOpen={!!editRule}
          onClose={() => setEditRule(null)}
          onSave={handleSaveEdit}
          editRule={editRule}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteRule.mutate(deleteId); }}
        title="Delete Rule"
        message={`Delete this rule? Transactions that were already categorized by it will not be changed.`}
        confirmLabel="Delete"
        danger
      />

      {/* Run Rules preview modal */}
      {previewItems !== null && (
        <RunRulesPreviewModal
          items={previewItems}
          onConfirm={handleConfirmRun}
          onClose={() => setPreviewItems(null)}
          running={runRules.isPending}
        />
      )}
    </div>
  );
}
