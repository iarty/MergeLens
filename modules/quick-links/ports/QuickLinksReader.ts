import type { QuickLinksData, QuickLinksError } from '../domain/QuickLinks'

export interface ReadQuickLinksInput {
  owner: string
  repository: string
  pullNumber: number
}

export type QuickLinksReadResult =
  | { status: 'success'; data: QuickLinksData }
  | { status: 'error'; error: QuickLinksError }

export interface QuickLinksReader {
  read(input: ReadQuickLinksInput): Promise<QuickLinksReadResult>
}
