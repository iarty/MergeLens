import { describe, expect, it } from 'vitest';
import {
  isReceiverUnavailableError,
  parseToolbarRequest,
  parseToolbarResponse,
} from '@/shared/messaging/protocol';
import type { MergeLensProtocolMap } from '@/shared/messaging/protocol';

const request = {
  correlationId: 'request-1',
  context: {
    kind: 'pull-request' as const,
    owner: 'openai',
    repository: 'codex',
    pullNumber: 42,
    url: 'https://github.com/openai/codex/pull/42',
  },
};

describe('PR toolbar messaging protocol', () => {
  it('defines a typed options-page command response', () => {
    const response: ReturnType<MergeLensProtocolMap['openOptionsPage']> = {
      status: 'success',
    };

    expect(response).toEqual({ status: 'success' });
  });
  it('validates a safe toolbar request', () => {
    expect(parseToolbarRequest(request)).toEqual(request);
  });

  it('rejects malformed request data', () => {
    expect(() =>
      parseToolbarRequest({
        ...request,
        context: { ...request.context, pullNumber: 0 },
      }),
    ).toThrow('Invalid PR toolbar request');
  });

  it('validates a normalized success response', () => {
    const response = {
      status: 'success' as const,
      correlationId: 'request-1',
      data: {
        pullRequest: {
          title: 'Add toolbar',
          url: 'https://github.com/openai/codex/pull/42',
          state: 'open' as const,
          isDraft: false,
          authorLogin: 'octocat',
        },
        checks: [],
        actionsUrl: 'https://github.com/openai/codex/actions',
      },
    };

    expect(parseToolbarResponse(response)).toEqual(response);
  });

  it('identifies common missing receiver errors', () => {
    expect(
      isReceiverUnavailableError(
        new Error('Could not establish connection. Receiving end does not exist.'),
      ),
    ).toBe(true);
    expect(isReceiverUnavailableError(new Error('Network request failed'))).toBe(false);
  });
});
