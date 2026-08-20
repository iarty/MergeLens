export type DeploymentState =
  'pending' | 'success' | 'failure' | 'inactive' | 'error' | 'unknown'

export interface DeploymentSummary {
  id: string
  environment: string
  state: DeploymentState
  url: string | null
  updatedAt: string | null
}

export interface ConfiguredQuickLink {
  id: string
  label: string
  url: string
}

export interface QuickLinksData {
  deployments: DeploymentSummary[]
  configuredLinks: ConfiguredQuickLink[]
}

export type QuickLinksErrorCode =
  | 'invalid-request'
  | 'missing-token'
  | 'unauthorized'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'unknown-error'

export interface QuickLinksError {
  code: QuickLinksErrorCode
  message: string
  retryAfterSeconds?: number
}
