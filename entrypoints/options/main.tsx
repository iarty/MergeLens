import React from 'react';
import ReactDOM from 'react-dom/client';
import { TokenSettings } from '@/features/settings/TokenSettings';
import { QuickLinksSettings } from '@/features/settings/QuickLinksSettings';
import { ReviewTemplatesSettings } from '@/features/settings/ReviewTemplatesSettings';
import { WorkspacePreferencesSettings } from '@/features/settings/WorkspacePreferencesSettings';
import { ReviewNotificationsSettings } from '@/features/settings/ReviewNotificationsSettings';
import { PortableLocalDataSettings } from '@/features/settings/PortableLocalDataSettings';
import { portableLocalDataServices } from './portableLocalDataServices';
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
      <ReviewNotificationsSettings />
      <WorkspacePreferencesSettings />
      <PortableLocalDataSettings services={portableLocalDataServices} />
    </div>
  </React.StrictMode>,
);
