import { h } from './dom.js';
import { renderConcept, renderSign, renderEntry, fitSign } from './entry.js';

const root = document.getElementById('word-root');
const slug = decodeURIComponent(location.pathname.replace(/^\/word\//, '').replace(/\/$/, ''));

// The server embeds the word in the page. If it didn't (the bare template was
// served), look it up instead.
let data = null;
try {
  data = JSON.parse(document.getElementById('word-data').textContent);
} catch {}

if (!data) {
  try {
    const res = await fetch(`/api/word?slug=${encodeURIComponent(slug)}`);
    data = { word: res.ok ? await res.json() : null };
  } catch {
    data = { word: null };
  }
}

if (data.word) {
  const word = data.word;
  const sign = renderSign(word, { heading: 'h1' });
  root.replaceChildren(renderConcept(word.concept) || '', sign, renderEntry(word));
  fitSign(sign);
  document.title = `${word.word} | German Word Maker`;
} else {
  const sign = renderSign({ word: 'Unbekannt', pronunciation: 'Not in the dictionary' }, { variant: 'unknown', heading: 'h1' });
  root.replaceChildren(sign, h('div', { class: 'entry' },
    h('p', { class: 'definition' }, `There’s no word “${slug}” in the dictionary yet.`)
  ));
  fitSign(sign);
  document.title = 'Word not found | German Word Maker';
}
