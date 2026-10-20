import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/mirza.css';
import './app.css';
import App from './App.jsx';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
// Fullscreen (Bot API 8.0+); older clients just stay expanded. A failure
// (UNSUPPORTED on some desktops) only fires `fullscreenFailed`, so it is harmless.
if (tg?.isVersionAtLeast?.('8.0') && !tg.isFullscreen) tg.requestFullscreen();
// "Are you sure?" before closing (Bot API 6.2+).
if (tg?.isVersionAtLeast?.('6.2')) tg.enableClosingConfirmation();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
