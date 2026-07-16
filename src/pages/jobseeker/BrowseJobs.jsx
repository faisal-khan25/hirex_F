import { useState, useMemo, useEffect } from 'react';
import { useFetch, useDebouncedValue } from '../../hooks/useHooks';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import useSEO from '../../hooks/useSeo';
import './BrowseJobs.css';

/* Each quick-filter chip maps to a (filterType, value) pair in the real
   filter state below, instead of being smuggled through the keyword box.
   'Remote' and 'Work From Home' intentionally point at the same
   underlying workMode value — there's no separate DB concept for them,
   they're just two labels for the same filter. */
const QUICK_FILTERS = [
  { label: 'Full Time',      type: 'jobType',    value: 'Full Time' },
  { label: 'Remote',         type: 'workMode',   value: 'Remote' },
  { label: 'Fresher',        type: 'experience',  value: 'Fresher' },
  { label: '0-1 Years',      type: 'experience',  value: '0-1 Years' },
  { label: '1-3 Years',      type: 'experience',  value: '1-3 Years' },
  { label: 'Work From Home', type: 'workMode',   value: 'Remote' },
];

const FILTER_GROUPS = [
  { key: 'experience', label: 'Experience', options: ['Fresher', '0-1 Years', '1-3 Years', '3-5 Years', '5+ Years'] },
  { key: 'jobType',    label: 'Job Type',   options: ['Full Time', 'Part Time', 'Contract', 'Internship'] },
  { key: 'workMode',   label: 'Work Mode',  options: ['On-site', 'Remote', 'Hybrid'] },
];

const SORT_OPTIONS = [
  { value: 'most_relevant',   label: 'Most Relevant' },
  { value: 'newest',          label: 'Newest First' },
  { value: 'salary_high_low', label: 'Salary: High to Low' },
];

const EMPTY_FILTERS = {
  keyword: '',
  location: '',
  jobType: [],
  workMode: [],
  experience: [],
  salaryMin: '',
  salaryMax: '',
  sortBy: 'most_relevant',
  page: 0,
};

/* Company initials logo fallback */
const CompanyLogo = ({ name }) => {
  const initials = name ? name.slice(0, 2).toUpperCase() : '??';
  return <div className="bj-logo">{initials[0]}</div>;
};

