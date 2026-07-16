/**
 * <tamarinse-exposure-quiz> — stepped Exposure Assessment.
 *
 * One question per screen with a slim progress bar, icon answer cards, and a
 * single Continue CTA. Steps, options, and weights come from the rendered DOM
 * (section blocks), never from a hardcoded array (BUILD_GUIDE section 4).
 * The weighted-sum logic is pure and lives in scoreExposure() so it stays
 * testable. Step transitions are CSS animations keyed off data-entering
 * (forward|back); reduced-motion users get instant swaps via the stylesheet.
 */

/**
 * @param {number} total - sum of checked weights
 * @param {number} max - sum of all weights
 * @param {{ tier: string, threshold: number }[]} tiers - ascending thresholds
 *   (fraction of max at which the tier starts)
 * @returns {string} tier label
 */
export function scoreExposure(total, max, tiers) {
  const ratio = max > 0 ? total / max : 0;
  let result = tiers[0]?.tier || '';
  for (const { tier, threshold } of tiers) {
    if (ratio >= threshold) result = tier;
  }
  return result;
}

class TamarinseExposureQuiz extends HTMLElement {
  #form = null;
  #result = null;
  #tierLabel = null;
  #nextButton = null;
  #backButton = null;
  #progressLabel = null;
  #progressBar = null;
  #progressFill = null;
  #steps = [];
  #current = 0;

  #onSubmit = (event) => {
    event.preventDefault();
    if (this.#current >= this.#steps.length - 1) {
      this.#showResult();
    } else {
      this.#goTo(this.#current + 1, 'forward');
    }
  };

  #onBack = () => {
    if (this.#current > 0) this.#goTo(this.#current - 1, 'back');
  };

  #onReset = (event) => {
    event.preventDefault();
    this.#reset();
  };

  connectedCallback() {
    this.#form = this.querySelector('form');
    this.#result = this.querySelector('[data-quiz-result]');
    this.#tierLabel = this.querySelector('[data-quiz-tier]');
    this.#nextButton = this.querySelector('[data-quiz-next]');
    this.#backButton = this.querySelector('[data-quiz-back]');
    this.#progressLabel = this.querySelector('[data-quiz-progress-label]');
    this.#progressBar = this.querySelector('[data-quiz-progress-bar]');
    this.#progressFill = this.querySelector('[data-quiz-progress-fill]');
    this.#steps = Array.from(this.querySelectorAll('[data-quiz-step]'));

    this.#form?.addEventListener('submit', this.#onSubmit);
    this.#backButton?.addEventListener('click', this.#onBack);
    this.querySelector('[data-quiz-reset]')?.addEventListener('click', this.#onReset);
    this.#sync();
  }

  disconnectedCallback() {
    this.#form?.removeEventListener('submit', this.#onSubmit);
    this.#backButton?.removeEventListener('click', this.#onBack);
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
    this.#current = Math.min(Math.max(index, 0), this.#steps.length - 1);
    this.#sync(direction);

    /* Move focus to the question so keyboard/AT users land on the new screen. */
    const question = this.#steps[this.#current]?.querySelector('legend');
    question?.focus({ preventScroll: true });
  }

  /** Reflect #current into visibility, progress, and button labels. */
  #sync(direction = null) {
    this.#steps.forEach((step, index) => {
      const active = index === this.#current;
      step.hidden = !active;
      if (active && direction) {
        step.setAttribute('data-entering', direction);
      } else {
        step.removeAttribute('data-entering');
      }
    });

    const position = this.#current + 1;
    const total = this.#steps.length;
    if (this.#progressLabel) this.#progressLabel.textContent = `${position} of ${total}`;
    this.#progressBar?.setAttribute('aria-valuenow', String(position));
    if (this.#progressFill) this.#progressFill.style.width = `${(position / total) * 100}%`;

    const last = this.#current >= total - 1;
    if (this.#nextButton) {
      this.#nextButton.textContent = last
        ? this.getAttribute('data-submit-label') || 'See my result'
        : this.getAttribute('data-continue-label') || 'Continue';
    }
    if (this.#backButton) this.#backButton.hidden = this.#current === 0;
  }

  #showResult() {
    const boxes = this.#checkboxes();
    const max = boxes.reduce((sum, box) => sum + Number(box.dataset.weight || 1), 0);
    const total = boxes.reduce(
      (sum, box) => sum + (box.checked ? Number(box.dataset.weight || 1) : 0),
      0
    );

    const tier = scoreExposure(total, max, this.#tiers());
    if (this.#tierLabel) this.#tierLabel.textContent = tier;

    this.setAttribute('data-state', 'result');
    this.#result?.focus({ preventScroll: true });
    this.#result?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
