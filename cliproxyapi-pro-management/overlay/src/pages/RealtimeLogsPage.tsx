import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IconSearch, IconSlidersHorizontal } from '@/components/ui/icons';
import {
  useMonitoringData,
  type MonitoringEventRow,
  type MonitoringStatusTone,
  type MonitoringTimeRange,
} from '@/features/monitoring/hooks/useMonitoringData';
import { useUsageData } from '@/features/monitoring/hooks/useUsageData';
import { useConfigStore, useNotificationStore } from '@/stores';
import { maskSensitiveText } from '@/utils/format';
import { formatCompactNumber, formatDurationMs, formatUsd } from '@/utils/usage';
import styles from './MonitoringCenterPage.module.scss';

const REALTIME_LOG_ROW_LIMIT = 300;
const AUTO_REFRESH_OPTIONS = [
  { value: '0', labelKey: 'monitoring.auto_refresh_off' },
  { value: '1000', labelKey: 'monitoring.auto_refresh_1s' },
  { value: '3000', labelKey: 'monitoring.auto_refresh_3s' },
  { value: '5000', labelKey: 'monitoring.auto_refresh_5s' },
  { value: '10000', labelKey: 'monitoring.auto_refresh_10s' },
  { value: '30000', labelKey: 'monitoring.auto_refresh_30s' },
];
const TIME_RANGE_OPTIONS: Array<{ value: MonitoringTimeRange; labelKey: string }> = [
  { value: 'today', labelKey: 'monitoring.range_today' },
  { value: '7d', labelKey: 'monitoring.range_7d' },
  { value: '14d', labelKey: 'monitoring.range_14d' },
  { value: '30d', labelKey: 'monitoring.range_30d' },
  { value: 'all', labelKey: 'monitoring.range_all' },
];

type StatusFilter = 'all' | 'success' | 'failed';

type RealtimeLogRow = MonitoringEventRow & {
  requestCount: number;
  successRate: number;
  streamKey: string;
  recentPattern: boolean[];
  recentSuccessCount: number;
  recentFailureCount: number;
};

const buildApiKeyFilterOptions = (rows: MonitoringEventRow[], allLabel: string) => [
  { value: 'all', label: allLabel },
  ...Array.from(
    new Map(
      rows
        .filter((row) => row.clientApiKey.hash && row.clientApiKey.hash !== '-')
        .map((row) => [row.clientApiKey.hash, row.clientApiKey.masked])
    ).entries()
  )
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label })),
];

const buildRealtimeMetaText = (row: MonitoringEventRow) => {
  const text = `${row.endpointMethod} ${row.endpointPath}`.trim();
  return maskSensitiveText(text || '-');
};

