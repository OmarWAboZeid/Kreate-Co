import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const NUMBER_KEYS = ['playCount', 'diggCount', 'commentCount', 'shareCount', 'collectCount'];

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString();
};

const formatDate = (ts) => {
  if (!ts) return '—';
  const num = Number(ts);
  if (!Number.isFinite(num)) return '—';
  const date = new Date(num * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const extractStats = (item) => {
  const stats = item.stats || item.statsV2 || {};
  const normalized = {};
  NUMBER_KEYS.forEach((key) => {
    normalized[key] = toNumber(stats[key]);
  });
  return normalized;
};

const engagementRate = (stats) => {
  const views = stats.playCount || 0;
  if (views === 0) return 0;
  const total = stats.diggCount + stats.commentCount + stats.shareCount + stats.collectCount;
  return (total / views) * 100;
};

const findPosts = (obj, results = []) => {
  if (!obj) return results;
  if (Array.isArray(obj)) {
    obj.forEach((item) => findPosts(item, results));
    return results;
  }
  if (typeof obj === 'object') {
    const maybeStats = obj.stats || obj.statsV2;
    if (maybeStats && Object.prototype.hasOwnProperty.call(maybeStats, 'playCount')) {
      results.push(obj);
    }
    Object.values(obj).forEach((value) => findPosts(value, results));
  }
  return results;
};

const findAccountInfo = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [];
  const queue = [obj];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (current.author || current.authorStats || current.authorStatsV2) {
      candidates.push(current);
    }
    Object.values(current).forEach((value) => {
      if (value && typeof value === 'object') queue.push(value);
    });
  }
  return candidates[0] || null;
};

const extractVideoUrl = (item) => {
  return (
    item.shareInfo?.shareUrl ||
    item.share_url ||
    item.shareUrl ||
    item.video?.playAddr ||
    item.video?.downloadAddr ||
    ''
  );
};

const extractThumbnail = (item) => {
  return (
    item.video?.cover ||
    item.video?.originCover ||
    item.video?.dynamicCover ||
    item.cover ||
    ''
  );
};

