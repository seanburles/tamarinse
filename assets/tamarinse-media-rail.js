/*
  <tamarinse-media-rail> — shared horizontal rail behavior (gallery, stories, reviews).
  On desktop it drifts slowly while on screen; any intentional interaction
  (pointer, wheel, touch, keyboard, arrows) permanently hands control back
  to the visitor. On mobile we keep the rail parked on the first card —
  auto-drift was finishing the carousel before the section was in view.
  Respects prefers-reduced-motion.
*/
if (!customElements.get('tamarinse-media-rail')) {
  customElements.define(
    'tamarinse-media-rail',
    class extends HTMLElement {
      /* px per second — a slow, ignorable drift, independent of refresh rate */
      static DRIFT = 24;

      #raf = null;
      #paused = false;
      #userTookOver = false;

      connectedCallback() {
        this.rail = this.querySelector('[data-rail]');
        if (!this.rail) return;

        const stop = () => {
          this.#userTookOver = true;
          this.#halt();
        };
        /* Any intentional interaction permanently ends the auto-drift. */
        ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((type) =>
          this.rail.addEventListener(type, stop, { passive: true })
        );
        this.addEventListener('mouseenter', () => (this.#paused = true));
        this.addEventListener('mouseleave', () => (this.#paused = false));

        this.querySelector('[data-rail-prev]')?.addEventListener('click', () => this.#page(-1));
        this.querySelector('[data-rail-next]')?.addEventListener('click', () => this.#page(1));

        const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        /* Touch / narrow viewports: no auto-drift — it races ahead of scroll. */
        const allowDrift =
          !reduceMotion && matchMedia('(min-width: 750px) and (pointer: fine)').matches;

        if ('IntersectionObserver' in window) {
          this.observer = new IntersectionObserver(
            (entries) => {
              const visible = entries[0]?.isIntersecting;
              if (!visible) {
                this.#halt();
                return;
              }
              if (this.#userTookOver) return;

              /* Land on the first card when the section arrives on screen */
              this.#halt();
              this.rail.scrollLeft = 0;

              if (allowDrift) this.#start();
            },
            {
              /* Wait until the rail is well into view — not a bottom peek */
              threshold: 0.55,
              rootMargin: '0px 0px -18% 0px',
            }
          );
          this.observer.observe(this);
        } else if (!this.#userTookOver) {
          this.rail.scrollLeft = 0;
        }
      }

      disconnectedCallback() {
        this.#halt();
        this.observer?.disconnect();
      }

      #start() {
        if (this.#raf) return;
        /* Snap points would hijack each programmatic scrollLeft write,
           so suspend snapping while the drift owns the scroll. */
        this.rail.style.scrollSnapType = 'none';
        /* Float accumulator — scrollLeft reads round to integers, so a
           sub-pixel increment would otherwise snap back every frame. */
        let pos = this.rail.scrollLeft;
        let last = performance.now();
        const step = (now) => {
          const dt = Math.min(now - last, 100) / 1000;
          last = now;
          if (!this.#paused) {
            /* Re-sync if something else (resize, hash jump) moved the rail. */
            if (Math.abs(this.rail.scrollLeft - pos) > 2) pos = this.rail.scrollLeft;
            const max = this.rail.scrollWidth - this.rail.clientWidth;
            if (pos >= max - 1) {
              this.#halt();
              return;
            }
            pos += this.constructor.DRIFT * dt;
            this.rail.scrollLeft = pos;
          }
          this.#raf = requestAnimationFrame(step);
        };
        this.#raf = requestAnimationFrame(step);
      }

      #halt() {
        if (this.#raf) cancelAnimationFrame(this.#raf);
        this.#raf = null;
        this.rail.style.scrollSnapType = '';
      }

      #page(direction) {
        this.#userTookOver = true;
        this.#halt();
        this.rail.scrollBy({ left: direction * this.rail.clientWidth * 0.7, behavior: 'smooth' });
      }
    }
  );
}
