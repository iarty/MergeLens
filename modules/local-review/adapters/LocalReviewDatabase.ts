import Dexie, { type Table } from 'dexie';

export const LOCAL_REVIEW_DATABASE_NAME = 'mergelens-local-review';
export const LOCAL_REVIEW_DATABASE_VERSION = 1;

export interface StoredPullRequestNote {
  schemaVersion: 1;
  prKey: string;
  owner: string;
  repository: string;
  pullNumber: number;
  body: string;
  updatedAt: string;
}

export interface StoredReviewTemplate {
  schemaVersion: 1;
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export class LocalReviewDatabase extends Dexie {
  notes!: Table<StoredPullRequestNote, string>;
  templates!: Table<StoredReviewTemplate, string>;

  constructor(databaseName = LOCAL_REVIEW_DATABASE_NAME) {
    super(databaseName);

    this.version(LOCAL_REVIEW_DATABASE_VERSION).stores({
      notes: '&prKey, updatedAt',
      templates: '&id, title, updatedAt',
    });
  }
}
