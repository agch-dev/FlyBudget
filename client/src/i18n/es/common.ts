import type { Translation } from '../catalog';
import type en from '../en/common';

const es: Translation<typeof en> = {
  language: {
    title: 'Idioma de la app',
    description: 'El idioma de la app en este dispositivo.',
  },
  currency: {
    UYU: 'Pesos',
    USD: 'Dólares',
  },
  nav: {
    dashboard: 'Panel',
    accounts: 'Cuentas',
    transactions: 'Transacciones',
    budget: 'Presupuesto',
    recurring: 'Recurrentes',
    reports: 'Reportes',
    cashFlow: 'Flujo de fondos',
    goals: 'Metas',
    payees: 'Beneficiarios',
    rules: 'Reglas',
    settings: 'Configuración',
  },
  sidebar: {
    help: 'Ayuda y documentación',
    helpNewTab: 'Ayuda y documentación (se abre en una pestaña nueva)',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    pin: 'Fijar barra lateral',
    unpin: 'Dejar de fijar la barra lateral',
    allAccounts: 'Todas las cuentas',
    forBudget: 'En el presupuesto',
    offBudget: 'Fuera del presupuesto',
    noAccounts: 'Todavía no hay cuentas',
    addAccount: 'Agregar cuenta',
    addManualAccount: 'Agregar cuenta manual',
    connectPlaid: 'Conectar con Plaid',
    connectSimplefin: 'Conectar con SimpleFIN',
    groupIncomplete: 'No se cuentan los saldos en la otra moneda: todavía no hay tipo de cambio',
  },
  ui: {
    close: 'Cerrar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    actions: 'Acciones',
    learnMore: 'Más información',
  },
  undo: {
    undid: 'Se deshizo: {{message}}',
    redid: 'Se rehízo: {{message}}',
    undo: 'Deshacer',
    redo: 'Rehacer',
    dismiss: 'Descartar',
  },
  viewingCurrency: {
    label: 'Moneda de visualización',
    hint: 'Mostrar los totales en pesos o en dólares. El presupuesto siempre está en pesos.',
  },
  dateFormat: {
    title: 'Formato de fecha',
  },
  help: {
    newHere: '¿Recién empezás con FlyBudget?',
    guide: 'Leer la guía',
    source: 'Código fuente en GitHub',
    report: 'Reportar un problema o sugerir una idea',
  },
  demo: {
    label: 'Demo',
    title: 'Este es un presupuesto de demostración.',
    nothingSaved: 'No se guarda nada.',
    detail:
      'Cambiá lo que quieras. No se guarda nada, y al cerrar la pestaña vuelve a empezar de cero.',
    backHome: 'Volver al inicio',
    backHomeHint: 'Volver a la página de inicio de FlyBudget',
    startOver: 'Empezar de nuevo',
    startOverHint: 'Empezar de nuevo con el presupuesto de demostración original',
    download: 'Descargar',
    downloadApp: 'Descargar FlyBudget',
    notAvailable: 'No disponible en la demo',
    noBanks:
      'Las conexiones bancarias necesitan la app de FlyBudget, así que la demo no puede conectar un banco ni recibir credenciales bancarias. En la app, Plaid o SimpleFIN traen tus transacciones automáticamente, y también podés importar archivos CSV de tu banco.',
    connectBank: 'Conectar un banco',
  },
  rates: {
    label: 'Tipos de cambio estimados',
    enter: 'Ingresar tipos de cambio',
    notCountedTitle: 'Todavía no hay ningún tipo de cambio guardado.',
    notCountedDetail:
      'Hasta que haya uno, los totales en pesos no incluyen los montos en dólares y los totales en dólares no incluyen los pesos.',
    missingTitle: 'No hay tipo de cambio para {{dates}}.',
    missingDetail_one:
      'Los montos en dólares de esa fecha se convierten al tipo de cambio más cercano disponible, así que los totales son estimados.',
    missingDetail_other:
      'Los montos en dólares de esas fechas se convierten al tipo de cambio más cercano disponible, así que los totales son estimados.',
    datesAnd: '{{dates}} y {{last}}',
    datesRange: '{{total}} fechas entre el {{first}} y el {{last}}',
  },
  errors: {
    invalidValues: 'Algunos de los valores ingresados no son válidos',
  },
};

export default es;
