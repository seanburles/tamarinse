/**
 * <tamarinse-exposure-result> — shows a quiz result carried over from
 * another page (client 2026-07-21: "after the quiz it should take you to the
 * product page and show the results there").
 *
 * The Exposure Assessment hands the tier off as a 1-based index on the URL
 * (?exposure=3) rather than a label, so renaming a tier in the theme editor
 * can never desync the two sections. This element reveals the matching
 * panel and does nothing at all when the parameter is absent — a direct
 * visit to the product page is completely unaffected.
 *
 * The parameter is treated as untrusted: it is coerced to an integer and
 * used only to look up a pre-rendered panel, never injected into the DOM.
 */

class TamarinseExposureResult extends HTMLElement {
  connectedCallback() {
    let tier = null;
    try {
      tier = new URLSearchParams(window.location.search).get('exposure');
    } catch (error) {
      return; /* malformed query string — stay hidden */
    }
    if (!tier) return;

    const index = Number.parseInt(tier, 10);
    if (!Number.isInteger(index) || index < 1) return;

    const panel = this.querySelector(`[data-tier="${index}"]`);
    if (!panel) return;

    panel.hidden = false;
    this.setAttribute('data-active', '');

    /* Announce it for assistive tech — the visitor arrived expecting a
       result, so it should be read even though it appeared on load. */
    panel.setAttribute('role', 'status');
  }
}

if (!customElements.get('tamarinse-exposure-result')) {
  customElements.define('tamarinse-exposure-result', TamarinseExposureResult);
}
