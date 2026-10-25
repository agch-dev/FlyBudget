import { Link } from 'react-router-dom';
import { useBudgetCurrency, useSecondaryFigure } from '../../hooks/useCurrency';
import { currencyName, formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';

export function SecondaryNetWorth({
  amount,
  day,
  className = '',
}: {
  /** In the budget's currency */
  amount: number;
  /** The day the figure stands for (yyyy-MM-dd) */
  day: string;
  className?: string;
}) {
  const figure = useSecondaryFigure(amount, day);
  const budget = useBudgetCurrency();
  if (figure.kind === 'none' || figure.kind === 'pending') return null;
  if (figure.kind === 'hidden') {
    return (
      <p className={`text-xs text-text-tertiary ${className}`}>
        <Link to="/settings?tab=currencies" className="hover:underline">
          {currencyName(figure.currency)} hidden: no recent rate
        </Link>
      </p>
    );
  }
  const rate =
    figure.rate && figure.rateDate
      ? `1 ${budget} = ${figure.rate} ${figure.currency} (${formatDay(figure.rateDate)})`
      : undefined;
  return (
    <p className={`text-sm tabular-nums text-text-secondary ${className}`} title={rate}>
      ≈ {formatMoney(figure.amount, figure.currency)}
    </p>
  );
}
