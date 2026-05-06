import { useState } from 'react';
import { Layers, ArrowUpDown, Download, SlidersHorizontal } from 'lucide-react';
import { CategoryManager } from '../components/settings/CategoryManager';
import { AccountReorder } from '../components/settings/AccountReorder';
import { DataExport } from '../components/settings/DataExport';
import { PreferencesPanel } from '../components/settings/PreferencesPanel';

const tabs = [
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'accounts', label: 'Accounts', icon: ArrowUpDown },
  { id: 'data', label: 'Data', icon: Download },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('categories');

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-5 border-b border-gray-100 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl">
          {activeTab === 'categories' && <CategoryManager />}
          {activeTab === 'accounts' && <AccountReorder />}
          {activeTab === 'data' && <DataExport />}
          {activeTab === 'preferences' && <PreferencesPanel />}
        </div>
      </div>
    </div>
  );
}