export default function TikTokResultsPage() {
  const [search, setSearch] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minEngagement, setMinEngagement] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('views');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

  const result = useMemo(() => {
    const raw = window.localStorage.getItem('tiktok_analysis_result');
    if (!raw) {
      console.warn('[tiktok][results] localStorage tiktok_analysis_result is empty');
      return null;
    }
    console.log('[tiktok][results] raw localStorage length', raw.length);
    try {
      const parsed = JSON.parse(raw);
      console.log('[tiktok][results] parsed result keys', Object.keys(parsed || {}));
      return parsed;
    } catch (error) {
      console.error('[tiktok][results] failed to parse localStorage JSON', error);
      console.log('[tiktok][results] raw preview', raw.slice(0, 1000));
      return null;
    }
  }, []);

  const posts = useMemo(() => {
    if (!result) return [];
    const rawPosts = findPosts(result);
    return rawPosts.map((item, index) => {
      const stats = extractStats(item);
      return {
        id: item.id || item.aweme_id || item.item_id || index,
        caption: (item.desc || item.caption || '').trim(),
        stats,
        engagement: engagementRate(stats),
        createdAt: item.createTime || item.create_time || item.timestamp,
        music: item.music || {},
        textExtra: item.textExtra || item.text_extra || [],
        views: stats.playCount,
        likes: stats.diggCount,
        comments: stats.commentCount,
        shares: stats.shareCount,
        saves: stats.collectCount,
        url: extractVideoUrl(item),
        thumbnail: extractThumbnail(item),
      };
    });
  }, [result]);

  const accountSummary = useMemo(() => {
    if (!result) return null;
    const accountNode = findAccountInfo(result) || {};
    const author = accountNode.author || accountNode.user || {};
    const stats = accountNode.authorStats || accountNode.authorStatsV2 || accountNode.stats || {};
    return {
      handle: author.uniqueId || author.unique_id || author.id || '—',
      name: author.nickname || author.nickName || author.displayName || '—',
      followers: stats.followerCount ?? stats.follower_count,
      following: stats.followingCount ?? stats.following_count,
      totalVideos: stats.videoCount ?? stats.video_count,
      totalLikes: stats.heartCount ?? stats.diggCount ?? stats.total_favorited,
    };
  }, [result]);

  useEffect(() => {
    console.log('[tiktok][results] result summary', {
      hasResult: Boolean(result),
      topLevelKeys: result ? Object.keys(result) : [],
      dataKeys: result?.data ? Object.keys(result.data) : [],
      counts: result?.counts,
    });
  }, [result]);

  useEffect(() => {
    console.log('[tiktok][results] posts length', posts.length);
    if (result && posts.length === 0) {
      console.log('[tiktok][results] no posts found in result');
    }
  }, [posts, result]);

  useEffect(() => {
    if (accountSummary) {
      console.log('[tiktok][results] account summary', accountSummary);
    }
  }, [accountSummary]);

  const totals = useMemo(() => {
    const total = posts.reduce(
      (acc, post) => {
        acc.views += post.stats.playCount;
        acc.likes += post.stats.diggCount;
        acc.comments += post.stats.commentCount;
        acc.shares += post.stats.shareCount;
        acc.saves += post.stats.collectCount;
        acc.engagementSum += post.engagement;
        return acc;
      },
      { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementSum: 0 }
    );
    const avgER = posts.length ? total.engagementSum / posts.length : 0;
    const avgViews = posts.length ? total.views / posts.length : 0;
    return { ...total, avgER, avgViews };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const minViewsValue = toNumber(minViews);
    const minEngagementValue = toNumber(minEngagement);
    return posts.filter((post) => {
      if (search && !post.caption.toLowerCase().includes(search.toLowerCase())) return false;
      if (post.stats.playCount < minViewsValue) return false;
      if (post.engagement < minEngagementValue) return false;
      return true;
    });
  }, [posts, search, minViews, minEngagement]);

  const sortedPosts = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredPosts].sort((a, b) => {
      if (sortKey === 'caption') return a.caption.localeCompare(b.caption) * dir;
      if (sortKey === 'date') return ((a.createdAt || 0) - (b.createdAt || 0)) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [filteredPosts, sortKey, sortDir]);

  const perPage = 25;
  const totalPages = Math.max(1, Math.ceil(sortedPosts.length / perPage));
  const pagePosts = sortedPosts.slice((page - 1) * perPage, page * perPage);

  const topByViews = useMemo(() => {
    return [...posts].sort((a, b) => b.views - a.views).slice(0, 10);
  }, [posts]);

  const topByEngagement = useMemo(() => {
    return [...posts].sort((a, b) => b.engagement - a.engagement).slice(0, 10);
  }, [posts]);

  const setSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'caption' ? 'asc' : 'desc');
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="app-shell">
      <div className="app-main not-found-main tiktok-results">
        <div className="results-header">
          <h1>TikTok Analysis Results</h1>
          <div className="results-actions">
            {result && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = 'tiktok-analysis.json';
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download JSON
              </button>
            )}
            <Link to="/tiktok" className="btn btn-secondary">
              Analyze Another
            </Link>
          </div>
        </div>

        {!result ? (
          <p className="error-text">No results found. Run an analysis first.</p>
        ) : (
          <>
            <section className="dashboard-section">
              <div className="section-header">
                <h2>Account Summary</h2>
                <span className="badge">From uploaded JSON</span>
              </div>
              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <div className="card-label">Handle + Name</div>
                  <div className="card-value">
                    @{accountSummary?.handle || '—'}
                    {accountSummary?.name ? ` • ${accountSummary.name}` : ''}
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Followers</div>
                  <div className="card-value">
                    {accountSummary?.followers ? formatNumber(accountSummary.followers) : '—'}
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Total Videos</div>
                  <div className="card-value">
                    {accountSummary?.totalVideos ? formatNumber(accountSummary.totalVideos) : '—'}
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Total Likes</div>
                  <div className="card-value">
                    {accountSummary?.totalLikes ? formatNumber(accountSummary.totalLikes) : '—'}
                  </div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Following</div>
                  <div className="card-value">
                    {accountSummary?.following ? formatNumber(accountSummary.following) : '—'}
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-header">
                <h2>Key Totals (Computed)</h2>
              </div>
              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <div className="card-label">Total Views</div>
                  <div className="card-value">{formatNumber(totals.views)}</div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Total Likes</div>
                  <div className="card-value">{formatNumber(totals.likes)}</div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Total Comments</div>
                  <div className="card-value">{formatNumber(totals.comments)}</div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Total Shares</div>
                  <div className="card-value">{formatNumber(totals.shares)}</div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Total Saves</div>
                  <div className="card-value">{formatNumber(totals.saves)}</div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Avg Engagement Rate</div>
                  <div className="card-value">{totals.avgER.toFixed(2)}%</div>
                </div>
                <div className="dashboard-card">
                  <div className="card-label">Avg Views / Video</div>
                  <div className="card-value">{formatNumber(Math.round(totals.avgViews))}</div>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-header">
                <h2>Top Videos</h2>
              </div>
              <div className="chart-grid">
                <div className="chart-card">
                  <h3>Top 10 by Views</h3>
                  <div className="chart-list">
                    {topByViews.map((post, index) => (
                      <div key={post.id} className="chart-row">
                        <span className="chart-label">#{index + 1}</span>
                        <div className="chart-bar">
                          <div
                            className="chart-fill"
                            style={{ width: `${(post.views / (topByViews[0]?.views || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="chart-value">{formatNumber(post.views)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chart-card">
                  <h3>Top 10 by Engagement Rate</h3>
                  <div className="chart-list">
                    {topByEngagement.map((post, index) => (
                      <div key={post.id} className="chart-row">
                        <span className="chart-label">#{index + 1}</span>
                        <div className="chart-bar">
                          <div
                            className="chart-fill"
                            style={{
                              width: `${(post.engagement / (topByEngagement[0]?.engagement || 1)) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <span className="chart-value">{post.engagement.toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-header">
                <h2>Videos</h2>
                <div className="actions">
                  <input
                    className="input"
                    placeholder="Search caption"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Min views"
                    value={minViews}
                    onChange={(event) => {
                      setMinViews(event.target.value);
                      setPage(1);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Min ER %"
                    value={minEngagement}
                    onChange={(event) => {
                      setMinEngagement(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              {posts.length === 0 ? (
                <div className="error-text">
                  <p>Couldn’t find posts array; check file format.</p>
                  {result?.data?.session_error && (
                    <p>Session error: {result.data.session_error}</p>
                  )}
                  {result?.data?.user?.info_error && (
                    <p>Details: {result.data.user.info_error}</p>
                  )}
                  {result?.data?.user?.liked_error && (
                    <p>Liked error: {result.data.user.liked_error}</p>
                  )}
                  {result?.search_error && <p>Search error: {result.search_error}</p>}
                  {result?.debug?.stderr && (
                    <details>
                      <summary>Debug log</summary>
                      <pre className="debug-log">{result.debug.stderr}</pre>
                    </details>
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Video</th>
                        <th onClick={() => setSort('caption')}>Caption</th>
                        <th className="num" onClick={() => setSort('views')}>
                          Views
                        </th>
                        <th className="num" onClick={() => setSort('likes')}>
                          Likes
                        </th>
                        <th className="num" onClick={() => setSort('comments')}>
                          Comments
                        </th>
                        <th className="num" onClick={() => setSort('shares')}>
                          Shares
                        </th>
                        <th className="num" onClick={() => setSort('saves')}>
                          Saves
                        </th>
                        <th className="num" onClick={() => setSort('engagement')}>
                          Engagement %
                        </th>
                        <th className="num" onClick={() => setSort('date')}>
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagePosts.map((post) => (
                        <Fragment key={post.id}>
                          <tr
                            className="video-row"
                            onClick={() => toggleExpand(post.id)}
                          >
                            <td>
                              <div className="thumb-wrap">
                                {post.thumbnail ? (
                                  <img src={post.thumbnail} alt="Video thumbnail" />
                                ) : (
                                  <div className="thumb-placeholder">—</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="caption-cell">
                                <span>{post.caption ? post.caption.slice(0, 120) : '—'}</span>
                                {post.url && (
                                  <a
                                    href={post.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="video-link"
                                  >
                                    View
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="num">{formatNumber(post.views)}</td>
                            <td className="num">{formatNumber(post.likes)}</td>
                            <td className="num">{formatNumber(post.comments)}</td>
                            <td className="num">{formatNumber(post.shares)}</td>
                            <td className="num">{formatNumber(post.saves)}</td>
                            <td className="num">{post.engagement.toFixed(2)}%</td>
                            <td className="num">{formatDate(post.createdAt)}</td>
                          </tr>
                          {expandedId === post.id && (
                            <tr className="expand-row">
                              <td colSpan={9}>
                                <div className="expand-content">
                                  <div>
                                    <strong>Full caption:</strong> {post.caption || '—'}
                                  </div>
                                  <div>
                                    <strong>Tags:</strong>{' '}
                                    {post.textExtra?.length
                                      ? post.textExtra
                                          .map((item) =>
                                            item.hashtagName
                                              ? `#${item.hashtagName}`
                                              : item.userId
                                              ? `@${item.userId}`
                                              : ''
                                          )
                                          .filter(Boolean)
                                          .join(' ')
                                      : '—'}
                                  </div>
                                  <div>
                                    <strong>Music:</strong> {post.music?.title || '—'} •{' '}
                                    {post.music?.authorName || post.music?.author || '—'}
                                  </div>
                                  {post.url && (
                                    <div>
                                      <strong>URL:</strong>{' '}
                                      <a href={post.url} target="_blank" rel="noreferrer">
                                        {post.url}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pagination">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={`page-${i + 1}`}
                    type="button"
                    className={page === i + 1 ? 'active' : ''}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
