/**
 * <tamarinse-bottle-sequence> — hero bottle as a scroll-scrubbed turntable.
 *
 * Replaces the procedural WebGL jar with a pre-rendered 360° image sequence
 * (frames extracted from the product turntable video, white studio backdrop
 * keyed out so the contact shadow composites onto the cream page).
 *
 * Behavior:
 * - The sequence is a seamless loop: frame index wraps, so rotation is
 *   unbounded in either direction.
 * - Scroll scrubs the turntable through the shared scroll controller.
 *   With data-scroll-root (pinned hero): the named ancestor is a tall
 *   scroll-jack wrapper whose sticky child holds the hero on screen —
 *   progress 0→1 through the pinned range is exactly one full turn, so
 *   the bottle cannot leave until the rotation completes.
 *   Without it: progress across the element's own viewport trip, anchored
 *   so the first paint is label-forward (frame 0).
 * - Grab-to-rotate: horizontal pointer drags spin the bottle with flick
 *   inertia; after a hands-off delay it eases back to label-forward.
 *   touch-action: pan-y (hero stylesheet) keeps vertical swipes scrolling.
 * - Reduced motion: draws frame 0 once, no listeners.
 *
 * The static fallback photo underneath fades out once the first frame paints
 * (element gains [data-active]).
 */

import { onScrollProgress, smoothProgress, prefersReducedMotion } from '@tamarinse/scroll-controller';

const MOBILE_QUERY = '(max-width: 749px)';

/* One full turn across the hero's viewport trip. */
const SCROLL_TURNS = 1;

/* ---- Grab-to-rotate tuning (matches the retired WebGL jar) ---- */
/* A drag across the full element width spins the bottle this many turns. */
const DRAG_TURNS_PER_WIDTH = 1.4;
/* Flick inertia: exponential decay rate and velocity floor/cap (turns/s). */
const SPIN_DAMPING = 2.4;
const SPIN_MIN = 0.01;
const SPIN_MAX = 1.6;
/* Hands-off delay before easing back to label-forward. */
const RETURN_DELAY_MS = 1600;
const RETURN_RATE = 3.2;

class TamarinseBottleSequence extends HTMLElement {
  #dispose = null;
  #smoother = null;
  #frames = [];
  #variant = null;
  #frameCount = 0;
  #currentIndex = -1;
  #loadingStarted = false;
  #mediaQuery = null;
  #onMediaChange = null;
  #resizeObserver = null;

  /* Rotation state, all in "turns" (1 = full revolution) */
  #anchor = null;
  #scrollTurns = 0;
  #userTurns = 0;

  /* Drag state */
  #dragging = false;
  #pointerId = null;
  #lastX = 0;
  #lastDragTime = 0;
  #spinVelocity = 0;
  #rafId = null;
  #returnTimer = null;
  #returning = false;

