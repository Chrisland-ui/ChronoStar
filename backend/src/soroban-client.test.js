import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ContractSimulationError, SorobanClient } from './soroban-client.js';

describe('SorobanClient.readContract', () => {
  it('throws a typed upstream error for a failed simulation', async () => {
    const client = new SorobanClient();
    client.simulate = mock.fn(async () => ({ error: 'contract invocation failed' }));

    await assert.rejects(
      client.readContract('CBAD', 'get', []),
      (error) =>
        error instanceof ContractSimulationError &&
        error.statusCode === 502 &&
        error.message.includes('contract invocation failed'),
    );
  });

  it('keeps null for a successful simulation with no return value', async () => {
    const client = new SorobanClient();
    client.simulate = mock.fn(async () => ({ result: {} }));

    assert.strictEqual(await client.readContract('CEMPTY', 'get', []), null);
  });
});
