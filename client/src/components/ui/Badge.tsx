type Variant = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'positive' | 'negative';

interface Props {
  variant: Variant;
  label?: string;
}

const styles: Record<Variant, string> = {
  checking:   'bg-blue-100 text-blue-700',
  savings:    'bg-green-100 text-green-700',
  credit:     'bg-orange-100 text-orange-700',
  cash:       'bg-gray-100 text-gray-600',
  investment: 'bg-purple-100 text-purple-700',
  positive:   'bg-green-100 text-green-700',
  negative:   'bg-red-100 text-red-600',
};

const labels: Record<Variant, string> = {
  checking:   'Checking',
  savings:    'Savings',
  credit:     'Credit',
  cash:       'Cash',
  investment: 'Investment',
  positive:   'Positive',
  negative:   'Negative',
};

export function Badge({ variant, label }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {label ?? labels[variant]}
    </span>
  );
}
