/**
 * Tamarinse easter eggs — the "brave new world pill" winks (client 2026-07-18).
 *
 * Deliberately quiet: nothing announces itself, nothing runs until a visitor
 * pokes at the site the way curious people do.
 *
 * Eggs:
 * 1. The city pill — three quick taps/clicks on the hero bottle, a click on
 *    any ™ mark in a headline, typing "pills" outside a form field, or
 *    scrolling to the very bottom of the page and back to the very top, dims
 *    the page and reveals a
 *    capsule with a night-time city skyline living in its top half
 *    (original art in the spirit of the client's Brave New World poster
 *    reference — not a copy of it), over a shower of tan capsules, with the
 *    caption "O brave new world, that has such capsules in it." (a riff on
 *    The Tempest — the line Huxley's title quotes; public domain.)
 *    Swap-ready: replace CITY_PILL_SVG with an <img> tag pointing at a
 *    generated asset and everything else carries over.
 * 2. Console greeting for the people who open devtools.
 *
 * Constraints: no dependencies, decoration only, auto-cleanup, throttled to
 * once per 30 minutes via cookie, dismiss via click/Escape/timeout, and
 * prefers-reduced-motion gets the still reveal without the rain.
 */

const EGG_COOKIE = 'tamarinse_egg';
const EGG_COOKIE_MAX_AGE_S = 30 * 60; /* 30 minutes */
const TAP_WINDOW_MS = 2_500;
/* Three, not five — five was effectively undiscoverable */
const TAPS_NEEDED = 3;
const KEYWORD = 'pills';
/* The ™ marks are the signposted route in: they carry a pointer cursor and
   tint on hover (tamarinse-tokens.css), so a curious visitor finds them
   without the joke being announced. */
const TM_SELECTOR = '.tamarinse-hero__tm, .tamarinse-closing__tm';
/* Riff on Miranda's line in The Tempest ("...such people in't!") — the line
   Huxley's Brave New World takes its title from. Modernised "in't" → "in it"
   because the archaic contraction reads as a typo to most visitors. */
const CAPTION = 'O brave new world, that has such capsules in it.';

/* Original flat-illustration capsule: arched window with a skyline in the
   top half, seam band, tan gelatin base. Brand palette throughout. */
const CITY_PILL_SVG = `
<svg viewBox="0 0 220 400" role="img" aria-hidden="true" focusable="false">
  <path d="M52 214V120a58 58 0 0 1 116 0v94Z" fill="#0b2e1e"/>
  <g fill="#f3eee2" opacity="0.85">
    <rect x="70" y="92" width="26" height="7" rx="3.5"/>
    <rect x="122" y="76" width="30" height="7" rx="3.5"/>
    <rect x="98" y="110" width="20" height="6" rx="3"/>
  </g>
  <g fill="#f3eee2">
    <rect x="62" y="152" width="18" height="62"/>
    <rect x="84" y="136" width="16" height="78"/>
    <rect x="118" y="146" width="14" height="68"/>
    <rect x="136" y="128" width="18" height="86"/>
    <rect x="158" y="160" width="10" height="54"/>
    <rect x="104" y="98" width="10" height="116"/>
    <path d="M104 98l5-12 5 12Z"/>
  </g>
  <g fill="#0b2e1e">
    <rect x="66" y="158" width="3.5" height="5"/><rect x="73" y="158" width="3.5" height="5"/>
    <rect x="66" y="170" width="3.5" height="5"/><rect x="73" y="170" width="3.5" height="5"/>
    <rect x="66" y="182" width="3.5" height="5"/><rect x="73" y="182" width="3.5" height="5"/>
    <rect x="88" y="142" width="3.5" height="5"/><rect x="95" y="142" width="3.5" height="5"/>
    <rect x="88" y="154" width="3.5" height="5"/><rect x="95" y="154" width="3.5" height="5"/>
    <rect x="88" y="166" width="3.5" height="5"/><rect x="95" y="166" width="3.5" height="5"/>
    <rect x="88" y="178" width="3.5" height="5"/><rect x="95" y="178" width="3.5" height="5"/>
    <rect x="121" y="152" width="3.5" height="5"/><rect x="127" y="152" width="3.5" height="5"/>
    <rect x="121" y="164" width="3.5" height="5"/><rect x="127" y="164" width="3.5" height="5"/>
    <rect x="140" y="134" width="3.5" height="5"/><rect x="147" y="134" width="3.5" height="5"/>
    <rect x="140" y="146" width="3.5" height="5"/><rect x="147" y="146" width="3.5" height="5"/>
    <rect x="140" y="158" width="3.5" height="5"/><rect x="147" y="158" width="3.5" height="5"/>
    <circle cx="109" cy="112" r="3.5"/>
  </g>
  <path d="M52 214V120a58 58 0 0 1 116 0v94" fill="none" stroke="#f3eee2" stroke-width="3"/>
  <rect x="52" y="214" width="116" height="18" fill="#8f7f58"/>
  <line x1="58" y1="220" x2="162" y2="220" stroke="#6b5c3e" stroke-width="2"/>
  <line x1="58" y1="226" x2="162" y2="226" stroke="#6b5c3e" stroke-width="2"/>
  <path d="M52 232h116v92a58 58 0 0 1-116 0Z" fill="#a3936e"/>
  <path d="M62 232v92a46 46 0 0 0 10 28" fill="none" stroke="#cfc09b" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
</svg>`;

