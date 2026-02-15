import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
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
  if (!raw || raw === 'draft') return 'Draft';
  if (raw === 'in review' || raw === 'in_review' || raw === 'submitted') return 'In Review';
  if (raw.includes('published')) return 'Published Campaign';
  return 'Draft';
};

const getPlatformLabel = (platform) => {
  const value = String(platform || '').trim();
  return value || 'Unknown';
};

export default function AnalyticsPage() {
  const { role } = useParams();
  const dispatch = useAppDispatch();
  const { campaigns, contentItems, brands, campaignCreators } = useAppState();
  const [loading, setLoading] = useState(false);
  const [loadingCampaignCreators, setLoadingCampaignCreators] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchAnalyticsData = async () => {
      setLoading(true);
      try {
        const [brandsRes, campaignsRes, contentRes] = await Promise.all([
          fetch('/api/brands'),
          fetch('/api/campaigns'),
          fetch('/api/content?limit=1500'),
        ]);
        const [brandsData, campaignsData, contentData] = await Promise.all([
          brandsRes.json(),
          campaignsRes.json(),
          contentRes.json(),
        ]);
        if (ignore) return;

        if (brandsData.ok) {
          dispatch({ type: 'SET_BRANDS', payload: brandsData.data || [] });
        }
        if (campaignsData.ok) {
          dispatch({ type: 'SET_CAMPAIGNS', payload: campaignsData.data || [] });
        }
        if (contentData.ok) {
          dispatch({ type: 'SET_CONTENT_ITEMS', payload: contentData.data || [] });
        }
      } catch (error) {
        console.error('Failed to load analytics data:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchAnalyticsData();
    return () => {
      ignore = true;
    };
  }, [dispatch, role]);

  const brandNames = brands.map((brand) => (typeof brand === 'string' ? brand : brand.name));
  const brandFilter = role === 'brand' ? storage.getBrand() || brandNames[0] : null;

  const visibleCampaigns = useMemo(() => {
    if (!brandFilter) return campaigns;
    return campaigns.filter((campaign) => campaign.brand === brandFilter);
  }, [brandFilter, campaigns]);

  const campaignIds = useMemo(() => visibleCampaigns.map((campaign) => campaign.id), [visibleCampaigns]);
  const campaignIdsKey = useMemo(() => campaignIds.join('|'), [campaignIds]);

  useEffect(() => {
    let ignore = false;

    const fetchCampaignCreatorStates = async () => {
      if (campaignIds.length === 0) {
        setLoadingCampaignCreators(false);
        return;
      }
      setLoadingCampaignCreators(true);
      try {
        await Promise.all(
          campaignIds.map(async (campaignId) => {
            const res = await fetch(`/api/campaigns/${campaignId}/creators`);
            const data = await res.json();
            if (ignore) return;
            dispatch({
              type: 'SET_CAMPAIGN_CREATORS',
              payload: {
                campaignId,
                data: data.ok ? data.data : EMPTY_CREATOR_STATE,
              },
            });
          })
        );
      } catch (error) {
        console.error('Failed to load campaign creator analytics:', error);
      } finally {
        if (!ignore) setLoadingCampaignCreators(false);
      }
    };

    fetchCampaignCreatorStates();
    return () => {
      ignore = true;
    };
  }, [campaignIdsKey, dispatch]);

  const selectedContentItems = useMemo(() => {
    if (visibleCampaigns.length === 0) return [];
    const selectedCreatorsByCampaign = new Map();
    visibleCampaigns.forEach((campaign) => {
      const state = campaignCreators[campaign.id] || EMPTY_CREATOR_STATE;
      const selectedSet = new Set((state.shortlist || []).filter(Boolean).map((id) => String(id)));
      selectedCreatorsByCampaign.set(String(campaign.id), selectedSet);
    });

    return contentItems.filter((item) => {
      const selectedSet = selectedCreatorsByCampaign.get(String(item.campaignId));
      if (!selectedSet || selectedSet.size === 0) return false;
      return selectedSet.has(String(item.creatorId));
    });
  }, [visibleCampaigns, campaignCreators, contentItems]);

  const campaignSummaries = useMemo(() => {
    return visibleCampaigns.map((campaign) => {
      const creatorState = campaignCreators[campaign.id] || EMPTY_CREATOR_STATE;
      const selectedCreatorIds = Array.from(
        new Set((creatorState.shortlist || []).filter(Boolean).map((id) => String(id)))
      );
      const selectedCreatorSet = new Set(selectedCreatorIds);
      const campaignSelectedContent = contentItems.filter(
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
  }, [campaignCreators, contentItems, visibleCampaigns]);

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
      Draft: 0,
      'In Review': 0,
      'Published Campaign': 0,
    };
    visibleCampaigns.forEach((campaign) => {
      const label = normalizeStatusLabel(campaign.status);
      base[label] += 1;
    });

    const totalCampaigns = Math.max(visibleCampaigns.length, 1);
    return [
      { label: 'Draft', count: base.Draft, tone: 'draft' },
      { label: 'In Review', count: base['In Review'], tone: 'review' },
      { label: 'Published Campaign', count: base['Published Campaign'], tone: 'published' },
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
      hint: `${campaignStatusRows.find((row) => row.label === 'Published Campaign')?.count || 0} published`,
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
    </div>
  );
}
