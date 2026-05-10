import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, ArrowLeftRight, Repeat, BarChart2, Users, Zap, Settings, Wallet } from 'lucide-react';
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
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-blue-600/20 text-blue-400 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]'
            : 'text-gray-400 hover:bg-white/[0.07] hover:text-gray-200'
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
    <aside className="flex flex-col w-60 shrink-0 h-screen bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800">
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Wallet size={14} className="text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">Budget App</span>
        </div>
      </div>

      <nav className="px-3 pt-3 space-y-0.5">
        <NavItem to="/dashboard" icon={<Home size={16} />} label="Dashboard" />
        <NavItem to="/budget" icon={<LayoutGrid size={16} />} label="Budget" />
        <NavItem to="/transactions" icon={<ArrowLeftRight size={16} />} label="All Transactions" />
        <NavItem to="/recurring" icon={<Repeat size={16} />} label="Recurring" />
        <NavItem to="/reports" icon={<BarChart2 size={16} />} label="Reports" />
      </nav>

      <div className="flex-1 overflow-y-auto">
        <SidebarAccountList />
      </div>

      <nav className="px-3 py-3 border-t border-white/[0.06] space-y-0.5">
        <NavItem to="/payees" icon={<Users size={16} />} label="Payees" />
        <NavItem to="/rules" icon={<Zap size={16} />} label="Rules" />
        <NavItem to="/settings" icon={<Settings size={16} />} label="Settings" />
      </nav>
    </aside>
  );
}
