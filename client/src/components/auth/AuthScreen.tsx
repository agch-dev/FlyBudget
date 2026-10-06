import { LanguageSwitch } from '../ui/LanguageSwitch';

/**
 * Centered card with the logo, used for sign-in, setup and reconnecting. These screens come
 * before Settings can be reached, so the App Language switch is on them.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt px-4">
      <div className="w-full max-w-sm bg-surface rounded-xl border border-border-light shadow-card p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="" className="w-12 h-12 mb-3" />
          <h1 className="text-lg font-semibold text-text text-center">{title}</h1>
          {subtitle && (
            <div className="text-sm text-text-secondary text-center mt-1 leading-relaxed">
              {subtitle}
            </div>
          )}
        </div>
        {children}
        <div className="flex justify-center mt-6">
          <LanguageSwitch />
        </div>
      </div>
    </div>
  );
}
