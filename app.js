const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const errorBox = document.getElementById('errorBox');

const accountSection = document.getElementById('accountSection');
const totalsSection = document.getElementById('totalsSection');
const chartsSection = document.getElementById('chartsSection');
const videosSection = document.getElementById('videosSection');

const statusEl = document.getElementById('uploadStatus');

const searchInput = document.getElementById('searchInput');
const minViewsInput = document.getElementById('minViewsInput');
const minEngagementInput = document.getElementById('minEngagementInput');
const resetFilters = document.getElementById('resetFilters');
const downloadCsv = document.getElementById('downloadCsv');
const videosBody = document.getElementById('videosBody');
const pagination = document.getElementById('pagination');

const cardHandle = document.getElementById('cardHandle');
const cardFollowers = document.getElementById('cardFollowers');
const cardVideos = document.getElementById('cardVideos');
const cardLikes = document.getElementById('cardLikes');
const cardFollowing = document.getElementById('cardFollowing');

const totalViews = document.getElementById('totalViews');
const totalLikes = document.getElementById('totalLikes');
const totalComments = document.getElementById('totalComments');
const totalShares = document.getElementById('totalShares');
const totalSaves = document.getElementById('totalSaves');
const avgEngagement = document.getElementById('avgEngagement');
const avgViews = document.getElementById('avgViews');

const chartViews = document.getElementById('chartViews');
const chartEngagement = document.getElementById('chartEngagement');

let state = {
  raw: null,
  posts: [],
  sortKey: 'views',
  sortDir: 'desc',
  page: 1,
  perPage: 25,
};

const NUMBER_KEYS = ['playCount', 'diggCount', 'commentCount', 'shareCount', 'collectCount'];

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString();
}

