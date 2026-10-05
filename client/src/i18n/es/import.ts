import type { Translation } from '../catalog';
import type en from '../en/import';

const es: Translation<typeof en> = {
  title: 'Importar transacciones',
  dismiss: 'Cerrar',
  back: 'Atrás',
  upload: {
    drop: 'Arrastrá y soltá un archivo CSV o de Excel, o hacé clic para buscarlo',
    supports: 'Admite archivos .csv, .xlsx y .xls',
    demo: 'Demo: tu archivo queda en esta pestaña del navegador y no se guarda.',
    fileLabel: 'Archivo CSV o de Excel',
  },
  map: {
    intro_one: 'Asigná cada columna a un campo. Se encontró {{count}} fila.',
    intro_other: 'Asigná cada columna a un campo. Se encontraron {{count}} filas.',
    sheet: 'Hoja',
    column: 'Columna {{header}}',
    firstRow: 'La primera fila se lee como <strong>{{date}}, {{amount}}</strong>.',
    preview: 'Vista previa',
    checking: 'Comprobando...',
  },
  role: {
    date: 'Fecha',
    payee: 'Beneficiario',
    amount: 'Monto',
    inflow: 'Entrada',
    outflow: 'Salida',
    amountUYU: 'Monto en pesos',
    amountUSD: 'Monto en dólares',
    currency: 'Moneda',
    notes: 'Notas',
    skip: 'Omitir',
  },
  conventions: {
    dates: 'Fechas',
    dateOrder: {
      'day-first': 'Día primero (31/12/2026)',
      'month-first': 'Mes primero (12/31/2026)',
    },
    decimals: 'Decimales',
    decimal: {
      comma: 'Coma (1.234,56)',
      point: 'Punto (1,234.56)',
    },
  },
  chargesPositive: {
    label: 'Las compras son positivas en este archivo',
    hint: 'Los estados de cuenta de tarjeta suelen serlo. Se invierte cada signo: las compras pasan a ser dinero que sale, y los pagos y las devoluciones, dinero que entra.',
  },
  currencyWord: {
    UYU: 'pesos',
    USD: 'dólares',
  },
  otherCurrency: {
    goTo: 'Las filas en {{currency}} van a',
    notImported: 'No se importan',
    count_one: '{{count}} fila de este archivo está en {{currency}}, y esta cuenta tiene {{own}}.',
    count_other:
      '{{count}} filas de este archivo están en {{currency}}, y esta cuenta tiene {{own}}.',
    addAccount: 'Agregá una cuenta en {{currency}} para importarlas.',
  },
  problems: {
    summary_one:
      '{{count}} fila no se puede leer y no se va a importar. Revisá las opciones de Fechas y Decimales.',
    summary_other:
      '{{count}} filas no se pueden leer y no se van a importar. Revisá las opciones de Fechas y Decimales.',
    row: 'Fila {{row}}: {{message}}',
    more: 'y {{more}} más',
    date: 'No se puede leer la fecha "{{cell}}"',
    amount: 'No se puede leer el monto "{{cell}}"',
    currency: 'No se puede leer la moneda "{{cell}}"',
  },
  preview: {
    found_one: 'Se encontró {{count}} transacción.',
    found_other: 'Se encontraron {{count}} transacciones.',
    duplicates_one: 'Se detectó {{count}} duplicado.',
    duplicates_other: 'Se detectaron {{count}} duplicados.',
    willImport_one: 'Se va a importar {{count}}.',
    willImport_other: 'Se van a importar {{count}}.',
    leftOut_one: '{{count}} fila en {{currency}} no se va a importar.',
    leftOut_other: '{{count}} filas en {{currency}} no se van a importar.',
    importRow: 'Importar {{payee}} del {{date}}',
    importUnnamedRow: 'Importar la fila del {{date}}',
    duplicate: 'duplicado',
    importing: 'Importando...',
    import_one: 'Importar {{count}} transacción',
    import_other: 'Importar {{count}} transacciones',
  },
  done: {
    title: 'Importación completa',
    summary: '{{imported}} importadas, {{skipped}} omitidas',
    close: 'Listo',
  },
  errors: {
    readFile: 'No se pudo leer el archivo',
    noRows: 'No se encontró ninguna fila en el archivo',
    dateRequired: 'La columna de fecha es obligatoria',
    amountRequired: 'Se necesita al menos una columna de monto',
    everyRowOther: 'Todas las filas están en {{currency}}. Elegí la cuenta a la que van.',
    noneReadable_one: 'La única fila no se pudo leer. Revisá las opciones de Fechas y Decimales.',
    noneReadable_other:
      'No se pudo leer ninguna de las {{count}} filas. Revisá las opciones de Fechas y Decimales.',
    noValidRows: 'No se encontraron filas válidas',
    previewFailed: 'No se pudo generar la vista previa',
    noneSelected: 'No hay filas seleccionadas',
    importFailed: 'No se pudo importar',
    partial:
      'Se importó en {{done}}, pero no en {{failed}}: {{reason}}. Importá de nuevo para terminar: las filas ya importadas se omiten.',
  },
  spreadsheet: {
    sheetName: 'Hoja {{number}}',
    damaged: 'Este archivo de Excel está dañado y no se puede leer.',
    tooLarge: 'Este archivo de Excel es demasiado grande para importarlo.',
    notWorkbook: 'Este archivo no es un libro de Excel.',
    tooOld:
      'Este archivo de Excel está en un formato anterior a 1997. Abrilo y guardalo como .xlsx o .csv.',
    passwordProtected:
      'Este archivo de Excel está protegido con contraseña. Guardá una copia sin contraseña para importarlo.',
  },
};

export default es;
