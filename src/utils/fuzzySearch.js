/**
 * Lightweight fuzzy-search scoring utilities.
 *
 * No external dependency is used here — the search index is small (a few
 * dozen entries per role) so a hand-rolled scorer is fast enough to run on
 * every keystroke while giving us full control over ranking: exact matches
 * and prefixes are scored highest, then substrings, then a subsequence /
 * edit-distance based fuzzy match so typos ("aplicatoin") still surface
 * "Applications".
 */

export function normalize(str = '') {
  return str.toLowerCase().trim();
}

/** Classic Levenshtein edit distance (insert/delete/substitute = 1). */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prevRow = new Array(bl + 1);
  let curRow = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prevRow[j] = j;

  for (let i = 1; i <= al; i++) {
    curRow[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        curRow[j - 1] + 1,   // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    [prevRow, curRow] = [curRow, prevRow];
  }
  return prevRow[bl];
}

/**
 * Returns true if every character of `query` appears in `text` in order
 * (not necessarily contiguously) — a classic "fuzzy" subsequence match,
 * the same technique editors like VS Code/Sublime use for file pickers.
 */
function isSubsequence(query, text) {
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

/**
 * Scores a single searchable string against the query. Higher is better;
 * 0 means "no match at all".
 */
function scoreString(query, rawText) {
  if (!query || !rawText) return 0;
  const text = normalize(rawText);

  if (text === query) return 100;
  if (text.startsWith(query)) return 90;

  const words = text.split(/\s+/);
  if (words.some((w) => w.startsWith(query))) return 80;
  if (text.includes(query)) return 70;

  // Typo tolerance: compare the query against each word using edit
  // distance, scaled by word length so short words need fewer typos.
  let bestWordScore = 0;
  for (const w of words) {
    if (!w) continue;
    const dist = levenshtein(query, w);
    const tolerance = Math.max(1, Math.floor(w.length / 4)); // 1 typo per ~4 chars
    if (dist <= tolerance) {
      bestWordScore = Math.max(bestWordScore, 60 - dist * 8);
    }
  }
  if (bestWordScore > 0) return bestWordScore;

  // Last resort: ordered-subsequence fuzzy match (handles things like
  // "brwjbs" -> "browse jobs"). Scored lowest so exact/typo matches win.
  if (query.length >= 2 && isSubsequence(query, text)) return 30;

  return 0;
}

/**
 * Scores a search-index item against a query across its label,
 * description, category and keyword fields, weighting the label highest.
 * Returns 0 if nothing matches.
 */
export function scoreItem(item, rawQuery) {
  const query = normalize(rawQuery);
  if (!query) return 0;

  const labelScore = scoreString(query, item.label) * 1.5;
  const categoryScore = scoreString(query, item.category) * 1.1;
  const descScore = scoreString(query, item.description || '') * 0.8;
  const keywordScore = Math.max(
    0,
    ...(item.keywords || []).map((k) => scoreString(query, k))
  ) * 1.2;

  return Math.max(labelScore, categoryScore, descScore, keywordScore);
}

/**
 * Filters + ranks a list of search-index items against a query.
 * `limit` caps the number of results returned (default: no cap).
 */
export function fuzzySearchItems(items, query, limit = Infinity) {
  const q = normalize(query);
  if (!q) return [];

  return items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
