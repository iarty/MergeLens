import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortableLocalDataSettings, type PortableLocalDataSettingsServices } from '@/features/settings/PortableLocalDataSettings';
import type { PortableLocalDataImportPreview } from '@/modules/portable-local-data';

const preview: PortableLocalDataImportPreview = {
  data: {
    format: 'mergelens-portable-local-data', schemaVersion: 1, exportedAt: '2026-08-19T10:00:00.000Z',
    data: {
      notes: [], reviewTemplates: [], savedFilters: [], globalWorkspacePreferences: {},
      repositoryWorkspacePreferences: [], reviewNotificationPreferences: { enabled: false, intervalMinutes: 15 },
    },
  },
  additions: { notes: 1, reviewTemplates: 0, savedFilters: 0, globalWorkspacePreferences: 0, repositoryWorkspacePreferences: 0, reviewNotificationPreferences: 0 },
  conflicts: [{ category: 'notes', key: 'acme/api#2' }],
  skipped: { notes: 0, reviewTemplates: 0, savedFilters: 0, globalWorkspacePreferences: 0, repositoryWorkspacePreferences: 0, reviewNotificationPreferences: 0 },
};

const createServices = (): PortableLocalDataSettingsServices => ({
  exportData: vi.fn(async () => ({ status: 'success' as const, data: preview.data, serializedData: '{}', counts: preview.additions, byteLength: 2 })),
  previewImport: vi.fn(async () => ({ status: 'success' as const, preview })),
  applyImport: vi.fn(async () => ({ status: 'success' as const, imported: preview.additions, skipped: preview.skipped })),
});

describe('PortableLocalDataSettings', () => {
  it('exposes accessible export and import controls', () => {
    render(<PortableLocalDataSettings services={createServices()} />);
    expect(screen.getByRole('region', { name: 'Portable local data' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeVisible();
    expect(screen.getByLabelText('Import JSON')).toBeInTheDocument();
    expect(screen.getByText('Import is merge-only. Records missing from the file remain unchanged.')).toBeVisible();
  });

  it('previews a file, requires conflict choice and confirmation, then applies import', async () => {
    const services = createServices();
    render(<PortableLocalDataSettings services={services} />);
    const fileInput = screen.getByLabelText('Import JSON') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['{}'], 'portable.json', { type: 'application/json' })] } });
    await screen.findByRole('heading', { name: 'Import preview' });
    expect(screen.getByRole('button', { name: 'Import data' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Keep existing' }));
    const confirmation = screen.getByRole('checkbox', { name: /confirm this data/i });
    fireEvent.click(confirmation);
    fireEvent.click(screen.getByRole('button', { name: 'Import data' }));
    await waitFor(() => expect(services.applyImport).toHaveBeenCalledWith(expect.objectContaining({
      conflictDecisions: { notes: 'keep-existing' },
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Imported 1 records.');
  });

  it('downloads a successful export without exposing payload in status', async () => {
    const services = createServices();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<PortableLocalDataSettings services={services} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Exported 1 records.');
    expect(screen.queryByText('{}')).toBeNull();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
