import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/mirza.css';
import './app.css';
import App from './App.jsx';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
