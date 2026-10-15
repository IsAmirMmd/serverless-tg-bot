import { useEffect } from 'react';

export const tg = window.Telegram?.WebApp;

// Follows Telegram's light/dark scheme and paints the Telegram header to match.
export function useTelegramTheme() {
  useEffect(() => {
    const apply = () => {
      const dark = tg?.colorScheme === 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const bg = dark ? '#17181a' : '#f4efe7';
      tg?.setHeaderColor?.(bg);
      tg?.setBackgroundColor?.(bg);
    };
    apply();
    tg?.onEvent?.('themeChanged', apply);
    return () => tg?.offEvent?.('themeChanged', apply);
  }, []);
}
