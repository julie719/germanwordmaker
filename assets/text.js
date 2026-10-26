// DOM-free text helpers, shared by the browser and the server (and unit-tested).

const SOFT_HYPHEN = '­';

// Where a compound word can break between its parts, found by looking for the
// start of each part (verbs without their -en/-n ending) after the previous one.
// "Schutzfolienabziehfreude" + [Schutzfolie, abziehen, Freude] -> [12, 18]
export function compoundBreaks(word, parts = []) {
  const lower = word.toLowerCase();
  const breaks = [];
  let from = 0;
  for (const part of parts.slice(1)) {
    const german = String(part?.german || '').trim();
    const stem = german[0] === german[0]?.toLowerCase() ? german.replace(/e?n$/, '') : german;
    const probe = stem.toLowerCase().slice(0, 5);
    if (probe.length < 3) continue;
    const at = lower.indexOf(probe, from + 2);
    if (at > from + 1 && at < lower.length - 2) {
      breaks.push(at);
      from = at;
    }
  }
  return breaks;
}

export function hyphenate(word, parts) {
  let out = word;
  for (const at of compoundBreaks(word, parts).reverse()) {
    out = out.slice(0, at) + SOFT_HYPHEN + out.slice(at);
  }
  return out;
}

// "Der Satz. (The sentence.)" -> { german: 'Der Satz.', english: 'The sentence.' }
// The English is the last balanced (...) group at the end, which may itself
// contain parentheses.
export function splitExample(example = '') {
  const text = String(example).trim();
  if (!text.endsWith(')')) return { german: text, english: '' };
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === ')') depth++;
    else if (text[i] === '(' && --depth === 0) {
      const german = text.slice(0, i).trim();
      return german ? { german, english: text.slice(i + 1, -1).trim() } : { german: text, english: '' };
    }
  }
  return { german: text, english: '' };
}

export const wordPath = word => `/word/${encodeURIComponent(word)}`;

export function ratingLabel({ avg = 0, count = 0 } = {}) {
  if (!count) return 'No ratings yet';
  return `${avg.toFixed(1)} from ${count} ${count === 1 ? 'rating' : 'ratings'}`;
}
