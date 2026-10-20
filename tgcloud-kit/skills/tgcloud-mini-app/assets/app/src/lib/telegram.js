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

// Telegram's native confirm dialog (window.confirm outside Telegram).
export function confirmDialog(message) {
  if (!tg?.showConfirm) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => tg.showConfirm(message, resolve));
}

export function alertDialog(message) {
  if (!tg?.showAlert) return Promise.resolve(window.alert(message));
  return new Promise((resolve) => tg.showAlert(message, resolve));
}

// Opens Telegram's "share to chat" picker with a link.
export function shareLink(url, text = '') {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(share);
  else window.open(share, '_blank', 'noopener');
}

// Copies text, or shows it when the clipboard is not available (some Telegram clients).
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    await alertDialog('کپی شد');
  } catch {
    await alertDialog(text);
  }
}
