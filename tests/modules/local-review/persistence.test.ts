import { beforeEach, describe, expect, it } from 'vitest';
import {
  DexieLocalReviewRepository,
  LOCAL_REVIEW_DATABASE_VERSION,
  MAX_REVIEW_TEMPLATE_COUNT,
  LocalReviewDatabase,
  LocalReviewValidationError,
  createPullRequestKey,
  type ReviewTemplate,
} from '@/modules/local-review';

type Row = Record<string, unknown>;

class FakeTable {
  private readonly rows = new Map<string, Row>();

  constructor(private readonly key: string) {}

  async get(id: string): Promise<Row | undefined> { return this.rows.get(id); }
  async put(row: Row): Promise<string> {
    this.rows.set(String(row[this.key]), row);
    return String(row[this.key]);
  }
  async delete(id: string): Promise<void> { this.rows.delete(id); }
  async count(): Promise<number> { return this.rows.size; }
  async toArray(): Promise<Row[]> { return [...this.rows.values()]; }
  seed(id: string, row: Row): void { this.rows.set(id, row); }
}

class FakeDatabase {
  readonly notes = new FakeTable('prKey');
  readonly templates = new FakeTable('id');
  private opened = false;
  readonly version = LOCAL_REVIEW_DATABASE_VERSION;

  isOpen(): boolean { return this.opened; }
  async open(): Promise<void> { this.opened = true; }
  async transaction<T>(_mode: string, _table: unknown, callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}

const timestamp = '2026-08-14T10:00:00.000Z';
const identity = createPullRequestKey({ owner: 'OpenAI', repository: 'Codex', pullNumber: 42 });
const note = { ...identity, body: 'private draft', updatedAt: timestamp };

const template = (id: string, title: string): ReviewTemplate => ({
  id,
  title,
  body: `Body ${id}`,
  createdAt: timestamp,
  updatedAt: timestamp,
});

describe('Dexie local review persistence', () => {
  let database: FakeDatabase;
  let repository: DexieLocalReviewRepository;

  beforeEach(() => {
    database = new FakeDatabase();
    repository = new DexieLocalReviewRepository(database as unknown as LocalReviewDatabase);
  });

  it('opens the versioned schema and round-trips notes/templates', async () => {
    expect(database.version).toBe(LOCAL_REVIEW_DATABASE_VERSION);
    expect(await repository.readNote(identity)).toBeNull();

    await repository.saveNote(note);
    expect(await repository.readNote(identity)).toEqual(note);

    await repository.upsertTemplate(template('z', 'Zeta'));
    await repository.upsertTemplate(template('a', 'Alpha'));
    expect((await repository.listTemplates()).map((item) => item.id)).toEqual(['a', 'z']);
  });

  it('ignores malformed and future records without exposing raw data', async () => {
    database.notes.seed(identity.prKey, {
      schemaVersion: 99,
      prKey: identity.prKey,
      owner: identity.owner,
      repository: identity.repository,
      pullNumber: identity.pullNumber,
      body: 'future record',
      updatedAt: timestamp,
    });
    database.templates.seed('bad', { schemaVersion: 1, id: '', title: '', body: '', createdAt: timestamp, updatedAt: timestamp });

    expect(await repository.readNote(identity)).toBeNull();
    expect(await repository.listTemplates()).toEqual([]);
  });

  it('isolates notes by repository and pull request and deletes blank notes', async () => {
    await repository.saveNote(note);
    const otherPr = createPullRequestKey({ owner: 'openai', repository: 'codex', pullNumber: 43 });
    const otherRepo = createPullRequestKey({ owner: 'openai', repository: 'other', pullNumber: 42 });
    expect(await repository.readNote(otherPr)).toBeNull();
    expect(await repository.readNote(otherRepo)).toBeNull();

    await repository.saveNote({ ...identity, body: '   ', updatedAt: '2026-08-14T11:00:00.000Z' });
    expect(await repository.readNote(identity)).toBeNull();
  });

  it('enforces template limits while allowing updates', async () => {
    for (let index = 0; index < MAX_REVIEW_TEMPLATE_COUNT; index += 1) {
      await repository.upsertTemplate(template(`template-${index}`, `Template ${index}`));
    }
    await expect(repository.upsertTemplate(template('overflow', 'Overflow')))
      .rejects.toBeInstanceOf(LocalReviewValidationError);
    await expect(repository.upsertTemplate(template('template-0', 'Updated'))).resolves.toMatchObject({ id: 'template-0' });
    expect(await repository.listTemplates()).toHaveLength(MAX_REVIEW_TEMPLATE_COUNT);
  });
});