function formatDate(ts) {
  if (!ts) return '—';
  const num = Number(ts);
  if (!Number.isFinite(num)) return '—';
  const date = new Date(num * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function cleanCaption(text) {
  return (text || '').trim();
}

function extractStats(item) {
  const stats = item.stats || item.statsV2 || {};
  const normalized = {};
  NUMBER_KEYS.forEach((key) => {
    normalized[key] = toNumber(stats[key]);
  });
  return normalized;
}

function engagementRate(stats) {
  const views = stats.playCount || 0;
  if (views === 0) return 0;
  const total = stats.diggCount + stats.commentCount + stats.shareCount + stats.collectCount;
  return (total / views) * 100;
}

function findPosts(obj, results = []) {
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
}

function findAccountInfo(obj) {
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
}

function updateStatus(fileName, count) {
  const now = new Date().toLocaleString();
  statusEl.querySelector('.status-line').textContent = fileName || 'No file loaded';
  statusEl.querySelector('.status-meta').textContent = `Videos: ${count ?? '—'} · Last parsed: ${count ? now : '—'}`;
}

function showError(message) {
  errorBox.hidden = !message;
  errorBox.textContent = message || '';
}

function normalizePosts(rawPosts) {
  return rawPosts.map((item, index) => {
    const stats = extractStats(item);
    return {
      id: item.id || item.aweme_id || item.item_id || index,
      caption: cleanCaption(item.desc || item.caption || ''),
      stats,
      engagement: engagementRate(stats),
      createdAt: item.createTime || item.create_time || item.timestamp,
      music: item.music || {},
      textExtra: item.textExtra || item.text_extra || [],
      raw: item,
    };
  });
}

function getAccountSummary(raw) {
  const accountNode = findAccountInfo(raw) || {};
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
}

function updateAccountCards(summary) {
  const handle = summary.handle === '—' ? '—' : `@${summary.handle}`;
  const display = summary.name && summary.name !== '—' ? ` • ${summary.name}` : '';
  cardHandle.textContent = `${handle}${display}`;
  cardFollowers.textContent = summary.followers ? formatNumber(summary.followers) : '—';
  cardVideos.textContent = summary.totalVideos ? formatNumber(summary.totalVideos) : '—';
  cardLikes.textContent = summary.totalLikes ? formatNumber(summary.totalLikes) : '—';
  cardFollowing.textContent = summary.following ? formatNumber(summary.following) : '—';
}

function computeTotals(posts) {
  const totals = posts.reduce(
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
  const avgER = posts.length ? totals.engagementSum / posts.length : 0;
  const avgViewsCount = posts.length ? totals.views / posts.length : 0;
  return { ...totals, avgER, avgViewsCount };
}

function updateTotals(totals) {
  totalViews.textContent = formatNumber(totals.views);
  totalLikes.textContent = formatNumber(totals.likes);
  totalComments.textContent = formatNumber(totals.comments);
  totalShares.textContent = formatNumber(totals.shares);
  totalSaves.textContent = formatNumber(totals.saves);
  avgEngagement.textContent = `${totals.avgER.toFixed(2)}%`;
  avgViews.textContent = formatNumber(Math.round(totals.avgViewsCount));
}

function renderCharts(posts) {
  const topViews = [...posts]
    .sort((a, b) => b.stats.playCount - a.stats.playCount)
    .slice(0, 10);
  const topEngagement = [...posts]
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);

  renderBarList(chartViews, topViews, (post) => post.stats.playCount, (v) => formatNumber(v));
  renderBarList(chartEngagement, topEngagement, (post) => post.engagement, (v) => `${v.toFixed(2)}%`);
}

function renderBarList(container, list, valueFn, labelFn) {
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<p class="muted">No data available.</p>';
    return;
  }
  const max = Math.max(...list.map(valueFn), 1);
  list.forEach((post, index) => {
    const value = valueFn(post);
    const bar = document.createElement('div');
    bar.className = 'bar';
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = `#${index + 1}`;
    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = `${(value / max) * 100}%`;
    track.appendChild(fill);
    const valueEl = document.createElement('div');
    valueEl.className = 'bar-value';
    valueEl.textContent = labelFn(value);
    bar.append(label, track, valueEl);
    container.appendChild(bar);
  });
}

function applyFilters(posts) {
  const search = (searchInput.value || '').toLowerCase();
  const minViews = toNumber(minViewsInput.value);
  const minER = toNumber(minEngagementInput.value);

  return posts.filter((post) => {
    if (search && !post.caption.toLowerCase().includes(search)) return false;
    if (post.stats.playCount < minViews) return false;
    if (post.engagement < minER) return false;
    return true;
  });
}

function sortPosts(posts) {
  const key = state.sortKey;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return [...posts].sort((a, b) => {
    if (key === 'caption') return a.caption.localeCompare(b.caption) * dir;
    if (key === 'date') return ((a.createdAt || 0) - (b.createdAt || 0)) * dir;
    return (a[key] - b[key]) * dir;
  });
}

function paginate(posts) {
  const start = (state.page - 1) * state.perPage;
  return posts.slice(start, start + state.perPage);
}

function renderTable(posts) {
  videosBody.innerHTML = '';
  posts.forEach((post) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${truncate(post.caption, 120)}</td>
      <td class="num">${formatNumber(post.stats.playCount)}</td>
      <td class="num">${formatNumber(post.stats.diggCount)}</td>
      <td class="num">${formatNumber(post.stats.commentCount)}</td>
      <td class="num">${formatNumber(post.stats.shareCount)}</td>
      <td class="num">${formatNumber(post.stats.collectCount)}</td>
      <td class="num">${post.engagement.toFixed(2)}%</td>
      <td class="num">${formatDate(post.createdAt)}</td>
    `;
    row.addEventListener('click', () => toggleDetails(row, post));
    videosBody.appendChild(row);
  });
}

function toggleDetails(row, post) {
  if (row.nextSibling && row.nextSibling.classList.contains('row-details')) {
    row.nextSibling.remove();
    return;
  }
  const details = document.createElement('tr');
  details.className = 'row-details';
  const hashtags = (post.textExtra || [])
    .filter((item) => item.hashtagName || item.userId)
    .map((item) => item.hashtagName ? `#${item.hashtagName}` : `@${item.userId}`);
  const musicTitle = post.music?.title || '—';
  const musicAuthor = post.music?.authorName || post.music?.author || '—';
  details.innerHTML = `
    <td colspan="8" class="row-details">
      <strong>Full caption:</strong> ${post.caption || '—'}<br/>
      <strong>Tags:</strong> ${hashtags.length ? hashtags.join(' ') : '—'}<br/>
      <strong>Music:</strong> ${musicTitle} • ${musicAuthor}
    </td>
  `;
  row.parentNode.insertBefore(details, row.nextSibling);
}

function renderPagination(total) {
  pagination.innerHTML = '';
  const pages = Math.ceil(total / state.perPage) || 1;
  for (let i = 1; i <= pages; i += 1) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === state.page) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.page = i;
      refreshTable();
    });
    pagination.appendChild(btn);
  }
}

