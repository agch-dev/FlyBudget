import { useAccounts } from '../../hooks/useAccounts';

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function AccountMultiSelect({ selected, onChange }: Props) {
  const { data: accounts = [] } = useAccounts();
  const open = accounts.filter(a => !a.closedAt);

  const allSelected = selected.length === 0;

  function toggle(id: string) {
    if (selected.length === 0) {
      onChange(open.filter(a => a.id !== id).map(a => a.id));
    } else if (selected.includes(id)) {
      const next = selected.filter(s => s !== id);
      onChange(next.length === open.length ? [] : next);
    } else {
      const next = [...selected, id];
      onChange(next.length === open.length ? [] : next);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => onChange([])}
        className={`text-xs px-1.5 py-0.5 rounded ${allSelected ? 'text-blue-600 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
      >
        {allSelected ? 'All selected' : 'Select all'}
      </button>
      {open.map(a => {
        const checked = allSelected || selected.includes(a.id);
        return (
          <label key={a.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(a.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 truncate">{a.name}</span>
          </label>
        );
      })}
    </div>
  );
}
