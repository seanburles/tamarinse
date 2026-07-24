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

import {
  onScrollProgress,
  onVisibilityChange,
  smoothProgress,
  getScrollTarget,
  prefersReducedMotion,
} from '@tamarinse/scroll-controller';

/* Progress map (fractions of the pinned range).
   Rebalanced 2026-07-18 toward reading time: the capsule opens sooner and the
   ingredient run now owns 74% of the pin (was 66%), so each reveal gets
   substantially more scroll. Defaults only — Liquid passes the authoritative
   ingredient window via data attributes. */
const OPEN_START = 0.02;
const OPEN_END = 0.14;
const INGREDIENTS_START = 0.16;
const INGREDIENTS_END = 0.9;
const CLOSE_START = 0.92;

/* Sequence map: scrub the capsule open early, then HOLD the fully open frame
   for the whole ingredient run before reversing. Finishing the open at 0.34
   (was 0.5) stretches that middle pause from 40% to ~58% of the pinned range,
   so the content has room to breathe and the reverse doesn't start early.

   Phones hold longer still (open by 26%, reverse from 95%): ~69% of the pin
   is a completely static canvas. With nothing scrubbing, every frame of that
   stretch belongs to the ingredient copy, which is what removes the residual
   "busy / glitchy" feel on touch. The ingredient WINDOW is deliberately the
   same at both breakpoints — the Liquid-generated snap steps are built from
   it, so changing it per breakpoint would desync the snap points. */
const SEQ_FORWARD_END = 0.34;
const SEQ_FORWARD_END_MOBILE = 0.26;
const CLOSE_START_MOBILE = 0.95;

const MOBILE_QUERY = '(max-width: 749px)';

/* ---- Reading comfort (client 2026-07-18: iOS reveals were "too touchy") ----
   Discrete content (six ingredients) mapped onto continuous scroll has no
   resting positions, so momentum always won and a single flick swept past
   several reveals. Three layers fix it:

   1. NATIVE SCROLL-SNAP (the real fix, touch only). The section renders one
      snap step per ingredient with scroll-snap-stop: always, so the browser
      stops the fling on each one — decided in the compositor DURING the
      gesture, which is why it feels intentional rather than like a
      correction. This element only toggles the snap class on the scroller
      while the section is on screen, so the rest of the page scrolls freely.
   2. Touch devices scrub through a slower low-pass filter, so what momentum
      does arrive lands as an ease rather than a jump.
   3. HYSTERESIS: once an ingredient is showing it keeps showing until scroll
      is meaningfully past the boundary — no flicker when you rest on an edge
      cutting the crossfades short. */
