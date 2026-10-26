// h('a', { class: 'x', href, onClick }, 'text', childNode) -> element.
// Strings always become text nodes, so user and model content can't inject HTML.
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter(c => c != null && c !== false));
  return el;
}

// Static, trusted icon markup only.
const ICONS = {
  speaker: '<path d="M4 9h3l4-4v14l-4-4H4z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" fill="none"/>',
  share: '<path d="M12 4v11M7.5 8.5 12 4l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" fill="none"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none"/>',
  x: '<path d="M4 4l16 16M20 4 4 20" fill="none"/>',
  linkedin: '<rect x="4" y="4" width="16" height="16" rx="2.5" fill="none"/><path d="M8.5 10.5V16M8.5 8v.01M12 16v-5.5M12 13a2.5 2.5 0 0 1 5 0v3" fill="none"/>',
  star: '<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>'
};

export function icon(name, className = 'icon') {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function storage(key, fallback) {
  return {
    read() {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    write(value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  };
}
