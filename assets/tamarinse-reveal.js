/*
  Scroll-triggered reveals for Tamarinse.
  - Section eyebrow + headline (staggered)
  - Below-fold images (opacity fade once loaded + in view)
  Skips hero, sticky buy bar, and stack-driven copy.
*/
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) && !reduced) return;

  /* Arm CSS hiding only after JS is alive */
  document.documentElement.classList.add('t-motion');

  const SKIP = '.tamarinse-hero, .tamarinse-buybar, .tamarinse-sticky-buy-bar, .t-stack-reveal';
  const IMG_SKIP =
    '.tamarinse-hero, .tamarinse-buybar, .tamarinse-sticky-buy-bar, .tamarinse-quality__icon-image';

  /** Find section roots that own homepage/product brand blocks */
  const roots = () =>
    [
      ...document.querySelectorAll(
        'section[class*="tamarinse-"], [class*="tamarinse-"][class*="-wrapper"] > [class*="tamarinse-"]'
      ),
    ].filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.closest(SKIP) || el.matches(SKIP)) return false;
      /* Prefer the content section, not the Shopify wrapper alone */
      if (el.className.includes('-wrapper') && el.classList.contains('shopify-section')) return false;
      return true;
    });

  /**
   * @param {HTMLElement} el
   */
  const reveal = (el) => {
    el.classList.add('is-revealed');
  };

  /** @type {IntersectionObserver | null} */
  let observer = null;
  /** @type {IntersectionObserver | null} */
  let imgObserver = null;

  if (!reduced) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(/** @type {HTMLElement} */ (entry.target));
          observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -6% 0px' }
    );

    imgObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = /** @type {HTMLImageElement} */ (entry.target);
          imgObserver?.unobserve(img);
          whenLoaded(img, () => reveal(img));
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -6% 0px' }
    );
  }

  /**
   * @param {HTMLImageElement} img
   * @param {() => void} cb
   */
  const whenLoaded = (img, cb) => {
    if (img.complete) {
      cb();
      return;
    }
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      cb();
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  };

  /**
   * @param {HTMLElement} el
   * @param {'eyebrow' | 'headline'} kind
   * @param {number} delay
   */
  const mark = (el, kind, delay) => {
    if (el.hasAttribute('data-t-reveal')) return;
    if (el.closest('.t-stack-reveal')) return;
    el.setAttribute('data-t-reveal', kind);
    el.style.setProperty('--t-reveal-delay', String(delay));

    if (reduced) {
      reveal(el);
      return;
    }

    /* If already on screen (or nearly), reveal immediately — don't wait for IO */
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.92 && rect.bottom > 0) {
      /* Double-rAF so the browser paints the hidden state first */
      requestAnimationFrame(() => requestAnimationFrame(() => reveal(el)));
      return;
    }

    observer?.observe(el);
  };

  /**
   * @param {HTMLImageElement} img
   */
  const isEligibleImage = (img) => {
    if (img.hasAttribute('data-t-img')) return false;
    if (img.closest(IMG_SKIP) || img.matches?.(IMG_SKIP)) return false;
    if (img.getAttribute('fetchpriority') === 'high') return false;
    if (img.getAttribute('loading') === 'eager') return false;
    const w = Number(img.getAttribute('width'));
    if (w > 0 && w < 40) return false;
    return true;
  };

  /**
   * @param {HTMLImageElement} img
   */
  const markImage = (img) => {
    if (!isEligibleImage(img)) return;

    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
    img.setAttribute('data-t-img', '');

    if (reduced) {
      reveal(img);
      return;
    }

    const rect = img.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.92 && rect.bottom > 0) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => whenLoaded(img, () => reveal(img)))
      );
      return;
    }

    imgObserver?.observe(img);
  };

  /**
   * @param {Element} root
   */
  const tagSection = (root) => {
    if (!(root instanceof HTMLElement)) return;
    if (root.matches(SKIP) || root.closest(SKIP)) return;

    const eyebrow = root.querySelector(':scope [class*="__eyebrow"]');
    const headline = root.querySelector(
      ':scope h2[class*="__title"], :scope h2[class*="__headline"], :scope h1[class*="__headline"]'
    );

    if (eyebrow) mark(eyebrow, 'eyebrow', 0);
    if (headline) mark(headline, 'headline', eyebrow ? 1 : 0);

    root.querySelectorAll('img').forEach((img) => {
      if (img instanceof HTMLImageElement) markImage(img);
    });
  };

  const run = () => roots().forEach(tagSection);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  /* Theme editor / section morphs */
  if ('MutationObserver' in window) {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.('[class*="tamarinse-"]')) tagSection(node);
          if (node instanceof HTMLImageElement) markImage(node);
          node.querySelectorAll?.('[class*="tamarinse-"]').forEach((el) => {
            if (el instanceof HTMLElement && el.matches('section, [class*="__inner"], [class*="tamarinse-"]')) {
              tagSection(el);
            }
          });
          node.querySelectorAll?.('img').forEach((img) => {
            if (img instanceof HTMLImageElement && img.closest('[class*="tamarinse-"]')) {
              markImage(img);
            }
          });
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
