import type { Translation } from '../catalog';
import type en from '../en/accounts';

const es: Translation<typeof en> = {
  welcome: {
    title: '¡Te damos la bienvenida a <brand></brand>!',
    intro:
      'Un presupuesto que muestra a dónde va tu dinero y le da una tarea a cada peso. Empezá por agregar las cuentas que querés seguir.',
    setupTime: 'Tiempo de configuración:',
    plaid: {
      title: 'Conectar con Plaid',
      tag: 'Gratis',
      time: '~10 min + aprobación',
      description:
        'Lo configurás una vez y las transacciones nuevas llegan solas. Creá una cuenta gratuita de desarrollador en Plaid; después Plaid aprueba el acceso a tus bancos reales.',
      action: 'Conectar Plaid',
    },
    simplefin: {
      title: 'Conectar con SimpleFIN',
      tag: 'US$1.50 por mes',
      time: '~5 min',
      description:
        'Lo configurás una vez y las transacciones nuevas llegan solas, a través de SimpleFIN Bridge (miles de bancos). Se paga directamente a SimpleFIN.',
      action: 'Conectar SimpleFIN',
    },
    manual: {
      title: 'Agregar cuentas a mano',
      tag: 'Sin conexión al banco',
      time: '~1 min cada una',
      description:
        'Agregás vos cada cuenta y su saldo. Las transacciones también son manuales: descargás archivos CSV de tu banco y los importás, o ingresás cada una a mano. Nada se actualiza solo.',
      action: 'Agregar a mano',
    },
    storedOnServer:
      'Tu presupuesto se guarda en tu propio servidor. Sin cuenta de FlyBudget, sin rastreo.',
    storedHere: 'Tu presupuesto queda en esta computadora. Sin cuenta de FlyBudget, sin rastreo.',
    compareBanks: 'Comparar opciones de bancos',
    skip: 'Omitir por ahora y recorrer la app',
  },
};

export default es;
