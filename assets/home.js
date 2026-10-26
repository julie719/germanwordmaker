import { h, reducedMotion } from './dom.js';
import { renderConcept, renderSign, renderEntry, observeSign, fitSign, reveal, audioButton, stars } from './entry.js';
import { hyphenate, wordPath } from './text.js';

const PAGE_SIZE = 24;

const form = document.getElementById('composer');
const field = document.getElementById('concept');
const count = document.getElementById('concept-count');
const makeButton = document.getElementById('make');
const formError = document.getElementById('form-error');
const result = document.getElementById('result');
const announcer = document.getElementById('announcer');

/* ---------- Composer ---------- */

const MAX = Number(field.maxLength);
let busy = false;

function syncComposer() {
  // Fallback for browsers without field-sizing: content.
  if (!CSS.supports('field-sizing', 'content')) {
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }
  const length = field.value.length;
  count.textContent = `${length}/${MAX}`;
  count.classList.toggle('is-visible', length > MAX * 0.8);
  count.classList.toggle('is-full', length >= MAX);
  makeButton.disabled = busy || !field.value.trim();
}

field.addEventListener('input', syncComposer);
field.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});
form.addEventListener('submit', e => {
  e.preventDefault();
  generate();
});

async function generate() {
  const concept = field.value.trim();
  if (!concept || busy) return;

  busy = true;
  syncComposer();
  makeButton.querySelector('.btn-label').textContent = 'Making…';
  formError.textContent = '';
  const currentSign = result.querySelector('.sign');
  const currentEntry = result.querySelector('.entry');
  currentSign?.setAttribute('data-loading', '');
  currentEntry?.classList.add('is-dimmed');

  // Show what this word is for straight away, while it's being made.
  const currentConcept = result.querySelector('.concept');
  const pendingConcept = renderConcept(concept);
  pendingConcept.classList.add('is-entering');
  if (currentConcept) currentConcept.replaceWith(pendingConcept);
  else result.prepend(pendingConcept);

  try {
    let res;
    try {
      res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept })
      });
    } catch {
      throw new Error('Couldn’t reach the server. Check your connection and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.word) throw new Error(data.error || 'Something went wrong making that word. Try again.');
    showWord(data);
  } catch (err) {
    currentSign?.removeAttribute('data-loading');
    currentEntry?.classList.remove('is-dimmed');
    if (currentConcept) pendingConcept.replaceWith(currentConcept);
    else pendingConcept.remove();
    formError.textContent = err.message;
  } finally {
    busy = false;
    makeButton.querySelector('.btn-label').textContent = 'Make a word';
    syncComposer();
  }
}

function showWord(word) {
  const sign = renderSign(word, { variant: word.isRefusal ? 'refusal' : 'word' });
  const entry = renderEntry(word, {
    note: word.isRefusal ? 'Not saved to the dictionary.' : null,
    extra: word.isRefusal ? null : h('p', { class: 'entry-cta' },
      'Want words like this on your screens automatically? ',
      h('a', { href: 'https://frameweave.com', target: '_blank', rel: 'noopener' }, 'That’s Frame Weave.')
    )
  });
  // Keep the concept line shown while generating; swap in the word beneath it.
  const caption = result.querySelector('.concept');
  if (caption?.querySelector('q')?.textContent !== word.concept) {
    caption?.remove();
    if (word.concept) result.prepend(renderConcept(word.concept));
  }
  result.querySelectorAll('.sign, .entry').forEach(el => el.remove());
  result.append(sign, entry);
  fitSign(sign);
  reveal(sign, entry);
  announcer.textContent = `New word: ${word.word}. ${word.definition || ''}`;

  const top = sign.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.55) {
    sign.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  if (word.id && dict.sort === 'new') {
    list.querySelector('.dict-message')?.remove();
    const row = dictRow(word);
    row.classList.add('is-new');
    list.prepend(row);
    dict.ids.add(word.id);
    dict.offset += 1;
  }
}

