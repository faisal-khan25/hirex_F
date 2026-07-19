import { Link, useLocation } from 'react-router-dom';
import './Footer.css';

const FOOTER_COLS = [
  {
    heading: 'Job Seekers',
    links: [
      { label: 'Browse Jobs', to: '/jobs' },
      { label: 'Create Account', to: '/register' },
      { label: 'Login', to: '/login' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact Us', to: '/contact' },
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms & Conditions', to: '/terms-and-conditions' },
    ],
  },
];

/**
 * Footer — compact, reusable site footer used on simple/legal pages.
 * (The homepage uses its own richer inline footer; this component keeps
 * the same visual language for pages like Terms & Conditions / Privacy Policy.)
 */
function Footer() {
  const location = useLocation();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <Link to="/" className="footer__logo">Hire<span>X</span></Link>
          <p className="footer__tagline">
            India's #1 job platform connecting talent with top companies across every industry.
          </p>
        </div>

        <div className="footer__columns">
          {FOOTER_COLS.map(({ heading, links }) => (
            <div key={heading}>
              <p className="footer__col-title">{heading}</p>
              <ul className="footer__list">
                {links.map(({ label, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className={`footer__link${location.pathname === to ? ' footer__link--active' : ''}`}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer__bottom">
          <p className="footer__copyright">
            © {new Date().getFullYear()} HireX Technologies Pvt. Ltd. All rights reserved.
          </p>
          <ul className="footer__bottom-links">
            <li><Link to="/privacy-policy" className="footer__bottom-link">Privacy Policy</Link></li>
            <li><Link to="/terms-and-conditions" className="footer__bottom-link">Terms &amp; Conditions</Link></li>
            <li><Link to="/contact" className="footer__bottom-link">Contact</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;