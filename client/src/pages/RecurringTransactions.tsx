import { useState } from 'react';
import { Plus, CalendarRange, ListChecks, Layers } from 'lucide-react';
import MonthlyTab from '../components/recurring/MonthlyTab';
import UpcomingTab from '../components/recurring/UpcomingTab';
import AllTab from '../components/recurring/AllTab';
import RecurringFormModal from '../components/recurring/RecurringFormModal';
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
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-b from-white to-slate-50/50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Recurring</h1>
            <p className="text-xs text-gray-400 mt-0.5">Track bills, subscriptions, and recurring income</p>
          </div>
          <button
            onClick={() => { setEditItem(null); setFormOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
          >
            <Plus size={13} />
            Add Recurring
          </button>
        </div>

        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
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
