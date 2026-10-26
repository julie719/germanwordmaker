// The pieces that make up a word: the sign, the dictionary entry, and its
// audio, rating and share controls. Shared by the home page and word pages.
import { h, icon, reducedMotion, storage } from './dom.js';
import { hyphenate, splitExample, wordPath, ratingLabel } from './text.js';

/* ---------- Sign ---------- */

// variant: 'word' | 'refusal' (struck through, like a town-exit sign) | 'unknown'
export function renderSign(word, { variant = 'word', heading = 'h2' } = {}) {
  const plate = h('div', { class: 'sign-plate' },
    h('div', { class: 'sign-inner' },
      word.article ? h('span', { class: 'sign-article', lang: 'de' }, word.article) : null,
      h(heading, { class: 'sign-word', lang: 'de' },
        h('span', { class: 'sign-word-text' }, hyphenate(word.word, word.parts))
      ),
      word.pronunciation ? h('span', { class: 'sign-sub' }, word.pronunciation) : null
    )
  );
  if (variant !== 'word') plate.append(strike());
  const sign = h('figure', { class: 'sign', 'data-variant': variant }, plate);
  observeSign(sign);
  return sign;
}

function strike() {
  const wrap = document.createElement('span');
  wrap.className = 'sign-strike';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="3" y1="97" x2="97" y2="3" pathLength="1"/></svg>';
  return wrap;
}

// Sizes the word to fill the plate. Too long for the minimum size: switch to the
// condensed cut, as real signs do for long place names; still too long: wrap,
// breaking between the compound's parts.
export function fitSign(sign) {
  const box = sign.querySelector('.sign-word');
  const text = box?.firstElementChild;
  const available = box?.clientWidth;
  if (!available) return;

  const min = available < 420 ? 28 : 36;
  const max = Math.max(min, Math.min(78, available / 5.2));
  const measure = () => (100 * available * 0.98) / text.getBoundingClientRect().width;

  box.classList.remove('is-condensed', 'is-wrapped', 'is-auto-hyphens');
  box.classList.add('is-measuring');
  box.style.fontSize = '100px';
  let size = measure();
  if (size < min) {
    box.classList.add('is-condensed');
    size = measure();
  }
  if (size < min) {
    box.classList.add('is-wrapped');
    box.classList.toggle('is-auto-hyphens', !text.textContent.includes('­'));
    size = min;
  }
  box.classList.remove('is-measuring');
  box.style.fontSize = `${Math.floor(Math.min(size, max))}px`;
}

const resizeObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entries => entries.forEach(e => {
      // Fitting changes the height, so only refit when the width changes.
      if (e.contentRect.width === e.target.fitWidth) return;
      e.target.fitWidth = e.contentRect.width;
      fitSign(e.target.closest('.sign'));
    }))
  : null;

export function observeSign(sign) {
  const box = sign.querySelector('.sign-word');
  if (!box) return;
  resizeObserver?.observe(box);
  document.fonts?.ready.then(() => fitSign(sign));
}

// The one orchestrated moment: the word wipes onto the plate, then the entry
// follows line by line.
export function reveal(sign, entry) {
  if (reducedMotion()) return;
  sign.classList.add('is-revealing');
  entry?.classList.add('is-revealing');
  setTimeout(() => {
    sign.classList.remove('is-revealing');
    entry?.classList.remove('is-revealing');
  }, 1000);
}

/* ---------- Entry ---------- */

export function renderEntry(word, { actions = true, note = null, extra = null } = {}) {
  const { german, english } = splitExample(word.example);
  const parts = (word.parts || []).filter(p => p?.german);

  const entry = h('div', { class: 'entry' },
    parts.length ? h('ol', { class: 'parts', 'aria-label': 'Built from' },
      parts.map(p => h('li', { class: 'part' },
        h('span', { class: 'part-de', lang: 'de' }, p.german),
        p.meaning ? h('span', { class: 'part-en' }, p.meaning) : null
      ))
    ) : null,
    word.definition ? h('p', { class: 'definition' }, word.definition) : null,
    german ? h('blockquote', { class: 'example' },
      h('p', { class: 'example-de', lang: 'de' }, german),
      english ? h('p', { class: 'example-en' }, english) : null
    ) : null,
    actions ? h('div', { class: 'entry-actions' },
      audioButton(word),
      word.id ? stars(word) : null,
      word.id ? shareButton(word) : null
    ) : null,
    note ? h('p', { class: 'entry-note' }, note) : null,
    extra
  );
  [...entry.children].forEach((child, i) => child.style.setProperty('--i', i));
  return entry;
}

