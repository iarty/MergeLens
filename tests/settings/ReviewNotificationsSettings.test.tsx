import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: (_key: string, options: Record<string, unknown>) => ({
      getValue: vi.fn(async () => options.fallback),
      setValue: vi.fn(async () => undefined),
      watch: vi.fn(() => vi.fn()),
    }),
  },
}));

import {
  ReviewNotificationsSettings,
  type ReviewNotificationsSettingsServices,
} from '@/features/settings/ReviewNotificationsSettings';

const createServices = (): ReviewNotificationsSettingsServices => ({
  getPreferences: vi.fn(async () => ({ enabled: false, intervalMinutes: 15 as const })),
  savePreferences: vi.fn(async (preferences) => preferences),
  isPermissionGranted: vi.fn(async () => false),
  requestPermission: vi.fn(async () => true),
  getScheduledInterval: vi.fn(async () => null),
});

describe('ReviewNotificationsSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests optional permission from the enable gesture and persists consent', async () => {
    const services = createServices();
    render(<ReviewNotificationsSettings services={services} />);
    const toggle = await screen.findByRole('checkbox', { name: /Disabled/ });

    fireEvent.click(toggle);

    await waitFor(() => expect(services.requestPermission).toHaveBeenCalledOnce());
    expect(services.savePreferences).toHaveBeenCalledWith({
      enabled: true,
      intervalMinutes: 15,
    });
    expect(await screen.findByText('Background polling is scheduled every 15 minutes.'))
      .toBeVisible();
  });

  it('keeps the feature disabled when permission is denied', async () => {
    const services = createServices();
    vi.mocked(services.requestPermission).mockResolvedValue(false);
    render(<ReviewNotificationsSettings services={services} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /Disabled/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notification permission was not granted.',
    );
    expect(services.savePreferences).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Disabled/ })).not.toBeChecked();
  });

  it('persists interval changes and disables without requesting permission', async () => {
    const services = createServices();
    vi.mocked(services.getPreferences).mockResolvedValue({ enabled: true, intervalMinutes: 15 });
    vi.mocked(services.isPermissionGranted).mockResolvedValue(true);
    vi.mocked(services.getScheduledInterval).mockResolvedValue(15);
    render(<ReviewNotificationsSettings services={services} />);

    fireEvent.change(await screen.findByLabelText('Check every'), {
      target: { value: '30' },
    });
    await waitFor(() => expect(services.savePreferences).toHaveBeenCalledWith({
      enabled: true,
      intervalMinutes: 30,
    }));

    fireEvent.click(screen.getByRole('checkbox', { name: /Enabled/ }));
    await waitFor(() => expect(services.savePreferences).toHaveBeenLastCalledWith({
      enabled: false,
      intervalMinutes: 30,
    }));
    expect(services.requestPermission).not.toHaveBeenCalled();
  });
});
