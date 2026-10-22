import { describe, it, expect, vi, afterEach } from 'vitest';
import { StreamConsumer } from './streamConsumer';

describe('StreamConsumer', () => {
  it('instantiates and manages subscribers', () => {
    const consumer = new StreamConsumer('/api/stream');
    const callback = vi.fn();

    const unsubscribe = consumer.subscribe(callback);
    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
  });

  describe('resuming after a dropped connection', () => {
    class FakeEventSource {
      static instances: FakeEventSource[] = [];
      listeners: Record<string, (event: MessageEvent) => void> = {};
      onerror: (() => void) | null = null;
      closed = false;
      constructor(public url: string) {
        FakeEventSource.instances.push(this);
      }
      addEventListener(type: string, listener: (event: MessageEvent) => void) {
        this.listeners[type] = listener;
      }
      close() {
        this.closed = true;
      }
    }

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      FakeEventSource.instances = [];
    });

    function setup() {
      vi.useFakeTimers();
      vi.stubGlobal('EventSource', FakeEventSource);
      vi.stubGlobal('window', {});
    }

    const message = (id: string) =>
      ({ data: JSON.stringify({ timestamp: 't', status: 'ok' }), lastEventId: id }) as MessageEvent;

    it('connects without a lastEventId the first time', () => {
      setup();
      const consumer = new StreamConsumer('/api/stream');
      consumer.subscribe(vi.fn());
      expect(FakeEventSource.instances[0].url).toBe('/api/stream');
    });

    it('reconnects with the id of the last event it received', () => {
      setup();
      const consumer = new StreamConsumer('/api/stream');
      consumer.subscribe(vi.fn());
      const first = FakeEventSource.instances[0];
      first.listeners['schedule-update'](message('7'));
      first.onerror?.();
      vi.advanceTimersByTime(2000);

      expect(first.closed).toBe(true);
      expect(FakeEventSource.instances).toHaveLength(2);
      expect(FakeEventSource.instances[1].url).toBe('/api/stream?lastEventId=7');
    });

    it('keeps the newest id and appends to an existing query string', () => {
      setup();
      const consumer = new StreamConsumer('/api/stream?x=1');
      consumer.subscribe(vi.fn());
      const first = FakeEventSource.instances[0];
      first.listeners['schedule-update'](message('3'));
      first.listeners['schedule-update'](message('4'));
      first.onerror?.();
      vi.advanceTimersByTime(2000);
      expect(FakeEventSource.instances[1].url).toBe('/api/stream?x=1&lastEventId=4');
    });

    it('still delivers events to subscribers', () => {
      setup();
      const consumer = new StreamConsumer('/api/stream');
      const callback = vi.fn();
      consumer.subscribe(callback);
      FakeEventSource.instances[0].listeners['schedule-update'](message('1'));
      expect(callback).toHaveBeenCalledWith({ timestamp: 't', status: 'ok' });
    });
  });
});