/* ---------- Audio ---------- */

const audioCache = new Map();
let playing = null;
let requested = null;

const speakText = word => `${word.word}. ${splitExample(word.example).german}`.slice(0, 300);

function loadAudio(word) {
  const key = word.elevenLabsHistoryId || `text:${speakText(word)}`;
  if (!audioCache.has(key)) {
    const promise = (async () => {
      let res = word.elevenLabsHistoryId
        ? await fetch(`/api/speak?historyId=${encodeURIComponent(word.elevenLabsHistoryId)}`)
        : null;
      if (!res?.ok) {
        res = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: speakText(word) })
        });
      }
      if (!res.ok) throw new Error('Audio unavailable');
      return URL.createObjectURL(await res.blob());
    })();
    promise.catch(() => audioCache.delete(key));
    audioCache.set(key, promise);
  }
  return audioCache.get(key);
}

const AUDIO_LABELS = { idle: 'Hear it', loading: 'Loading', playing: 'Stop', error: 'Audio unavailable' };

function setAudioState(button, state) {
  button.dataset.state = state;
  const label = button.querySelector('.btn-label');
  if (label) label.textContent = AUDIO_LABELS[state];
  else button.setAttribute('aria-label', `${AUDIO_LABELS[state]}: ${button.dataset.word}`);
}

function stopPlaying() {
  if (!playing) return;
  playing.audio.pause();
  setAudioState(playing.button, 'idle');
  playing = null;
}

export function audioButton(word, { compact = false } = {}) {
  const button = h('button', {
    type: 'button',
    class: compact ? 'btn btn-icon btn-audio' : 'btn btn-quiet btn-audio',
    'data-state': 'idle',
    'data-word': word.word
  },
    h('span', { class: 'audio-glyph', 'aria-hidden': 'true' },
      icon('speaker', 'icon icon-speaker'),
      h('span', { class: 'eq' }, h('i'), h('i'), h('i')),
      h('span', { class: 'spinner' })
    ),
    compact ? null : h('span', { class: 'btn-label' }, AUDIO_LABELS.idle)
  );
  if (compact) setAudioState(button, 'idle');

  // Saved audio is a cacheable GET, so warm it up before the click.
  const warm = () => word.elevenLabsHistoryId && loadAudio(word).catch(() => {});
  button.addEventListener('pointerenter', warm, { once: true });
  button.addEventListener('focus', warm, { once: true });

  button.addEventListener('click', async () => {
    if (playing?.button === button) return stopPlaying();
    stopPlaying();
    if (requested && requested !== button) setAudioState(requested, 'idle');
    requested = button;
    setAudioState(button, 'loading');

    const fail = () => {
      if (playing?.button === button) playing = null;
      setAudioState(button, 'error');
      setTimeout(() => button.dataset.state === 'error' && setAudioState(button, 'idle'), 2000);
    };

    try {
      const url = await loadAudio(word);
      if (requested !== button || button.dataset.state !== 'loading') return;
      const audio = new Audio(url);
      playing = { audio, button };
      audio.addEventListener('playing', () => playing?.audio === audio && setAudioState(button, 'playing'));
      audio.addEventListener('ended', () => playing?.audio === audio && stopPlaying());
      audio.addEventListener('error', fail);
      await audio.play();
    } catch {
      fail();
    }
  });
  return button;
}

/* ---------- Stars ---------- */

const votes = storage('gwm:ratings', {});
const starRow = () => [1, 2, 3, 4, 5].map(() => icon('star', 'star'));

