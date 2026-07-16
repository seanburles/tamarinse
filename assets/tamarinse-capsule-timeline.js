/**
 * <tamarinse-capsule-sequence> — the signature scroll-driven capsule section.
 *
 * A tall wrapper pins a full-viewport stage. As the visitor scrolls:
 *   phase "closed"     capsule sits whole
 *   phase "open"       halves separate, layer-one (delayed-release) copy shows
 *   phase "ingredient" six ingredients reveal one at a time between the halves
 *   phase "closing"    capsule smoothly closes
 *
 * All motion is scroll-mapped through the shared scroll controller — nothing
 * loops, nothing autoplays (style contract). Reduced motion: the capsule
 * renders open with the ingredient list shown statically; the browser's
 * normal scroll does the rest.
 */

import { onScrollProgress, prefersReducedMotion } from '@tamarinse/scroll-controller';

/* Progress map (fractions of the pinned range) */
const OPEN_START = 0.02;
const OPEN_END = 0.16;
const INGREDIENTS_START = 0.2;
const INGREDIENTS_END = 0.86;
const CLOSE_START = 0.9;

class TamarinseCapsuleSequence extends HTMLElement {
  #dispose = null;
  #items = [];
  #dots = [];
  #activeIndex = -1;

  connectedCallback() {
    this.#items = Array.from(this.querySelectorAll('[data-capsule-ingredient]'));
    this.#dots = Array.from(this.querySelectorAll('[data-capsule-dot]'));

    if (prefersReducedMotion()) {
      this.setAttribute('data-static', '');
      return;
    }

    this.#dispose = onScrollProgress(
      this,
      (progress) => this.#update(progress),
      { mode: 'pin' }
    );
  }

  disconnectedCallback() {
    if (this.#dispose) this.#dispose();
    this.#dispose = null;
  }

  #update(progress) {
    /* Separation amount: 0 closed → 1 fully open */
    let separation;
    if (progress < OPEN_START) {
      separation = 0;
    } else if (progress < OPEN_END) {
      separation = (progress - OPEN_START) / (OPEN_END - OPEN_START);
    } else if (progress < CLOSE_START) {
      separation = 1;
    } else {
      separation = 1 - (progress - CLOSE_START) / (1 - CLOSE_START);
    }
    this.style.setProperty('--capsule-separation', this.#easeInOut(separation).toFixed(4));

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
    let index = -1;
    if (phase === 'ingredient' && this.#items.length > 0) {
      const span = (INGREDIENTS_END - INGREDIENTS_START) / this.#items.length;
      index = Math.min(
        this.#items.length - 1,
        Math.floor((progress - INGREDIENTS_START) / span)
      );
    } else if (phase === 'after') {
      index = this.#items.length - 1;
    }

    if (index !== this.#activeIndex) {
      this.#activeIndex = index;
      this.#items.forEach((item, i) => {
        item.toggleAttribute('data-active', i === index);
      });
      this.#dots.forEach((dot, i) => {
        dot.toggleAttribute('data-active', i <= index && index > -1);
      });
    }
  }

  #easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

if (!customElements.get('tamarinse-capsule-sequence')) {
  customElements.define('tamarinse-capsule-sequence', TamarinseCapsuleSequence);
}