/* ---------- Wörterbuch ---------- */

const list = document.getElementById('dict-list');
const moreButton = document.getElementById('dict-more');
const seg = document.getElementById('dict-sort');
const sub = document.getElementById('dict-sub');
const SUBTITLES = {
  new: 'Every word made here, newest first.',
  top: 'Highest rated first. A word needs a few votes to climb.'
};
const dict = { sort: 'new', offset: 0, seq: 0, ids: new Set() };

function dictRow(word) {
  return h('li', { class: 'dict-entry' },
    h('div', { class: 'dict-head' },
      h('a', { class: 'dict-word', href: wordPath(word.word), lang: 'de' }, hyphenate(word.word, word.parts)),
      word.article ? h('span', { class: 'dict-article', lang: 'de' }, `, ${word.article}`) : null
    ),
    h('div', { class: 'dict-actions' },
      audioButton(word, { compact: true }),
      stars(word, { compact: true })
    ),
    renderConcept(word.concept, 'dict-concept'),
    h('p', { class: 'dict-def' }, word.definition)
  );
}

const skeleton = () => Array.from({ length: 5 }, () =>
  h('li', { class: 'dict-skeleton', 'aria-hidden': 'true' },
    h('span', { class: 'sk sk-word' }),
    h('span', { class: 'sk sk-line' }),
    h('span', { class: 'sk sk-line short' })
  )
);

function message(text, action) {
  return h('li', { class: 'dict-message' }, text, action || null);
}

async function loadDictionary({ append = false } = {}) {
  const seq = ++dict.seq;
  if (!append) {
    dict.offset = 0;
    dict.ids.clear();
    if (list.querySelector('.dict-entry')) list.classList.add('is-fading');
    else list.replaceChildren(...skeleton());
  }
  list.setAttribute('aria-busy', 'true');
  moreButton.disabled = true;

  try {
    const res = await fetch(`/api/gallery?sort=${dict.sort}&offset=${dict.offset}&limit=${PAGE_SIZE}`);
    if (!res.ok) throw new Error();
    const { words, nextOffset } = await res.json();
    if (seq !== dict.seq) return;

    const rows = words.filter(w => !dict.ids.has(w.id)).map((word, i) => {
      dict.ids.add(word.id);
      const row = dictRow(word);
      if (append) {
        row.classList.add('is-appearing');
        row.style.setProperty('--i', i);
      }
      return row;
    });

    if (append) list.append(...rows);
    else if (rows.length) list.replaceChildren(...rows);
    else list.replaceChildren(message(dict.sort === 'top'
      ? 'No ratings yet. Rate a word to start the ranking.'
      : 'No words yet. Make the first one.'));

    dict.offset = nextOffset ?? dict.offset;
    moreButton.hidden = nextOffset == null;
  } catch {
    if (seq !== dict.seq) return;
    const retry = h('button', {
      type: 'button',
      class: 'btn btn-quiet',
      onClick: e => {
        e.target.closest('.dict-message').remove();
        loadDictionary({ append });
      }
    }, 'Try again');
    if (append) moreButton.hidden = true;
    (append ? list.append.bind(list) : list.replaceChildren.bind(list))(message('Couldn’t load the dictionary.', retry));
  } finally {
    if (seq === dict.seq) {
      list.classList.remove('is-fading');
      list.removeAttribute('aria-busy');
      moreButton.disabled = false;
    }
  }
}

seg.addEventListener('click', e => {
  const button = e.target.closest('button[data-sort]');
  if (!button || button.dataset.sort === dict.sort) return;
  dict.sort = button.dataset.sort;
  seg.dataset.active = dict.sort;
  seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  sub.textContent = SUBTITLES[dict.sort];
  loadDictionary();
});

moreButton.addEventListener('click', () => loadDictionary({ append: true }));

/* ---------- Start ---------- */

syncComposer();
const introSign = result.querySelector('.sign');
if (introSign) {
  fitSign(introSign);
  observeSign(introSign);
}
loadDictionary();
