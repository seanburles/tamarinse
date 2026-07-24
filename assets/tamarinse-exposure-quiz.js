/**
 * <tamarinse-exposure-quiz> — stepped Exposure Assessment.
 *
 * One question per screen with a slim progress bar, icon answer cards, and a
 * single Continue CTA. Steps, options, and weights come from the rendered DOM
 * (section blocks), never from a hardcoded array (BUILD_GUIDE section 4).
 * The weighted-sum logic is pure and lives in scoreExposure() so it stays
 * testable. Step transitions are CSS animations keyed off data-entering
 * (forward|back); reduced-motion users get instant swaps via the stylesheet.
 *
 * All listeners are DELEGATED on the custom element and every inner element
 * is queried lazily. There is deliberately NO <form> element — a plain <div>
 * wraps the fieldsets instead — so that Shopify-injected scripts, view
 * transitions, or any other external code can never trigger a form submission
 * and cause full-page navigation (the "white screen slide" bug).
 */

/**
 * @param {number} total - sum of checked weights
 * @param {number} max - sum of all weights
 * @param {{ tier: string, threshold: number, text?: string }[]} tiers -
 *   ascending thresholds (fraction of max at which the tier starts)
 * @returns {{ tier: string, threshold: number, text?: string } | null}
 *   the matched tier entry (label + optional per-tier result copy)
 */
export function scoreExposure(total, max, tiers) {
  const ratio = max > 0 ? total / max : 0;
  let result = tiers[0] || null;
  for (const entry of tiers) {
    if (ratio >= entry.threshold) result = entry;
  }
  return result;
}

class TamarinseExposureQuiz extends HTMLElement {
  #current = 0;

  #onClick = (event) => {
    if (event.target.closest('[data-quiz-next]')) {
      event.stopPropagation();
      if (this.#current >= this.#steps().length - 1) {
        this.#showResult();
      } else {
        this.#goTo(this.#current + 1, 'forward');
      }
      return;
    }

    const option = event.target.closest('.tamarinse-quiz__option');
    if (option) {
      event.stopPropagation();
      const cb = option.querySelector('.tamarinse-quiz__checkbox');
      if (cb) cb.focus({ preventScroll: true });
      return;
    }

    if (event.target.closest('[data-quiz-back]')) {
      if (this.#current > 0) this.#goTo(this.#current - 1, 'back');
    } else if (event.target.closest('[data-quiz-reset]')) {
      event.preventDefault();
      this.#reset();
    }
  };

  /** Block change events on quiz checkboxes from reaching external handlers
   *  (Shopify-injected scripts, analytics, etc.) that might misinterpret a
   *  toggle as a filter/form change and trigger page navigation. Uses the
   *  capture phase so it fires before any document-level capture listeners. */
  #onFieldChange = (event) => {
    event.stopImmediatePropagation();
  };

  connectedCallback() {
    this.addEventListener('click', this.#onClick);
    this.addEventListener('change', this.#onFieldChange, true);
    queueMicrotask(() => this.#sync());
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('change', this.#onFieldChange, true);
  }

  #steps() {
    return Array.from(this.querySelectorAll('[data-quiz-step]'));
  }

  #checkboxes() {
    return Array.from(this.querySelectorAll('input[type="checkbox"][data-weight]'));
  }

  #tiers() {
    try {
      return JSON.parse(this.getAttribute('data-tiers') || '[]');
    } catch (error) {
      return [];
    }
  }

  #goTo(index, direction) {
    this.#current = Math.min(Math.max(index, 0), this.#steps().length - 1);
    this.#sync(direction);

    /* Move focus to the question so keyboard/AT users land on the new screen. */
    const question = this.#steps()[this.#current]?.querySelector('legend');
    question?.focus({ preventScroll: true });
  }

  /** Reflect #current into visibility, progress, and button labels. */
  #sync(direction = null) {
    const steps = this.#steps();
    steps.forEach((step, index) => {
      const active = index === this.#current;
      step.hidden = !active;
      if (active && direction) {
        step.setAttribute('data-entering', direction);
      } else {
        step.removeAttribute('data-entering');
      }
    });

    const position = this.#current + 1;
    const total = steps.length;
    const progressLabel = this.querySelector('[data-quiz-progress-label]');
    if (progressLabel) progressLabel.textContent = `${position} of ${total}`;
    this.querySelector('[data-quiz-progress-bar]')?.setAttribute('aria-valuenow', String(position));
    const progressFill = this.querySelector('[data-quiz-progress-fill]');
    if (progressFill) progressFill.style.width = `${(position / total) * 100}%`;

    const last = this.#current >= total - 1;
    const nextButton = this.querySelector('[data-quiz-next]');
    if (nextButton) {
      nextButton.textContent = last
        ? this.getAttribute('data-submit-label') || 'See my result'
        : this.getAttribute('data-continue-label') || 'Continue';
    }
    const backButton = this.querySelector('[data-quiz-back]');
    if (backButton) backButton.hidden = this.#current === 0;
  }

  #showResult() {
    const boxes = this.#checkboxes();
    const max = boxes.reduce((sum, box) => sum + Number(box.dataset.weight || 1), 0);
    const total = boxes.reduce(
      (sum, box) => sum + (box.checked ? Number(box.dataset.weight || 1) : 0),
      0
    );

    const tiers = this.#tiers();
    const match = scoreExposure(total, max, tiers);

    /* "On the product page" mode: hand the result off and navigate, instead
       of revealing it here. The tier travels as a 1-based INDEX so renaming
       a tier in the theme editor can't desync the two sections. */
    const target = this.getAttribute('data-result-url');
    if (this.getAttribute('data-result-mode') === 'product' && target) {
      const index = tiers.indexOf(match) + 1;
      const url = new URL(target, window.location.origin);
      if (index > 0) url.searchParams.set('exposure', String(index));
      window.location.assign(url.toString());
      return;
    }

    const tierLabel = this.querySelector('[data-quiz-tier]');
    if (tierLabel) tierLabel.textContent = match?.tier || '';

    /* Per-tier supporting copy — every tier closes with the product
       recommendation, worded for that exposure level. */
    const resultText = this.querySelector('[data-quiz-result-text]');
    if (resultText && match?.text) resultText.textContent = match.text;

    this.setAttribute('data-state', 'result');
    const result = this.querySelector('[data-quiz-result]');
    result?.focus({ preventScroll: true });
    result?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  #reset() {
    for (const box of this.#checkboxes()) box.checked = false;
    this.removeAttribute('data-state');
    this.#goTo(0, 'back');
  }
}

if (!customElements.get('tamarinse-exposure-quiz')) {
  customElements.define('tamarinse-exposure-quiz', TamarinseExposureQuiz);
}
