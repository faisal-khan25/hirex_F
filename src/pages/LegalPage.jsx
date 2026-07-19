import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import useSEO from '../hooks/useSeo';
import './LegalPage.css';

/**
 * LegalPage — shared shell for Privacy Policy / Terms & Conditions.
 *
 * Renders a hero header, a sticky in-page table of contents, the section
 * content, a "related policy" callout, and the shared site Footer — so both
 * legal pages share one professional, Naukri-style layout instead of
 * duplicating markup.
 *
 * Props:
 *   eyebrow      — small badge label above the title (e.g. "Legal")
 *   title        — page title (e.g. "Privacy Policy")
 *   lastUpdated  — human-readable date string
 *   intro        — one/two sentence summary shown under the title
 *   sections     — [{ id, heading, content }]
 *   relatedLink  — { to, label } — link to the companion legal page
 */
function LegalPage({ eyebrow = 'Legal', title, lastUpdated, intro, sections = [], relatedLink }) {
  useSEO({
    title,
    description: intro,
  });

  const [activeId, setActiveId] = useState(sections[0]?.id);

  const handleJump = useCallback((id) => (e) => {
    e.preventDefault();
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="lp-page">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="lp-hero">
        <div className="lp-hero-inner">
          <span className="lp-hero-badge">{eyebrow}</span>
          <h1>{title}</h1>
          {intro && <p className="lp-hero-intro">{intro}</p>}
          {lastUpdated && <p className="lp-hero-updated">Last updated: {lastUpdated}</p>}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="lp-body">
        <div className="lp-layout">

          {/* Table of contents */}
          <nav className="lp-toc" aria-label="Table of contents">
            <p className="lp-toc-title">On this page</p>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={handleJump(s.id)}
                    className={`lp-toc-link${activeId === s.id ? ' lp-toc-link--active' : ''}`}
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Section content */}
          <main className="lp-content">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="lp-section">
                <h2>{s.heading}</h2>
                <div className="lp-section-body">{s.content}</div>
              </section>
            ))}

            {relatedLink && (
              <div className="lp-related">
                <p>
                  Looking for something else? Read our{' '}
                  <Link to={relatedLink.to}>{relatedLink.label}</Link>.
                </p>
              </div>
            )}
          </main>

        </div>
      </div>

      <Footer />
    </div>
  );
}

export default LegalPage;
