/**
 * <tamarinse-bottle-scene> — isolated WebGL hero bottle.
 *
 * Spec (MASTER_PROMPT.md):
 * - lazy-init: Three.js scene is only constructed when the element nears the
 *   viewport; render loop pauses entirely (not just hides) when off screen.
 * - idle state: continuous Y rotation, one turn per --t-bottle-period
 *   (default 24s), delta-time driven so speed is frame-rate independent.
 * - scroll state: progress from the shared scroll controller eases the bottle
 *   to a label-forward pose and locks it.
 * - fallbacks: prefers-reduced-motion → static label-forward pose (one frame,
 *   no loop). Low device tier / no WebGL → static fallback image, proactively.
 * - disposal: geometry/material/texture/renderer all released in
 *   disconnectedCallback. No leaks when scrolled past and back.
 *
 * Model: until the client supplies the real Draco-compressed GLB
 * (BUILD_GUIDE open decisions), a procedural placeholder bottle is built from
 * primitives with a canvas-drawn minimal label. Swap point is clearly marked
 * in #buildBottle().
 */

import {
  onScrollProgress,
  onNearViewport,
  onVisibilityChange,
  prefersReducedMotion,
  deviceTier,
  cappedPixelRatio,
} from '@tamarinse/scroll-controller';

const TWO_PI = Math.PI * 2;
/* Rotation (radians) at which the label faces the camera. The procedural
   label is drawn centered on +Z, so label-forward is 0. */
const LABEL_FORWARD = 0;
/* Portion of the scroll range used to blend idle → locked. */
const LOCK_START = 0.05;
const LOCK_END = 0.5;

class TamarinseBottleScene extends HTMLElement {
  #three = null;
  #renderer = null;
  #scene = null;
  #camera = null;
  #bottle = null;
  #disposers = [];
  #rafId = null;
  #lastTime = 0;
  #idleRotation = 0.6; /* start slightly off-label so the settle is visible */
  #scrollBlend = 0;
  #lockBase = null;
  #visible = false;
  #initialized = false;
  #staticPose = false;

  connectedCallback() {
    if (prefersReducedMotion()) {
      this.#staticPose = true;
    }

    if (deviceTier() === 'low') {
      this.#showFallback();
      return;
    }

    this.#disposers.push(
      onNearViewport(this, () => this.#init(), '50% 0px')
    );
  }

  disconnectedCallback() {
    this.#teardown();
  }

