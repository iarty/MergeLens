import React from 'react';
import ReactDOM from 'react-dom/client';
import { TokenSettings } from '@/features/settings/TokenSettings';
import { QuickLinksSettings } from '@/features/settings/QuickLinksSettings';
import { ReviewTemplatesSettings } from '@/features/settings/ReviewTemplatesSettings';
import './style.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Options root element is unavailable');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <div className="settings-page">
      <TokenSettings />
      <QuickLinksSettings />
      <ReviewTemplatesSettings />
    </div>
  </React.StrictMode>,
);
