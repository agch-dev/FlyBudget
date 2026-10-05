import type { Translation } from '../catalog';
import type en from '../en/settings';

const es: Translation<typeof en> = {
  title: 'Configuración',
  tabs: {
    categories: 'Categorías',
    accounts: 'Cuentas',
    connections: 'Bancos conectados',
    data: 'Datos',
    preferences: 'Preferencias',
    rates: 'Tipos de cambio',
    server: 'Servidor',
  },
  license: 'FlyBudget es software libre bajo la licencia <license>GNU AGPL v3</license>.',
  sourceCode: 'Código fuente',
  loading: 'Cargando…',
  save: 'Guardar',
  saving: 'Guardando…',
  categories: {
    section: {
      income: 'Ingresos',
      expense: 'Gastos',
    },
    createGroup: 'Crear grupo',
    groupName: 'Nombre del grupo…',
    addGroup: 'Agregar grupo',
    noGroups: 'Todavía no hay grupos.',
    dragGroup: 'Arrastrar para reordenar el grupo',
    edit: 'Editar',
    delete: 'Eliminar',
    noCategories: 'Todavía no hay categorías.',
    createCategory: 'Crear categoría',
    categoryName: 'Nombre de la categoría…',
    addCategory: 'Agregar categoría',
    pickIcon: 'Elegir ícono',
    searchEmoji: 'Buscar emoji…',
    dragCategory: 'Arrastrar para reordenar {{name}}',
    editNamed: 'Editar {{name}}',
    deleteGroupTitle: 'Eliminar grupo',
    deleteGroupMessage: '¿Eliminar "{{name}}" y todas sus categorías? Esto no se puede deshacer.',
    deleteCategoryTitle: 'Eliminar categoría',
    deleteCategoryMessage: '¿Eliminar "{{name}}"? Esto no se puede deshacer.',
    reassign: {
      intro_one:
        '<strong>{{name}}</strong> tiene <strong>{{count}}</strong> transacción. Elegí una categoría a la que moverla antes de eliminar.',
      intro_other:
        '<strong>{{name}}</strong> tiene <strong>{{count}}</strong> transacciones. Elegí una categoría a la que moverlas antes de eliminar.',
      budgetRemoved: 'Se van a quitar los montos planificados de esta categoría.',
      moveTo: 'Mover las transacciones a',
      select: 'Elegí una categoría…',
      confirm: 'Mover y eliminar',
    },
    editTitle: 'Editar categoría',
    iconAndName: 'Ícono y nombre',
    changeIcon: 'Cambiar ícono',
    nameLabel: 'Nombre de la categoría',
    group: 'Grupo',
    budgetType: 'Tipo de presupuesto',
    budgetTypeHint: {
      fixed: 'Un monto mensual parejo y previsible',
      flexible: 'Gastos variables que cambian cada mes',
      non_monthly: 'Gastos periódicos o irregulares',
      savings: 'Metas de ahorro y aportes a inversiones',
    },
  },
  accountOrder: {
    title: 'Orden de las cuentas',
    description: 'Arrastrá para reordenar las cuentas en la barra lateral.',
    empty: 'Todavía no hay cuentas. Agregá una desde la página Cuentas.',
    onBudget: 'En el presupuesto',
    offBudget: 'Fuera del presupuesto',
    drag: 'Arrastrar para reordenar {{name}}',
  },
  data: {
    title: 'Exportar datos',
    description: 'Descargá tus datos para tener un respaldo o analizarlos.',
    transactions: {
      title: 'Exportar transacciones',
      description:
        'Descargá todas las transacciones en un archivo CSV, cada una con su cuenta, su grupo de cuentas y su moneda. Si querés, filtrá por fechas.',
      from: 'Desde',
      to: 'Hasta',
      download: 'Descargar CSV',
    },
    rates: {
      title: 'Exportar tipos de cambio',
      description:
        'Descargá todos los tipos de cambio guardados (pesos por dólar, por fecha) en un archivo CSV. Son los que están detrás de cada total convertido.',
      download: 'Descargar CSV de tipos de cambio',
    },
    backup: {
      title: 'Copia de seguridad completa',
      description:
        'Descargá una copia de seguridad en JSON con todos tus datos: cuentas, transacciones, presupuestos, categorías, beneficiarios, reglas, recurrentes, metas, reportes y paneles. No incluye las credenciales de las conexiones bancarias.',
      download: 'Descargar copia de seguridad',
    },
    restore: {
      title: 'Restaurar una copia de seguridad',
      description:
        'Reemplazá todos tus datos con un archivo de copia de seguridad. Antes se guarda una copia de tus datos actuales.',
      file: 'Archivo de copia de seguridad',
      choose: 'Restaurar copia…',
      restoring: 'Restaurando…',
      notBackup: '{{name}} no es un archivo de copia de seguridad de FlyBudget.',
      done: 'Se restauró {{name}} ({{total}} transacciones).',
      doneWithCopy:
        'Se restauró {{name}} ({{total}} transacciones). Tus datos anteriores se guardaron como {{file}} junto a la base de datos.',
      failed: 'No se pudo restaurar',
      confirmTitle: '¿Restaurar esta copia de seguridad?',
      confirmMessage:
        'Todos tus datos actuales se van a reemplazar con el contenido de {{name}}. Las conexiones bancarias siguen conectadas.',
      theBackup: 'la copia de seguridad',
      confirm: 'Reemplazar mis datos',
    },
  },
  preferences: {
    title: 'Preferencias',
    saved: 'Las preferencias se guardan solas en tu navegador.',
    savedInDemo: 'Las preferencias se guardan en esta pestaña mientras probás la demo.',
    reset: 'Volver a los valores predeterminados',
    resetTitle: 'Restablecer preferencias',
    resetMessage: '¿Seguro que querés volver todas las preferencias a sus valores predeterminados?',
    resetConfirm: 'Restablecer',
    theme: {
      title: 'Tema',
      light: 'Claro',
      dark: 'Oscuro',
      system: 'Del sistema',
    },
    sidebar: {
      title: 'Barra lateral',
      persistent: { label: 'Fija', description: 'Siempre abierta' },
      'auto-hide': { label: 'Ocultar sola', description: 'Cerrada, se abre al pasar el mouse' },
    },
    icons: {
      title: 'Íconos',
      merchant: {
        label: 'Comercio',
        description: 'Logos de comercios (o iniciales de color) junto a sus nombres',
      },
      category: { label: 'Categoría', description: 'Emojis junto a los nombres de categorías' },
      account: {
        label: 'Cuenta',
        description: 'Logos de cuentas (o iniciales de color) junto a sus nombres',
      },
      show: 'Mostrar',
      hide: 'Ocultar',
    },
  },
  rates: {
    title: 'Tipos de cambio',
    description:
      'Pesos por dólar: el tipo de cambio interbancario, uno por día. Los fines de semana y feriados usan el del día hábil anterior.',
    dayPattern: 'EEE d MMM yyyy',
    monthPattern: "MMMM 'de' yyyy",
    loadError: 'No se pudieron cargar los tipos de cambio.',
    today: 'Tipo de cambio de hoy',
    perDollar: 'por US$ 1',
    latest: 'El de {{day}}, el último que hay',
    noRate: 'Todavía no hay tipo de cambio',
    lastFetched: 'Última actualización {{when}}.',
    neverFetched: 'Nunca se actualizó.',
    fetchPolicy:
      'FlyBudget trae los tipos de cambio nuevos más o menos una vez por día, al iniciar.',
    fetchPolicyDemo:
      'La demo nunca trae tipos de cambio; en la app, FlyBudget los trae más o menos una vez por día.',
    refresh: 'Actualizar',
    refreshing: 'Actualizando…',
    enter: 'Ingresar un tipo de cambio',
    byMonth: 'Tipos de cambio por mes',
    emptyTitle: 'Todavía no hay tipos de cambio',
    empty:
      'Acá van los tipos de cambio para convertir entre pesos y dólares. Actualizá para traerlos, o ingresá uno a mano.',
    emptyDemo:
      'Acá van los tipos de cambio para convertir entre pesos y dólares. Ingresá uno a mano para probar.',
    monthRates: 'Tipos de cambio de {{month}}',
    rateCount_one: '{{count}} tipo de cambio',
    rateCount_other: '{{count}} tipos de cambio',
    manual: 'Ingresado a mano',
    editDay: 'Editar el tipo de cambio del {{day}}',
    correctTitle: 'Corregir un tipo de cambio',
    date: 'Fecha',
    pesosPerDollar: 'Pesos por dólar',
    replaces:
      'Reemplaza {{rate}}. Un tipo de cambio ingresado a mano se conserva cuando se traen los tipos de cambio.',
    keptByHand:
      'Un tipo de cambio ingresado a mano se conserva cuando se traen los tipos de cambio.',
    save: 'Guardar tipo de cambio',
  },
  banks: {
    title: 'Bancos conectados',
    description: 'Importá las transacciones de tus bancos automáticamente.',
    plaidSynced_one: 'Sincronización con Plaid terminada: se importó {{count}} transacción nueva.',
    plaidSynced_other:
      'Sincronización con Plaid terminada: se importaron {{count}} transacciones nuevas.',
    simplefinSynced_one:
      'Sincronización con SimpleFIN terminada: se importó {{count}} transacción nueva.',
    simplefinSynced_other:
      'Sincronización con SimpleFIN terminada: se importaron {{count}} transacciones nuevas.',
    addAnotherBank: 'Agregar otro banco',
    addAnotherConnection: 'Agregar otra conexión',
    syncing: 'Sincronizando…',
    syncAll: 'Sincronizar todo',
    syncNow: 'Sincronizar ahora',
    noPlaidBanks: 'Todavía no hay bancos conectados con Plaid.',
    connectBank: 'Conectar banco',
    plaidConfig: 'Configuración de Plaid',
    plaidConfigHint: 'Ingresá tus credenciales de la API de Plaid para conectar bancos.',
    simplefinConfig: 'Configuración de SimpleFIN',
    simplefinConfigHint: 'Ingresá tu token de configuración de SimpleFIN para conectar bancos.',
    lastSynced: 'Última sincronización {{when}}',
    notLinked: 'Sin vincular',
    reconnect: 'Volver a conectar',
    disconnect: 'Desconectar',
    done: 'Listo',
    syncResult:
      'Sincronizado: {{added}} agregadas, {{modified}} modificadas, {{removed}} eliminadas.',
    syncStatus: {
      good: 'Sincronizado',
      syncing: 'Sincronizando…',
      error: 'Error',
      login_required: 'Hay que iniciar sesión',
    },
    hostedLink: {
      title: 'Terminá de conectar en tu navegador',
      detail:
        'Plaid se abrió en tu navegador. Iniciá sesión en tu banco ahí: FlyBudget sigue solo cuando termines.',
      secure: 'Iniciás sesión en tu banco en el sitio seguro de Plaid, nunca en FlyBudget.',
      reopen: 'Abrir Plaid de nuevo',
      cancelled: 'Se canceló la conexión.',
      expired: 'La sesión de Plaid venció. Probá de nuevo.',
    },
    connect: {
      title: 'Conectar una cuenta bancaria',
      heading: 'Conectá tu banco',
      intro:
        'Vinculá tus cuentas bancarias de forma segura para importar las transacciones automáticamente y tener los saldos al día.',
      preparing: 'Preparando…',
      syncingTitle: 'Sincronizando transacciones',
      syncingDetail: 'Importando tus transacciones. Puede tardar un momento…',
      doneTitle: 'Conexión lista',
      imported_one: 'Se importó {{count}} transacción en {{accounts}}.',
      imported_other: 'Se importaron {{count}} transacciones en {{accounts}}.',
      accountCount_one: '{{count}} cuenta',
      accountCount_other: '{{count}} cuentas',
    },
    mapping: {
      intro: 'Elegí qué hacer con cada cuenta encontrada.',
      create: 'Crear nueva',
      link: 'Vincular a una existente',
      skip: 'Omitir',
      linkTo: 'Cuenta a la que vincular {{name}}',
      selectAccount: 'Elegí una cuenta…',
      accountName: 'Nombre de la cuenta',
      saveAndSync: 'Guardar y sincronizar',
    },
    plaid: {
      setupTitle: 'Configurar la sincronización bancaria',
      setupDetail:
        'Conectá tus cuentas bancarias para importar las transacciones automáticamente con Plaid. Una cuenta de desarrollador es gratis y siempre incluye hasta 10 conexiones bancarias.',
      getCredentials: 'Obtener credenciales de Plaid',
      clientId: 'Client ID',
      clientIdPlaceholder: 'Ingresá tu Client ID de Plaid',
      secret: 'Secret',
      secretPlaceholder: 'Ingresá tu Secret de Plaid',
      environment: 'Entorno',
      production: 'Production: tus cuentas bancarias reales',
      sandbox: 'Sandbox: solo datos de prueba (para desarrolladores)',
      environmentHint: 'Usá el Secret que corresponde a este entorno en tu panel de Plaid.',
      save: 'Guardar credenciales',
      saveError: 'No se pudieron guardar las credenciales. Revisá los datos y probá de nuevo.',
      modalTitle: 'Conectar con Plaid',
      modalHeading: 'Conectar con Plaid',
      modalIntro:
        'Creá una <signup>cuenta de desarrollador de Plaid</signup> gratis para obtener tus credenciales de la API, y después ingresalas acá abajo.',
      configuredTitle: 'Plaid configurado',
      configuredDetail: 'Tus credenciales se guardaron. Ya podés conectar tu banco.',
      loginRequired:
        'Tu banco pide que vuelvas a iniciar sesión. Tocá "Volver a conectar" para actualizar tus credenciales.',
      disconnectTitle: 'Desconectar banco',
      disconnectMessage:
        '¿Seguro que querés desconectar {{name}}? Esto revoca en Plaid el acceso de FlyBudget a este banco. Tus cuentas y transacciones no se eliminan.',
    },
    simplefin: {
      setupDetail:
        'Conectá tus cuentas bancarias para importar las transacciones automáticamente con SimpleFIN Bridge. El servicio cuesta US$1.50 por mes y se le paga directamente a SimpleFIN.',
      getToken: 'Obtener un token de SimpleFIN',
      token: 'Token de configuración',
      tokenPlaceholder: 'Pegá tu token de configuración de SimpleFIN',
      connect: 'Conectar',
      connecting: 'Conectando…',
      connectError: 'No se pudo conectar. Revisá el token de configuración y probá de nuevo.',
      modalTitle: 'Conectar con SimpleFIN',
      modalHeading: 'Conectar con SimpleFIN Bridge',
      modalIntro:
        'Entrá a <bridge>SimpleFIN Bridge</bridge> para crear un token de configuración y pegalo acá abajo. SimpleFIN cuesta US$1.50 por mes y se le paga directamente a ellos.',
      synced_one: 'Sincronizado: se importó {{count}} transacción nueva.',
      synced_other: 'Sincronizado: se importaron {{count}} transacciones nuevas.',
      disconnectTitle: 'Desconectar SimpleFIN',
      disconnectMessage:
        '¿Seguro que querés desconectar {{name}}? FlyBudget va a borrar el acceso que tiene guardado. Para revocarlo del todo, quitá también esta app de tu cuenta de SimpleFIN Bridge en bridge.simplefin.org. Tus cuentas y transacciones no se eliminan.',
    },
  },
  server: {
    version: 'Versión {{version}}',
    versionSentence: 'Versión {{version}}.',
    local: {
      title: 'Dónde están tus datos',
      demoTitle: 'En este navegador (demo)',
      demoDetail:
        'Esta demo funciona entera en tu navegador: nada de lo que cambies se envía a ningún lado ni se guarda. En la app, tu presupuesto es un archivo en tu computadora o en un servidor tuyo.',
      computerTitle: 'En esta computadora',
      computerDetail:
        'Tu presupuesto es un archivo en esta computadora, y FlyBudget solo accede a él a través de su propio servidor local. No se envía nada a FlyBudget ni a nadie más; la sincronización bancaria contacta a Plaid o SimpleFIN solo cuando conectás un banco.',
      otherDevicesTitle: 'Usar FlyBudget en tu celular y otros dispositivos',
      otherDevicesDetail:
        'Instalá FlyBudget en un servidor que controles, como un servidor en tu casa o una máquina chica en la nube, e iniciá sesión desde cualquier navegador. Tus datos pasan a ese servidor; nadie más los aloja.',
      guide: 'Leer la guía para instalarlo en tu servidor',
      backupFirst: 'Hacer una copia de seguridad antes',
    },
    offline: {
      title: 'Copia sin conexión',
      keep: 'Guardar una copia de mi presupuesto en este dispositivo',
      detail:
        'Cuando FlyBudget no llega a su servidor, se abre con lo último que cargó este navegador. Podés mirar todo y agregar transacciones nuevas; se envían cuando vuelve la conexión. La copia se borra al cerrar sesión. Desactivalo en una computadora compartida.',
      waiting_one:
        '{{count}} transacción guardada en este dispositivo está esperando para enviarse.',
      waiting_other:
        '{{count}} transacciones guardadas en este dispositivo están esperando para enviarse.',
    },
    checks: {
      title: 'Revisión de seguridad',
      checking: 'Revisando tu servidor…',
      allGood: 'Todo bien para la forma en que te conectaste recién.',
      warnings_one:
        'Hay {{count}} cosa para revisar. Se arregla con una opción en tu docker-compose.yml.',
      warnings_other:
        'Hay {{count}} cosas para revisar. Cada una se arregla con una opción en tu docker-compose.yml.',
      passed: 'Bien',
      warning: 'Advertencia',
      httpsSecure: 'La conexión está cifrada (HTTPS)',
      httpsLocal: 'Conectado desde la misma computadora que el servidor',
      httpsOff: 'Sin HTTPS: las contraseñas y los datos viajan sin cifrar',
      httpsFix:
        'Poné FlyBudget detrás de un proxy inverso con HTTPS (Caddy, Nginx, Traefik) o una VPN, y configurá <env>FLYBUDGET_TRUST_PROXY</env>.',
      proxyOk: 'La configuración del proxy inverso coincide con cómo te conectás',
      proxyUntrusted: 'Hay un proxy inverso delante de FlyBudget, pero no es de confianza',
      proxyUntrustedFix:
        'Configurá <env>FLYBUDGET_TRUST_PROXY=1</env> (la cantidad de proxies delante de FlyBudget) para que se detecten HTTPS y las direcciones de los clientes.',
      proxyUnused: 'FLYBUDGET_TRUST_PROXY está configurado, pero este pedido llegó sin proxy',
      proxyUnusedFix:
        'Si te conectás directo, quitá <env>FLYBUDGET_TRUST_PROXY</env>: si no, los clientes pueden falsear su dirección y saltearse el límite de intentos de inicio de sesión.',
      hostsOk: 'Solo responde a las direcciones que permitiste',
      hostsAny: 'Responde a cualquier nombre de host',
      hostsFix:
        'Configurá <env>FLYBUDGET_ALLOWED_HOSTS</env> con la dirección que usás, p. ej. <env>FLYBUDGET_ALLOWED_HOSTS=budget.example.com</env>.',
      keyOk: 'Las credenciales bancarias se guardan cifradas',
      keyMissing: 'Las credenciales bancarias no están cifradas',
      keyFix:
        'Configurá <env>FLYBUDGET_DATA_KEY_FILE</env> con un archivo que tenga una clave aleatoria (mirá la guía de instalación en tu servidor).',
      passwordOk: 'Una contraseña protege este servidor',
      passwordMissing: 'Todavía no hay contraseña',
    },
    devices: {
      title: 'Dispositivos con sesión iniciada',
      description:
        'Navegadores con sesión iniciada en este servidor. Cerrá la sesión de los que no reconozcas y después cambiá la contraseña.',
      loadError: 'No se pudieron cargar los dispositivos.',
      thisDevice: 'Este dispositivo',
      browserOn: '{{browser}} en {{os}}',
      unknown: 'Navegador desconocido',
      activeAndSignedIn: 'Activo {{active}} · inició sesión {{signedIn}}',
      signedIn: 'Inició sesión {{signedIn}}',
      signOutNamed: 'Cerrar la sesión de {{name}}',
      signOutOthers: 'Cerrar sesión en los demás dispositivos',
    },
    password: {
      title: 'Cambiar contraseña',
      description:
        'Esta contraseña protege tu servidor de FlyBudget. Cambiarla cierra la sesión en todos los demás dispositivos.',
      current: 'Contraseña actual',
      new: 'Contraseña nueva',
      confirm: 'Repetí la contraseña nueva',
      mismatch: 'Las contraseñas nuevas no coinciden.',
      changed: 'Se cambió la contraseña. Se cerró la sesión en los demás dispositivos.',
    },
    signOut: {
      button: 'Cerrar sesión',
      description: 'Cerrá la sesión de FlyBudget en este navegador.',
    },
  },
  errors: {
    bankRateLimit: 'Demasiados pedidos al banco. Esperá un minuto y probá de nuevo.',
    ratesRefreshLimit:
      'Los tipos de cambio se actualizaron muchas veces recién. Probá de nuevo en una hora.',
  },
};

export default es;
