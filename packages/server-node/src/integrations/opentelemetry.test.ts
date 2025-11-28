/**
 * Tests for OpenTelemetry metrics integration
 */

import {
  OpenTelemetryMetricsCollector,
  OTelMeter,
  OTelCounter,
  OTelHistogram,
  OTelUpDownCounter,
} from './opentelemetry';

function createMockCounter(): OTelCounter {
  return {
    add: jest.fn(),
  };
}

function createMockHistogram(): OTelHistogram {
  return {
    record: jest.fn(),
  };
}

function createMockUpDownCounter(): OTelUpDownCounter {
  return {
    add: jest.fn(),
  };
}

function createMockMeter(): OTelMeter & {
  counters: Map<string, OTelCounter>;
  histograms: Map<string, OTelHistogram>;
  upDownCounters: Map<string, OTelUpDownCounter>;
} {
  const counters = new Map<string, OTelCounter>();
  const histograms = new Map<string, OTelHistogram>();
  const upDownCounters = new Map<string, OTelUpDownCounter>();

  return {
    counters,
    histograms,
    upDownCounters,
    createCounter: jest.fn((name: string) => {
      const counter = createMockCounter();
      counters.set(name, counter);
      return counter;
    }),
    createHistogram: jest.fn((name: string) => {
      const histogram = createMockHistogram();
      histograms.set(name, histogram);
      return histogram;
    }),
    createUpDownCounter: jest.fn((name: string) => {
      const upDownCounter = createMockUpDownCounter();
      upDownCounters.set(name, upDownCounter);
      return upDownCounter;
    }),
  };
}

