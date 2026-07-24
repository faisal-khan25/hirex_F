/**
 * loadGoogleFont — non-blocking, de-duplicated Google Fonts loader.
 *
 * Why this exists:
 *   Login.css / Register.css used to pull in Plus Jakarta Sans via a CSS
 *   `@import url(...)`. A CSS @import is render-blocking: the browser must
 *   fetch and parse it (a full network round trip to fonts.googleapis.com,
 *   which itself points to more URLs on fonts.gstatic.com) before it can
 *   finish building the CSSOM for the importing stylesheet — which delays
 *   first paint of the whole page, not just the text using that font.
 *
 *   Injecting a real <link> tag from JS instead lets the browser fetch the
 *   font stylesheet in parallel with everything else, off the critical
 *   rendering path. `&display=swap` (kept from the original URL) means
 *   text still renders immediately in the fallback stack and swaps once
 *   the webfont arrives, so there's no invisible-text period either way —
 *   this change only removes the render-blocking hop, it doesn't alter
 *   what ends up on screen.
 *
 * Usage: call once at module scope in a lazy-loaded page (e.g. Login,
 * Register) so it only ever runs for visitors who actually hit that route.
 */
const loadedHrefs = new Set();

export default function loadGoogleFont(href) {
  if (typeof document === 'undefined' || loadedHrefs.has(href)) return;
  loadedHrefs.add(href);

  if (document.querySelector(`link[data-google-font="${href}"]`)) return;

  // Warm the connection to both Google Fonts origins in parallel with the
  // stylesheet request itself.
  ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].forEach((origin) => {
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = origin;
    if (origin.includes('gstatic')) preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);
  });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-google-font', href);
  document.head.appendChild(link);
}
