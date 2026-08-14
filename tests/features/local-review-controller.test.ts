import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalReviewController,
} from '@/features/local-review/localReviewController';
import type {
  LocalReviewController,
  LocalReviewTransport,
} from '@/features/local-review/types';
import type {
  GetLocalReviewWorkspaceResponse,
  SavePullRequestNoteResponse,
} from '@/shared/messaging/schemas';

const contextA = { owner: 'OpenAI', repository: 'Codex', pullNumber: 42 };
const contextB = { owner: 'OpenAI', repository: 'Codex', pullNumber: 43 };

type WorkspaceSuccess = Extract<
  GetLocalReviewWorkspaceResponse,
  { status: 'success' }
>;
type SaveSuccess = Extract<SavePullRequestNoteResponse, { status: 'success' }>;

const workspaceResponse = (
  correlationId = 'load-1',
  body = '',
): WorkspaceSuccess => ({
  status: 'success',
  correlationId,
  data: {
    note: body.length > 0
      ? {
          prKey: 'openai/codex#42',
          owner: 'openai',
          repository: 'codex',
          pullNumber: 42,
          body,
          updatedAt: '2026-08-14T10:00:00.000Z',
        }
      : null,
    templates: [],
  },
});

const saveResponse = (
  correlationId: string,
  body: string,
): SaveSuccess => ({
  status: 'success',
  correlationId,
  data: {
    note: body.length > 0
      ? {
          prKey: 'openai/codex#42',
          owner: 'openai',
          repository: 'codex',
          pullNumber: 42,
          body,
          updatedAt: '2026-08-14T10:00:00.000Z',
        }
      : null,
  },
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createTransport = (
  overrides: Partial<LocalReviewTransport> = {},
): LocalReviewTransport => ({
  loadWorkspace: vi.fn(async (_context, correlationId) =>
    workspaceResponse(correlationId)),
  saveNote: vi.fn(async (_context, body, correlationId) =>
    saveResponse(correlationId, body)),
  writeClipboard: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('localReviewController', () => {
  const controllers: LocalReviewController[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await Promise.all(controllers.map((controller) => controller.dispose()));
    vi.useRealTimers();
  });

  const createController = (
    transport: LocalReviewTransport,
    debounceMs = 50,
  ): LocalReviewController => {
    let correlationSequence = 0;
    const controller = createLocalReviewController(contextA, {
      transport,
      debounceMs,
      createCorrelationId: () => `correlation-${++correlationSequence}`,
    });
    controllers.push(controller);
    return controller;
  };

  it('ignores a stale load after navigation to another pull request', async () => {
    const firstLoad = deferred<GetLocalReviewWorkspaceResponse>();
    const transport = createTransport({
      loadWorkspace: vi.fn()
        .mockReturnValueOnce(firstLoad.promise)
        .mockImplementation(async (_context, correlationId) => ({
          ...workspaceResponse(correlationId, 'PR 43 draft'),
          data: {
            ...workspaceResponse(correlationId, 'PR 43 draft').data,
            note: {
              prKey: 'openai/codex#43',
              owner: 'openai',
              repository: 'codex',
              pullNumber: 43,
              body: 'PR 43 draft',
              updatedAt: '2026-08-14T10:00:00.000Z',
            },
          },
        })),
    });
    const controller = createController(transport);

    controller.reconcileContext(contextB);
    await settle();
    expect(controller.getState()).toMatchObject({
      context: { prKey: 'openai/codex#43' },
      loadStatus: 'ready',
      draft: 'PR 43 draft',
    });

    firstLoad.resolve(workspaceResponse('correlation-1', 'stale PR 42 draft'));
    await settle();
    expect(controller.getState()).toMatchObject({
      context: { prKey: 'openai/codex#43' },
      draft: 'PR 43 draft',
    });
  });

  it('serializes saves and applies only the latest revision result', async () => {
    const firstSave = deferred<SavePullRequestNoteResponse>();
    const secondSave = deferred<SavePullRequestNoteResponse>();
    const transport = createTransport({
      saveNote: vi.fn()
        .mockReturnValueOnce(firstSave.promise)
        .mockReturnValueOnce(secondSave.promise),
    });
    const controller = createController(transport);
    await settle();

    controller.setDraft('first revision');
    await vi.advanceTimersByTimeAsync(50);
    expect(transport.saveNote).toHaveBeenCalledTimes(1);
    expect(controller.getState().saveStatus).toBe('saving');

    controller.setDraft('second revision');
    await vi.advanceTimersByTimeAsync(50);
    expect(transport.saveNote).toHaveBeenCalledTimes(1);

    firstSave.resolve(saveResponse('correlation-2', 'first revision'));
    await settle();
    expect(transport.saveNote).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({
      draft: 'second revision',
      saveStatus: 'saving',
    });

    secondSave.resolve(saveResponse('correlation-3', 'second revision'));
    await settle();
    expect(controller.getState().saveStatus).toBe('saved');
  });

  it('preserves same-PR drafts and flushes an immutable old-PR snapshot', async () => {
    const transport = createTransport();
    const controller = createController(transport);
    await settle();

    controller.setDraft('PR 42 pending draft');
    controller.reconcileContext({
      owner: 'openai',
      repository: 'CODEX',
      pullNumber: 42,
    });
    expect(controller.getState()).toMatchObject({
      context: { prKey: 'openai/codex#42' },
      draft: 'PR 42 pending draft',
      saveStatus: 'dirty',
    });

    controller.reconcileContext(contextB);
    await settle();
    expect(transport.saveNote).toHaveBeenCalledWith(
      expect.objectContaining({ pullNumber: 42 }),
      'PR 42 pending draft',
      expect.any(String),
    );
    expect(controller.getState().context.prKey).toBe('openai/codex#43');
  });

  it('inserts templates before a selection and rejects oversized drafts', async () => {
    const transport = createTransport({
      loadWorkspace: vi.fn(async (_context, correlationId) => ({
        ...workspaceResponse(correlationId, 'ABCDE'),
        data: {
          ...workspaceResponse(correlationId, 'ABCDE').data,
          templates: [{
            id: 'template-1',
            title: 'Template title',
            body: 'XX',
            createdAt: '2026-08-14T10:00:00.000Z',
            updatedAt: '2026-08-14T10:00:00.000Z',
          }],
        },
      })),
    });
    const controller = createController(transport);
    await settle();

    expect(controller.insertTemplate('template-1', 1, 4)).toEqual({
      inserted: true,
      cursorPosition: 3,
    });
    expect(controller.getState().draft).toBe('AXXBCDE');

    controller.setDraft('x'.repeat(50_001));
    expect(controller.getState()).toMatchObject({
      draft: 'AXXBCDE',
      saveStatus: 'error',
      saveError: { code: 'invalid-input' },
    });
  });

  it('maps receiver failures and supports retrying the workspace load', async () => {
    const transport = createTransport({
      loadWorkspace: vi.fn()
        .mockRejectedValueOnce(
          new Error('Could not establish connection. Receiving end does not exist.'),
        )
        .mockImplementation(async (_context, correlationId) =>
          workspaceResponse(correlationId)),
    });
    const controller = createController(transport);
    await settle();
    expect(controller.getState()).toMatchObject({
      loadStatus: 'error',
      loadError: { code: 'receiver-unavailable' },
    });

    controller.retry();
    await settle();
    expect(controller.getState().loadStatus).toBe('ready');
  });
});
