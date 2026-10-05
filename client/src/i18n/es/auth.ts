import type { Translation } from '../catalog';
import type en from '../en/auth';

const es: Translation<typeof en> = {
  setupTitle: 'Configurá tu servidor de FlyBudget',
  signInTitle: 'Iniciar sesión en FlyBudget',
  serverAddress: 'Dirección del servidor',
  setupIntro:
    'Creá la contraseña que protege este servidor. Cualquiera que pueda acceder a él va a necesitar esta contraseña.',
  insecure:
    '<strong>La conexión no es segura.</strong> Tu contraseña viajaría sin cifrar. Continuá solo en una red de confianza.',
  setupCode: 'Código de configuración',
  setupCodeHint:
    'Aparece en el registro del servidor. Con Docker, ejecutá <code>docker logs flybudget</code>.',
  password: 'Contraseña',
  newPassword: 'Contraseña nueva',
  confirmPassword: 'Confirmar contraseña',
  createPassword: 'Crear contraseña',
  signIn: 'Iniciar sesión',
  errors: {
    tooShort: 'Usá al menos {{min}} caracteres.',
    mismatch: 'Las contraseñas no coinciden.',
    incorrectPassword: 'Contraseña incorrecta',
    incorrectCurrentPassword: 'La contraseña actual es incorrecta',
    incorrectSetupCode: 'Código de configuración incorrecto',
    tooManyAttempts: 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.',
  },
};

export default es;