function refreshTable() {
  const filtered = applyFilters(state.posts);
  const sorted = sortPosts(filtered);
  const paged = paginate(sorted);
  renderTable(paged);
  renderPagination(filtered.length);
}

function truncate(text, len) {
  if (!text) return '—';
  if (text.length <= len) return text;
  return `${text.slice(0, len)}…`;
}

function downloadCsvFile(rows) {
  const headers = ['Caption', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'EngagementRate', 'Date'];
  const lines = [headers.join(',')];
  rows.forEach((post) => {
    const line = [
      `"${post.caption.replace(/"/g, '""')}"`,
      post.stats.playCount,
      post.stats.diggCount,
      post.stats.commentCount,
      post.stats.shareCount,
      post.stats.collectCount,
      post.engagement.toFixed(2),
      formatDate(post.createdAt),
    ];
    lines.push(line.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tiktok-videos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseJson(fileText, fileName) {
  try {
    const raw = JSON.parse(fileText);
    const posts = normalizePosts(findPosts(raw));
    if (!posts.length) {
      showError('Couldn\'t find posts array; check file format.');
    } else {
      showError('');
    }
    state.raw = raw;
    state.posts = posts.map((post) => ({
      ...post,
      views: post.stats.playCount,
      likes: post.stats.diggCount,
      comments: post.stats.commentCount,
      shares: post.stats.shareCount,
      saves: post.stats.collectCount,
    }));
    state.page = 1;

    updateStatus(fileName, state.posts.length);
    accountSection.hidden = false;
    totalsSection.hidden = false;
    chartsSection.hidden = false;
    videosSection.hidden = false;

    const summary = getAccountSummary(raw);
    updateAccountCards(summary);

    const totals = computeTotals(state.posts);
    updateTotals(totals);

    renderCharts(state.posts);
    refreshTable();
  } catch (error) {
    showError('Invalid JSON. Please upload a valid TikTok JSON export.');
  }
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => parseJson(event.target.result, file.name);
  reader.readAsText(file);
}

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  handleFile(file);
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  handleFile(file);
});

resetFilters.addEventListener('click', () => {
  searchInput.value = '';
  minViewsInput.value = '';
  minEngagementInput.value = '';
  state.page = 1;
  refreshTable();
});

[searchInput, minViewsInput, minEngagementInput].forEach((input) => {
  input.addEventListener('input', () => {
    state.page = 1;
    refreshTable();
  });
});

downloadCsv.addEventListener('click', () => {
  const filtered = applyFilters(state.posts);
  const sorted = sortPosts(filtered);
  downloadCsvFile(sorted);
});

document.querySelectorAll('#videosTable th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = key === 'caption' ? 'asc' : 'desc';
    }
    refreshTable();
  });
});

updateStatus(null, null);
