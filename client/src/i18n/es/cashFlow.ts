import type { Translation } from '../catalog';
import type en from '../en/cashFlow';

const es: Translation<typeof en> = {
  title: 'Flujo de fondos',
  preset: {
    '1m': '1M',
    '3m': '3M',
    '6m': '6M',
    ytd: 'Este año',
    'last-year': 'Año pasado',
    custom: 'Personalizado',
  },
  exportCsv: 'Exportar CSV',
  totalIncome: 'Ingresos totales',
  totalExpenses: 'Gastos totales',
  netIncome: 'Ingreso neto total',
  savingsRate: 'Tasa de ahorro',
  showAs: 'Mostrar como',
  list: 'Lista',
  diagram: 'Diagrama',
  swipe: 'Deslizá para verlo completo',
  transactionsOf: 'Transacciones: {{name}}',
  clear: 'Quitar',
  node: {
    income: 'Ingresos',
    totalIncome: 'Ingresos totales',
    savings: 'Ahorro',
    uncategorized: 'Sin categoría',
  },
  emptyMessage: 'No hay datos para este período',
  emptyHint: 'Agregá transacciones o elegí un período más largo.',
  negativeFlows:
    'Se excluyeron algunos flujos: los diagramas de Sankey no pueden representar valores negativos (p. ej. reembolsos). Los totales del resumen pueden diferir un poco.',
  ofTotalIncome: '{{percent}}% de los ingresos totales',
  ofTotalSpending: '{{percent}}% de los gastos totales',
  ofGroup: '{{percent}}% de {{group}}',
  savingsRatePercent: '{{percent}}% de tasa de ahorro',
  moneyIn: 'Entradas',
  whereItWent: 'A dónde fue',
  saved: 'Ahorrado',
  shareOfIncome: '{{share}}<hidden> de los ingresos</hidden>',
  hideTransactions: 'Ocultar transacciones',
  allGroupTransactions: 'Todas las transacciones de {{group}}',
};

export default es;
