import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileEventStore } from './store.js';

describe('FileEventStore write queue recovery', () => {
  it('allows a later append after one write fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chronostar-queue-'));
    const filePath = join(directory, 'events.json');
    const log = { error: mock.fn() };
    const store = new FileEventStore(filePath, 10_000, log);

    // Force the first atomic rename to fail by making the destination a directory.
    await mkdir(filePath);
    await assert.rejects(store.append({ type: 'vault', id: 1, targetLedger: 10 }));
    assert.deepStrictEqual(store.getWriteStatus().healthy, false);
    assert.strictEqual(log.error.mock.callCount(), 1);

    await rm(filePath, { recursive: true, force: true });
    await store.append({ type: 'vault', id: 2, targetLedger: 20 });

    assert.deepStrictEqual(store.getWriteStatus(), { healthy: true, lastError: null });
    assert.strictEqual(JSON.parse(await readFile(filePath, 'utf8')).length, 2);
  });
});
