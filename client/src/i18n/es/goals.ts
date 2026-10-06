import type { Translation } from '../catalog';
import type en from '../en/goals';

// A goal is a "meta"; the amount it aims for (its target) is the "objetivo".
const es: Translation<typeof en> = {
  page: {
    title: 'Metas',
    add: 'Agregar meta',
    emptyTitle: 'Ahorrá para lo que importa',
    emptyDescription:
      'Ponete un objetivo, como un fondo de emergencia, un viaje o un auto nuevo, y mirá qué tan cerca estás y cuánto apartar cada mes.',
    inProgress: 'En curso',
    completed: 'Completadas',
    deleteTitle: 'Eliminar meta',
    deleteMessage: '¿Eliminar "{{name}}"? Esto no se puede deshacer.',
    delete: 'Eliminar',
  },
  summary: {
    saved: 'Ahorrado',
    percentOfTarget: '{{percent}}% del objetivo',
    target: 'Objetivo',
    leftToSave: 'Falta ahorrar',
    reached: 'Metas alcanzadas',
    reachedOf: '{{reached}} de {{total}}',
    converted:
      'Los totales están en pesos, con las metas en dólares convertidas al tipo de cambio de hoy.',
    notCounted_one:
      '{{count}} meta en dólares no está en estos totales porque todavía no hay tipo de cambio. <rates>Ingresar tipos de cambio</rates>',
    notCounted_other:
      '{{count}} metas en dólares no están en estos totales porque todavía no hay tipo de cambio. <rates>Ingresar tipos de cambio</rates>',
  },
  group: {
    count_one: '{{count}} meta',
    count_other: '{{count}} metas',
  },
  card: {
    target: 'Objetivo: {{date}}',
    ofTarget: 'de {{amount}}',
    edit: 'Editar meta',
    delete: 'Eliminar meta',
    reached: 'Meta alcanzada',
    overdue: 'Pasó la fecha objetivo · faltan {{amount}}',
    toGo: 'Faltan {{amount}}',
    toGoPerMonth: 'Faltan {{amount}}<small> · {{perMonth}} por mes para llegar a tiempo</small>',
  },
  form: {
    addTitle: 'Agregar meta',
    editTitle: 'Editar meta',
    name: 'Nombre',
    namePlaceholder: 'ej. Fondo de emergencia',
    target: 'Objetivo',
    saved: 'Ahorrado hasta ahora',
    targetDate: 'Fecha objetivo (opcional)',
    targetDateLabel: 'Fecha objetivo',
    account: 'Cuenta vinculada (opcional)',
    accountLabel: 'Cuenta vinculada',
    noAccount: 'Ninguna',
    currencyLocked: 'Una meta está en la moneda de su cuenta vinculada.',
    icon: 'Ícono',
    color: 'Color',
    colorOption: 'Color {{color}}',
    cancel: 'Cancelar',
    save: 'Guardar',
    add: 'Agregar meta',
  },
  checkTarget: {
    title: 'Revisá el objetivo',
    account: {
      UYU: '{{account}} está en pesos, así que esta meta pasa de dólares a pesos. Los montos conservan sus números y no se convierten.',
      USD: '{{account}} está en dólares, así que esta meta pasa de pesos a dólares. Los montos conservan sus números y no se convierten.',
    },
    linkedAccount: 'La cuenta vinculada',
    question: '¿Es el objetivo correcto?',
    change: 'Cambiar montos',
    save: 'Sí, guardar',
  },
};

export default es;
