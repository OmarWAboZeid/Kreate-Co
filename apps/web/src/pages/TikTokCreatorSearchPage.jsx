import { useMemo, useState } from 'react';

const parseList = (value) =>
  value
    .split(/[\n,]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeHashtags = (value) =>
  parseList(value).map((item) => item.replace(/^#/, ''));

const formatNumber = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return value || '';
  return new Intl.NumberFormat().format(num);
};

export default function TikTokCreatorSearchPage() {
  const [searchInput, setSearchInput] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [proxyInput, setProxyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [admitting, setAdmitting] = useState({});

  const hasResults = results.length > 0;
  const queries = useMemo(() => parseList(searchInput), [searchInput]);
  const hashtags = useMemo(() => normalizeHashtags(hashtagInput), [hashtagInput]);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!queries.length && !hashtags.length) {
      setError('Enter at least one search term or hashtag.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/tiktok/creators/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries,
          hashtags,
          searchCount: 0,
          hashtagVideos: 0,
          maxCreators: 0,
          browser: 'webkit',
          headless: false,
          sleepAfter: 5,
          timeout: 60000,
          proxy: proxyInput.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to fetch creators.');
      }
      if (payload.meta) {
        console.log('[tiktok][creators] response meta', payload.meta);
      }
      setResults(payload.data || []);
      setMeta(payload.meta || null);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdmit = async (creator) => {
    const key = creator.profile_url || creator.username || '';
    if (!key) return;
    setAdmitting((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch('/api/tiktok/creators/admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to admit creator.');
      }
      setResults((prev) =>
        prev.filter((item) => (item.profile_url || item.username) !== key)
      );
    } catch (err) {
      setError(err.message || 'Failed to admit creator.');
    } finally {
      setAdmitting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSkip = (creator) => {
    const key = creator.profile_url || creator.username || '';
    if (!key) return;
    setResults((prev) => prev.filter((item) => (item.profile_url || item.username) !== key));
  };

  return (
    <div className="app-shell">
      <div className="app-main not-found-main tiktok-results">
        <h1>TikTok Creator Intake</h1>
        <p>Search with keywords, hashtags, or both. Approve creators to add them to the CSV.</p>

        <form onSubmit={handleSearch} className="analysis-form creator-search-form">
          <input
            className="input"
            placeholder="Search terms (comma separated)"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <input
            className="input"
            placeholder="Hashtags (comma separated, omit #)"
            value={hashtagInput}
            onChange={(event) => setHashtagInput(event.target.value)}
          />
          <input
            className="input"
            placeholder="Proxy (optional: http://user:pass@host:port)"
            value={proxyInput}
            onChange={(event) => setProxyInput(event.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {meta?.stderrPreview && (
          <details className="error-text">
            <summary>Search warnings (click to expand)</summary>
            <pre className="muted">{meta.stderrPreview}</pre>
          </details>
        )}

        <div className="results-header">
          <div>
            <h2>Results</h2>
            <p className="muted">
              {hasResults
                ? `${results.length} creators ready to review.`
                : 'No results yet.'}
              {meta && (
                <>
                  {' '}
                  <span>
                    Source: {meta.total} | Existing skipped: {meta.existingSkipped} | Duplicates:{' '}
                    {meta.duplicateSkipped}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {hasResults && (
          <div className="table-wrap">
            <table className="table creators-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Followers</th>
                  <th>Profile</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((creator) => {
                  const key = creator.profile_url || creator.username;
                  return (
                    <tr key={key}>
                      <td>{creator.name || '—'}</td>
                      <td>@{creator.username}</td>
                      <td className="num">{formatNumber(creator.followers_count)}</td>
                      <td>
                        <a href={creator.profile_url} target="_blank" rel="noreferrer">
                          View profile
                        </a>
                      </td>
                      <td>
                        <div className="creator-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={admitting[key]}
                            onClick={() => handleAdmit(creator)}
                          >
                            {admitting[key] ? 'Saving…' : 'Admit'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleSkip(creator)}
                          >
                            Skip
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
