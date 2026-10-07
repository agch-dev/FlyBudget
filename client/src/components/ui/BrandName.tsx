interface Props {
  className?: string;
  /** Color of "Budget": the page's text color by default (black, or white in dark mode) */
  budgetClassName?: string;
  /** Color of "Fly" */
  flyClassName?: string;
}

/** The FlyBudget wordmark: "Fly" in the brand blue, "Budget" in the text color */
export function BrandName({
  className = '',
  budgetClassName = 'text-text',
  flyClassName = 'text-brand-600',
}: Props) {
  return (
    <span className={className}>
      <span className={flyClassName}>Fly</span>
      <span className={budgetClassName}>Budget</span>
    </span>
  );
}

/**
 * "UY" next to the wordmark in the app's header, so this fork reads as apart from upstream
 * FlyBudget. Made for the sidebar, which is dark in both themes. Not translated, like a currency code.
 */
export function ForkBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide bg-brand-500/20 text-brand-500 ring-1 ring-inset ring-brand-500/40 ${className}`}
    >
      UY
    </span>
  );
}
