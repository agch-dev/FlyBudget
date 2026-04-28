export function centsToInput(cents: number): string {
  return cents === 0 ? '' : (Math.abs(cents) / 100).toFixed(2);
}

export function parseCents(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export function formatCurrency(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatCentsAxis(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100_000_00) return `$${(cents / 100_000_00).toFixed(0)}M`;
  if (abs >= 1_000_00) return `$${(cents / 1_000_00).toFixed(0)}k`;
  return `$${(cents / 100).toFixed(0)}`;
}
