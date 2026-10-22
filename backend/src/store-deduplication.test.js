import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileEventStore, InMemoryEventStore } from './store.js';

const duplicateBatch = [
  { type: 'vault', id: 7, targetLedger: 100 },
  { type: 'vault', id: 7, targetLedger: 100 },
];

describe('event-store batch deduplication', () => {
  it('keeps one copy in the in-memory store', async () => {
    const store = new InMemoryEventStore();
    assert.strictEqual((await store.append(duplicateBatch)).length, 1);
  });

  it('persists one copy in the file store', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chronostar-events-'));
    const filePath = join(directory, 'events.json');
    const store = new FileEventStore(filePath);

    await store.append(duplicateBatch);

    assert.strictEqual(JSON.parse(await readFile(filePath, 'utf8')).length, 1);
  });
});
