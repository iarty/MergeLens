import { describe, expect, it, vi } from 'vitest';
import { OctokitQuickLinksReader } from '@/modules/quick-links';

vi.mock('@/shared/github/auth/localToken', () => ({
  readLocalGitHubToken: vi.fn(),
}));

const input = { owner: 'facebook', repository: 'react', pullNumber: 42 };
const deployment = {
  id: 7,
  environment: 'Preview',
  sha: 'head-sha',
  statuses_url: 'https://api.github.com/repos/facebook/react/deployments/7/statuses',
};

const createClient = (overrides: Record<string, unknown> = {}) => ({
  rest: {
    pulls: { get: vi.fn().mockResolvedValue({ data: { head: { sha: 'head-sha' } } }) },
    repos: {
      listDeployments: vi.fn().mockResolvedValue({ data: [deployment], headers: {} }),
      listDeploymentStatuses: vi.fn().mockResolvedValue({
        data: [{ state: 'success', environment_url: 'https://preview.example.com', updated_at: '2026-08-14T01:00:00Z' }],
      }),
      ...overrides,
    },
  },
});

describe('OctokitQuickLinksReader', () => {
  it('returns missing-token before creating a client', async () => {
    const factory = vi.fn();
    const reader = new OctokitQuickLinksReader(vi.fn().mockResolvedValue(null), factory);
    await expect(reader.read(input)).resolves.toMatchObject({ status: 'error', error: { code: 'missing-token' } });
    expect(factory).not.toHaveBeenCalled();
  });

  it('loads bounded deployments, latest statuses, and configured links', async () => {
    const client = createClient();
    const reader = new OctokitQuickLinksReader(
      vi.fn().mockResolvedValue('token'),
      () => client as never,
      vi.fn().mockResolvedValue([{ id: 'docs', label: 'Docs', url: 'https://docs.example.com/' }]),
    );
    const result = await reader.read(input);

    expect(result).toMatchObject({ status: 'success', data: { deployments: [{ state: 'success' }] } });
    expect(client.rest.repos.listDeployments).toHaveBeenCalledWith({
      owner: 'facebook', repo: 'react', sha: 'head-sha', per_page: 6,
    });
    expect(client.rest.repos.listDeploymentStatuses).toHaveBeenCalledWith({
      owner: 'facebook', repo: 'react', deployment_id: 7, per_page: 1,
    });
    expect(JSON.stringify(result)).not.toContain('token');
  });

  it.each([[401, 'unauthorized'], [403, 'rate-limited'], [503, 'network-error']] as const)(
    'maps HTTP %s to %s',
    async (status, code) => {
      const error = Object.assign(new Error('request failed'), { status, response: { headers: {} } });
      const client = createClient({ listDeployments: vi.fn().mockRejectedValue(error) });
      const reader = new OctokitQuickLinksReader(vi.fn().mockResolvedValue('token'), () => client as never);
      await expect(reader.read(input)).resolves.toMatchObject({ status: 'error', error: { code } });
    },
  );
});