  connectedCallback() {
    this.#frameCount = parseInt(this.dataset.frameCount, 10) || 0;

    this.#mediaQuery = window.matchMedia(MOBILE_QUERY);
    this.#onMediaChange = () => this.#setVariant(this.#mediaQuery.matches ? 'mobile' : 'desktop');
    this.#mediaQuery.addEventListener('change', this.#onMediaChange);
    this.#setVariant(this.#mediaQuery.matches ? 'mobile' : 'desktop');

    this.#resizeObserver = new ResizeObserver(() => this.#syncCanvasSize());
    this.#resizeObserver.observe(this);
    this.#syncCanvasSize();

    const pinRoot = this.dataset.scrollRoot ? this.closest(this.dataset.scrollRoot) : null;

    if (prefersReducedMotion()) {
      /* Static label-forward pose — first frame paints via #loadFrames.
         Collapse the scroll-jack wrapper so there's no dead scroll range. */
      if (pinRoot) pinRoot.setAttribute('data-static', '');
      return;
    }

    /* Low-pass filter between raw scroll and the turntable (iOS Safari:
       toolbar-collapse progress jumps and flick over-sensitivity ease out
       over a few frames instead of snapping frames). Rate 10 keeps the
       rotation feeling directly tied to the finger. */
    this.#smoother = smoothProgress((turns) => {
      this.#scrollTurns = turns;
      this.#render();
    }, 10);

    if (pinRoot) {
      /* Pinned mode: progress through the wrapper's sticky range = one turn.
         The first callback anchors the rotation at the load position, so the
         bottle ALWAYS starts label-forward (frame 0) — including mobile
         Safari loads that restore a scroll position partway into the pin. */
      this.#dispose = onScrollProgress(
        pinRoot,
        (progress) => {
          if (this.#anchor === null) this.#anchor = progress;
          this.#smoother.set((progress - this.#anchor) * SCROLL_TURNS);
        },
        { mode: 'pin' }
      );
    } else {
      this.#dispose = onScrollProgress(this, (progress, rect) => {
        if (this.#anchor === null) this.#anchor = this.#anchorProgress(rect);
        this.#smoother.set((progress - this.#anchor) * SCROLL_TURNS);
      });
    }

    const canvas = this.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', this.#onPointerDown);
      canvas.addEventListener('pointermove', this.#onPointerMove);
      canvas.addEventListener('pointerup', this.#onPointerEnd);
      canvas.addEventListener('pointercancel', this.#onPointerEnd);
    }
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
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
    clearTimeout(this.#returnTimer);
    const canvas = this.querySelector('canvas');
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.#onPointerDown);
      canvas.removeEventListener('pointermove', this.#onPointerMove);
      canvas.removeEventListener('pointerup', this.#onPointerEnd);
      canvas.removeEventListener('pointercancel', this.#onPointerEnd);
    }
    this.#frames = [];
  }

  /* The rotation anchor is the progress this element would report at the
     very top of the page, so a fresh visitor always starts label-forward
     (frame 0) — even when the browser restores a scroll position and the
     first callback fires mid-page. */
  #anchorProgress(rect) {
    const wrapper = document.querySelector('.page-wrapper');
    const scrollTop =
      wrapper && /auto|scroll/.test(getComputedStyle(wrapper).overflowY)
        ? wrapper.scrollTop
        : window.scrollY;
    const viewport = window.innerHeight;
    const topAtPageTop = rect.top + scrollTop;
    return (viewport - topAtPageTop) / (rect.height + viewport);
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
        if (this.#variant !== variant) return;
        /* Paint as soon as the frame the viewport is waiting on arrives */
        if (i === Math.max(0, this.#currentIndex)) this.#draw(i, true);
      };
      this.#frames[i] = img;
    }
  }

  /* ── Canvas ── */

  #syncCanvasSize() {
    const canvas = this.querySelector('canvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this.#draw(Math.max(0, this.#currentIndex), true);
    }
  }

  #render() {
    const total = this.#scrollTurns + this.#userTurns;
    const index =
      ((Math.round(total * this.#frameCount) % this.#frameCount) + this.#frameCount) %
      this.#frameCount;
    this.#draw(index);
  }

  #draw(index, force = false) {
    if (!force && index === this.#currentIndex) return;
    const canvas = this.querySelector('canvas');
    const img = this.#frames[index];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) {
      this.#currentIndex = index;
      return;
    }
    this.#currentIndex = index;

    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    /* contain-fit, centered — the frames carry their own contact shadow */
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);

    /* Exposed for QA/debugging — which turntable frame is on screen */
    this.setAttribute('data-frame', index);
    if (!this.hasAttribute('data-active')) this.setAttribute('data-active', '');
  }

  /* ── Grab-to-rotate ── */

  #onPointerDown = (event) => {
    if (!event.isPrimary) return;
    this.#dragging = true;
    this.#pointerId = event.pointerId;
    this.#lastX = event.clientX;
    this.#lastDragTime = performance.now();
    this.#spinVelocity = 0;
    this.#returning = false;
    clearTimeout(this.#returnTimer);
    this.setAttribute('data-grabbing', '');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  #onPointerMove = (event) => {
    if (!this.#dragging || event.pointerId !== this.#pointerId) return;
    const dx = event.clientX - this.#lastX;
    this.#lastX = event.clientX;

    const width = this.getBoundingClientRect().width || 1;
    const deltaTurns = (dx / width) * DRAG_TURNS_PER_WIDTH;
    this.#userTurns += deltaTurns;

    const now = performance.now();
    const dt = Math.max(1, now - this.#lastDragTime) / 1000;
    this.#lastDragTime = now;
    this.#spinVelocity = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, deltaTurns / dt));

    this.#render();
  };

  #onPointerEnd = (event) => {
    if (event.pointerId !== this.#pointerId) return;
    this.#dragging = false;
    this.#pointerId = null;
    this.removeAttribute('data-grabbing');

    /* Stale flick guard: if the pointer rested before release, don't spin */
    if (performance.now() - this.#lastDragTime > 120) this.#spinVelocity = 0;

    if (Math.abs(this.#spinVelocity) > SPIN_MIN) {
      this.#startMotionLoop();
    } else {
      this.#spinVelocity = 0;
      this.#scheduleReturn();
    }
  };

  #scheduleReturn() {
    clearTimeout(this.#returnTimer);
    if (this.#userTurns === 0) return;
    this.#returnTimer = setTimeout(() => {
      this.#returning = true;
      this.#startMotionLoop();
    }, RETURN_DELAY_MS);
  }

  /* Runs only while inertia or the return ease is active */
  #startMotionLoop() {
    if (this.#rafId !== null) return;
    let last = performance.now();

    const tick = (now) => {
      this.#rafId = null;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      let active = false;

      if (Math.abs(this.#spinVelocity) > SPIN_MIN) {
        this.#userTurns += this.#spinVelocity * dt;
        this.#spinVelocity *= Math.exp(-SPIN_DAMPING * dt);
        active = true;
        if (Math.abs(this.#spinVelocity) <= SPIN_MIN) {
          this.#spinVelocity = 0;
          this.#scheduleReturn();
        }
      } else if (this.#returning) {
        /* Ease the combined rotation to the nearest whole turn so the
           label faces forward again. */
        const total = this.#scrollTurns + this.#userTurns;
        const target = Math.round(total) - this.#scrollTurns;
        const delta = target - this.#userTurns;
        if (Math.abs(delta) < 0.002) {
          this.#userTurns = target;
          this.#returning = false;
        } else {
          this.#userTurns += delta * Math.min(1, RETURN_RATE * dt);
          active = true;
        }
      }

      this.#render();
      if (active && !this.#dragging) {
        this.#rafId = requestAnimationFrame(tick);
      }
    };

    this.#rafId = requestAnimationFrame(tick);
  }
}

if (!customElements.get('tamarinse-bottle-sequence')) {
  customElements.define('tamarinse-bottle-sequence', TamarinseBottleSequence);
}
