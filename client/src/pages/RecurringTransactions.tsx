import { useState } from 'react';
import { Plus, CalendarRange, ListChecks, Layers } from 'lucide-react';
import MonthlyTab from '../components/recurring/MonthlyTab';
import UpcomingTab from '../components/recurring/UpcomingTab';
import AllTab from '../components/recurring/AllTab';
import RecurringFormModal from '../components/recurring/RecurringFormModal';
import { Button } from '../components/ui/Button';
import { useRecurringTransactions, useCreateRecurring, useUpdateRecurring } from '../hooks/useRecurringTransactions';
import type { RecurringTransaction } from '../types';

const tabs = [
  { id: 'monthly' as const, label: 'Monthly', icon: CalendarRange },
  { id: 'upcoming' as const, label: 'Upcoming', icon: ListChecks },
  { id: 'all' as const, label: 'All', icon: Layers },
];

type TabId = (typeof tabs)[number]['id'];

export default function RecurringTransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('monthly');
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringTransaction | null>(null);

  const { data: allRecurring = [] } = useRecurringTransactions();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();

  function handleEdit(item: RecurringTransaction) {
    setEditItem(item);
    setFormOpen(true);
  }

  function handleSave(data: any) {
    if (editItem) {
      updateRecurring.mutate({ id: editItem.id, ...data }, {
        onSuccess: () => { setFormOpen(false); setEditItem(null); },
      });
    } else {
      createRecurring.mutate(data, {
        onSuccess: () => { setFormOpen(false); },
      });
    }
  }

  function handleClose() {
    setFormOpen(false);
    setEditItem(null);
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text">Recurring</h1>
            <p className="text-xs text-text-tertiary mt-0.5">Track bills, subscriptions, and recurring income</p>
          </div>
          <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true); }}>
            <Plus size={13} /> Add Recurring
          </Button>
        </div>

        <div className="flex gap-0 mt-3 border-b border-border-light -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'monthly' && <MonthlyTab onEdit={handleEdit} allRecurring={allRecurring} />}
        {activeTab === 'upcoming' && <UpcomingTab onEdit={handleEdit} allRecurring={allRecurring} />}
        {activeTab === 'all' && <AllTab allRecurring={allRecurring} onEdit={handleEdit} />}
      </div>

      <RecurringFormModal
        isOpen={formOpen}
        onClose={handleClose}
        onSave={handleSave}
        editItem={editItem}
      />
    </div>
  );
}
