import { NavLink } from 'react-router-dom';
import { LayoutGrid, ArrowLeftRight, BarChart2, Users, Zap, Settings } from 'lucide-react';
import { SidebarAccountList } from './SidebarAccountList';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="flex flex-col w-60 shrink-0 h-screen bg-white border-r border-gray-200">
      <div className="px-4 py-4 border-b border-gray-100">
        <span className="text-base font-bold text-gray-900">Budget App</span>
      </div>

      <nav className="px-3 pt-3 space-y-0.5">
        <NavItem to="/budget" icon={<LayoutGrid size={16} />} label="Budget" />
        <NavItem to="/transactions" icon={<ArrowLeftRight size={16} />} label="All Transactions" />
        <NavItem to="/reports" icon={<BarChart2 size={16} />} label="Reports" />
      </nav>

      <div className="flex-1 overflow-y-auto">
        <SidebarAccountList />
      </div>

      <nav className="px-3 py-3 border-t border-gray-100 space-y-0.5">
        <NavItem to="/payees" icon={<Users size={16} />} label="Payees" />
        <NavItem to="/rules" icon={<Zap size={16} />} label="Rules" />
        <NavItem to="/settings" icon={<Settings size={16} />} label="Settings" />
      </nav>
    </aside>
  );
}
