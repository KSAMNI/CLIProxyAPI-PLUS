import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { computeApiUrl } from '@/utils/connection';
import { isRecordValue } from '@/utils/quota';
import {
  loadLegacyModelPrices,
  loadModelPricesFromSqlite,
  saveModelPricesToSqlite,
  type ModelPrice,
} from '@/utils/usage';

export interface UsagePayload {
  total_requests?: number;
  success_count?: number;
  failure_count?: number;
  total_tokens?: number;
  latest_id?: number;
  apis?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UseUsageDataReturn {
  usage: UsagePayload | null;
  loading: boolean;
  error: string;
  lastRefreshedAt: Date | null;
  modelPrices: Record<string, ModelPrice>;
  setModelPrices: (prices: Record<string, ModelPrice>) => void;
  refreshUsage: () => Promise<boolean>;
}

export type UseUsageDataOptions = {
  recentLimit?: number;
};

const USAGE_STREAM_FLUSH_INTERVAL_MS = 250;

const toNumber = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

type UsageModelEntry = { details?: unknown[]; [key: string]: unknown };
type UsageApiEntry = { models?: Record<string, UsageModelEntry>; [key: string]: unknown };

type UsageMode = {
  key: string;
  recentLimit?: number;
};

type UsageSnapshot = Pick<UseUsageDataReturn, 'usage' | 'loading' | 'error' | 'lastRefreshedAt'>;

type UsageStore = UsageSnapshot & {
  key: string;
  recentLimit?: number;
  latestId: number;
  subscribers: Set<() => void>;
  loadPromise: Promise<boolean> | null;
  loadRequestId: number;
  incrementalLoading: boolean;
  incrementalPending: boolean;
  pendingUsagePayload: UsagePayload | null;
  flushUsagePayloadTimer: ReturnType<typeof setTimeout> | null;
  streamController: AbortController | null;
  streamReconnectTimer: ReturnType<typeof setTimeout> | null;
  streamConnectionKey: string;
};

const usageStores = new Map<string, UsageStore>();

const asUsageApiEntry = (value: unknown): UsageApiEntry =>
  isRecordValue(value) ? (value as UsageApiEntry) : {};

const usageModeFromOptions = (options: UseUsageDataOptions): UsageMode => {
  const recentLimit = typeof options.recentLimit === 'number' && options.recentLimit > 0
    ? options.recentLimit
    : undefined;
  return recentLimit ? { key: `recent:${recentLimit}`, recentLimit } : { key: 'full' };
};

const createUsageStore = (mode: UsageMode): UsageStore => ({
  key: mode.key,
  recentLimit: mode.recentLimit,
  usage: null,
  loading: true,
  error: '',
  lastRefreshedAt: null,
  latestId: 0,
  subscribers: new Set(),
  loadPromise: null,
  loadRequestId: 0,
  incrementalLoading: false,
  incrementalPending: false,
  pendingUsagePayload: null,
  flushUsagePayloadTimer: null,
  streamController: null,
  streamReconnectTimer: null,
  streamConnectionKey: '',
});

const getUsageStore = (mode: UsageMode) => {
  const existing = usageStores.get(mode.key);
  if (existing) return existing;
  const store = createUsageStore(mode);
  usageStores.set(mode.key, store);
  return store;
};

const notifyUsageStore = (store: UsageStore) => {
  store.subscribers.forEach((subscriber) => subscriber());
};

const usageSnapshot = (store: UsageStore): UsageSnapshot => ({
  usage: store.usage,
  loading: store.loading,
  error: store.error,
  lastRefreshedAt: store.lastRefreshedAt,
});

const stopUsageStream = (store: UsageStore) => {
  store.streamController?.abort();
  store.streamController = null;
  if (store.streamReconnectTimer) {
    clearTimeout(store.streamReconnectTimer);
    store.streamReconnectTimer = null;
  }
  store.streamConnectionKey = '';
};

const mergeUsagePayload = (current: UsagePayload | null, next: UsagePayload | null): UsagePayload | null => {
  if (!next) return current;
  if (!current) return next;

  const currentLatestId = toNumber(current.latest_id);
  const nextLatestId = toNumber(next.latest_id);
  if (nextLatestId <= currentLatestId) return current;

  let mergedApis = current.apis;
  Object.entries(next.apis ?? {}).forEach(([endpoint, apiEntry]) => {
    const existingApi = asUsageApiEntry(current.apis?.[endpoint]);
    const nextApi = asUsageApiEntry(apiEntry);
    const models: Record<string, UsageModelEntry> = { ...(existingApi.models ?? {}) };

    Object.entries(nextApi.models ?? {}).forEach(([model, modelEntry]) => {
      const existingModel = models[model];
      models[model] = {
        ...(existingModel ?? {}),
        ...(modelEntry ?? {}),
        details: [
          ...(Array.isArray(existingModel?.details) ? existingModel.details : []),
          ...(Array.isArray(modelEntry?.details) ? modelEntry.details : []),
        ],
      };
    });

    const writableApis: Record<string, unknown> = mergedApis === current.apis ? { ...(current.apis ?? {}) } : (mergedApis ?? {});
    mergedApis = writableApis;
    writableApis[endpoint] = {
      ...existingApi,
      ...nextApi,
      models,
    };
  });

  return {
    ...current,
    total_requests: toNumber(current.total_requests) + toNumber(next.total_requests),
    success_count: toNumber(current.success_count) + toNumber(next.success_count),
    failure_count: toNumber(current.failure_count) + toNumber(next.failure_count),
    total_tokens: toNumber(current.total_tokens) + toNumber(next.total_tokens),
    latest_id: nextLatestId,
    apis: mergedApis,
  };
};

const detailTimestampMs = (detail: unknown) => {
  if (!isRecordValue(detail)) return 0;
  const timestamp = detail.timestamp;
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') return 0;
  const parsed = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
};

const limitUsagePayloadDetails = (payload: UsagePayload | null, limit: number | undefined): UsagePayload | null => {
  if (!payload || typeof limit !== 'number' || limit <= 0) return payload;
  type DetailRef = { endpoint: string; model: string; detail: unknown; timestampMs: number; index: number };
  const refs: DetailRef[] = [];

  Object.entries(payload.apis ?? {}).forEach(([endpoint, apiEntry]) => {
    const api = asUsageApiEntry(apiEntry);
    Object.entries(api.models ?? {}).forEach(([model, modelEntry]) => {
      const details = Array.isArray(modelEntry.details) ? modelEntry.details : [];
      details.forEach((detail, index) => {
        refs.push({ endpoint, model, detail, timestampMs: detailTimestampMs(detail), index });
      });
    });
  });

  if (refs.length <= limit) return payload;

  const apis: Record<string, UsageApiEntry> = {};
  let totalRequests = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalTokens = 0;
  const limited = refs
    .sort((left, right) => right.timestampMs - left.timestampMs || right.index - left.index)
    .slice(0, limit);

  limited.forEach(({ endpoint, model, detail }) => {
    const existingApi = asUsageApiEntry(payload.apis?.[endpoint]);
    const api = apis[endpoint] ?? { ...existingApi, models: {} };
    const models = api.models ?? {};
    const existingModel = existingApi.models?.[model] ?? {};
    const modelEntry = models[model] ?? { ...existingModel, details: [] };
    modelEntry.details = [...(Array.isArray(modelEntry.details) ? modelEntry.details : []), detail];
    models[model] = modelEntry;
    api.models = models;
    apis[endpoint] = api;

    if (isRecordValue(detail)) {
      totalRequests += 1;
      if (detail.failed === true) {
        failureCount += 1;
      } else {
        successCount += 1;
      }
      const tokens = isRecordValue(detail.tokens) ? detail.tokens : {};
      totalTokens += toNumber(tokens.total_tokens ?? tokens.totalTokens);
    }
  });

  return {
    ...payload,
    total_requests: totalRequests,
    success_count: successCount,
    failure_count: failureCount,
    total_tokens: totalTokens,
    apis,
  };
};

const buildUsageStreamUrl = (apiBase: string, afterId: number) => {
  const base = computeApiUrl(apiBase);
  if (!base) return '';
  const url = new URL(`${base}/usage/stream`);
  url.searchParams.set('after_id', String(Math.max(afterId, 0)));
  return url.toString();
};

const readSseMessage = (block: string): { event: string; data: string } | null => {
  if (!block.trim()) return null;
  let event = 'message';
  const dataLines: string[] = [];
  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  });
  return dataLines.length > 0 ? { event, data: dataLines.join('\n') } : null;
};

