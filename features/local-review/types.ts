import type {
  CanonicalPullRequestIdentity,
  LocalReviewErrorCode,
  PullRequestIdentity,
  ReviewTemplate,
} from '@/modules/local-review'
import type {
  GetLocalReviewWorkspaceResponse,
  SavePullRequestNoteResponse,
} from '@/shared/messaging/schemas'

export type LocalReviewControllerErrorCode =
  LocalReviewErrorCode | 'receiver-unavailable' | 'invalid-response'

export interface LocalReviewControllerError {
  code: LocalReviewControllerErrorCode
  message: string
}

export type LocalReviewLoadStatus = 'loading' | 'ready' | 'error'
export type LocalReviewSaveStatus =
  'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type LocalReviewClipboardStatus = 'idle' | 'success' | 'error'

export interface LocalReviewState {
  context: CanonicalPullRequestIdentity
  generation: number
  revision: number
  loadStatus: LocalReviewLoadStatus
  saveStatus: LocalReviewSaveStatus
  clipboardStatus: LocalReviewClipboardStatus
  draft: string
  templates: ReviewTemplate[]
  loadError: LocalReviewControllerError | null
  saveError: LocalReviewControllerError | null
  clipboardError: string | null
  validationMessage: string | null
}

export interface LocalReviewTransport {
  loadWorkspace: (
    context: PullRequestIdentity,
    correlationId: string,
  ) => Promise<GetLocalReviewWorkspaceResponse>
  saveNote: (
    context: PullRequestIdentity,
    body: string,
    correlationId: string,
  ) => Promise<SavePullRequestNoteResponse>
  writeClipboard: (text: string) => Promise<void>
}

export interface InsertTemplateResult {
  inserted: boolean
  cursorPosition: number
}

export interface LocalReviewController {
  getState: () => LocalReviewState
  subscribe: (listener: () => void) => () => void
  reconcileContext: (context: PullRequestIdentity) => void
  setDraft: (draft: string) => void
  insertTemplate: (
    templateId: string,
    selectionStart: number,
    selectionEnd: number,
  ) => InsertTemplateResult
  retry: () => void
  copyDraft: () => Promise<void>
  flush: () => Promise<void>
  dispose: () => Promise<void>
}

export interface LocalReviewControllerOptions {
  debounceMs?: number
  createCorrelationId?: () => string
  transport?: LocalReviewTransport
}

export interface LocalReviewPanelProps {
  controller: LocalReviewController
}
