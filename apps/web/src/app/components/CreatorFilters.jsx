import {
  GENDER_OPTIONS,
  INFLUENCER_ENGAGEMENT_RATES,
  INFLUENCER_FOLLOWER_RANGES,
  INFLUENCER_PLATFORMS,
  NICHES,
  UGC_AGE_OPTIONS,
  UGC_EXPERIENCE_LEVELS,
} from '../config/options.js';

export default function CreatorFilters({ type, filters, onChange, niches = NICHES }) {
  const updateFilter = (field) => (event) => {
    onChange({ ...filters, [field]: event.target.value });
  };

  if (type === 'ugc') {
    return (
      <div className="filters-bar filters-bar-wrap">
        <input
          className="input"
          placeholder="Search UGC creators"
          value={filters.search}
          onChange={updateFilter('search')}
        />
        <select className="input" value={filters.gender} onChange={updateFilter('gender')}>
          <option value="">All Genders</option>
          {GENDER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select className="input" value={filters.age} onChange={updateFilter('age')}>
          <option value="">All Ages</option>
          {UGC_AGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select className="input" value={filters.niche} onChange={updateFilter('niche')}>
          <option value="">All Niches</option>
          {niches.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={filters.experienceLevel}
          onChange={updateFilter('experienceLevel')}
        >
          <option value="">Experience Level</option>
          {UGC_EXPERIENCE_LEVELS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="filters-bar filters-bar-wrap">
      <input
        className="input"
        placeholder="Search influencers"
        value={filters.search}
        onChange={updateFilter('search')}
      />
      <select
        className="input"
        value={filters.followerCount}
        onChange={updateFilter('followerCount')}
      >
        <option value="">Follower Count</option>
        {INFLUENCER_FOLLOWER_RANGES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select className="input" value={filters.gender} onChange={updateFilter('gender')}>
        <option value="">All Genders</option>
        {GENDER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select className="input" value={filters.niche} onChange={updateFilter('niche')}>
        <option value="">All Niches</option>
        {niches.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select className="input" value={filters.platform} onChange={updateFilter('platform')}>
        <option value="">All Platforms</option>
        {INFLUENCER_PLATFORMS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className="input"
        value={filters.engagementRate}
        onChange={updateFilter('engagementRate')}
      >
        <option value="">Engagement Rate</option>
        {INFLUENCER_ENGAGEMENT_RATES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
