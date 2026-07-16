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
 *
 * Inner nodes are queried on every update, never cached: theme-dev hot
 * reloads and Horizon soft navigations morph section DOM in place, which
 * turns cached child references into detached nodes (the "pins but nothing
 * shows" bug). Attributes are also re-applied every frame so a morph that
 * strips them heals on the next scroll tick.
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

  connectedCallback() {
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

  #easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

if (!customElements.get('tamarinse-capsule-sequence')) {
  customElements.define('tamarinse-capsule-sequence', TamarinseCapsuleSequence);
}
