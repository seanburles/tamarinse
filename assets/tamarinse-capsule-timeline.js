/**
 * <tamarinse-capsule-sequence> — the signature scroll-driven capsule section.
 *
 * A tall wrapper pins a full-viewport stage. The background is a canvas that
 * scrubs through a pre-rendered image sequence (frames extracted from the
 * capsule video — desktop 16:9 set and mobile 9:16 set) as the visitor
 * scrolls. Over it, the text timeline plays:
 *   phase "closed"     capsule sits whole
 *   phase "open"       capsule splits, layer-one (delayed-release) copy shows
 *   phase "ingredient" six ingredients reveal one at a time in the gap
 *   phase "closing"    the sequence scrubs back to the closed capsule
 *
 * All motion is scroll-mapped through the shared scroll controller — nothing
 * loops, nothing autoplays (style contract). Reduced motion: the ingredient
 * list renders statically and the canvas stays hidden.
 *
 * Inner nodes are queried on every update, never cached: theme-dev hot
 * reloads and Horizon soft navigations morph section DOM in place, which
 * turns cached child references into detached nodes (the "pins but nothing
 * shows" bug). Attributes are also re-applied every frame so a morph that
 * strips them heals on the next scroll tick.
 */

import { onScrollProgress, smoothProgress, prefersReducedMotion } from '@tamarinse/scroll-controller';

/* Progress map (fractions of the pinned range) */
const OPEN_START = 0.02;
const OPEN_END = 0.16;
const INGREDIENTS_START = 0.2;
const INGREDIENTS_END = 0.86;
const CLOSE_START = 0.9;

/* Sequence map: scrub forward over the first half of the pin, hold the fully
   open frame through the ingredient reveals, scrub back during "closing". */
const SEQ_FORWARD_END = 0.5;

const MOBILE_QUERY = '(max-width: 749px)';

class TamarinseCapsuleSequence extends HTMLElement {
  #dispose = null;
  #smoother = null;
  #frames = [];
  #variant = null;
  #frameCount = 0;
  #currentIndex = -1;
  #loadingStarted = false;
  #mediaQuery = null;
  #resizeObserver = null;
  #onMediaChange = null;

