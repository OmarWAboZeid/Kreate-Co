import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
import {
  campaignsApi,
  queryKeys,
  useBrandsQuery,
  useCampaignsQuery,
  useContentItemsQuery,
} from '../queries/index.js';
import { storage, useAppDispatch, useAppState } from '../state.jsx';

const EMPTY_CREATOR_STATE = {
  shortlist: [],
  approvals: {},
  outreach: {},
  rejectionReasons: {},
};

const createEmptyMetrics = () => ({
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  reach: 0,
});

const toMetricNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeMetrics = (base, metrics) => ({
  views: base.views + toMetricNumber(metrics?.views),
  likes: base.likes + toMetricNumber(metrics?.likes),
  comments: base.comments + toMetricNumber(metrics?.comments),
  shares: base.shares + toMetricNumber(metrics?.shares),
  saves: base.saves + toMetricNumber(metrics?.saves),
  reach: base.reach + toMetricNumber(metrics?.reach),
});

const formatMetricNumber = (value) => toMetricNumber(value).toLocaleString();

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatEngagementRate = (views, interactions) => {
  const safeViews = toMetricNumber(views);
  const safeInteractions = toMetricNumber(interactions);
  if (safeViews <= 0 || safeInteractions <= 0) return '0.00';
  return ((safeInteractions / safeViews) * 100).toFixed(2);
};

const formatPercent = (numerator, denominator) => {
  const top = toMetricNumber(numerator);
  const bottom = toMetricNumber(denominator);
  if (bottom <= 0 || top <= 0) return '0.0';
  return ((top / bottom) * 100).toFixed(1);
};

const normalizeStatusLabel = (status) => {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw || raw === 'planning' || raw === 'draft') return 'Planning';
  if (
    raw === 'in review' ||
    raw === 'in_review' ||
    raw === 'in progress' ||
    raw === 'in_progress' ||
    raw === 'submitted' ||
    raw === 'active'
  ) {
    return 'In Progress';
  }
  if (raw.includes('published')) return 'Published';
  return 'Planning';
};

const getPlatformLabel = (platform) => {
  const value = String(platform || '').trim();
  return value || 'Unknown';
};

