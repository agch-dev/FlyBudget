// Server mode: the sign-in and set-a-password screens.
export default {
  setupTitle: 'Set up your FlyBudget server',
  signInTitle: 'Sign in to FlyBudget',
  serverAddress: 'Server address',
  setupIntro:
    'Create the password that protects this server. Anyone who can reach it will need this password.',
  insecure:
    '<strong>Not a secure connection.</strong> Your password would travel unencrypted. Only continue on a network you trust.',
  setupCode: 'Setup code',
  setupCodeHint: 'Printed in the server log. With Docker, run <code>docker logs flybudget</code>.',
  password: 'Password',
  newPassword: 'New password',
  confirmPassword: 'Confirm password',
  createPassword: 'Create password',
  signIn: 'Sign in',
  errors: {
    tooShort: 'Use at least {{min}} characters.',
    mismatch: "The passwords don't match.",
    // The server's own refusals (api/serverErrors.ts): the English is the server's text
    incorrectPassword: 'Incorrect password',
    incorrectCurrentPassword: 'Current password is incorrect',
    incorrectSetupCode: 'Incorrect setup code',
    tooManyAttempts: 'Too many attempts. Wait 15 minutes and try again.',
  },
} as const;