export function stars(word, { compact = false } = {}) {
  let rating = { avg: 0, count: 0, ...word.rating };
  let yours = votes.read()[word.id] || null;
  let committed = { rating, yours };
  let timer = null;

  const meta = h('span', { class: 'stars-meta', 'aria-live': 'polite' });
  const buttons = [1, 2, 3, 4, 5].map(n => h('button', {
    type: 'button',
    role: 'radio',
    class: 'star-hit',
    'aria-label': `${n} ${n === 1 ? 'star' : 'stars'}`,
    onClick: () => vote(n),
    onPointerenter: () => paint(n)
  }));
  const group = h('span', {
    class: 'stars-group',
    role: 'radiogroup',
    'aria-label': `Rate ${word.word}`,
    onPointerleave: () => paint()
  },
    h('span', { class: 'stars-track', 'aria-hidden': 'true' }, starRow()),
    h('span', { class: 'stars-fill', 'aria-hidden': 'true' }, starRow()),
    buttons
  );
  const root = h('div', { class: compact ? 'stars stars-compact' : 'stars' }, group, meta);

  group.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = Math.min(5, Math.max(1, (yours || 0) + step));
    vote(n);
    buttons[n - 1].focus();
  });

  function paint(preview) {
    const value = preview ?? yours ?? rating.avg;
    root.style.setProperty('--pct', `${(value / 5) * 100}%`);
    root.dataset.mode = preview ? 'preview' : yours ? 'yours' : 'avg';
    buttons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(yours === i + 1));
      b.tabIndex = (yours ? yours === i + 1 : i === 0) ? 0 : -1;
    });
    const text = compact
      ? (rating.count ? `${rating.avg.toFixed(1)} (${rating.count})` : '')
      : ratingLabel(rating);
    if (meta.textContent !== text) {
      meta.textContent = text;
      if (!reducedMotion()) {
        meta.classList.remove('is-ticking');
        void meta.offsetWidth;
        meta.classList.add('is-ticking');
      }
    }
  }

  function vote(n) {
    const previous = yours;
    const sum = rating.avg * rating.count - (previous || 0) + n;
    const count = rating.count + (previous ? 0 : 1);
    rating = { avg: Math.round((sum / count) * 10) / 10, count };
    yours = n;
    remember(word.id, n);
    paint();

    for (const row of root.querySelectorAll('.stars-track, .stars-fill')) {
      const star = row.children[n - 1];
      star.classList.remove('is-popped');
      void star.offsetWidth;
      star.classList.add('is-popped');
    }

    clearTimeout(timer);
    timer = setTimeout(submit, 350);
  }

  async function submit() {
    try {
      const res = await fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: word.id, stars: yours })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      rating = { avg: data.avg, count: data.count };
      committed = { rating, yours };
      paint();
    } catch {
      ({ rating, yours } = committed);
      remember(word.id, yours);
      paint();
      meta.textContent = 'Couldn’t save your rating. Try again.';
    }
  }

  paint();
  return root;
}

function remember(id, n) {
  const all = votes.read();
  if (n) all[id] = n;
  else delete all[id];
  votes.write(all);
}

/* ---------- Share ---------- */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = h('textarea', { class: 'visually-hidden', readonly: true });
    field.value = text;
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}

export function shareButton(word) {
  const url = location.origin + wordPath(word.word);
  const text = `${word.word}: ${word.definition}`;
  const label = h('span', { class: 'btn-label' }, 'Share');
  const button = h('button', {
    type: 'button',
    class: 'btn btn-quiet',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false'
  }, icon('share'), label);

  const copyItem = h('button', { type: 'button', role: 'menuitem', class: 'menu-item' }, icon('link'), 'Copy link');
  const menu = h('div', { class: 'menu', role: 'menu' },
    copyItem,
    h('a', {
      role: 'menuitem',
      class: 'menu-item',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n\n${url}`)}`,
      target: '_blank',
      rel: 'noopener'
    }, icon('x'), 'Post on X'),
    h('a', {
      role: 'menuitem',
      class: 'menu-item',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      target: '_blank',
      rel: 'noopener'
    }, icon('linkedin'), 'Share on LinkedIn')
  );
  const wrap = h('div', { class: 'share' }, button, menu);
  const items = () => [...menu.querySelectorAll('.menu-item')];

  const onOutside = e => !wrap.contains(e.target) && close();
  function open(focusFirst) {
    const rect = button.getBoundingClientRect();
    wrap.classList.toggle('share-end', rect.left + 230 > document.documentElement.clientWidth);
    wrap.dataset.open = '';
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutside);
    if (focusFirst) items()[0].focus();
  }
  function close(refocus) {
    if (!('open' in wrap.dataset)) return;
    delete wrap.dataset.open;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside);
    if (refocus) button.focus();
  }

  button.addEventListener('click', async e => {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: word.word, text, url }); } catch {}
      return;
    }
    'open' in wrap.dataset ? close() : open(e.detail === 0);
  });
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Escape') return close(true);
    if (!('open' in wrap.dataset) || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const list = items();
    const next = list.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1);
    list[(next + list.length) % list.length].focus();
  });
  menu.addEventListener('click', e => e.target.closest('a') && close());
  wrap.addEventListener('focusout', e => !wrap.contains(e.relatedTarget) && close());

  copyItem.addEventListener('click', async () => {
    const ok = await copyText(url);
    close(true);
    button.classList.add('is-confirming');
    label.textContent = ok ? 'Link copied' : 'Couldn’t copy';
    setTimeout(() => {
      button.classList.remove('is-confirming');
      label.textContent = 'Share';
    }, 1600);
  });

  return wrap;
}
