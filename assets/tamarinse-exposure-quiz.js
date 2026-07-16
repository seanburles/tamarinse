/**
 * <tamarinse-exposure-quiz> — Exposure Assessment widget.
 *
 * Self-contained state machine: questions → weighted score → result tier.
 * Question list and weights come from the rendered DOM (section blocks),
 * never from a hardcoded array (BUILD_GUIDE section 4). The weighted-sum
 * logic itself is pure and lives in scoreExposure() so it stays testable.
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
  #onChange = (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      this.#updateCount();
    }
  };

  #onSubmit = (event) => {
    event.preventDefault();
    this.#showResult();
  };

  #onReset = (event) => {
    event.preventDefault();
    this.#reset();
  };

  connectedCallback() {
    this.#form = this.querySelector('form');
    this.#result = this.querySelector('[data-quiz-result]');
    this.#tierLabel = this.querySelector('[data-quiz-tier]');
    this.#count = this.querySelector('[data-quiz-count]');

    this.#form?.addEventListener('change', this.#onChange);
    this.#form?.addEventListener('submit', this.#onSubmit);
    this.querySelector('[data-quiz-reset]')?.addEventListener('click', this.#onReset);
    this.#updateCount();
  }

  disconnectedCallback() {
    this.#form?.removeEventListener('change', this.#onChange);
    this.#form?.removeEventListener('submit', this.#onSubmit);
  }

  #form = null;
  #result = null;
  #tierLabel = null;
  #count = null;

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

  #updateCount() {
    if (!this.#count) return;
    const checked = this.#checkboxes().filter((box) => box.checked).length;
    this.#count.textContent = String(checked);
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
    this.#result?.focus({ preventScroll: false });
    this.#result?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  #reset() {
    for (const box of this.#checkboxes()) box.checked = false;
    this.removeAttribute('data-state');
    this.#updateCount();
  }
}

if (!customElements.get('tamarinse-exposure-quiz')) {
  customElements.define('tamarinse-exposure-quiz', TamarinseExposureQuiz);
}
