import type { Translation } from '../catalog';
import type en from '../en/budget';

const es: Translation<typeof en> = {
  nav: {
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    today: 'Hoy',
  },
  columns: {
    planned: 'Planificado',
    actual: 'Real',
    remaining: 'Restante',
  },
  sections: {
    income: 'Ingresos',
    expenses: 'Gastos',
    totalIncome: 'Total de ingresos',
    totalExpenses: 'Total de gastos',
  },
  budgetType: {
    fixed: 'Fijos',
    flexible: 'Flexibles',
    non_monthly: 'No mensuales',
    savings: 'Ahorro e inversiones',
  },
  plannedFor: 'Planificado para {{category}}',
  plannedForAmount: 'Planificado para {{category}}: {{amount}}',
  inactive: {
    show_one: 'Mostrar {{count}} categoría inactiva',
    show_other: 'Mostrar {{count}} categorías inactivas',
    hide_one: 'Ocultar {{count}} categoría inactiva',
    hide_other: 'Ocultar {{count}} categorías inactivas',
  },
  nothingPlanned: {
    click:
      'Todavía no hay nada planificado para {{month}}. Hacé clic en un monto de la columna <strong>Planificado</strong> para indicar cuánto esperás ganar y gastar en cada categoría. Las categorías que dejes vacías se ocultan una vez que hayas planificado algo. <guide>Cómo funciona el presupuesto</guide>',
    tap: 'Todavía no hay nada planificado para {{month}}. Tocá un monto de la columna <strong>Planificado</strong> para indicar cuánto esperás ganar y gastar en cada categoría. Las categorías que dejes vacías se ocultan una vez que hayas planificado algo. <guide>Cómo funciona el presupuesto</guide>',
  },
  noCategories: 'Todavía no hay categorías. <settings>Agregá algunas en Configuración</settings>',
  summary: {
    toBeBudgeted: 'Por asignar',
    status: {
      over: 'Asignaste de más',
      full: 'Todo asignado',
      almost: 'Casi todo asignado',
      left: 'Queda por asignar',
    },
    tabs: {
      summary: 'Resumen',
      income: 'Ingresos',
      expenses: 'Gastos',
    },
    income: 'Ingresos',
    expenses: 'Gastos',
    saveUp: 'Ahorro',
    fixed: 'Fijos',
    flexible: 'Flexibles',
    nonMonthly: 'No mensuales',
    planned: '{{amount}} planificado',
    earned: 'recibido',
    spent: 'gastado',
    contributed: 'aportado',
    remaining: 'restante',
  },
  history: {
    title: 'Historial',
    earnedLastMonth: 'Recibido el mes pasado',
    spentLastMonth: 'Gastado el mes pasado',
    monthlyAverage: 'Promedio mensual',
    none: 'No hay historial disponible',
    applyToFuture: 'Aplicar {{amount}} a todos los meses siguientes',
  },
  sheet: {
    title: 'Planificar {{category}}',
    titlePlain: 'Planificar',
    nextTwelveMonths: 'Usar este monto para los próximos 12 meses',
    save: 'Guardar',
  },
  phone: {
    actualOfPlanned: '{{actual}} de {{planned}}',
    remaining: '{{amount}} restante',
    received: 'Recibido',
    spent: 'Gastado',
  },
  category: {
    fallbackName: 'Categoría',
    spendingHistory: 'Historial de gastos',
    budget: 'Presupuesto',
    summary: {
      title: 'Resumen',
      noData: 'Sin datos',
      count: 'Cantidad de transacciones',
      largest: 'Transacción más grande',
      average: 'Transacción promedio',
      totalIncome: 'Total de ingresos',
      totalSpending: 'Total de gastos',
      first: 'Primera transacción',
      last: 'Última transacción',
    },
  },
};

export default es;
