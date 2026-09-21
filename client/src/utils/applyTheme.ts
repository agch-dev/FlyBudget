import { usePreferencesStore, type Theme } from '../store/preferencesStore';

function setDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

function apply(theme: Theme) {
  if (theme === 'dark') {
    setDark(true);
  } else if (theme === 'light') {
    setDark(false);
  } else {
    setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
}

export function initTheme() {
  const theme = usePreferencesStore.getState().theme;
  apply(theme);

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (usePreferencesStore.getState().theme === 'system') {
      setDark(mq.matches);
    }
  });

  usePreferencesStore.subscribe((state) => apply(state.theme));
}
