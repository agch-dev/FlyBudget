import type { Translation } from '../catalog';
import type en from '../en/connection';

const es: Translation<typeof en> = {
  networkError:
    'No se puede conectar con FlyBudget en este momento. No se guardó nada; probá de nuevo cuando se reconecte.',
  banner: {
    label: 'Conexión',
    cantReach: 'No se puede conectar con FlyBudget.',
    dataAsOf: 'Estás viendo tus datos de {{when}}.',
    lookAround: 'Igual podés seguir mirando.',
    savedOnDevice:
      'Las transacciones nuevas se guardan en este dispositivo; los demás cambios esperan a que se reconecte.',
    savingPaused: 'El guardado está en pausa.',
    waiting_one: '{{count}} transacción esperando para enviarse',
    waiting_other: '{{count}} transacciones esperando para enviarse',
    retryNow: 'Reintentar ahora',
    reconnected: 'Conexión restablecida. Todo está al día.',
  },
  retry: {
    checking: 'Comprobando…',
    paused: 'En pausa mientras esta pestaña está en segundo plano',
    tryingAgainIn: 'Nuevo intento en {{seconds}} s',
    tryingAgain: 'Intentando de nuevo…',
    retryingIn: 'Reintentando en {{seconds}} s',
    retrying: 'Reintentando…',
    progress: 'Tiempo hasta el próximo intento',
  },
  hint: {
    savingPaused: 'El guardado está en pausa hasta que FlyBudget se reconecte.',
    savedOnDevice:
      'No se puede conectar con FlyBudget. Esto queda guardado en este dispositivo y se envía cuando se reconecte.',
  },
  reconnect: {
    title: {
      desktop: 'FlyBudget se está iniciando de nuevo',
      server: 'Reconectando con tu servidor',
      dev: 'Reconectando con FlyBudget',
    },
    fewSeconds: 'Suele llevar unos segundos.',
    serverError: 'El servidor de FlyBudget respondió con un error.',
    cantReach: 'No se puede conectar en este momento. {{retry}}',
    tryNow: 'Probar ahora',
    desktopHint:
      'Si esto no se soluciona, cerrá FlyBudget y volvé a abrirlo. Tus datos están a salvo en esta computadora.',
    devHint:
      'Puede que el servidor de desarrollo se esté reiniciando. Si se detuvo, ejecutá <code>npm run dev</code> de nuevo.',
    troubleshooting: 'Solución de problemas',
    budgetSafe:
      'Tu presupuesto está a salvo en el servidor; esta página simplemente no puede conectarse.',
    checkContainer: 'Verificá que el contenedor esté en ejecución:',
    seeLogs: 'Mirá lo que registró:',
    proxy:
      'Si accedés a través de un proxy inverso o una VPN, verificá que también esté funcionando y que este dispositivo esté conectado a la red correcta.',
  },
  status: {
    demoPlace: 'Demo en este navegador',
    onThisComputer: 'En esta computadora',
    thisBrowser: 'Este navegador',
    thisComputer: 'Esta computadora',
    online: 'En línea',
    reconnecting: 'Reconectando',
    reconnectingNow: 'Reconectando…',
    label: 'Estado del servidor: {{state}}, {{place}}',
    menu: 'Servidor',
    serverOnline: 'Servidor en línea',
    reconnectingToServer: 'Reconectando con el servidor',
    address: 'Dirección',
    connection: 'Conexión',
    version: 'Versión',
    security: {
      encrypted: 'Cifrada (HTTPS)',
      local: 'Queda en esta computadora',
      unencrypted: 'Sin cifrar (HTTP)',
    },
    retryNow: 'Reintentar ahora',
    serverSettings: 'Configuración del servidor',
    signOut: 'Cerrar sesión',
  },
};

export default es;