const HYSTERESIS = 0.22; /* fraction of one ingredient band */
const SNAP_CLASS = 't-capsule-snap';

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
  #ingredientIndex = -1;
  #disposeVisibility = null;
  #onDotClick = null;

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
       progress jumps ease over a few frames instead of snapping. Touch gets a
       slower rate than pointer devices — momentum scrolling delivers far
       bigger per-frame jumps, and this is what turns them silky. */
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.#smoother = smoothProgress((progress) => this.#update(progress), coarse ? 5 : 8);
    this.#dispose = onScrollProgress(
      this,
      (progress) => this.#smoother.set(progress),
      { mode: 'pin' }
    );

    /* Snap belongs to the scroll container, so it can only be on while this
       section owns the viewport — otherwise every other section would snap
       to these steps too. */
    this.#disposeVisibility = onVisibilityChange(this, (visible) => {
      this.#toggleSnap(visible);
    });

    /* Tap a dot to jump to that ingredient */
    this.#onDotClick = (event) => {
      const dot = event.target.closest('[data-capsule-dot]');
      if (!dot) return;
      const index = Number(dot.dataset.index);
      if (Number.isFinite(index)) this.#scrollToIngredient(index);
    };
    this.addEventListener('click', this.#onDotClick);
  }

  /* ── Scroll snap ── */

  #scrollRoot() {
    const target = getScrollTarget();
    return target === window ? document.documentElement : target;
  }

  #toggleSnap(on) {
    const enabled = on && this.dataset.snap !== 'false';
    /* The CSS behind this class is already gated to (pointer: coarse) and to
       users who haven't asked for reduced motion. */
    this.#scrollRoot().classList.toggle(SNAP_CLASS, enabled);
  }

  /** Jump to an ingredient's centre — used by the dot controls. */
  #scrollToIngredient(index) {
    const items = this.querySelectorAll('[data-capsule-ingredient]');
    if (items.length === 0) return;

    const rect = this.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return;

    const span = (this.#ingredientsEnd() - this.#ingredientsStart()) / items.length;
    const target = this.#ingredientsStart() + (index + 0.5) * span;

    /* progress P sits at rect.top === -P * total, so the scroll delta that
       centres this ingredient is rect.top + P * total. */
    const delta = rect.top + target * total;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    getScrollTarget().scrollBy({ top: delta, behavior });
  }

  /* Canvas pacing — phones open sooner and reverse later, so the fully open
     frame is held for longer while the copy plays. */
  #seqForwardEnd() {
    return this.#variant === 'mobile' ? SEQ_FORWARD_END_MOBILE : SEQ_FORWARD_END;
  }

  #closeStart() {
    return this.#variant === 'mobile' ? CLOSE_START_MOBILE : CLOSE_START;
  }

  /* Timeline window — Liquid is the source of truth so the snap steps and
     these reveals can't drift apart. */
  #ingredientsStart() {
    const value = parseFloat(this.dataset.ingredientsStart);
    return Number.isFinite(value) ? value : INGREDIENTS_START;
  }

  #ingredientsEnd() {
    const value = parseFloat(this.dataset.ingredientsEnd);
    return Number.isFinite(value) ? value : INGREDIENTS_END;
  }

  disconnectedCallback() {
    if (this.#dispose) this.#dispose();
    this.#dispose = null;
    if (this.#smoother) this.#smoother.dispose();
    this.#smoother = null;
    if (this.#disposeVisibility) this.#disposeVisibility();
    this.#disposeVisibility = null;
    /* Never leave the page scroller in snap mode */
    this.#scrollRoot().classList.remove(SNAP_CLASS);
    if (this.#onDotClick) this.removeEventListener('click', this.#onDotClick);
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

    /* Sequence position: forward scrub → hold open → reverse scrub.
       The hold is the long static stretch that gives the copy its air. */
    const forwardEnd = this.#seqForwardEnd();
    const closeStart = this.#closeStart();
    let seq;
    if (progress < forwardEnd) {
      seq = progress / forwardEnd;
    } else if (progress < closeStart) {
      seq = 1;
    } else {
      seq = 1 - (progress - closeStart) / (1 - closeStart);
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
    else if (progress < this.#ingredientsStart()) phase = 'open';
    else if (progress < this.#ingredientsEnd()) phase = 'ingredient';
    else if (progress < closeStart) phase = 'after';
    else phase = 'closing';
    if (this.getAttribute('data-phase') !== phase) {
      this.setAttribute('data-phase', phase);
    }

    /* Active ingredient — with hysteresis so resting near a band edge can't
       flicker between two reveals and cut their crossfades short. */
    const items = this.querySelectorAll('[data-capsule-ingredient]');
    let index = -1;
    if (phase === 'ingredient' && items.length > 0) {
      const start = this.#ingredientsStart();
      const span = (this.#ingredientsEnd() - start) / items.length;
      const raw = (progress - start) / span;
      index = Math.min(items.length - 1, Math.max(0, Math.floor(raw)));

      const previous = this.#ingredientIndex;
      if (previous >= 0 && index !== previous) {
        /* Hold the current reveal until we're clearly past the boundary */
        const boundary = Math.max(index, previous);
        if (Math.abs(raw - boundary) < HYSTERESIS) index = previous;
      }
    } else if (phase === 'after') {
      index = items.length - 1;
    }
    this.#ingredientIndex = index;

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