describe('OpenTelemetryMetricsCollector', () => {
  let mockMeter: ReturnType<typeof createMockMeter>;
  let collector: OpenTelemetryMetricsCollector;

  beforeEach(() => {
    mockMeter = createMockMeter();
    collector = new OpenTelemetryMetricsCollector({ meter: mockMeter });
  });

  describe('constructor', () => {
    it('should create counters with default prefix', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'cascade_transactions_started_total',
        expect.any(Object)
      );
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'cascade_transactions_completed_total',
        expect.any(Object)
      );
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'cascade_transactions_failed_total',
        expect.any(Object)
      );
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'cascade_entities_tracked_total',
        expect.any(Object)
      );
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'cascade_entities_truncated_total',
        expect.any(Object)
      );
    });

    it('should create histograms with default prefix', () => {
      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'cascade_tracking_duration_milliseconds',
        expect.any(Object)
      );
      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'cascade_construction_duration_milliseconds',
        expect.any(Object)
      );
      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'cascade_response_size_entities',
        expect.any(Object)
      );
    });

    it('should create gauge (UpDownCounter) with default prefix', () => {
      expect(mockMeter.createUpDownCounter).toHaveBeenCalledWith(
        'cascade_active_transactions',
        expect.any(Object)
      );
    });

    it('should use custom prefix when provided', () => {
      const customMeter = createMockMeter();
      new OpenTelemetryMetricsCollector({ meter: customMeter, prefix: 'myapp' });

      expect(customMeter.createCounter).toHaveBeenCalledWith(
        'myapp_transactions_started_total',
        expect.any(Object)
      );
      expect(customMeter.createHistogram).toHaveBeenCalledWith(
        'myapp_tracking_duration_milliseconds',
        expect.any(Object)
      );
      expect(customMeter.createUpDownCounter).toHaveBeenCalledWith(
        'myapp_active_transactions',
        expect.any(Object)
      );
    });
  });

  describe('increment', () => {
    it('should increment counter with default value of 1', () => {
      collector.increment('transactionsStarted');

      const counter = mockMeter.counters.get('cascade_transactions_started_total');
      expect(counter?.add).toHaveBeenCalledWith(1);
    });

    it('should increment counter with specified value', () => {
      collector.increment('entitiesTracked', 5);

      const counter = mockMeter.counters.get('cascade_entities_tracked_total');
      expect(counter?.add).toHaveBeenCalledWith(5);
    });

    it('should update local snapshot', () => {
      collector.increment('transactionsStarted');
      collector.increment('transactionsStarted');
      collector.increment('transactionsCompleted');

      const snapshot = collector.getSnapshot();
      expect(snapshot.transactionsStarted).toBe(2);
      expect(snapshot.transactionsCompleted).toBe(1);
    });
  });

  describe('gauge', () => {
    it('should set gauge value via UpDownCounter delta', () => {
      collector.gauge('activeTransactions', 5);

      const upDownCounter = mockMeter.upDownCounters.get('cascade_active_transactions');
      expect(upDownCounter?.add).toHaveBeenCalledWith(5);
    });

    it('should calculate delta when value changes', () => {
      collector.gauge('activeTransactions', 5);
      collector.gauge('activeTransactions', 3);

      const upDownCounter = mockMeter.upDownCounters.get('cascade_active_transactions');
      expect(upDownCounter?.add).toHaveBeenCalledWith(5);
      expect(upDownCounter?.add).toHaveBeenCalledWith(-2);
    });

    it('should not call add when value is unchanged', () => {
      collector.gauge('activeTransactions', 5);
      collector.gauge('activeTransactions', 5);

      const upDownCounter = mockMeter.upDownCounters.get('cascade_active_transactions');
      expect(upDownCounter?.add).toHaveBeenCalledTimes(1);
    });

    it('should update local snapshot', () => {
      collector.gauge('activeTransactions', 3);

      const snapshot = collector.getSnapshot();
      expect(snapshot.activeTransactions).toBe(3);
    });
  });

  describe('histogram', () => {
    it('should record histogram value', () => {
      collector.histogram('trackingTimeMs', 50);

      const histogram = mockMeter.histograms.get('cascade_tracking_duration_milliseconds');
      expect(histogram?.record).toHaveBeenCalledWith(50);
    });

    it('should update local snapshot with histogram values', () => {
      collector.histogram('trackingTimeMs', 10);
      collector.histogram('trackingTimeMs', 20);
      collector.histogram('trackingTimeMs', 30);

      const snapshot = collector.getSnapshot();
      expect(snapshot.trackingTimeMs).toEqual([10, 20, 30]);
    });

    it('should limit histogram values to maxHistogramSize', () => {
      const smallCollector = new OpenTelemetryMetricsCollector({
        meter: mockMeter,
        maxHistogramSize: 3,
      });

      smallCollector.histogram('trackingTimeMs', 1);
      smallCollector.histogram('trackingTimeMs', 2);
      smallCollector.histogram('trackingTimeMs', 3);
      smallCollector.histogram('trackingTimeMs', 4);
      smallCollector.histogram('trackingTimeMs', 5);

      const snapshot = smallCollector.getSnapshot();
      expect(snapshot.trackingTimeMs).toEqual([3, 4, 5]);
    });
  });

  describe('getSnapshot', () => {
    it('should return a copy of current metrics', () => {
      collector.increment('transactionsStarted', 5);
      collector.increment('transactionsCompleted', 3);
      collector.increment('transactionsFailed', 1);
      collector.increment('entitiesTracked', 100);
      collector.increment('entitiesTruncated', 10);
      collector.gauge('activeTransactions', 2);
      collector.histogram('trackingTimeMs', 50);
      collector.histogram('constructionTimeMs', 30);
      collector.histogram('cascadeSize', 25);

      const snapshot = collector.getSnapshot();

      expect(snapshot).toEqual({
        transactionsStarted: 5,
        transactionsCompleted: 3,
        transactionsFailed: 1,
        entitiesTracked: 100,
        entitiesTruncated: 10,
        activeTransactions: 2,
        trackingTimeMs: [50],
        constructionTimeMs: [30],
        cascadeSize: [25],
      });
    });

    it('should return a new array for histogram values', () => {
      collector.histogram('trackingTimeMs', 10);

      const snapshot1 = collector.getSnapshot();
      const snapshot2 = collector.getSnapshot();

      expect(snapshot1.trackingTimeMs).not.toBe(snapshot2.trackingTimeMs);
      expect(snapshot1.trackingTimeMs).toEqual(snapshot2.trackingTimeMs);
    });
  });

  describe('reset', () => {
    it('should reset local snapshot counters', () => {
      collector.increment('transactionsStarted', 5);
      collector.histogram('trackingTimeMs', 50);

      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(snapshot.transactionsStarted).toBe(0);
      expect(snapshot.trackingTimeMs).toEqual([]);
    });

    it('should not affect OpenTelemetry metrics (counters are cumulative)', () => {
      collector.increment('transactionsStarted', 5);
      collector.reset();
      collector.increment('transactionsStarted', 3);

      const counter = mockMeter.counters.get('cascade_transactions_started_total');
      // Both increments should have been recorded
      expect(counter?.add).toHaveBeenCalledTimes(2);
      expect(counter?.add).toHaveBeenCalledWith(5);
      expect(counter?.add).toHaveBeenCalledWith(3);
    });
  });

  describe('integration with CascadeTracker', () => {
    it('should work with tracker-like usage pattern', () => {
      // Simulate a cascade transaction
      collector.increment('transactionsStarted');
      collector.gauge('activeTransactions', 1);

      // Simulate tracking entities
      collector.increment('entitiesTracked', 10);

      // Simulate building response
      collector.histogram('trackingTimeMs', 25);
      collector.histogram('constructionTimeMs', 15);
      collector.histogram('cascadeSize', 10);

      // Transaction complete
      collector.increment('transactionsCompleted');
      collector.gauge('activeTransactions', 0);

      const snapshot = collector.getSnapshot();
      expect(snapshot.transactionsStarted).toBe(1);
      expect(snapshot.transactionsCompleted).toBe(1);
      expect(snapshot.transactionsFailed).toBe(0);
      expect(snapshot.entitiesTracked).toBe(10);
      expect(snapshot.activeTransactions).toBe(0);
    });

    it('should handle failed transactions', () => {
      collector.increment('transactionsStarted');
      collector.gauge('activeTransactions', 1);

      // Transaction fails
      collector.increment('transactionsFailed');
      collector.gauge('activeTransactions', 0);

      const snapshot = collector.getSnapshot();
      expect(snapshot.transactionsStarted).toBe(1);
      expect(snapshot.transactionsFailed).toBe(1);
      expect(snapshot.transactionsCompleted).toBe(0);
    });
  });
});
