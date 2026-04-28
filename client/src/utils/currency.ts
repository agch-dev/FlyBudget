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
