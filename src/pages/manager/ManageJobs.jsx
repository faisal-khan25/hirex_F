import { useState, useMemo, useEffect, useRef } from 'react';
import { useFetch, useForm } from '../../hooks/useHooks';
import api, { getRecruiterApplicantStats } from '../../services/api';
import useSEO from '../../hooks/useSeo';
import './ManageJobs.css';

const EMPTY_JOB = {
  title:       '',
  description: '',
  skills:      '',
  salary:      '',
  location:    '',
  jobType:     'Full Time',
};

const timeAgo = (d) => {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 7)  return `${diff}d ago`;
  return `${Math.floor(diff / 7)}w ago`;
};

export default function ManageJobs() {
  useSEO({ title: 'Model Factory | SynthX Pro', description: 'Configure, test, and track system node listings.' });
  const { data, loading, refetch } = useFetch('/api/manager/jobs');
  const [jobs, setJobs] = useState([]);
  const deletedIds = useRef(new Set()); 

  useEffect(() => {
    if (data) {
      setJobs(data.filter(j => !deletedIds.current.has(j.id)));
    }
  }, [data]); 

  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [deleting,   setDeleting]   = useState(null); 
  const { form, setForm, onChange, reset } = useForm(EMPTY_JOB);
  const [recruiterStats, setRecruiterStats] = useState({ applied: 0, shortlisted: 0, hired: 0, rejected: 0 });

  useEffect(() => {
    if (!data || data.length === 0) return;
    getRecruiterApplicantStats().then(setRecruiterStats).catch(() => {});
  }, [data]);

  const activeCount = jobs.length;

  const filtered = useMemo(() =>
    search.trim()
      ? jobs.filter(j =>
          j.title?.toLowerCase().includes(search.toLowerCase()) ||
          j.location?.toLowerCase().includes(search.toLowerCase())
        )
      : jobs,
  [jobs, search]);

  const openNew = () => { reset(); setEditingId(null); setShowForm(true); setError(''); };

  const openEdit = (job) => {
    setForm({ ...job, skills: job.skills || '', description: job.description || '' });
    setEditingId(job.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this model configuration? This action cannot be reversed.')) return;
    setDeleting(id);
    deletedIds.current.add(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    try {
      await api.delete(`/api/manager/jobs/${id}`);
    } catch (err) {
      deletedIds.current.delete(id);
      setJobs(data?.filter(j => !deletedIds.current.has(j.id)) || []);
      alert(`Delete failed: ${err.response?.data?.error || 'Error occurred.'}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="fx-dashboard-frame">
      <div className="fx-inner-window">
        
        {/* TOP SYSTEM CONTROLS AND BAR */}
        <div className="fx-action-header">
          <div className="fx-title-area">
            <h1 className="fx-main-heading">Model Factory</h1>
            <span className="fx-heading-divider">|</span>
            <span className="fx-sub-heading">New Job Post</span>
            <span className="fx-badge-count">All ({activeCount})</span>
          </div>

          <div className="fx-control-group">
            <button className="fx-btn-primary" onClick={openNew}> New Job Post</button>
            <button className="fx-btn-secondary">Start/Stop Jobs</button>
            
            <div className="fx-search-wrapper">
              <input
                type="search"
                className="fx-input-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
              />
              <button className="fx-btn-search">Search</button>
            </div>
          </div>
        </div>

        {/* SYSTEM UTILITY FILTER BAR */}
        <div className="fx-filter-bar">
          <div className="fx-filter-left">
            <select aria-label="Select Model Family" className="fx-select">
              <option value="-1">Model Families</option>
              <option value="edit">Edit Selected</option>
              <option value="delete">Deprecate Selected</option>
            </select>
            <button className="fx-btn-utility">Apply</button>
            
            <select aria-label="Filter Epochs" className="fx-select">
              <option value="0">All epochs</option>
            </select>
            <button className="fx-btn-utility">Filter</button>
          </div>
          <div className="fx-filter-right">
            <span className="fx-item-counter">{filtered.length} items logged</span>
          </div>
        </div>

        {/* FACTORY DATA GRID MATRIX */}
        <div className="fx-grid-container">
          <table className="fx-data-table">
            <thead>
              <tr>
                <th scope="col" className="fx-col-cb"><input type="checkbox" className="fx-checkbox" /></th>
                <th scope="col">Model Title</th>
                <th scope="col">Location</th>
                <th scope="col">Model Type</th>
                <th scope="col">Training Resource</th>
                <th scope="col">Date Value</th>
                <th scope="col">Validation</th>
                <th scope="col" className="fx-text-right">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="fx-table-loader">Syncing architectural matrix streams...</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="fx-table-loader">Zero system records returned for specified parameters.</td>
                </tr>
              )}

              {!loading && filtered.map((job) => (
                <tr key={job.id} className="fx-data-row">
                  <td className="fx-col-cb">
                    <input type="checkbox" className="fx-checkbox" name="post[]" value={job.id} />
                  </td>
                  
                  <td className="fx-cell-interactive">
                    <strong className="fx-row-title-link" onClick={() => openEdit(job)}>
                      {job.title}
                    </strong>
                    
                    <div className="fx-row-action-links">
                      <button className="fx-action-link-btn" onClick={() => openEdit(job)}>Configure</button>
                      <span className="fx-action-link-sep">|</span>
                      <button 
                        className="fx-action-link-btn fx-danger" 
                        onClick={() => handleDelete(job.id)}
                        disabled={deleting === job.id}
                      >
                        {deleting === job.id ? 'Terminating...' : 'Deprecate'}
                      </button>
                    </div>
                  </td>

                  <td>{job.location || 'Global/Remote'}</td>
                  <td className="fx-text-muted">{job.jobType || 'Full Time'}</td>
                  <td className="fx-font-mono">{job.salary || '—'}</td>
                  <td>{job.createdAt ? timeAgo(job.createdAt) : '—'}</td>
                  <td className="fx-font-mono fx-weight-bold">{job.applicationCount || 0}</td>
                  <td className="fx-text-right">
                    <span className="fx-status-pill pill-active">Active</span>
                    <span className="fx-status-pill pill-new">New</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CONFIGURATION MODULE LAYER */}
      {showForm && (
        <div className="fx-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="fx-modal-window" onClick={e => e.stopPropagation()}>
            <div className="fx-modal-header">
              <h2 className="fx-modal-title">
                {editingId ? 'Modify Instance Configuration' : 'Provision Structural Parameters'}
              </h2>
              <button className="fx-modal-close-trigger" onClick={() => setShowForm(false)}>×</button>
            </div>

            {error && <div className="fx-system-error-msg">{error}</div>}

            <form className="fx-modal-form" onSubmit={(e) => { e.preventDefault(); setShowForm(false); refetch(); }}>
              <div className="fx-form-group">
                <label className="fx-form-label">Instance Identifier / Title *</label>
                <input name="title" className="fx-form-input" value={form.title} onChange={onChange} required />
              </div>

              <div className="fx-form-split-row">
                <div className="fx-form-group">
                  <label className="fx-form-label">Deployment Node Location</label>
                  <input name="location" className="fx-form-input" value={form.location} onChange={onChange} />
                </div>
                <div className="fx-form-group">
                  <label className="fx-form-label">Allocated Processing / Resource Allocation</label>
                  <input name="salary" className="fx-form-input" value={form.salary} onChange={onChange} />
                </div>
              </div>

              <div className="fx-form-split-row">
                <div className="fx-form-group">
                  <label className="fx-form-label">Execution Logic Mode</label>
                  <select name="jobType" className="fx-form-select" value={form.jobType} onChange={onChange}>
                    <option>Full Time</option>
                    <option>Part Time</option>
                    <option>Internship</option>
                    <option>Contract</option>
                  </select>
                </div>
                <div className="fx-form-group">
                  <label className="fx-form-label">Required Feature Sets (Comma Separated)</label>
                  <input name="skills" className="fx-form-input" value={form.skills} onChange={onChange} />
                </div>
              </div>

              <div className="fx-form-group">
                <label className="fx-form-label">Instance Operations Description</label>
                <textarea name="description" className="fx-form-textarea" value={form.description} onChange={onChange} rows={4} />
              </div>

              <div className="fx-modal-action-row">
                <button type="button" className="fx-modal-btn-cancel" onClick={() => setShowForm(false)}>Abort</button>
                <button type="submit" className="fx-modal-btn-submit">{editingId ? 'Write Schema Changes' : 'Initialize Matrix'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}