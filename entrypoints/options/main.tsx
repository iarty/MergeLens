import React from 'react';
import ReactDOM from 'react-dom/client';
import { TokenSettings } from '@/features/settings/TokenSettings';
import './style.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Options root element is unavailable');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TokenSettings />
  </React.StrictMode>,
);