const parseUsageSsePayload = (block: string): UsagePayload | null => {
  const message = readSseMessage(block);
  if (message?.event !== 'usage') return null;
  return JSON.parse(message.data) as UsagePayload;
};

const nextUsageReconnectDelay = (currentDelay: number) => Math.min(currentDelay * 2, 30000);

const setStoreSnapshot = (store: UsageStore, payload: UsagePayload | null) => {
  store.latestId = toNumber(payload?.latest_id);
  store.usage = payload ?? null;
  store.lastRefreshedAt = new Date();
};

const fetchUsageSnapshot = (store: UsageStore) => {
  if (store.recentLimit) {
    return apiClient.get<UsagePayload>(`/usage/recent-events?limit=${store.recentLimit}`);
  }
  return apiClient.get<UsagePayload>('/usage');
};

const loadUsageStore = (store: UsageStore, force = false): Promise<boolean> => {
  if (store.loadPromise && !force) return store.loadPromise;
  if (store.usage && !force) return Promise.resolve(true);

  const requestId = store.loadRequestId + 1;
  store.loadRequestId = requestId;
  store.loading = true;
  store.error = '';
  notifyUsageStore(store);

  const promise = fetchUsageSnapshot(store)
    .then((payload) => {
      if (store.loadRequestId !== requestId) return false;
      setStoreSnapshot(store, payload);
      return true;
    })
    .catch((err) => {
      if (store.loadRequestId !== requestId) return false;
      store.error = err instanceof Error ? err.message : String(err);
      return false;
    })
    .finally(() => {
      if (store.loadRequestId !== requestId) return;
      store.loading = false;
      store.loadPromise = null;
      notifyUsageStore(store);
    });

  store.loadPromise = promise;
  return promise;
};