let styleInjected = false;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function eggCookieActive() {
  return document.cookie.split(';').some((part) => part.trim().startsWith(`${EGG_COOKIE}=`));
}

function setEggCookie() {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${EGG_COOKIE}=1; Max-Age=${EGG_COOKIE_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
}

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .t-egg-layer {
      position: fixed;
      inset: 0;
      z-index: 9999;
      overflow: hidden;
      pointer-events: none;
    }

    .t-egg-capsule {
      position: absolute;
      top: -4rem;
      width: var(--egg-w);
      height: calc(var(--egg-w) * 2.4);
      border-radius: 999px;
      background: linear-gradient(
        to bottom,
        #cfc09b 0 48%,
        #8f7f58 48% 50%,
        #a3936e 50% 100%
      );
      box-shadow: inset 2px 2px 3px rgb(255 255 255 / 45%), inset -2px -3px 4px rgb(25 23 18 / 25%);
      animation: t-egg-fall var(--egg-dur) cubic-bezier(0.3, 0, 0.8, 0.6) var(--egg-delay) both;
    }

    @keyframes t-egg-fall {
      from {
        transform: translateY(0) rotate(var(--egg-rot-a));
        opacity: 1;
      }

      85% {
        opacity: 1;
      }

      to {
        transform: translateY(calc(100vh + 8rem)) rotate(var(--egg-rot-b));
        opacity: 0.9;
      }
    }

    .t-egg-city {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      background: rgb(12 15 13 / 55%);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      cursor: pointer;
      animation: t-egg-fade 480ms ease-out both;
    }

    .t-egg-city__figure {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.375rem;
      animation: t-egg-rise 760ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
    }

    .t-egg-city svg {
      width: clamp(140px, 24vh, 210px);
      height: auto;
      filter: drop-shadow(0 20px 44px rgb(0 0 0 / 45%));
    }

    .t-egg-city__caption {
      max-width: min(84vw, 24rem);
      color: #f3eee2;
      font-family: var(--t-font-heading, Georgia, serif);
      font-size: 1.0625rem;
      font-style: italic;
      text-align: center;
      letter-spacing: 0.01em;
      line-height: 1.5;
    }

    @keyframes t-egg-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes t-egg-rise {
      from {
        opacity: 0;
        transform: translateY(2rem) scale(0.92);
      }

      to {
        opacity: 1;
        transform: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .t-egg-city,
      .t-egg-city__figure {
        animation: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function rainCapsules() {
  const layer = document.createElement('div');
  layer.className = 't-egg-layer';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 36; i += 1) {
    const pill = document.createElement('span');
    pill.className = 't-egg-capsule';
    pill.style.setProperty('--egg-w', `${(8 + Math.random() * 10).toFixed(1)}px`);
    pill.style.setProperty('--egg-dur', `${(2.4 + Math.random() * 1.6).toFixed(2)}s`);
    pill.style.setProperty('--egg-delay', `${(Math.random() * 0.9).toFixed(2)}s`);
    pill.style.setProperty('--egg-rot-a', `${(Math.random() * 360).toFixed(0)}deg`);
    pill.style.setProperty('--egg-rot-b', `${(Math.random() * 540 - 270).toFixed(0)}deg`);
    pill.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    layer.appendChild(pill);
  }

  document.body.appendChild(layer);
  /* Longest fall = 0.9s delay + 4.0s duration — clear well after that */
  setTimeout(() => layer.remove(), 5500);
}

function showCityPill() {
  const overlay = document.createElement('div');
  overlay.className = 't-egg-city';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <figure class="t-egg-city__figure">
      ${CITY_PILL_SVG}
      <figcaption class="t-egg-city__caption">${CAPTION}</figcaption>
    </figure>`;

  let timer;
  const onKey = (event) => {
    if (event.key === 'Escape') dismiss();
  };
  const dismiss = () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };
  overlay.addEventListener('pointerdown', dismiss);
  document.addEventListener('keydown', onKey, true);
  timer = setTimeout(dismiss, 7000);

  document.body.appendChild(overlay);
}

function reveal() {
  if (eggCookieActive()) return;
  setEggCookie();

  injectStyles();
  if (!reducedMotion()) rainCapsules();
  showCityPill();
}

/* ── Trigger 1: a few quick taps on the hero bottle ── */
let taps = [];
document.addEventListener(
  'pointerdown',
  (event) => {
    if (!event.target.closest('tamarinse-bottle-sequence, tamarinse-bottle-scene')) return;
    const now = performance.now();
    taps = taps.filter((t) => now - t < TAP_WINDOW_MS);
    taps.push(now);
    if (taps.length >= TAPS_NEEDED) {
      taps = [];
      reveal();
    }
  },
  { passive: true }
);

/* ── Trigger 2: click a ™ mark — the discoverable one ── */
document.addEventListener('click', (event) => {
  if (event.target.closest(TM_SELECTOR)) reveal();
});

/* ── Trigger 3: typing "pills" outside form fields ── */
let typed = '';
document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]')) {
    return;
  }
  if (event.key.length !== 1) return;
  typed = (typed + event.key.toLowerCase()).slice(-KEYWORD.length);
  if (typed === KEYWORD) {
    typed = '';
    reveal();
  }
});

/* ── Trigger 4: scroll to the very bottom, then back to the very top ──
   Horizon scrolls .page-wrapper on desktop and the window elsewhere, so read
   whichever is the live scroll container. "Armed" latches at the bottom and
   fires on the return to the top; reveal()'s 30-minute cookie stops repeats. */
const EDGE_SLOP = 4; /* px tolerance for "all the way" (sub-pixel zoom, elastic) */
let armedFromBottom = false;

function scrollMetrics() {
  const wrapper = document.querySelector('.page-wrapper');
  if (wrapper) {
    const ov = getComputedStyle(wrapper).overflowY;
    if (ov === 'auto' || ov === 'scroll') {
      return {
        top: wrapper.scrollTop,
        max: wrapper.scrollHeight - wrapper.clientHeight,
      };
    }
  }
  const doc = document.scrollingElement || document.documentElement;
  return {
    top: window.scrollY || doc.scrollTop,
    max: doc.scrollHeight - window.innerHeight,
  };
}

function onEdgeScroll() {
  const { top, max } = scrollMetrics();
  /* Ignore pages too short to have a real top-and-bottom journey */
  if (max < window.innerHeight) return;

  if (top >= max - EDGE_SLOP) {
    armedFromBottom = true;
  } else if (armedFromBottom && top <= EDGE_SLOP) {
    armedFromBottom = false;
    reveal();
  }
}

/* capture:true catches the .page-wrapper's scroll (scroll doesn't bubble) */
window.addEventListener('scroll', onEdgeScroll, { passive: true, capture: true });

/* ── Console greeting ── */
try {
  // eslint-disable-next-line no-console
  console.log(
    '%cTamarinse™%c O brave new world, that has such capsules in it. — try clicking a ™.',
    'font-weight:700;color:#0d7a3f;font-size:14px;',
    'color:#9a8a68;font-style:italic;'
  );
} catch (error) {
  /* consoles that object to styling can stay unstyled */
}
