import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Clock, Zap, ArrowRight,
  Briefcase, Building2, UserSquare2, Users, ClipboardList,
  MessageSquare, Bell, Settings, Sparkles, FileText, Award,
  Radio, Cpu, BarChart3, UserCog, CircleUserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { deduplicatedGet } from '../../services/api';
import { getSearchIndex, getQuickActions, CATEGORY_ICON } from '../../data/searchIndex';
import { fuzzySearchItems } from '../../utils/fuzzySearch';
import './GlobalSearch.css';

const ICONS = {
  Briefcase, Building2, UserSquare2, Users, ClipboardList,
  MessageSquare, Bell, Settings, Sparkles, FileText, Award,
  Radio, Cpu, BarChart3, UserCog, CircleUserRound,
};

function CategoryIcon({ category, size = 16 }) {
  const Icon = ICONS[CATEGORY_ICON[category]] || Search;
  return <Icon size={size} aria-hidden="true" />;
}

const RECENT_LIMIT = 5;
const recentKey = (role) => `hirex_recent_searches_${role || 'guest'}`;

function loadRecent(role) {
  try {
    const raw = window.localStorage.getItem(recentKey(role));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(role, item) {
  try {
    const existing = loadRecent(role).filter((r) => r.id !== item.id);
    const next = [{ id: item.id, label: item.label, category: item.category, path: item.path }, ...existing].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(recentKey(role), JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

// Dynamic, role-specific "live" providers: these augment the static index
// with real records from the backend so search results aren't limited to
// page names. Kept intentionally small/defensive — any network failure is
// swallowed so the static index results still render.
async function fetchDynamicResults(role, query) {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    if (role === 'JOBSEEKER') {
      const { data } = await deduplicatedGet(`/api/jobs/browse?keyword=${encodeURIComponent(q)}&size=5`);
      const jobs = data?.content ?? [];
      return jobs.map((job) => ({
        id: `dyn-job-${job.id}`,
        label: job.title,
        category: 'Jobs',
        path: '/jobseeker/browse',
        description: [job.companyName, job.location].filter(Boolean).join(' · ') || 'Open role',
        keywords: [],
        isDynamic: true,
      }));
    }

    if (role === 'MANAGER') {
      const { data } = await deduplicatedGet('/api/manager/jobs');
      const jobs = Array.isArray(data) ? data : [];
      const ql = q.toLowerCase();
      return jobs
        .filter((job) => job.title?.toLowerCase().includes(ql))
        .slice(0, 5)
        .map((job) => ({
          id: `dyn-job-${job.id}`,
          label: job.title,
          category: 'Jobs',
          path: '/manager/jobs',
          description: job.location || 'Your job posting',
          keywords: [],
          isDynamic: true,
        }));
    }
  } catch {
    // Silent — dynamic augmentation is best-effort only.
  }
  return [];
}

export default function GlobalSearch({ variant = 'desktop' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dynamicResults, setDynamicResults] = useState([]);
  const [recent, setRecent] = useState(() => loadRecent(user?.role));

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const staticIndex = useMemo(() => getSearchIndex(user?.role), [user?.role]);
  const quickActions = useMemo(() => getQuickActions(user?.role), [user?.role]);

  // ── Debounced dynamic fetch ──────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) {
      setDynamicResults([]);
      return;
    }
    const myRequestId = ++requestIdRef.current;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchDynamicResults(user?.role, query);
      if (requestIdRef.current === myRequestId) setDynamicResults(results);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, user?.role]);

  const staticResults = useMemo(
    () => fuzzySearchItems(staticIndex, query, 20),
    [staticIndex, query]
  );

  // Merge: dynamic (real records) first within their category, then static
  // page-level matches, de-duped by id.
  const results = useMemo(() => {
    const seen = new Set();
    const merged = [...dynamicResults, ...staticResults].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    return merged;
  }, [dynamicResults, staticResults]);

  // Group by category, preserving first-seen category order for stable UI.
  const grouped = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const item of results) {
      if (!map.has(item.category)) {
        map.set(item.category, []);
        order.push(item.category);
      }
      map.get(item.category).push(item);
    }
    return order.map((category) => ({ category, items: map.get(category) }));
  }, [results]);

  const flatList = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const showEmptyState = query.trim().length === 0;

  // ── Body scroll lock only for the mobile full-screen overlay ─────
  // On desktop the panel is a small anchored dropdown, so locking the
  // whole page's scroll for that would feel broken; on narrow viewports
  // it becomes a full-screen takeover, where the lock matches user intent.
  useEffect(() => {
    if (!open) return;
    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobileViewport) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ── Close on outside click / Escape ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Global Cmd/Ctrl+K shortcut ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setActiveIndex(-1); }, [query, open]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }, []);

  const goTo = useCallback((item) => {
    if (item.path === '__logout__') {
      logout();
      navigate('/login');
      closeSearch();
      return;
    }
    setRecent(saveRecent(user?.role, item));
    navigate(item.path);
    closeSearch();
  }, [logout, navigate, user?.role, closeSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const pool = showEmptyState ? [...recent, ...quickActions] : flatList;
      if (pool.length) setActiveIndex((i) => (i + 1) % pool.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const pool = showEmptyState ? [...recent, ...quickActions] : flatList;
      if (pool.length) setActiveIndex((i) => (i - 1 + pool.length) % pool.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pool = showEmptyState ? [...recent, ...quickActions] : flatList;
      const chosen = pool[activeIndex] ?? pool[0];
      if (chosen) goTo(chosen);
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  }, [showEmptyState, recent, quickActions, flatList, activeIndex, goTo, closeSearch]);

  const activeDescendantId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  let runningIndex = -1;
  const renderItem = (item, extraProps = {}) => {
    runningIndex += 1;
    const idx = runningIndex;
    const isActive = idx === activeIndex;
    return (
      <li key={item.id} role="presentation">
        <button
          type="button"
          id={`${listboxId}-opt-${idx}`}
          role="option"
          aria-selected={isActive}
          className={`gsearch__result${isActive ? ' gsearch__result--active' : ''}`}
          onMouseEnter={() => setActiveIndex(idx)}
          onClick={() => goTo(item)}
          {...extraProps}
        >
          <span className="gsearch__result-icon"><CategoryIcon category={item.category} /></span>
          <span className="gsearch__result-text">
            <span className="gsearch__result-label">{item.label}</span>
            {item.description && <span className="gsearch__result-desc">{item.description}</span>}
          </span>
          <span className="gsearch__result-category">{item.category}</span>
        </button>
      </li>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`gsearch gsearch--${variant}${open ? ' gsearch--open' : ''}`}
    >
      <div className="gsearch__input-wrap">
        <Search size={18} className="gsearch__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          aria-autocomplete="list"
          aria-label="Search HireX"
          className="gsearch__input"
          placeholder={`Search ${user?.role === 'ADMIN' ? 'users, companies, jobs…' : user?.role === 'MANAGER' ? 'candidates, jobs, ATS results…' : 'jobs, applications, messages…'}`}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <kbd className="gsearch__kbd" aria-hidden="true">Ctrl K</kbd>
        {open && (
          <button
            type="button"
            className="gsearch__close"
            aria-label="Close search"
            onClick={closeSearch}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {open && (
        <div className="gsearch__panel" role="presentation">
          <ul className="gsearch__list" id={listboxId} role="listbox" aria-label="Search results">
            {showEmptyState ? (
              <>
                {recent.length > 0 && (
                  <li className="gsearch__group" role="presentation">
                    <div className="gsearch__group-label"><Clock size={13} aria-hidden="true" /> Recent</div>
                    <ul className="gsearch__group-list" role="presentation">
                      {recent.map((item) => renderItem(item))}
                    </ul>
                  </li>
                )}
                {quickActions.length > 0 && (
                  <li className="gsearch__group" role="presentation">
                    <div className="gsearch__group-label"><Zap size={13} aria-hidden="true" /> Quick actions</div>
                    <ul className="gsearch__group-list" role="presentation">
                      {quickActions.map((item) => renderItem(item))}
                    </ul>
                  </li>
                )}
                {recent.length === 0 && quickActions.length === 0 && (
                  <li className="gsearch__empty">Start typing to search HireX</li>
                )}
              </>
            ) : flatList.length > 0 ? (
              grouped.map(({ category, items }) => (
                <li className="gsearch__group" key={category} role="presentation">
                  <div className="gsearch__group-label"><CategoryIcon category={category} size={13} /> {category}</div>
                  <ul className="gsearch__group-list" role="presentation">
                    {items.map((item) => renderItem(item))}
                  </ul>
                </li>
              ))
            ) : (
              <li className="gsearch__empty">
                No results for "<strong>{query}</strong>". Try a different term.
              </li>
            )}
          </ul>

          {!showEmptyState && flatList.length > 0 && (
            <div className="gsearch__hint">
              <span><ArrowRight size={12} aria-hidden="true" /> Enter to open</span>
              <span>↑ ↓ to navigate</span>
              <span>Esc to close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
