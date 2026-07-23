import { useState, useMemo, useEffect } from 'react';
import { useFetch, useDebouncedValue } from '../../hooks/useHooks';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import useSEO from '../../hooks/useSeo';
import './BrowseJobs.css';

const QUICK_FILTERS = [
  { label: 'Full Time',      type: 'jobType',      value: 'Full Time' },
  { label: 'Remote',         type: 'workMode',     value: 'Remote' },
  { label: 'Fresher',        type: 'experience',  value: 'Fresher' },
  { label: '0-1 Years',      type: 'experience',  value: '0-1 Years' },
  { label: '1-3 Years',      type: 'experience',  value: '1-3 Years' },
  { label: 'Work From Home', type: 'workMode',     value: 'Remote' },
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

const CompanyLogo = ({ name }) => {
  const initials = name ? name.slice(0, 2).toUpperCase() : '??';
  return <div className="bj-logo">{initials}</div>;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 7)  return `${diff}d ago`;
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

  const EMPLOYMENT_TYPE_MAP = {
    'full time': 'FULL_TIME', 'part time': 'PART_TIME', 'contract': 'CONTRACTOR',
    'internship': 'INTERN', 'temporary': 'TEMPORARY',
  };

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
    description: 'Browse live job openings across India on HireX. Filter by experience, job type, and work mode.',
    url: 'https://hirex.in/jobs',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': jobPostingsJsonLd ? [breadcrumbJsonLd, ...jobPostingsJsonLd] : [breadcrumbJsonLd],
    },
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, keyword: keywordInput, page: 0 }));
  };

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

        {/* ── SIDEBAR FILTERS ──────────────────────────────── */}
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

        {/* ── MAIN MANAGEMENT CONTENT ────────────────────────── */}
        <div className="bj-main">

          {/* Top Bar Layout */}
          <div className="bj-topbar">
            <div>
              <h1>Browse Jobs</h1>
              <p className="bj-count">
                {loading ? 'Loading operational data…' : `${totalElements} active entry listings matching criteria`}
              </p>
            </div>
            <div className="bj-sort">
              <label htmlFor="bj-sort-select">Sort parameters</label>
              <select id="bj-sort-select" value={filters.sortBy} onChange={handleSortChange}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Administrative Filters Toolbar Context */}
          <div className="bj-toolbar-card">
            <form className="bj-search-form" onSubmit={handleSearch}>
              <div className="bj-search-box">
                <span className="bj-search-icon">🔍</span>
                <input
                  className="bj-search-input"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  placeholder="Query global job specifications, titles or parameters..."
                />
                {activeFiltersPresent && (
                  <button type="button" className="bj-clear-x" onClick={clearAllFilters}>×</button>
                )}
                <button type="submit" className="bj-search-btn">Execute Search</button>
              </div>
            </form>

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
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="bj-loading">
              <div className="bj-spinner" />
              Syncing database records…
            </div>
          )}

          {/* Empty Records Panel */}
          {!loading && jobs.length === 0 && (
            <div className="bj-empty">
              <div className="bj-empty-icon">📁</div>
              <h3>No matching records found</h3>
              <p>Adjust current filters or key parameters to discover entries.</p>
            </div>
          )}

          {/* Data Tabular Layout Rows */}
          {!loading && jobs.length > 0 && (
            <>
              <div className="bj-table-container">
                {/* Table Header Fields */}
                <div className="bj-table-header">
                  <div className="bj-col-info">Job Particulars & Company</div>
                  <div className="bj-col-meta">Parameters & Location</div>
                  <div className="bj-col-skills">Primary Skill Framework</div>
                  <div className="bj-col-actions">Operational Actions</div>
                </div>

                {/* Table Body Content Rows */}
                <div className="bj-table-body">
                  {jobs.map((job, idx) => {
                    const skills  = getSkills(job.title);
                    const isNew   = idx < 3 && filters.page === 0;
                    return (
                      <div key={job.id} className="bj-table-row">
                        
                        {/* Column 1: Core Details */}
                        <div className="bj-col-info">
                          <CompanyLogo name={job.companyName} />
                          <div className="bj-info-text">
                            <div className="bj-title-wrapper">
                              <h3 className="bj-job-title">{job.title}</h3>
                              {isNew && <span className="bj-badge-new-dot">New</span>}
                            </div>
                            <p className="bj-company">{job.companyName}</p>
                            <span className="bj-posted-stamp">Logged: {timeAgo(job.postedAt)}</span>
                          </div>
                        </div>

                        {/* Column 2: Parameters Data */}
                        <div className="bj-col-meta">
                          <div className="bj-meta-cell">
                            <span className="bj-meta-lbl">Type</span>
                            <span className="bj-meta-val text-accent">{job.jobType || 'Full Time'}</span>
                          </div>
                          <div className="bj-meta-cell">
                            <span className="bj-meta-lbl">Mode</span>
                            <span className="bj-meta-val">{job.workMode || 'Global'}</span>
                          </div>
                          <div className="bj-meta-cell">
                            <span className="bj-meta-lbl">Loc</span>
                            <span className="bj-meta-val">{job.location || 'India'}</span>
                          </div>
                          <div className="bj-meta-cell">
                            <span className="bj-meta-lbl">Compensation</span>
                            <span className="bj-meta-val highlight">{job.salary || 'Undisclosed'}</span>
                          </div>
                        </div>

                        {/* Column 3: Skill Framework Badges */}
                        <div className="bj-col-skills">
                          {skills.map(s => <span key={s} className="bj-table-skill-tag">{s}</span>)}
                        </div>

                        {/* Column 4: Operational Layout Action Handlers */}
                        <div className="bj-col-actions">
                          <button className="bj-save-action-icon" title="Save Entry">🔖</button>
                          {user?.role === 'JOBSEEKER' ? (
                            <button
                              className="bj-action-apply-btn"
                              onClick={() => { setApplyModal(job); setApplyMsg(''); setCoverLetter(''); }}
                            >
                              Apply
                            </button>
                          ) : (
                            <span className="bj-action-disabled-status">View Only</span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* System Pagination Controls */}
              {totalPages > 1 && (
                <div className="bj-pagination">
                  <button
                    className="bj-page-btn"
                    onClick={() => goToPage(filters.page - 1)}
                    disabled={filters.page === 0}
                  >
                    ← Previous Page
                  </button>
                  <span className="bj-page-status">
                    Showing Index Page {filters.page + 1} of {totalPages} Pages
                  </span>
                  <button
                    className="bj-page-btn"
                    onClick={() => goToPage(filters.page + 1)}
                    disabled={!hasNext}
                  >
                    Next Page →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── APPLY PROMPT SYSTEM MODAL ────────────────────────── */}
      {applyModal && (
        <div className="bj-modal-overlay" onClick={() => setApplyModal(null)}>
          <div className="bj-modal" onClick={e => e.stopPropagation()}>
            <div className="bj-modal-head">
              <div className="bj-modal-logo">🏢</div>
              <div>
                <h2>Execute Application Action</h2>
                <p>{applyModal.title} — {applyModal.companyName}</p>
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
                  Attach Cover Letter Declaration <span>(Optional Argument)</span>
                </label>
                <textarea
                  rows={5}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Provide brief statement context for management review..."
                />
                <div className="bj-modal-actions">
                  <button className="bj-modal-cancel" onClick={() => setApplyModal(null)}>Abort</button>
                  <button className="bj-modal-submit" onClick={handleApply}>Dispatch Application</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}