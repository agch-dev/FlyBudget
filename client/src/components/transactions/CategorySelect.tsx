import type { CategoryGroup } from '../../types';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  groups: CategoryGroup[];
  className?: string;
}

export function CategorySelect({ value, onChange, groups, className = '' }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`block w-full bg-transparent text-sm text-gray-700 focus:outline-none ${className}`}
    >
      <option value="">Uncategorized</option>
      {groups.map((g) => (
        <optgroup key={g.id} label={g.name}>
          {g.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
