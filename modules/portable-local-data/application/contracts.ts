import type {
  PortableDataConflictDecisions,
  PortableDataConflictKey,
  PortableLocalData,
  PortableLocalDataValidationErrorCode,
} from '../domain/PortableLocalData';

export interface PortableLocalDataCounts {
  notes: number;
  reviewTemplates: number;
  savedFilters: number;
  globalWorkspacePreferences: number;
  repositoryWorkspacePreferences: number;
  reviewNotificationPreferences: number;
}

export type PortableLocalDataErrorCode =
  | PortableLocalDataValidationErrorCode
  | 'quota-exceeded'
  | 'storage-unavailable'
  | 'serialization-failed';

export interface PortableLocalDataError {
  code: PortableLocalDataErrorCode;
  message: string;
  issueCount?: number;
  failedCategory?: keyof PortableLocalDataCounts;
}

export type ExportPortableLocalDataResult =
  | {
      status: 'success';
      data: PortableLocalData;
      serializedData: string;
      counts: PortableLocalDataCounts;
      byteLength: number;
    }
  | { status: 'error'; error: PortableLocalDataError };

export interface PortableLocalDataImportPreview {
  data: PortableLocalData;
  additions: PortableLocalDataCounts;
  conflicts: PortableDataConflictKey[];
  skipped: PortableLocalDataCounts;
}

export type PreviewPortableLocalDataImportResult =
  | { status: 'success'; preview: PortableLocalDataImportPreview }
  | { status: 'error'; error: PortableLocalDataError };

export interface ApplyPortableLocalDataImportInput {
  preview: PortableLocalDataImportPreview;
  conflictDecisions: PortableDataConflictDecisions;
}

export type ApplyPortableLocalDataImportResult =
  | {
      status: 'success';
      imported: PortableLocalDataCounts;
      skipped: PortableLocalDataCounts;
    }
  | {
      status: 'partial';
      imported: PortableLocalDataCounts;
      skipped: PortableLocalDataCounts;
      error: PortableLocalDataError;
    }
  | { status: 'error'; error: PortableLocalDataError };