  connectedCallback() {
    if (prefersReducedMotion()) {
      this.setAttribute('data-static', '');
      return;
    }

    this.#frameCount = parseInt(this.dataset.frameCount, 10) || 0;

    this.#mediaQuery = window.matchMedia(MOBILE_QUERY);
    this.#onMediaChange = () => this.#setVariant(this.#mediaQuery.matches ? 'mobile' : 'desktop');
    this.#mediaQuery.addEventListener('change', this.#onMediaChange);
    this.#setVariant(this.#mediaQuery.matches ? 'mobile' : 'desktop');

    this.#resizeObserver = new ResizeObserver(() => this.#syncCanvasSize());
    this.#resizeObserver.observe(this);

    /* Low-pass filter between raw scroll and the timeline (client 2026-07-18:
       iOS scrubbing was "very sensitive"): flicks and Safari toolbar-resize
       progress jumps ease over a few frames instead of snapping. Rate 9 keeps
       the frame scrub tracking the finger closely while filtering jitter. */
    this.#smoother = smoothProgress((progress) => this.#update(progress), 9);
    this.#dispose = onScrollProgress(
      this,
      (progress) => this.#smoother.set(progress),
      { mode: 'pin' }
    );
  }

  disconnectedCallback() {
    if (this.#dispose) this.#dispose();
    this.#dispose = null;
    if (this.#smoother) this.#smoother.dispose();
    this.#smoother = null;
    if (this.#mediaQuery && this.#onMediaChange) {
      this.#mediaQuery.removeEventListener('change', this.#onMediaChange);
    }
    if (this.#resizeObserver) this.#resizeObserver.disconnect();
    this.#resizeObserver = null;
    this.#frames = [];
  }

  /* ── Frame set ── */

  #setVariant(variant) {
    if (variant === this.#variant) return;
    this.#variant = variant;
    this.#loadingStarted = false;
    this.#frames = [];
    this.#currentIndex = -1;
    this.#loadFrames();
  }

  #frameUrl(index) {
    const base =
      this.#variant === 'mobile' ? this.dataset.framesMobile : this.dataset.framesDesktop;
    if (!base) return null;
    /* The data attribute holds frame 000's URL (asset_url includes a version
       query string) — swap the padded index inside it. */
    return base.replace('-000.webp', `-${String(index).padStart(3, '0')}.webp`);
  }

  #loadFrames() {
    if (this.#loadingStarted || this.#frameCount === 0) return;
    this.#loadingStarted = true;

    const variant = this.#variant;
    for (let i = 0; i < this.#frameCount; i += 1) {
      const url = this.#frameUrl(i);
      if (!url) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      img.onload = () => {
        /* A breakpoint change may have swapped the set mid-flight */
        if (this.#variant !== variant) return;
        /* Paint as soon as the frame the viewport is waiting on arrives */
        if (i === Math.max(0, this.#currentIndex)) this.#draw(i);
      };
      this.#frames[i] = img;
    }
  }

  /* ── Canvas ── */

  #syncCanvasSize() {
    const canvas = this.querySelector('.tamarinse-capsule__canvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (this.#currentIndex > -1) this.#draw(this.#currentIndex, true);
    }
  }

  #draw(index, force = false) {
    if (!force && index === this.#currentIndex) return;
    const canvas = this.querySelector('.tamarinse-capsule__canvas');
    const img = this.#frames[index];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) {
      this.#currentIndex = index;
      return;
    }
    this.#currentIndex = index;

    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    /* cover-fit: fill the viewport, crop the overflow, keep the capsule centered */
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* ── Scroll timeline ── */

  #update(progress) {
    /* Canvas geometry is handled by the ResizeObserver — reading
       getBoundingClientRect here every frame forced a layout on each scroll
       tick, which is a major stutter source on iOS Safari. The canvas box is
       svh-locked, so scroll can't change it. */

    /* Sequence position: forward scrub → hold open → reverse scrub */
    let seq;
    if (progress < SEQ_FORWARD_END) {
      seq = progress / SEQ_FORWARD_END;
    } else if (progress < CLOSE_START) {
      seq = 1;
    } else {
      seq = 1 - (progress - CLOSE_START) / (1 - CLOSE_START);
    }
    if (this.#frameCount > 0) {
      const index = Math.max(
        0,
        Math.min(this.#frameCount - 1, Math.round(seq * (this.#frameCount - 1)))
      );
      this.#draw(index);
    }

    /* Phase attribute drives copy visibility via CSS */
    let phase;
    if (progress < OPEN_START) phase = 'closed';
    else if (progress < INGREDIENTS_START) phase = 'open';
    else if (progress < INGREDIENTS_END) phase = 'ingredient';
    else if (progress < CLOSE_START) phase = 'after';
    else phase = 'closing';
    if (this.getAttribute('data-phase') !== phase) {
      this.setAttribute('data-phase', phase);
    }

    /* Active ingredient */
    const items = this.querySelectorAll('[data-capsule-ingredient]');
    let index = -1;
    if (phase === 'ingredient' && items.length > 0) {
      const span = (INGREDIENTS_END - INGREDIENTS_START) / items.length;
      index = Math.min(
        items.length - 1,
        Math.floor((progress - INGREDIENTS_START) / span)
      );
    } else if (phase === 'after') {
      index = items.length - 1;
    }

    items.forEach((item, i) => {
      item.toggleAttribute('data-active', i === index);
    });
    this.querySelectorAll('[data-capsule-dot]').forEach((dot, i) => {
      dot.toggleAttribute('data-active', i <= index && index > -1);
    });
  }
}

if (!customElements.get('tamarinse-capsule-sequence')) {
  customElements.define('tamarinse-capsule-sequence', TamarinseCapsuleSequence);
}