export default function AnalyticsPage() {
  const { role } = useParams();
  const isAdmin = role === 'admin';
  const dispatch = useAppDispatch();
  const { campaigns, contentItems, brands, campaignCreators } = useAppState();
  const [adminAnalyticsTab, setAdminAnalyticsTab] = useState('campaign');
  const brandsQuery = useBrandsQuery();
  const campaignsQuery = useCampaignsQuery();
  const contentItemsQuery = useContentItemsQuery({ limit: 1500 });
  const loading =
    brandsQuery.isLoading || campaignsQuery.isLoading || contentItemsQuery.isLoading;
  const brandSource = brandsQuery.data?.data || brands;
  const campaignSource = campaignsQuery.data?.data || campaigns;
  const contentSource = contentItemsQuery.data?.data || contentItems;

  useEffect(() => {
    if (!isAdmin && adminAnalyticsTab !== 'campaign') {
      setAdminAnalyticsTab('campaign');
    }
  }, [adminAnalyticsTab, isAdmin]);

  useEffect(() => {
    const payload = brandsQuery.data?.data;
    if (!payload) return;
    dispatch({ type: 'SET_BRANDS', payload });
  }, [brandsQuery.data, dispatch]);

  useEffect(() => {
    const payload = campaignsQuery.data?.data;
    if (!payload) return;
    dispatch({ type: 'SET_CAMPAIGNS', payload });
  }, [campaignsQuery.data, dispatch]);

  useEffect(() => {
    const payload = contentItemsQuery.data?.data;
    if (!payload) return;
    dispatch({ type: 'SET_CONTENT_ITEMS', payload });
  }, [contentItemsQuery.data, dispatch]);

  const brandNames = brandSource.map((brand) =>
    typeof brand === 'string' ? brand : brand.name
  );
  const brandFilter = role === 'brand' ? storage.getBrand() || brandNames[0] : null;

  const visibleCampaigns = useMemo(() => {
    if (!brandFilter) return campaignSource;
    return campaignSource.filter((campaign) => campaign.brand === brandFilter);
  }, [brandFilter, campaignSource]);

  const campaignIds = useMemo(() => visibleCampaigns.map((campaign) => campaign.id), [visibleCampaigns]);
  const campaignIdsKey = useMemo(() => campaignIds.join('|'), [campaignIds]);
  const campaignCreatorQueries = useQueries({
    queries: campaignIds.map((campaignId) => ({
      queryKey: queryKeys.campaigns.creators(campaignId),
      queryFn: () => campaignsApi.creators(campaignId),
      enabled: Boolean(campaignId),
    })),
  });
  const loadingCampaignCreators = campaignCreatorQueries.some(
    (query) => query.isLoading || query.isFetching
  );
  const campaignCreatorSyncToken = campaignCreatorQueries
    .map(
      (query, index) =>
        `${campaignIds[index] || ''}:${query.dataUpdatedAt || 0}:${query.errorUpdatedAt || 0}:${
          query.isError ? 1 : 0
        }`
    )
    .join('|');

  useEffect(() => {
    if (campaignIds.length === 0) {
      return;
    }
    campaignIds.forEach((campaignId, index) => {
      const query = campaignCreatorQueries[index];
      if (!query) return;
      if (query.data?.data) {
        dispatch({
          type: 'SET_CAMPAIGN_CREATORS',
          payload: {
            campaignId,
            data: query.data.data,
          },
        });
        return;
      }
      if (query.isError) {
        dispatch({
          type: 'SET_CAMPAIGN_CREATORS',
          payload: {
            campaignId,
            data: EMPTY_CREATOR_STATE,
          },
        });
      }
    });
  }, [campaignCreatorSyncToken, campaignIdsKey, campaignIds, dispatch]);

  const selectedContentItems = useMemo(() => {
    if (visibleCampaigns.length === 0) return [];
    const selectedCreatorsByCampaign = new Map();
    visibleCampaigns.forEach((campaign) => {
      const state = campaignCreators[campaign.id] || EMPTY_CREATOR_STATE;
      const selectedSet = new Set((state.shortlist || []).filter(Boolean).map((id) => String(id)));
      selectedCreatorsByCampaign.set(String(campaign.id), selectedSet);
    });

    return contentSource.filter((item) => {
      const selectedSet = selectedCreatorsByCampaign.get(String(item.campaignId));
      if (!selectedSet || selectedSet.size === 0) return false;
      return selectedSet.has(String(item.creatorId));
    });
  }, [visibleCampaigns, campaignCreators, contentSource]);

  const campaignSummaries = useMemo(() => {
    return visibleCampaigns.map((campaign) => {
      const creatorState = campaignCreators[campaign.id] || EMPTY_CREATOR_STATE;
      const selectedCreatorIds = Array.from(
        new Set((creatorState.shortlist || []).filter(Boolean).map((id) => String(id)))
      );
      const selectedCreatorSet = new Set(selectedCreatorIds);
      const campaignSelectedContent = contentSource.filter(
        (item) =>
          String(item.campaignId) === String(campaign.id) &&
          selectedCreatorSet.has(String(item.creatorId))
      );

      const metrics = campaignSelectedContent.reduce(
        (acc, item) => mergeMetrics(acc, item.metrics),
        createEmptyMetrics()
      );
      const interactions =
        metrics.likes + metrics.comments + metrics.shares + metrics.saves;
      const publishedCount = campaignSelectedContent.filter(
        (item) => item.status === 'Published'
      ).length;
      const approvedCreatorCount = selectedCreatorIds.filter(
        (creatorId) => creatorState.approvals?.[creatorId] === 'Brand Approved'
      ).length;

      return {
        campaign,
        selectedCreatorIds,
        approvedCreatorCount,
        submissions: campaignSelectedContent.length,
        publishedCount,
        metrics,
        interactions,
      };
    });
  }, [campaignCreators, contentSource, visibleCampaigns]);

  const aggregateTotals = useMemo(() => {
    const uniqueSelectedCreators = new Set();
    const totals = campaignSummaries.reduce(
      (acc, summary) => {
        summary.selectedCreatorIds.forEach((id) => uniqueSelectedCreators.add(id));
        acc.approvedCreators += summary.approvedCreatorCount;
        acc.submissions += summary.submissions;
        acc.published += summary.publishedCount;
        acc.metrics = mergeMetrics(acc.metrics, summary.metrics);
        acc.interactions += summary.interactions;
        return acc;
      },
      {
        approvedCreators: 0,
        submissions: 0,
        published: 0,
        metrics: createEmptyMetrics(),
        interactions: 0,
      }
    );
    return {
      campaigns: campaignSummaries.length,
      selectedCreators: uniqueSelectedCreators.size,
      approvedCreators: totals.approvedCreators,
      submissions: totals.submissions,
      published: totals.published,
      metrics: totals.metrics,
      interactions: totals.interactions,
    };
  }, [campaignSummaries]);

  const campaignStatusRows = useMemo(() => {
    const base = {
      Planning: 0,
      'In Progress': 0,
      Published: 0,
    };
    visibleCampaigns.forEach((campaign) => {
      const label = normalizeStatusLabel(campaign.status);
      base[label] += 1;
    });

    const totalCampaigns = Math.max(visibleCampaigns.length, 1);
    return [
      { label: 'Planning', count: base.Planning, tone: 'planning' },
      { label: 'In Progress', count: base['In Progress'], tone: 'in-progress' },
      { label: 'Published', count: base.Published, tone: 'published' },
    ].map((row) => ({
      ...row,
      percent: Number(((row.count / totalCampaigns) * 100).toFixed(1)),
    }));
  }, [visibleCampaigns]);

  const platformRows = useMemo(() => {
    const map = new Map();
    selectedContentItems.forEach((item) => {
      const label = getPlatformLabel(item.platform);
      const metrics = item.metrics || {};
      const record = map.get(label) || {
        platform: label,
        submissions: 0,
        published: 0,
        metrics: createEmptyMetrics(),
        interactions: 0,
      };
      record.submissions += 1;
      if (item.status === 'Published') {
        record.published += 1;
      }
      record.metrics = mergeMetrics(record.metrics, metrics);
      record.interactions +=
        toMetricNumber(metrics.likes) +
        toMetricNumber(metrics.comments) +
        toMetricNumber(metrics.shares) +
        toMetricNumber(metrics.saves);
      map.set(label, record);
    });

    return Array.from(map.values()).sort((left, right) => {
      if (right.metrics.views !== left.metrics.views) {
        return right.metrics.views - left.metrics.views;
      }
      return right.submissions - left.submissions;
    });
  }, [selectedContentItems]);

  const rankedCampaigns = useMemo(() => {
    return [...campaignSummaries].sort((left, right) => {
      if (right.metrics.views !== left.metrics.views) {
        return right.metrics.views - left.metrics.views;
      }
      return right.submissions - left.submissions;
    });
  }, [campaignSummaries]);

  const topCampaign = rankedCampaigns[0] || null;

  const funnelSteps = useMemo(
    () => [
      { label: 'Campaigns', value: aggregateTotals.campaigns },
      { label: 'Selected Creators', value: aggregateTotals.selectedCreators },
      { label: 'Approved Creators', value: aggregateTotals.approvedCreators },
      { label: 'Submissions', value: aggregateTotals.submissions },
      { label: 'Published Content', value: aggregateTotals.published },
    ],
    [aggregateTotals]
  );
  const funnelMax = Math.max(1, ...funnelSteps.map((step) => step.value));

  const approvalRate = formatPercent(aggregateTotals.approvedCreators, aggregateTotals.selectedCreators);
  const publishRate = formatPercent(aggregateTotals.published, aggregateTotals.submissions);
  const avgViewsPerCreator = aggregateTotals.selectedCreators
    ? Math.round(aggregateTotals.metrics.views / aggregateTotals.selectedCreators)
    : 0;
  const avgViewsPerCampaign = aggregateTotals.campaigns
    ? Math.round(aggregateTotals.metrics.views / aggregateTotals.campaigns)
    : 0;
  const avgSubmissionsPerCreator = aggregateTotals.selectedCreators
    ? (aggregateTotals.submissions / aggregateTotals.selectedCreators).toFixed(2)
    : '0.00';

  const kpiCards = [
    {
      label: 'Total Campaigns',
      value: formatMetricNumber(aggregateTotals.campaigns),
      hint: `${campaignStatusRows.find((row) => row.label === 'Published')?.count || 0} published`,
    },
    {
      label: 'Selected Creators',
      value: formatMetricNumber(aggregateTotals.selectedCreators),
      hint: `${approvalRate}% approval rate`,
    },
    {
      label: 'Content Submissions',
      value: formatMetricNumber(aggregateTotals.submissions),
      hint: `${avgSubmissionsPerCreator} per creator`,
    },
    {
      label: 'Published Content',
      value: formatMetricNumber(aggregateTotals.published),
      hint: `${publishRate}% publish rate`,
    },
    {
      label: 'Total Views',
      value: formatMetricNumber(aggregateTotals.metrics.views),
      hint: `${formatMetricNumber(avgViewsPerCampaign)} avg per campaign`,
    },
    {
      label: 'Engagement Rate',
      value: `${formatEngagementRate(aggregateTotals.metrics.views, aggregateTotals.interactions)}%`,
      hint: `${formatMetricNumber(aggregateTotals.metrics.likes)} likes`,
    },
    {
      label: 'Avg Views / Creator',
      value: formatMetricNumber(avgViewsPerCreator),
      hint: `${formatMetricNumber(aggregateTotals.metrics.comments)} comments`,
    },
    {
      label: 'Total Reach',
      value: formatMetricNumber(aggregateTotals.metrics.reach),
      hint: `${formatMetricNumber(aggregateTotals.metrics.shares)} shares`,
    },
  ];

  const campaignSummaryMap = useMemo(() => {
    return new Map(campaignSummaries.map((summary) => [String(summary.campaign.id), summary]));
  }, [campaignSummaries]);

  const financialRows = useMemo(() => {
    return visibleCampaigns
      .map((campaign) => {
        const summary = campaignSummaryMap.get(String(campaign.id));
        const plannedBudget = toMetricNumber(campaign.package?.price);
        const submissions = summary?.submissions || 0;
        const published = summary?.publishedCount || 0;
        const selectedCreators = summary?.selectedCreatorIds?.length || 0;
        const approvedCreators = summary?.approvedCreatorCount || 0;

        return {
          campaign,
          statusLabel: normalizeStatusLabel(campaign.status),
          packageName: campaign.package?.name || campaign.customPackageLabel || 'Custom',
          dealType: campaign.dealType || '—',
          plannedBudget,
          selectedCreators,
          approvedCreators,
          submissions,
          published,
          costPerSubmission: submissions > 0 ? plannedBudget / submissions : 0,
          costPerPublished: published > 0 ? plannedBudget / published : 0,
        };
      })
      .sort((left, right) => {
        if (right.plannedBudget !== left.plannedBudget) {
          return right.plannedBudget - left.plannedBudget;
        }
        if (right.published !== left.published) {
          return right.published - left.published;
        }
        return String(left.campaign.name || '').localeCompare(String(right.campaign.name || ''));
      });
  }, [campaignSummaryMap, visibleCampaigns]);

  const financialTotals = useMemo(() => {
    return financialRows.reduce(
      (acc, row) => {
        acc.totalBudget += row.plannedBudget;
        if (row.statusLabel === 'In Progress') acc.inProgressBudget += row.plannedBudget;
        if (row.statusLabel === 'Published') acc.publishedBudget += row.plannedBudget;
        acc.costPerSubmissionTotal += row.costPerSubmission;
        acc.costPerPublishedTotal += row.costPerPublished;
        return acc;
      },
      {
        totalBudget: 0,
        inProgressBudget: 0,
        publishedBudget: 0,
        costPerSubmissionTotal: 0,
        costPerPublishedTotal: 0,
      }
    );
  }, [financialRows]);

  const avgBudgetPerCampaign =
    financialRows.length > 0 ? financialTotals.totalBudget / financialRows.length : 0;
  const avgCostPerSubmission =
    aggregateTotals.submissions > 0
      ? financialTotals.totalBudget / aggregateTotals.submissions
      : 0;
  const avgCostPerPublished =
    aggregateTotals.published > 0 ? financialTotals.totalBudget / aggregateTotals.published : 0;
  const publishedBudgetShare =
    financialTotals.totalBudget > 0
      ? ((financialTotals.publishedBudget / financialTotals.totalBudget) * 100).toFixed(1)
      : '0.0';

  const financialKpis = [
    {
      label: 'Planned Budget',
      value: formatCurrency(financialTotals.totalBudget),
      hint: `${formatMetricNumber(financialRows.length)} campaigns`,
    },
    {
      label: 'In Progress Budget',
      value: formatCurrency(financialTotals.inProgressBudget),
      hint: 'Active campaign allocation',
    },
    {
      label: 'Published Budget',
      value: formatCurrency(financialTotals.publishedBudget),
      hint: `${publishedBudgetShare}% of planned budget`,
    },
    {
      label: 'Avg Budget / Campaign',
      value: formatCurrency(avgBudgetPerCampaign),
      hint: `${formatCurrency(avgCostPerPublished)} est. cost per published video`,
    },
    {
      label: 'Est. Cost / Submission',
      value: formatCurrency(avgCostPerSubmission),
      hint: `${formatMetricNumber(aggregateTotals.submissions)} total submissions`,
    },
    {
      label: 'Est. Cost / Published',
      value: formatCurrency(avgCostPerPublished),
      hint: `${formatMetricNumber(aggregateTotals.published)} published videos`,
    },
  ];

  const topBudgetCampaign = financialRows[0] || null;

  return (
    <div className="page-stack aggregate-analytics-page">
      <div className="aggregate-analytics-hero">
        <div className="aggregate-analytics-hero-copy">
          <h2>Analytics & Reporting</h2>
          <p>
            Aggregate performance across all campaigns with creators, content delivery, and outcome quality signals.
          </p>
        </div>
        <button type="button" className="btn btn-secondary">
          Export
        </button>
      </div>

      {(loading || loadingCampaignCreators) && <p className="muted">Loading analytics...</p>}

      {isAdmin ? (
        <div className="tabs-container aggregate-analytics-tabs">
          <button
            type="button"
            className={`tab-btn ${adminAnalyticsTab === 'campaign' ? 'active' : ''}`}
            onClick={() => setAdminAnalyticsTab('campaign')}
          >
            Campaign
          </button>
          <button
            type="button"
            className={`tab-btn ${adminAnalyticsTab === 'financials' ? 'active' : ''}`}
            onClick={() => setAdminAnalyticsTab('financials')}
          >
            Financials
          </button>
        </div>
      ) : null}

      {(!isAdmin || adminAnalyticsTab === 'campaign') && (
        <>
          <section className="aggregate-analytics-kpi-grid">
            {kpiCards.map((card) => (
              <article className="aggregate-analytics-kpi-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.hint}</p>
              </article>
            ))}
          </section>

          <section className="aggregate-analytics-panels">
            <article className="card aggregate-analytics-panel">
              <div className="aggregate-analytics-panel-header">
                <h3>Delivery Funnel</h3>
                <p>Track flow from campaign setup to published content.</p>
              </div>
              <div className="aggregate-analytics-funnel">
                {funnelSteps.map((step) => (
                  <div className="aggregate-analytics-funnel-row" key={step.label}>
                    <div className="aggregate-analytics-funnel-top">
                      <span>{step.label}</span>
                      <strong>{formatMetricNumber(step.value)}</strong>
                    </div>
                    <div className="aggregate-analytics-progress">
                      <span
                        style={{
                          width: `${Math.max(8, (step.value / funnelMax) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card aggregate-analytics-panel">
              <div className="aggregate-analytics-panel-header">
                <h3>Campaign Status Mix</h3>
                <p>How campaigns are distributed by lifecycle stage.</p>
              </div>
              <div className="aggregate-analytics-status-list">
                {campaignStatusRows.map((row) => (
                  <div className="aggregate-analytics-status-row" key={row.label}>
                    <div className="aggregate-analytics-status-head">
                      <span>{row.label}</span>
                      <strong>{row.count}</strong>
                    </div>
                    <div className="aggregate-analytics-progress">
                      <span className={`tone-${row.tone}`} style={{ width: `${Math.max(6, row.percent)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <article className="card aggregate-analytics-panel aggregate-analytics-platforms">
            <div className="aggregate-analytics-panel-header">
              <h3>Platform Performance</h3>
              <p>Submission output and engagement per platform.</p>
            </div>
            {platformRows.length === 0 ? (
              <p className="muted">No platform analytics yet.</p>
            ) : (
              <div className="analytics-table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Submissions</th>
                      <th>Published</th>
                      <th>Views</th>
                      <th>Likes</th>
                      <th>Comments</th>
                      <th>Shares</th>
                      <th>Saves</th>
                      <th>ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformRows.map((row) => (
                      <tr key={row.platform}>
                        <td>{row.platform}</td>
                        <td>{formatMetricNumber(row.submissions)}</td>
                        <td>{formatMetricNumber(row.published)}</td>
                        <td>{formatMetricNumber(row.metrics.views)}</td>
                        <td>{formatMetricNumber(row.metrics.likes)}</td>
                        <td>{formatMetricNumber(row.metrics.comments)}</td>
                        <td>{formatMetricNumber(row.metrics.shares)}</td>
                        <td>{formatMetricNumber(row.metrics.saves)}</td>
                        <td className="engagement-cell">
                          {formatEngagementRate(row.metrics.views, row.interactions)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card aggregate-analytics-panel aggregate-analytics-campaigns">
            <div className="aggregate-analytics-panel-header">
              <h3>Campaign Aggregates</h3>
              <p>Performance leaderboard across all visible campaigns.</p>
            </div>
            <div className="aggregate-analytics-highlight">
              <span>Top Campaign by Views</span>
              <strong>{topCampaign ? topCampaign.campaign.name : 'No campaigns yet'}</strong>
              {topCampaign ? (
                <p>
                  {formatMetricNumber(topCampaign.metrics.views)} views ·{' '}
                  {formatEngagementRate(topCampaign.metrics.views, topCampaign.interactions)}% ER
                </p>
              ) : (
                <p>Add campaign activity to generate rankings.</p>
              )}
            </div>
            {rankedCampaigns.length === 0 ? (
              <p className="muted">No campaigns available yet.</p>
            ) : (
              <div className="analytics-table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Selected Creators</th>
                      <th>Approved</th>
                      <th>Submissions</th>
                      <th>Published</th>
                      <th>Views</th>
                      <th>Likes</th>
                      <th>Comments</th>
                      <th>Shares</th>
                      <th>Saves</th>
                      <th>ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedCampaigns.map((summary, index) => (
                      <tr key={summary.campaign.id}>
                        <td>{index + 1}</td>
                        <td>{summary.campaign.name}</td>
                        <td>
                          <StatusPill status={summary.campaign.status} />
                        </td>
                        <td>{summary.selectedCreatorIds.length}</td>
                        <td>{summary.approvedCreatorCount}</td>
                        <td>{summary.submissions}</td>
                        <td>{summary.publishedCount}</td>
                        <td>{formatMetricNumber(summary.metrics.views)}</td>
                        <td>{formatMetricNumber(summary.metrics.likes)}</td>
                        <td>{formatMetricNumber(summary.metrics.comments)}</td>
                        <td>{formatMetricNumber(summary.metrics.shares)}</td>
                        <td>{formatMetricNumber(summary.metrics.saves)}</td>
                        <td className="engagement-cell">
                          {formatEngagementRate(summary.metrics.views, summary.interactions)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}

      {isAdmin && adminAnalyticsTab === 'financials' && (
        <>
          <section className="aggregate-analytics-kpi-grid aggregate-financial-kpi-grid">
            {financialKpis.map((card) => (
              <article className="aggregate-analytics-kpi-card aggregate-financial-kpi-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.hint}</p>
              </article>
            ))}
          </section>

          <article className="card aggregate-analytics-panel aggregate-analytics-financials">
            <div className="aggregate-analytics-panel-header">
              <h3>Campaign Financials</h3>
              <p>Estimated budget and cost efficiency across visible campaigns.</p>
            </div>
            <div className="aggregate-analytics-highlight">
              <span>Highest Budget Campaign</span>
              <strong>{topBudgetCampaign ? topBudgetCampaign.campaign.name : 'No campaigns yet'}</strong>
              {topBudgetCampaign ? (
                <p>
                  {formatCurrency(topBudgetCampaign.plannedBudget)} planned ·{' '}
                  {formatCurrency(topBudgetCampaign.costPerPublished)} est. cost per published
                </p>
              ) : (
                <p>Add campaign package pricing to generate financial insights.</p>
              )}
            </div>

            {financialRows.length === 0 ? (
              <p className="muted">No campaigns available yet.</p>
            ) : (
              <div className="analytics-table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Package</th>
                      <th>Deal Type</th>
                      <th>Planned Budget</th>
                      <th>Selected</th>
                      <th>Approved</th>
                      <th>Submissions</th>
                      <th>Published</th>
                      <th>Est. Cost / Submission</th>
                      <th>Est. Cost / Published</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRows.map((row, index) => (
                      <tr key={row.campaign.id}>
                        <td>{index + 1}</td>
                        <td>{row.campaign.name}</td>
                        <td>
                          <StatusPill status={row.campaign.status} />
                        </td>
                        <td>{row.packageName}</td>
                        <td>{row.dealType}</td>
                        <td>{formatCurrency(row.plannedBudget)}</td>
                        <td>{formatMetricNumber(row.selectedCreators)}</td>
                        <td>{formatMetricNumber(row.approvedCreators)}</td>
                        <td>{formatMetricNumber(row.submissions)}</td>
                        <td>{formatMetricNumber(row.published)}</td>
                        <td>{formatCurrency(row.costPerSubmission)}</td>
                        <td>{formatCurrency(row.costPerPublished)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </div>
  );
}
