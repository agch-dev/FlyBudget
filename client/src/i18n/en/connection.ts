import type { AppMode } from '../../hooks/useServer';
import type { ConnectionSecurity } from '../../utils/connection';

// Whether FlyBudget's server can be reached: the banner, the reconnect screen, the hints next
// to save buttons and the sidebar's server status.
export default {
  /** What a failed save says when the request never reached the server (`NetworkError`) */
  networkError: "Can't reach FlyBudget right now. Nothing was saved; try again once it reconnects.",
  banner: {
    label: 'Connection',
    cantReach: "Can't reach FlyBudget.",
    /** `when` is a distance from now, like "5 minutes ago" */
    dataAsOf: 'Showing your data as of {{when}}.',
    lookAround: 'You can still look around.',
    savedOnDevice:
      'New transactions are saved on this device; other changes wait until it reconnects.',
    savingPaused: 'Saving is paused.',
    waiting_one: '{{count}} transaction waiting to send',
    waiting_other: '{{count}} transactions waiting to send',
    retryNow: 'Retry now',
    reconnected: 'Reconnected. Everything is up to date.',
  },
  retry: {
    checking: 'Checking…',
    paused: 'Paused while this tab is in the background',
    tryingAgainIn: 'Trying again in {{seconds}}s',
    tryingAgain: 'Trying again…',
    retryingIn: 'Retrying in {{seconds}}s',
    retrying: 'Retrying…',
    progress: 'Time until the next try',
  },
  hint: {
    savingPaused: 'Saving is paused until FlyBudget reconnects.',
    savedOnDevice:
      "Can't reach FlyBudget. This is saved on this device and sent when it reconnects.",
  },
  reconnect: {
    /** Keyed by `AppMode` */
    title: {
      desktop: 'FlyBudget is starting up again',
      server: 'Reconnecting to your server',
      dev: 'Reconnecting to FlyBudget',
    } satisfies Record<AppMode, string>,
    fewSeconds: 'This usually takes a few seconds.',
    serverError: "FlyBudget's server answered with an error.",
    /** `retry` is one of the `retry.*` sentences */
    cantReach: "Can't reach it right now. {{retry}}",
    tryNow: 'Try now',
    desktopHint:
      "If this doesn't go away, quit FlyBudget and open it again. Your data is safe on this computer.",
    devHint:
      'The development server may be restarting. If it stopped, run <code>npm run dev</code> again.',
    troubleshooting: 'Troubleshooting',
    budgetSafe: "Your budget is safe on the server; this page just can't reach it.",
    checkContainer: 'Check that the container is running:',
    seeLogs: 'See what it logged:',
    proxy:
      "If you reach it through a reverse proxy or VPN, check that it's running too, and that this device is connected to the right network.",
  },
  status: {
    demoPlace: 'Demo in this browser',
    onThisComputer: 'On this computer',
    thisBrowser: 'This browser',
    thisComputer: 'This computer',
    online: 'Online',
    reconnecting: 'Reconnecting',
    reconnectingNow: 'Reconnecting…',
    label: 'Server status: {{state}}, {{place}}',
    menu: 'Server',
    serverOnline: 'Server online',
    reconnectingToServer: 'Reconnecting to the server',
    address: 'Address',
    connection: 'Connection',
    version: 'Version',
    /** Keyed by `ConnectionSecurity` */
    security: {
      encrypted: 'Encrypted (HTTPS)',
      local: 'Stays on this computer',
      unencrypted: 'Not encrypted (HTTP)',
    } satisfies Record<ConnectionSecurity, string>,
    retryNow: 'Retry now',
    serverSettings: 'Server settings',
    signOut: 'Sign out',
  },
} as const;