const buildRealtimeLogRows = (rows: MonitoringEventRow[]): RealtimeLogRow[] => {
  const sortedAsc = [...rows].sort(
    (left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id)
  );
  const metricsByStream = new Map<string, { total: number; success: number; pattern: boolean[] }>();

  const enriched = sortedAsc.map((row) => {
    const streamKey = [row.account, row.provider, row.model, row.channel].join('::');
    const previous = metricsByStream.get(streamKey) ?? { total: 0, success: 0, pattern: [] };
    const nextPattern = [...previous.pattern, !row.failed].slice(-10);
    const next = {
      total: previous.total + (row.statsIncluded ? 1 : 0),
      success: previous.success + (row.statsIncluded && !row.failed ? 1 : 0),
      pattern: nextPattern,
    };
    metricsByStream.set(streamKey, next);

    return {
      ...row,
      streamKey,
      requestCount: next.total,
      successRate: next.total > 0 ? next.success / next.total : 1,
      recentPattern: nextPattern,
      recentSuccessCount: nextPattern.filter(Boolean).length,
      recentFailureCount: nextPattern.filter((item) => !item).length,
    } satisfies RealtimeLogRow;
  });

  return enriched.sort(
    (left, right) =>
      right.timestampMs - left.timestampMs ||
      right.requestCount - left.requestCount ||
      right.id.localeCompare(left.id)
  );
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

function StatusBadge({ tone, children }: { tone: MonitoringStatusTone; children: ReactNode }) {
  return <span className={`${styles.statusBadge} ${styles[`statusBadge${tone}`]}`}>{children}</span>;
}

function RecentPattern({
  pattern,
  label,
}: {
  pattern: boolean[];
  label: string;
}) {
  const normalized = pattern.slice(-10);
  return (
    <div className={`${styles.patternBars} ${styles.patternBarsPlain}`} role="img" aria-label={label}>
      {normalized.map((item, index) => (
        <span
          key={index}
          className={`${styles.patternBar} ${styles.patternBarPlain} ${item ? styles.patternSuccess : styles.patternFailed}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function RealtimeLogsPage() {
  const { t, i18n } = useTranslation();
  const config = useConfigStore((state) => state.config);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [timeRange, setTimeRange] = useState<MonitoringTimeRange>('today');
  const [searchInput, setSearchInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedModel, setSelectedModel] = useState('all');
  const [selectedApiKey, setSelectedApiKey] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [autoRefreshMs, setAutoRefreshMs] = useState(10000);
  const deferredSearch = useDeferredValue(searchInput);

  const { usage, error: usageError, modelPrices, refreshUsage } = useUsageData();
  const { error: monitoringError, filteredRows } = useMonitoringData({
    usage,
    config,
    modelPrices,
    timeRange,
    searchQuery: deferredSearch,
    deletedCredentialLabel: t('monitoring.deleted_credential'),
  });
  const hasPrices = Object.keys(modelPrices).length > 0;
  const combinedError = [usageError, monitoringError].filter(Boolean).join('；');

  const providerOptions = useMemo(
    () => [
      { value: 'all', label: t('monitoring.filter_all_providers') },
      ...Array.from(new Set(filteredRows.map((row) => row.provider)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ value, label: value })),
    ],
    [filteredRows, t]
  );

  const modelOptions = useMemo(
    () => [
      { value: 'all', label: t('monitoring.filter_all_models') },
      ...Array.from(new Set(filteredRows.map((row) => row.model)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ value, label: value })),
    ],
    [filteredRows, t]
  );

  const apiKeyOptions = useMemo(
    () => buildApiKeyFilterOptions(filteredRows, t('monitoring.filter_all_api_keys')),
    [filteredRows, t]
  );

  const autoRefreshOptions = useMemo(
    () => AUTO_REFRESH_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t]
  );

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('monitoring.filter_all_statuses') },
      { value: 'success', label: t('monitoring.filter_status_success') },
      { value: 'failed', label: t('monitoring.filter_status_failed') },
    ],
    [t]
  );

  useEffect(() => {
    if (autoRefreshMs <= 0) return;
    const timer = window.setInterval(() => {
      void refreshUsage();
    }, autoRefreshMs);
    return () => window.clearInterval(timer);
  }, [autoRefreshMs, refreshUsage]);

  const scopedRows = useMemo(
    () =>
      filteredRows.filter((row) => {
        if (selectedProvider !== 'all' && row.provider !== selectedProvider) return false;
        if (selectedModel !== 'all' && row.model !== selectedModel) return false;
        if (selectedApiKey !== 'all' && row.clientApiKey.hash !== selectedApiKey) return false;
        if (selectedStatus === 'success' && row.failed) return false;
        if (selectedStatus === 'failed' && !row.failed) return false;
        return true;
      }),
    [filteredRows, selectedApiKey, selectedModel, selectedProvider, selectedStatus]
  );

  const realtimeLogRows = useMemo(() => buildRealtimeLogRows(scopedRows), [scopedRows]);
  const visibleRealtimeLogRows = useMemo(
    () => realtimeLogRows.slice(0, REALTIME_LOG_ROW_LIMIT),
    [realtimeLogRows]
  );
  const scopedFailureCount = scopedRows.filter((row) => row.failed).length;

  const clearFilters = () => {
    setSearchInput('');
    setSelectedProvider('all');
    setSelectedModel('all');
    setSelectedApiKey('all');
    setSelectedStatus('all');
  };

  const handleManualRefresh = async () => {
    try {
      const refreshed = await refreshUsage();
      showNotification(t(refreshed ? 'monitoring.refresh_success' : 'monitoring.refresh_failed'), refreshed ? 'success' : 'error');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t('monitoring.refresh_failed'), 'error');
    }
  };

  return (
    <div className={`${styles.page} ${styles.realtimeLogsPage}`}>
      <section className={styles.masthead}>
        <div className={styles.mastheadGlow} aria-hidden="true" />
        <div className={styles.mastheadCopy}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{t('monitoring.analysis_tab_logs')}</h1>
          </div>
        </div>
      </section>

      <section className={styles.usageTrendSection}>
        <div className={styles.usageTrendHeader}>
          <div className={styles.inlineMetrics}>
            <span>{`${t('monitoring.log_rows')}: ${realtimeLogRows.length}`}</span>
            {realtimeLogRows.length > visibleRealtimeLogRows.length ? (
              <span>{`${t('monitoring.visible_log_rows')}: ${visibleRealtimeLogRows.length}`}</span>
            ) : null}
            <span>{`${t('monitoring.recent_failures')}: ${scopedFailureCount}`}</span>
          </div>
          <div className={styles.usageTrendActions}>
            <button type="button" className={`${styles.clearButton} ${styles.usageTrendHideButton}`} onClick={() => void handleManualRefresh()}>
              {t('monitoring.refresh')}
            </button>
            <Select
              value={String(autoRefreshMs)}
              options={autoRefreshOptions}
              onChange={(value) => setAutoRefreshMs(Number(value))}
              ariaLabel={t('monitoring.auto_refresh')}
              className={styles.usageTrendApiKeySelect}
            />
            <div className={`${styles.rankingMetricSwitch} ${styles.timeRangeControl}`}>
              {TIME_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.rankingMetricButton} ${styles.timeRangeButton} ${timeRange === option.value ? styles.rankingMetricButtonActive : ''}`}
                  onClick={() => setTimeRange(option.value)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Card className={styles.realtimePanel}>
          <div className={styles.filterGrid}>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('monitoring.search_placeholder')}
              className={styles.toolbarHeaderSearchInput}
              rightElement={<IconSearch size={16} />}
              aria-label={t('monitoring.search_placeholder')}
            />
            <Select value={selectedApiKey} options={apiKeyOptions} onChange={setSelectedApiKey} ariaLabel={t('monitoring.filter_api_key')} />
            <Select value={selectedProvider} options={providerOptions} onChange={setSelectedProvider} ariaLabel={t('monitoring.filter_provider')} />
            <Select value={selectedModel} options={modelOptions} onChange={setSelectedModel} ariaLabel={t('monitoring.filter_model')} />
            <Select value={selectedStatus} options={statusOptions} onChange={(value) => setSelectedStatus(value as StatusFilter)} ariaLabel={t('monitoring.filter_status')} />
            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              <IconSlidersHorizontal size={16} />
              <span>{t('monitoring.clear_filters')}</span>
            </button>
          </div>

          {combinedError ? <div className={styles.errorBox}>{combinedError}</div> : null}

          <div className={`${styles.tableWrapper} ${styles.tableScrollWrapper} ${styles.realtimeTableWrapper}`}>
            <table className={`${styles.table} ${styles.realtimeTable}`}>
              <thead>
                <tr>
                  <th>{t('monitoring.column_type')}</th>
                  <th>{t('monitoring.column_model')}</th>
                  <th>{t('monitoring.api_key_label')}</th>
                  <th>{t('monitoring.recent_status')}</th>
                  <th>{t('monitoring.request_status')}</th>
                  <th>{t('monitoring.column_success_rate')}</th>
                  <th>{t('monitoring.total_calls')}</th>
                  <th>{t('monitoring.column_latency')}</th>
                  <th>{t('monitoring.column_time')}</th>
                  <th>{t('monitoring.this_call_usage')}</th>
                  <th>{t('monitoring.this_call_cost')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRealtimeLogRows.map((row) => (
                  <tr key={row.id} className={row.failed ? styles.logRowFailed : undefined}>
                    <td><div className={styles.primaryCell}><span>{row.provider}</span><small>{row.account || row.authLabel || row.accountMasked || '-'}</small></div></td>
                    <td><div className={styles.primaryCell}><span className={styles.monoCell}>{row.model}</span><small className={styles.monoCell}>{buildRealtimeMetaText(row)}</small></div></td>
                    <td><span className={styles.monoCell}>{row.clientApiKey.masked}</span></td>
                    <td>
                      <div className={styles.recentStatusCell}>
                        <RecentPattern
                          pattern={row.recentPattern}
                          label={t('monitoring.recent_pattern_label', {
                            total: row.recentPattern.length,
                            success: row.recentSuccessCount,
                            failure: row.recentFailureCount,
                          })}
                        />
                      </div>
                    </td>
                    <td><StatusBadge tone={row.failed ? 'bad' : 'good'}>{row.failed ? t('monitoring.result_failed') : t('monitoring.result_success')}</StatusBadge></td>
                    <td className={row.successRate >= 0.95 ? styles.goodText : row.successRate >= 0.85 ? styles.warnText : styles.badText}>{formatPercent(row.successRate)}</td>
                    <td>{formatCompactNumber(row.requestCount)}</td>
                    <td>{formatDurationMs(row.latencyMs, { locale: i18n.language })}</td>
                    <td>{new Date(row.timestampMs).toLocaleString(i18n.language)}</td>
                    <td><div className={styles.primaryCell}><span>{formatCompactNumber(row.totalTokens)}</span><small>{`I ${formatCompactNumber(row.inputTokens)} · O ${formatCompactNumber(row.outputTokens)} · C ${formatCompactNumber(row.cachedTokens)}`}</small></div></td>
                    <td>{hasPrices ? formatUsd(row.totalCost) : '--'}</td>
                  </tr>
                ))}
                {realtimeLogRows.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
                      <div className={styles.emptyTable}>{deferredSearch.trim() ? t('monitoring.no_filtered_data') : t('monitoring.no_data')}</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
