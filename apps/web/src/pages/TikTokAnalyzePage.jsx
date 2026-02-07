import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TikTokAnalyzePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!url.trim()) {
      setError('Please enter a TikTok profile URL.');
      return;
    }
    setError('');
    setLoading(true);
    const trimmedUrl = url.trim();
    console.log('[tiktok] analyzing', trimmedUrl);
    try {
      const response = await fetch('/api/tiktok/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const contentType = response.headers.get('content-type');
      const rawText = await response.text();
      console.log('[tiktok] response status', response.status);
      console.log('[tiktok] response content-type', contentType);
      console.log('[tiktok] response body length', rawText.length);
      console.log('[tiktok] response body preview', rawText.slice(0, 1000));
      let payload;
      try {
        payload = JSON.parse(rawText);
      } catch (parseError) {
        console.error('[tiktok] response JSON parse failed', parseError);
        throw new Error('Invalid JSON response from server.');
      }
      console.log('[tiktok] payload ok', payload?.ok);
      console.log('[tiktok] payload keys', payload ? Object.keys(payload) : null);
      if (payload?.data) {
        console.log('[tiktok] payload.data keys', Object.keys(payload.data));
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to analyze profile.');
      }
      console.log('[tiktok] analysis complete');
      const serialized = JSON.stringify(payload.data);
      window.localStorage.setItem('tiktok_analysis_result', serialized);
      console.log('[tiktok] stored result length', serialized.length);
      navigate('/tiktok/results');
    } catch (err) {
      console.error('[tiktok] analysis failed', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-main not-found-main">
        <h1>TikTok Creator Analyzer</h1>
        <p>Paste a TikTok creator profile URL to fetch public data.</p>
        <form onSubmit={handleSubmit} className="analysis-form">
          <input
            className="input"
            placeholder="https://www.tiktok.com/@username"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