const flushUsageStorePayload = (store: UsageStore) => {
  const payload = store.pendingUsagePayload;
  if (!payload) return;
  store.pendingUsagePayload = null;
  if (store.flushUsagePayloadTimer) {
    clearTimeout(store.flushUsagePayloadTimer);
    store.flushUsagePayloadTimer = null;
  }
  store.usage = limitUsagePayloadDetails(mergeUsagePayload(store.usage, payload), store.recentLimit);
  store.latestId = toNumber(store.usage?.latest_id);
  store.lastRefreshedAt = new Date();
  notifyUsageStore(store);
};

const applyUsageStorePayload = (store: UsageStore, payload: UsagePayload | null, immediate = false) => {
  const nextLatestId = toNumber(payload?.latest_id);
  if (nextLatestId <= store.latestId) return;
  store.latestId = nextLatestId;
  store.pendingUsagePayload = mergeUsagePayload(store.pendingUsagePayload, payload);
  if (immediate) {
    flushUsageStorePayload(store);
    return;
  }
  if (!store.flushUsagePayloadTimer) {
    store.flushUsagePayloadTimer = setTimeout(() => flushUsageStorePayload(store), USAGE_STREAM_FLUSH_INTERVAL_MS);
  }
};

const loadUsageIncrementalStore = async (store: UsageStore): Promise<boolean> => {
  if (store.recentLimit) return loadUsageStore(store, true);
  if (store.incrementalLoading) {
    store.incrementalPending = true;
    return true;
  }

  let succeeded = true;
  store.incrementalLoading = true;
  try {
    do {
      store.incrementalPending = false;
      const afterId = store.latestId;
      if (afterId <= 0) {
        succeeded = (await loadUsageStore(store, true)) && succeeded;
        continue;
      }

      try {
        const payload = await apiClient.get<UsagePayload>(`/usage/events?after_id=${afterId}&limit=5000`);
        applyUsageStorePayload(store, payload ?? null, true);
      } catch {
        succeeded = (await loadUsageStore(store, true)) && succeeded;
      }
    } while (store.incrementalPending);
    return succeeded;
  } finally {
    store.incrementalLoading = false;
  }
};

