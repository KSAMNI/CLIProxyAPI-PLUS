/**
 * Zustand persistence middleware for quota data.
 * Automatically syncs quota state to SQLite quota cache.
 */

import { useQuotaStore } from '@/stores';
import {
  getQuotaProviderMapName,
  getQuotaProviderSetterName,
  isQuotaProviderType,
  QUOTA_PROVIDER_TYPES,
  type QuotaProviderType,
} from '@/utils/quota';
import { sqliteQuotaCache, type QuotaCacheEntry } from './sqliteQuotaCache';

interface QuotaStatusState {
  status: 'idle' | 'loading' | 'success' | 'error';
  cachedAt?: number;
}

class QuotaPersistenceMiddleware {
  private unsubscribe: (() => void) | null = null;
  private isPreloading = false;
  private syncQueue = new Set<string>();
  private isFlushing = false;
  private syncedVersions = new Map<string, number>();
  private loadedThrough = 0;
  private reloadRequestedAt = 0;
  private preloadPromise: Promise<void> | null = null;
  private ensureFreshPromise: Promise<void> | null = null;

  /**
   * Start the middleware
   */
  start() {
    if (this.unsubscribe) {
      console.warn('QuotaPersistenceMiddleware already started');
      return;
    }

    // Check if upstream store structure is compatible
    if (!this.checkCompatibility()) {
      console.warn('QuotaPersistenceMiddleware: Upstream store structure changed, persistence disabled');
      return;
    }

    console.log('QuotaPersistenceMiddleware: Starting...');

    // Preload cache first
    this.runPreload().then(() => {
      console.log('QuotaPersistenceMiddleware: Cache preloaded');
    });

    // Subscribe to store changes
    this.unsubscribe = useQuotaStore.subscribe((state) => {
      if (this.isPreloading) return; // Skip during preload to avoid circular updates

      this.syncProvider('antigravity', state.antigravityQuota);
      this.syncProvider('claude', state.claudeQuota);
      this.syncProvider('codex', state.codexQuota);
      this.syncProvider('gemini-cli', state.geminiCliQuota);
      this.syncProvider('kimi', state.kimiQuota);
    });

    console.log('QuotaPersistenceMiddleware: Started successfully');
  }

