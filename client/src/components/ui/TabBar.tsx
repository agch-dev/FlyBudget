import type { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: Props) {
  return (
    <div className="flex gap-0 border-b border-border -mb-px">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-border'
            }`}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
