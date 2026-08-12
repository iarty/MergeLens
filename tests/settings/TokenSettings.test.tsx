import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenSettings } from '@/features/settings/TokenSettings';
import {
  clearLocalGitHubToken,
  hasLocalGitHubToken,
  saveLocalGitHubToken,
} from '@/shared/github/auth/localToken';

vi.mock('@/shared/github/auth/localToken', () => ({
  clearLocalGitHubToken: vi.fn(),
  hasLocalGitHubToken: vi.fn(),
  saveLocalGitHubToken: vi.fn(),
}));

describe('TokenSettings', () => {
  beforeEach(() => {
    vi.mocked(hasLocalGitHubToken).mockResolvedValue(false);
    vi.mocked(saveLocalGitHubToken).mockResolvedValue(undefined);
    vi.mocked(clearLocalGitHubToken).mockResolvedValue(undefined);
  });

  it('saves a token and never displays it after save', async () => {
    render(<TokenSettings />);
    await screen.findByText('No token configured');

    const tokenInput = screen.getByLabelText('Personal access token');
    fireEvent.change(tokenInput, { target: { value: 'secret-test-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save token' }));

    await waitFor(() => {
      expect(saveLocalGitHubToken).toHaveBeenCalledWith('secret-test-token');
    });
    expect(await screen.findByText('Token configured')).toBeInTheDocument();
    expect(tokenInput).toHaveValue('');
    expect(screen.queryByText('secret-test-token')).not.toBeInTheDocument();
  });

  it('clears a configured token', async () => {
    vi.mocked(hasLocalGitHubToken).mockResolvedValue(true);
    render(<TokenSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Clear token' }));

    await waitFor(() => {
      expect(clearLocalGitHubToken).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText('No token configured')).toBeInTheDocument();
  });
});
