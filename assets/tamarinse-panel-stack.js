/**
 * <tamarinse-panel-stack> — shared scroll-pinned card-deck reveal.
 *
 * A tall wrapper pins a full-viewport stage. Inside it, each
 * [data-stack-card] covers the previous one as the visitor scrolls: the
 * incoming card slides up as an inset rounded "card", settles to full
 * bleed, and the outgoing card recedes (scales down, rounds, dims). Copy
 * inside each card scrubs in with a stagger — everything is driven by two
 * CSS custom properties this element writes per card:
 *
 *   --stack-enter  0 → 1 while the card slides in and settles
 *   --stack-exit   0 → 1 while the next card covers it
 *
 * All motion is scroll-mapped through the shared scroll controller —
 * nothing loops, nothing autoplays (style contract). Reduced motion: the
 * element sets data-static and the cards render as a plain stacked flow.
 *
 * Used by "The Problem" and "Everyday Exposure" (tamarinse-panel-stack.css
 * holds the shared card styles). Inner nodes are queried on every update,
 * never cached: theme-dev hot reloads morph section DOM in place, which
 * turns cached child references into detached nodes.
 */

import { onScrollProgress, smoothProgress, prefersReducedMotion } from '@tamarinse/scroll-controller';

/* Top fraction of each card's scroll unit reserved for reading (the card
   is fully settled and nothing moves). The remaining fraction is the
   slide + settle transition. Raised from 0.28 (client 2026-07-18): more
   settled reading time per card = the deck feels slower and less touchy. */
const HOLD = 0.34;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

class TamarinsePanelStack extends HTMLElement {
  #dispose = null;
  #smoother = null;

  connectedCallback() {
    if (prefersReducedMotion()) {
      this.setAttribute('data-static', '');
      return;
    }
    /* Raw scroll progress goes through a low-pass filter before it drives
       the cards: micro-flicks and iOS viewport-resize jumps become short
       eases instead of instant snaps (the "too sensitive / glitchy" fix). */
    this.#smoother = smoothProgress((progress) => this.#update(progress), 7);
    this.#dispose = onScrollProgress(this, (progress) => this.#smoother.set(progress), {
      mode: 'pin',
    });
  }

  disconnectedCallback() {
    if (this.#dispose) this.#dispose();
    this.#dispose = null;
    if (this.#smoother) this.#smoother.dispose();
    this.#smoother = null;
  }

  #update(progress) {
    const cards = this.querySelectorAll('[data-stack-card]');
    const count = cards.length;
    if (count === 0) return;

    /* Overall pin progress, exposed for section-level overlays (e.g. the
       Problem intro title) to choreograph their own in/out windows. */
    this.style.setProperty('--stack-progress', progress.toFixed(4));

    /* Map overall pin progress onto card units: card i enters over
       p ∈ [i-1, i-HOLD] and is covered over p ∈ [i, i+1-HOLD]. */
    const p = progress * (count - 1);
    let active = 0;

    cards.forEach((card, i) => {
      const enter = i === 0 ? 1 : clamp01((p - (i - 1)) / (1 - HOLD));
      const exit = i >= count - 1 ? 0 : clamp01((p - i) / (1 - HOLD));
      card.style.setProperty('--stack-enter', easeInOut(enter).toFixed(4));
      card.style.setProperty('--stack-exit', easeInOut(exit).toFixed(4));
      if (enter >= 0.5) active = i;
    });

    this.querySelectorAll('[data-stack-tick]').forEach((tick, i) => {
      tick.toggleAttribute('data-active', i === active);
    });

    const index = this.querySelector('[data-stack-index]');
    if (index) {
      const label = String(active + 1).padStart(2, '0');
      if (index.textContent !== label) index.textContent = label;
    }
  }
}

if (!customElements.get('tamarinse-panel-stack')) {
  customElements.define('tamarinse-panel-stack', TamarinsePanelStack);
}
