/**
 * Tamarinse — shared scroll-progress controller.
 *
 * One IntersectionObserver-gated scroll utility consumed by the WebGL bottle,
 * the capsule sequence, and anything else that maps scroll position to
 * animation progress. Sections must not roll their own scroll math or attach
 * global listeners directly (BUILD_GUIDE section 3, rule 3).
 *
 * The scroll listener only runs while the tracked element is on screen, and
 * every subscription returns a dispose function so custom elements can clean
 * up in disconnectedCallback.
 */

const subscriptions = new Set();
let listening = false;
let rafId = null;

/** Horizon scrolls .page-wrapper (not the window) on desktop ≥990px.
 *  We listen on both so animations work at every breakpoint. */
function getScrollTarget() {
  return document.querySelector('.page-wrapper') || window;
}

/** When .page-wrapper is the overflow container, IntersectionObservers
 *  must use it as root instead of the viewport (root: null) so their
 *  intersection calculations account for the wrapper's scroll position. */
function getObserverRoot() {
  const wrapper = document.querySelector('.page-wrapper');
  if (!wrapper) return null;
  const ov = getComputedStyle(wrapper).overflowY;
  return (ov === 'auto' || ov === 'scroll') ? wrapper : null;
}

function onScroll() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    for (const sub of subscriptions) {
      if (sub.active) update(sub);
    }
  });
}

function startListening() {
  if (listening) return;
  listening = true;
  const target = getScrollTarget();
  target.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

function stopListening() {
  if (!listening) return;
  listening = false;
  const target = getScrollTarget();
  target.removeEventListener('scroll', onScroll);
  window.removeEventListener('scroll', onScroll, { capture: true });
  window.removeEventListener('resize', onScroll);
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function anyActive() {
  for (const sub of subscriptions) {
    if (sub.active) return true;
  }
  return false;
}

/** @param {Subscription} sub */
function update(sub) {
  const rect = sub.element.getBoundingClientRect();
  const viewport = window.innerHeight;
  let progress;

  if (sub.mode === 'pin') {
    // For tall "scrollytelling" wrappers with a sticky child: progress runs
    // 0→1 while the wrapper scrolls through its pinned range.
    const total = rect.height - viewport;
    progress = total <= 0 ? 1 : -rect.top / total;
  } else {
    // 'enter' (default): 0 when the element's top reaches the viewport
    // bottom, 1 when the element's bottom reaches the viewport top.
    const total = rect.height + viewport;
    progress = (viewport - rect.top) / total;
  }

  progress = Math.min(1, Math.max(0, progress));
  if (progress !== sub.lastProgress) {
    sub.lastProgress = progress;
    sub.callback(progress, rect);
  }
}

/**
 * Subscribe an element to scroll progress updates.
 *
 * @param {Element} element - element (or tall wrapper) to track
 * @param {(progress: number, rect: DOMRect) => void} callback
 * @param {{ mode?: 'enter' | 'pin', margin?: string }} [options]
 *   mode 'enter': progress across the element's trip through the viewport.
 *   mode 'pin':   progress through a tall wrapper's sticky range.
 *   margin:       rootMargin for the activation observer (pre-activate early).
 * @returns {() => void} dispose function
 */
export function onScrollProgress(element, callback, options = {}) {
  const sub = {
    element,
    callback,
    mode: options.mode || 'enter',
    active: false,
    lastProgress: -1,
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        sub.active = entry.isIntersecting;
        if (sub.active) {
          startListening();
          update(sub);
        } else if (!anyActive()) {
          stopListening();
        }
      }
    },
    { root: getObserverRoot(), rootMargin: options.margin || '0px' }
  );

  subscriptions.add(sub);
  observer.observe(element);

  return () => {
    observer.disconnect();
    subscriptions.delete(sub);
    if (!anyActive()) stopListening();
  };
}

/**
 * Run a callback once when the element first approaches the viewport.
 * Used to lazy-init expensive work (e.g. constructing the WebGL scene).
 *
 * @param {Element} element
 * @param {() => void} callback
 * @param {string} [margin] - rootMargin, defaults to one viewport ahead
 * @returns {() => void} dispose function
 */
export function onNearViewport(element, callback, margin = '100% 0px') {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          callback();
        }
      }
    },
    { root: getObserverRoot(), rootMargin: margin }
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Observe viewport visibility (used to pause render loops entirely when a
 * canvas scrolls out of view — not just hide it).
 *
 * @param {Element} element
 * @param {(visible: boolean) => void} callback
 * @returns {() => void} dispose function
 */
export function onVisibilityChange(element, callback) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callback(entry.isIntersecting);
    }
  }, { root: getObserverRoot() });
  observer.observe(element);
  return () => observer.disconnect();
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Coarse device tier for proactively routing low-end devices to static
 * fallbacks (MASTER_PROMPT: device-tier BEFORE rendering, not after).
 *
 * @returns {'low' | 'high'}
 */
export function deviceTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (cores <= 3 || memory <= 2) return 'low';

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'low';
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();
  } catch (error) {
    return 'low';
  }

  return 'high';
}

export function isMobileViewport() {
  return window.matchMedia('(max-width: 749px)').matches;
}

/**
 * Pixel-ratio cap per spec: 1.5 on mobile, 2 on desktop.
 */
export function cappedPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.5 : 2);
}