  /**
   * Stop the middleware
   */
  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    void this.flushSyncQueue();
    console.log('QuotaPersistenceMiddleware: Stopped');
  }

  /**
   * Check if upstream store structure is compatible
   */
  private checkCompatibility(): boolean {
    const state = useQuotaStore.getState();
    const requiredFields = [
      ...QUOTA_PROVIDER_TYPES.map(getQuotaProviderMapName),
      ...QUOTA_PROVIDER_TYPES.map(getQuotaProviderSetterName),
      'clearQuotaCache',
    ];

    const missing = requiredFields.filter((field) => !(field in state));
    if (missing.length > 0) {
      console.error(`QuotaPersistenceMiddleware: Missing fields: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Sync provider quota to SQLite quota cache.
   */
  private syncProvider(
    provider: QuotaProviderType,
    quotaMap: Record<string, QuotaStatusState>
  ) {
    Object.entries(quotaMap).forEach(([fileName, state]) => {
      if (state.status !== 'success') return;

      const key = `${provider}:${fileName}`;
      const version = state.cachedAt ?? 0;
      if (this.syncedVersions.get(key) === version) return;
      this.syncQueue.add(key);
    });

    void this.flushSyncQueue();
  }

  /**
   * Flush sync queue to SQLite quota cache
   */
  private async flushSyncQueue() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      while (this.syncQueue.size > 0) {
        const key = this.syncQueue.values().next().value as string | undefined;
        if (!key) break;
        this.syncQueue.delete(key);

        const separatorIndex = key.indexOf(':');
        if (separatorIndex <= 0) continue;

        const provider = key.slice(0, separatorIndex) as QuotaProviderType;
        const fileName = key.slice(separatorIndex + 1);
        const state = useQuotaStore.getState();
        const quotaMap = this.getQuotaMap(state, provider);
        const quotaState = quotaMap?.[fileName];

        if (quotaState?.status !== 'success') continue;

        const cachedAt = quotaState.cachedAt ?? Date.now();
        const synced = await sqliteQuotaCache.set(provider, fileName, { ...quotaState, cachedAt }, cachedAt);
        if (synced) {
          this.syncedVersions.set(key, cachedAt);
        }
      }
    } catch (err) {
      console.error('QuotaPersistenceMiddleware: Failed to sync to SQLite quota cache:', err);
    } finally {
      this.isFlushing = false;
      if (this.syncQueue.size > 0) {
        void this.flushSyncQueue();
      }
    }
  }

  async ensureFresh() {
    if (this.ensureFreshPromise) return this.ensureFreshPromise;

    this.ensureFreshPromise = (async () => {
      await this.preloadPromise;
      const stats = await sqliteQuotaCache.getStats();
      const targetUpdatedAt = Math.max(this.reloadRequestedAt, stats.updatedAt);
      if (targetUpdatedAt <= 0 || targetUpdatedAt <= this.loadedThrough) return;
      await this.runPreload(targetUpdatedAt);
    })().finally(() => {
      this.ensureFreshPromise = null;
    });

    return this.ensureFreshPromise;
  }

  private runPreload(loadedAt = Date.now()) {
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = this.preloadCache(loadedAt).finally(() => {
      this.preloadPromise = null;
    });

    return this.preloadPromise;
  }

  markStale(updatedAt = Date.now()) {
    this.reloadRequestedAt = Math.max(this.reloadRequestedAt, updatedAt);
  }

  /**
   * Preload cache from SQLite quota cache to Zustand store
   */
  private async preloadCache(loadedAt = Date.now()) {
    this.isPreloading = true;
    let latestCachedAt = 0;

    try {
      const cachedEntries = await sqliteQuotaCache.getAll();
      if (cachedEntries.length === 0) {
        this.loadedThrough = Math.max(this.loadedThrough, loadedAt);
        return;
      }

      const entriesByProvider = new Map<QuotaProviderType, QuotaCacheEntry[]>();
      cachedEntries.forEach((entry) => {
        if (!isQuotaProviderType(entry.provider)) return;
        latestCachedAt = Math.max(latestCachedAt, entry.cachedAt ?? 0);
        const provider = entry.provider;
        const entries = entriesByProvider.get(provider) ?? [];
        entries.push(entry);
        entriesByProvider.set(provider, entries);
      });

      entriesByProvider.forEach((entries, provider) => {
        this.preloadProvider(provider, entries);
      });
      this.loadedThrough = Math.max(this.loadedThrough, latestCachedAt, loadedAt);
    } catch (err) {
      console.error('QuotaPersistenceMiddleware: Failed to preload cache:', err);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload single provider from SQLite quota cache
   */
  private preloadProvider(provider: QuotaProviderType, cachedEntries: QuotaCacheEntry[]) {
    const cached = new Map(cachedEntries.map((entry) => [entry.fileName, entry]));
    if (cached.size === 0) return;

    const setterName = getQuotaProviderSetterName(provider);
    const storeState = useQuotaStore.getState();
    const setter = storeState[setterName];

    if (typeof setter === 'function') {
      setter((prev: Record<string, any>) => {
        let changed = false;
        const next = { ...prev };
        cached.forEach((entry, fileName) => {
          this.syncedVersions.set(`${provider}:${fileName}`, entry.cachedAt ?? 0);
          if (next[fileName] === entry.data) return;
          next[fileName] = entry.data;
          changed = true;
        });
        return changed ? next : prev;
      });

      console.log(`QuotaPersistenceMiddleware: Preloaded ${cached.size} entries for ${provider}`);
    }
  }

  /**
   * Get quota map from state by provider
   */
  private getQuotaMap(
    state: any,
    provider: QuotaProviderType
  ): Record<string, QuotaStatusState> | null {
    const mapName = getQuotaProviderMapName(provider);
    return state[mapName] || null;
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return await sqliteQuotaCache.getStats();
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    await sqliteQuotaCache.clear();
    console.log('QuotaPersistenceMiddleware: Cache cleared');
  }
}

export const quotaPersistenceMiddleware = new QuotaPersistenceMiddleware();