  #showFallback() {
    this.setAttribute('data-fallback-active', '');
  }

  async #init() {
    if (this.#initialized) return;
    this.#initialized = true;

    try {
      this.#three = await import('three');
    } catch (error) {
      this.#showFallback();
      return;
    }

    if (!this.isConnected) return;

    const THREE = this.#three;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(cappedPixelRatio());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.classList.add('tamarinse-bottle-scene__canvas');
    this.#renderer = renderer;

    const scene = new THREE.Scene();
    this.#scene = scene;

    /* Framing: bottle (~3 units tall) occupies just over half the viewport
       height, centered slightly above middle so hero copy clears the base. */
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.2, 11);
    camera.lookAt(0, 0.2, 0);
    this.#camera = camera;

    /* Studio lighting: soft key + rim (spec) + gentle fill. */
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
    key.position.set(2.5, 3, 4);
    const rim = new THREE.DirectionalLight(0xf7f5f0, 3.2);
    rim.position.set(-3, 2, -4);
    const fill = new THREE.HemisphereLight(0xf7f5f0, 0x1a120c, 0.9);
    scene.add(key, rim, fill);

    this.#bottle = this.#buildBottle(THREE);
    scene.add(this.#bottle);

    this.appendChild(renderer.domElement);
    this.setAttribute('data-webgl-active', '');

    this.#resize();
    const resizeObserver = new ResizeObserver(() => this.#resize());
    resizeObserver.observe(this);
    this.#disposers.push(() => resizeObserver.disconnect());

    /* Scroll-linked label lock, driven by the pinned hero wrapper. */
    const scrollRootSelector = this.getAttribute('data-scroll-root');
    const scrollRoot = scrollRootSelector ? this.closest(scrollRootSelector) : null;
    if (scrollRoot) {
      this.#disposers.push(
        onScrollProgress(
          scrollRoot,
          (progress) => {
            const raw = (progress - LOCK_START) / (LOCK_END - LOCK_START);
            this.#scrollBlend = Math.min(1, Math.max(0, raw));
            if (this.#staticPose) this.#renderFrame();
          },
          { mode: 'pin' }
        )
      );
    }

    if (this.#staticPose) {
      /* Reduced motion: single static label-forward frame, no loop. */
      this.#idleRotation = LABEL_FORWARD;
      this.#scrollBlend = 1;
      this.#renderFrame();
      return;
    }

    this.#disposers.push(
      onVisibilityChange(this, (visible) => {
        this.#visible = visible;
        if (visible) {
          this.#startLoop();
        } else {
          this.#stopLoop();
        }
      })
    );
  }

  /**
   * Placeholder bottle built from primitives.
   * REPLACE WITH GLB: when the client's Draco-compressed model lands, load it
   * here via GLTFLoader/DRACOLoader (vendored the same way as three) and
   * return the loaded scene instead. Keep the returned object's label facing
   * +Z at rotation 0 so LABEL_FORWARD stays valid.
   */
  #buildBottle(THREE) {
    const group = new THREE.Group();

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x241610,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
    });

    /* Bottle silhouette via lathe: base → straight wall → shoulder → neck. */
    const profile = [];
    const points = [
      [0, 0],
      [0.78, 0],
      [0.84, 0.06],
      [0.84, 1.72],
      [0.8, 1.95],
      [0.58, 2.18],
      [0.42, 2.28],
      [0.4, 2.5],
    ];
    for (const [x, y] of points) profile.push(new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), glassMaterial);

    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b0b0c,
      roughness: 0.4,
      metalness: 0.15,
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.5, 48), capMaterial);
    cap.position.y = 2.72;

    const labelTexture = this.#drawLabel(THREE);
    const labelMaterial = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.65,
      metalness: 0,
    });
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.855, 0.855, 1.15, 64, 1, true),
      labelMaterial
    );
    label.position.y = 0.95;
    /* CylinderGeometry's UV seam (u=0) sits at +Z; the canvas center is at
       u=0.5 (theta=π), so half a turn brings it to face the camera. */
    label.rotation.y = Math.PI;

    group.add(body, cap, label);
    group.position.y = -0.45;
    return group;
  }

  /* Minimal custom label per the brief — an aesthetic layout, not the
     literal supplement-facts panel. */
  #drawLabel(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* Label content occupies the front third, centered on the seam offset. */
    const cx = canvas.width / 2;
    ctx.fillStyle = '#0b0b0c';
    ctx.textAlign = 'center';

    ctx.font = '500 34px "Helvetica Neue", Arial, sans-serif';
    ctx.save();
    ctx.letterSpacing = '14px';
    ctx.fillText('TAMARINSE', cx, 190);
    ctx.restore();

    ctx.font = '400 22px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = 'rgba(11,11,12,0.66)';
    ctx.fillText('Daily Defense Against Microplastics™', cx, 260);

    ctx.strokeStyle = '#a85638';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 60, 310);
    ctx.lineTo(cx + 60, 310);
    ctx.stroke();

    ctx.font = '400 19px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = 'rgba(11,11,12,0.55)';
    ctx.fillText('60 CAPSULES — 30 DAY SUPPLY', cx, 370);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  #bottlePeriodSeconds() {
    const raw = getComputedStyle(this).getPropertyValue('--t-bottle-period').trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  }

  #resize() {
    if (!this.#renderer || !this.#camera) return;
    const width = this.clientWidth || 1;
    const height = this.clientHeight || 1;
    this.#renderer.setPixelRatio(cappedPixelRatio());
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderFrame();
  }

  #startLoop() {
    if (this.#rafId !== null || this.#staticPose) return;
    this.#lastTime = performance.now();
    const tick = (now) => {
      this.#rafId = null;
      if (!this.#visible || !this.#renderer) return;

      const delta = Math.min((now - this.#lastTime) / 1000, 0.1);
      this.#lastTime = now;

      if (this.#scrollBlend < 1) {
        this.#idleRotation = (this.#idleRotation + delta * (TWO_PI / this.#bottlePeriodSeconds())) % TWO_PI;
        this.#lockBase = null;
      } else if (this.#lockBase === null) {
        this.#lockBase = this.#idleRotation;
      }

      this.#renderFrame();
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  #stopLoop() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  #renderFrame() {
    if (!this.#renderer || !this.#bottle) return;

    /* Blend the free-running idle rotation toward the nearest label-forward
       equivalent so the settle takes the shortest path. */
    const idle = this.#lockBase ?? this.#idleRotation;
    let target = LABEL_FORWARD;
    let deltaToLabel = (target - idle) % TWO_PI;
    if (deltaToLabel > Math.PI) deltaToLabel -= TWO_PI;
    if (deltaToLabel < -Math.PI) deltaToLabel += TWO_PI;

    const eased = this.#easeInOut(this.#scrollBlend);
    this.#bottle.rotation.y = idle + deltaToLabel * eased;

    this.#renderer.render(this.#scene, this.#camera);
  }

  #easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  #teardown() {
    this.#stopLoop();
    for (const dispose of this.#disposers) dispose();
    this.#disposers = [];

    if (this.#scene) {
      this.#scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
    }

    if (this.#renderer) {
      this.#renderer.dispose();
      this.#renderer.domElement.remove();
    }

    this.#renderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#bottle = null;
    this.#initialized = false;
    this.removeAttribute('data-webgl-active');
  }
}

if (!customElements.get('tamarinse-bottle-scene')) {
  customElements.define('tamarinse-bottle-scene', TamarinseBottleScene);
}