const connectUsageStream = async ({
  apiBase,
  managementKey,
  signal,
  afterId,
  applyUsagePayload,
  loadUsageIncremental,
}: {
  apiBase: string;
  managementKey: string;
  signal: AbortSignal;
  afterId: number;
  applyUsagePayload: (payload: UsagePayload | null, immediate?: boolean) => void;
  loadUsageIncremental: () => Promise<boolean>;
}) => {
  const decoder = new TextDecoder();
  let buffer = '';
  const url = buildUsageStreamUrl(apiBase, afterId);
  if (!url) return;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${managementKey}` },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Usage stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    parts.forEach((part) => {
      try {
        const payload = parseUsageSsePayload(part);
        if (payload) {
          applyUsagePayload(payload);
        }
      } catch {
        void loadUsageIncremental();
      }
    });
  }
};

const ensureUsageStream = (store: UsageStore, apiBase: string, managementKey: string, connectionStatus: string) => {
  if (connectionStatus !== 'connected' || !apiBase || !managementKey) {
    stopUsageStream(store);
    return;
  }

  const connectionKey = `${apiBase}\n${managementKey}`;
  if (store.streamController && store.streamConnectionKey === connectionKey) return;

  stopUsageStream(store);
  store.streamConnectionKey = connectionKey;
  const controller = new AbortController();
  store.streamController = controller;
  let reconnectDelay = 1000;

  const connect = async () => {
    try {
      await connectUsageStream({
        apiBase,
        managementKey,
        signal: controller.signal,
        afterId: store.latestId,
        applyUsagePayload: (payload, immediate) => applyUsageStorePayload(store, payload, immediate),
        loadUsageIncremental: () => loadUsageIncrementalStore(store),
      });
      reconnectDelay = 1000;
    } catch (err) {
      if (!controller.signal.aborted) {
        console.warn('Usage SSE stream disconnected:', err);
      }
    }

    if (!controller.signal.aborted) {
      store.streamReconnectTimer = setTimeout(() => {
        void loadUsageIncrementalStore(store);
        void connect();
      }, reconnectDelay);
      reconnectDelay = nextUsageReconnectDelay(reconnectDelay);
    }
  };

  void connect();
};

export function useUsageData(options: UseUsageDataOptions = {}): UseUsageDataReturn {
  const mode = useMemo(() => usageModeFromOptions(options), [options.recentLimit]);
  const [snapshot, setSnapshot] = useState<UsageSnapshot>(() => usageSnapshot(getUsageStore(mode)));
  const [modelPrices, setModelPricesState] = useState<Record<string, ModelPrice>>({});
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);

  useEffect(() => {
    const store = getUsageStore(mode);
    const updateSnapshot = () => setSnapshot(usageSnapshot(store));
    store.subscribers.add(updateSnapshot);
    updateSnapshot();
    void loadUsageStore(store);

    return () => {
      store.subscribers.delete(updateSnapshot);
      if (store.subscribers.size === 0) {
        stopUsageStream(store);
      }
    };
  }, [mode]);

  useEffect(() => {
    const store = getUsageStore(mode);
    ensureUsageStream(store, apiBase, managementKey, connectionStatus);
    return () => {
      if (store.subscribers.size === 0) {
        stopUsageStream(store);
      }
    };
  }, [apiBase, connectionStatus, managementKey, mode]);

  useEffect(() => {
    let cancelled = false;
    const legacyPrices = loadLegacyModelPrices();
    setModelPricesState(legacyPrices);

    const syncModelPrices = async () => {
      try {
        const sqlitePrices = await loadModelPricesFromSqlite();
        if (cancelled) return;
        if (Object.keys(sqlitePrices).length > 0) {
          setModelPricesState(sqlitePrices);
          return;
        }
        if (Object.keys(legacyPrices).length > 0) {
          await saveModelPricesToSqlite(legacyPrices);
        }
      } catch (err) {
        console.error('Failed to sync model prices with sqlite:', err);
      }
    };

    void syncModelPrices();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUsage = useCallback(() => loadUsageIncrementalStore(getUsageStore(mode)), [mode]);

  const setModelPrices = useCallback((prices: Record<string, ModelPrice>) => {
    setModelPricesState(prices);
    void saveModelPricesToSqlite(prices).catch((err) => {
      console.error('Failed to save model prices to sqlite:', err);
    });
  }, []);

  return {
    usage: snapshot.usage,
    loading: snapshot.loading,
    error: snapshot.error,
    lastRefreshedAt: snapshot.lastRefreshedAt,
    modelPrices,
    setModelPrices,
    refreshUsage,
  };
}