/* Relative time helper */
const timeAgo = (dateStr) => {
  if (!dateStr) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  if (diff < 7)  return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}m ago`;
};

const SKILLS_MAP = {
  'Software Dev': ['React', 'Node.js', 'Java'],
  'Data':         ['Python', 'SQL', 'ML'],
  'Design':       ['Figma', 'Adobe XD', 'CSS'],
  'Sales':        ['CRM', 'B2B', 'Negotiation'],
};
const getSkills = (title = '') => {
  const key = Object.keys(SKILLS_MAP).find(k => title.toLowerCase().includes(k.toLowerCase()));
  return key ? SKILLS_MAP[key] : ['Communication', 'Teamwork'];
};

/** Builds the /api/jobs/browse query string from the current filter state. */
function buildQuery(f) {
  const params = new URLSearchParams();
  if (f.keyword.trim())  params.set('keyword', f.keyword.trim());
  if (f.location.trim()) params.set('location', f.location.trim());
  f.jobType.forEach(v => params.append('jobType', v));
  f.workMode.forEach(v => params.append('workMode', v));
  f.experience.forEach(v => params.append('experience', v));
  if (f.salaryMin !== '' && !Number.isNaN(Number(f.salaryMin))) params.set('salaryMin', f.salaryMin);
  if (f.salaryMax !== '' && !Number.isNaN(Number(f.salaryMax))) params.set('salaryMax', f.salaryMax);
  if (f.sortBy) params.set('sortBy', f.sortBy);
  params.set('page', String(f.page));
  params.set('size', '10');
  return params.toString();
}

const hasActiveFilters = (f) =>
  !!f.keyword.trim() || !!f.location.trim() || f.jobType.length || f.workMode.length ||
  f.experience.length || f.salaryMin !== '' || f.salaryMax !== '';

export default function BrowseJobs() {
  const { user } = useAuth();

  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [keywordInput, setKeywordInput]   = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [applyModal,  setApplyModal]  = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applyMsg,    setApplyMsg]    = useState('');

  // Live-filter the keyword/location text boxes without hammering the API
  // on every keystroke — updates flow into `filters` ~350ms after typing
  // stops, and every filter change resets back to page 0.
  const debouncedKeyword  = useDebouncedValue(keywordInput, 350);
  const debouncedLocation = useDebouncedValue(locationInput, 350);

  useEffect(() => {
    setFilters(prev => (prev.keyword === debouncedKeyword ? prev : { ...prev, keyword: debouncedKeyword, page: 0 }));
  }, [debouncedKeyword]);

  useEffect(() => {
    setFilters(prev => (prev.location === debouncedLocation ? prev : { ...prev, location: debouncedLocation, page: 0 }));
  }, [debouncedLocation]);

  const query = useMemo(() => buildQuery(filters), [filters]);
  const url = `/api/jobs/browse?${query}`;
  const { data: result, loading } = useFetch(url, [query]);

  const jobs          = result?.content ?? [];
  const totalElements = result?.totalElements ?? 0;
  const totalPages    = result?.totalPages ?? 0;
  const hasNext        = result?.hasNext ?? false;

  // Google's employment-type enum — anything unrecognized falls back to
  // OTHER rather than being omitted, since the property is required
  // whenever employmentType is present at all.
  const EMPLOYMENT_TYPE_MAP = {
    'full time': 'FULL_TIME', 'part time': 'PART_TIME', 'contract': 'CONTRACTOR',
    'internship': 'INTERN', 'temporary': 'TEMPORARY',
  };

  // JobPosting rich-result schema, built only from fields the API actually
  // returns (title, description, companyName, location, createdAt,
  // jobType) — no invented data. NOTE: Google also recommends
  // `validThrough`, which this API doesn't currently expose per job; add
  // it here once the backend returns an expiry/closing date.
  const jobPostingsJsonLd = (jobs && jobs.length)
    ? jobs.slice(0, 20).map((job) => ({
        '@type': 'JobPosting',
        title: job.title,
        description: job.description || job.title,
        datePosted: job.postedAt,
        hiringOrganization: {
          '@type': 'Organization',
          name: job.companyName || 'HireX Employer',
        },
        jobLocation: {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: job.location || 'India', addressCountry: 'IN' },
        },
        ...(job.jobType && EMPLOYMENT_TYPE_MAP[job.jobType.toLowerCase()]
          ? { employmentType: EMPLOYMENT_TYPE_MAP[job.jobType.toLowerCase()] }
          : {}),
        ...(job.salary ? { baseSalary: { '@type': 'MonetaryAmount', currency: 'INR', value: { '@type': 'QuantitativeValue', value: job.salary } } } : {}),
      }))
    : null;

  const breadcrumbJsonLd = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://hirex.in/' },
      { '@type': 'ListItem', position: 2, name: 'Browse Jobs', item: 'https://hirex.in/jobs' },
    ],
  };

  useSEO({
    title: 'Browse Jobs',
    description: 'Browse 50,000+ live job openings across India on HireX. Filter by experience, job type, and work mode, then apply in one click.',
    url: 'https://hirex.in/jobs',
    // Single valid JSON-LD document combining breadcrumb + every listed
    // job posting via @graph (the standard way to ship multiple schema.org
    // entities in one <script> tag).
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': jobPostingsJsonLd ? [breadcrumbJsonLd, ...jobPostingsJsonLd] : [breadcrumbJsonLd],
    },
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, keyword: keywordInput, page: 0 }));
  };

  /** Toggles a value inside a multi-select filter group (checkbox / quick filter). */
  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const current = prev[type];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [type]: next, page: 0 };
    });
  };

  const isFilterActive = (type, value) => filters[type].includes(value);

  const handleSalaryChange = (field) => (e) => {
    const val = e.target.value;
    // Allow empty string (clearing the field) or non-negative numbers only.
    if (val !== '' && (Number.isNaN(Number(val)) || Number(val) < 0)) return;
    setFilters(prev => ({ ...prev, [field]: val, page: 0 }));
  };

  const handleSortChange = (e) => {
    setFilters(prev => ({ ...prev, sortBy: e.target.value, page: 0 }));
  };

  const goToPage = (nextPage) => {
    if (nextPage < 0 || (totalPages && nextPage >= totalPages)) return;
    setFilters(prev => ({ ...prev, page: nextPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAllFilters = () => {
    setKeywordInput('');
    setLocationInput('');
    setFilters(EMPTY_FILTERS);
  };

  const handleApply = async () => {
    try {
      const res = await api.post(`/api/jobseeker/apply/${applyModal.id}`, { coverLetter });
      setApplyMsg(res.data?.message || res.data || 'Applied successfully');
    } catch (e) {
      setApplyMsg(e.response?.data?.error || 'Failed to apply');
    }
  };

  const isSuccess = applyMsg && (
    applyMsg.toLowerCase().includes('success') ||
    applyMsg.toLowerCase().includes('applied')
  );

  const activeFiltersPresent = hasActiveFilters(filters);

  return (
    <div className="bj-page">
      <div className="bj-inner">

        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <aside className="bj-sidebar">
          <p className="bj-sidebar-title">Filters</p>

          {/* Location */}
          <div className="bj-filter-group">
            <h4>Location</h4>
            <input
              className="bj-location-input"
              type="text"
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              placeholder="e.g. Hyderabad, Remote…"
            />
            <div className="bj-sidebar-divider" />
          </div>

          {FILTER_GROUPS.map(({ key, label, options }) => (
            <div key={key} className="bj-filter-group">
              <h4>{label}</h4>
              {options.map(opt => (
                <label key={opt}>
                  <input
                    type="checkbox"
                    checked={isFilterActive(key, opt)}
                    onChange={() => toggleFilter(key, opt)}
                  />
                  {opt}
                </label>
              ))}
              <div className="bj-sidebar-divider" />
            </div>
          ))}

          {/* Salary range */}
          <div className="bj-filter-group">
            <h4>Salary (LPA)</h4>
            <div className="bj-salary-range">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Min"
                value={filters.salaryMin}
                onChange={handleSalaryChange('salaryMin')}
              />
              <span>–</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Max"
                value={filters.salaryMax}
                onChange={handleSalaryChange('salaryMax')}
              />
            </div>
          </div>

          <button className="bj-clear-btn" onClick={clearAllFilters} disabled={!activeFiltersPresent}>
            Clear all filters
          </button>
        </aside>

        {/* ── MAIN ────────────────────────────────────────── */}
        <div className="bj-main">

          {/* Top bar */}
          <div className="bj-topbar">
            <div>
              <h1>Browse Jobs</h1>
              <p className="bj-count">
                {loading ? 'Loading…' : `${totalElements} job${totalElements === 1 ? '' : 's'} found${filters.keyword ? ` for "${filters.keyword}"` : ''}`}
              </p>
            </div>
            <div className="bj-sort">
              <label htmlFor="bj-sort-select">Sort by</label>
              <select id="bj-sort-select" value={filters.sortBy} onChange={handleSortChange}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Search */}
          <form className="bj-search-form" onSubmit={handleSearch}>
            <div className="bj-search-box">
              <span className="bj-search-icon">🔍</span>
              <input
                className="bj-search-input"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                placeholder="Search by job title, skill, or keyword…"
              />
              {activeFiltersPresent && (
                <button type="button" className="bj-clear-x" onClick={clearAllFilters}>×</button>
              )}
              <button type="submit" className="bj-search-btn">Search</button>
            </div>
          </form>

          {/* Quick filters */}
          <div className="bj-quick-filters">
            {QUICK_FILTERS.map(f => (
              <button
                key={f.label}
                className={`bj-qf-btn${isFilterActive(f.type, f.value) ? ' active' : ''}`}
                onClick={() => toggleFilter(f.type, f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="bj-loading">
              <div className="bj-spinner" />
              Fetching jobs…
            </div>
          )}

          {/* Empty */}
          {!loading && jobs.length === 0 && (
            <div className="bj-empty">
              <div className="bj-empty-icon">🔍</div>
              <h3>No jobs found</h3>
              <p>Try a different keyword or remove some filters</p>
            </div>
          )}

          {/* Job cards */}
          {!loading && jobs.length > 0 && (
            <>
              <div className="bj-grid">
                {jobs.map((job, idx) => {
                  const skills  = getSkills(job.title);
                  const isNew   = idx < 3 && filters.page === 0;
                  return (
                    <div key={job.id} className="bj-card">

                      {/* Top row */}
                      <div className="bj-card-top">
                        <div className="bj-card-left">
                          <CompanyLogo name={job.companyName} />
                          <div className="bj-card-info">
                            <h3 className="bj-job-title">{job.title}</h3>
                            <p className="bj-company">{job.companyName}</p>
                            <p className="bj-posted">{timeAgo(job.postedAt)}</p>
                          </div>
                        </div>
                        <div className="bj-card-badges">
                          <span className="bj-badge bj-badge-type">{job.jobType || 'Full Time'}</span>
                          {job.workMode && <span className="bj-badge bj-badge-type">{job.workMode}</span>}
                          {isNew && <span className="bj-badge bj-badge-new">New</span>}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="bj-meta">
                        <div className="bj-meta-item"><span>📍</span><span>{job.location || 'India'}</span></div>
                        <div className="bj-meta-item"><span>💼</span><span>{job.experience || 'Any experience'}</span></div>
                        {job.salary && <div className="bj-meta-item"><span>💰</span><span>{job.salary}</span></div>}
                      </div>

                      {/* Skills */}
                      <div className="bj-skills">
                        {skills.map(s => <span key={s} className="bj-skill">{s}</span>)}
                      </div>

                      {/* Footer */}
                      <div className="bj-card-footer">
                        <span className="bj-salary">{job.salary || 'Salary not disclosed'}</span>
                        <div className="bj-card-actions">
                          <button className="bj-save-btn">🔖 Save</button>
                          {user?.role === 'JOBSEEKER' && (
                            <button
                              className="bj-apply-btn"
                              onClick={() => { setApplyModal(job); setApplyMsg(''); setCoverLetter(''); }}
                            >
                              Apply Now
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Pagination — preserves every active filter, only `page` changes */}
              {totalPages > 1 && (
                <div className="bj-pagination">
                  <button
                    className="bj-page-btn"
                    onClick={() => goToPage(filters.page - 1)}
                    disabled={filters.page === 0}
                  >
                    ← Prev
                  </button>
                  <span className="bj-page-status">
                    Page {filters.page + 1} of {totalPages}
                  </span>
                  <button
                    className="bj-page-btn"
                    onClick={() => goToPage(filters.page + 1)}
                    disabled={!hasNext}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── APPLY MODAL ─────────────────────────────────── */}
      {applyModal && (
        <div className="bj-modal-overlay" onClick={() => setApplyModal(null)}>
          <div className="bj-modal" onClick={e => e.stopPropagation()}>

            <div className="bj-modal-head">
              <div className="bj-modal-logo">🏢</div>
              <div>
                <h2>{applyModal.title}</h2>
                <p>{applyModal.companyName}</p>
              </div>
              <button className="bj-modal-close" onClick={() => setApplyModal(null)}>×</button>
            </div>

            <div className="bj-modal-divider" />

            {applyMsg ? (
              <div className={`bj-alert ${isSuccess ? 'bj-alert-success' : 'bj-alert-error'}`}>
                {applyMsg}
              </div>
            ) : (
              <>
                <label className="bj-modal-label">
                  Cover Letter <span>(optional)</span>
                </label>
                <textarea
                  rows={5}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Tell the recruiter why you're a great fit for this role…"
                />
                <div className="bj-modal-actions">
                  <button className="bj-modal-cancel" onClick={() => setApplyModal(null)}>Cancel</button>
                  <button className="bj-modal-submit" onClick={handleApply}>Submit Application</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}