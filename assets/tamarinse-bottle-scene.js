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
 * Model: clear glass jar with a brushed-silver cap, tan capsules inside, and
 * the pale-sage Tamarinse label — procedurally matched to the client's
 * product photo (assets/tamarinse-bottle-photo.png). If a real GLB ever
 * lands, swap it in inside #buildBottle() keeping the label facing +Z at
 * rotation 0 so LABEL_FORWARD stays valid.
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
/* Rotation (radians) at which the label faces the camera. */
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
  #envTexture = null;
  #disposers = [];
  #rafId = null;
  #lastTime = 0;
  #elapsed = 0;
  /* Static hero: gentle sway around label-forward instead of full rotation,
     so the label never turns its blank back to the visitor. */
  #idleRotation = LABEL_FORWARD;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.domElement.classList.add('tamarinse-bottle-scene__canvas');
    this.#renderer = renderer;

    const scene = new THREE.Scene();
    /* Transmission (glass) samples the backdrop, so the scene background must
       match the page — an empty/transparent backdrop reads as black. */
    scene.background = this.#pageBackground(THREE);
    this.#scene = scene;

    /* Framing: the element is a contained stage now (not full-viewport),
       so center the jar and fill ~70% of the frame height. */
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    this.#camera = camera;

    /* Bright studio environment — gives the glass its refraction detail and
       the silver cap its reflections. Procedural panels render immediately;
       if a studio HDRI is configured it swaps in once decoded. */
    this.#envTexture = this.#createEnvironment(THREE, renderer);
    scene.environment = this.#envTexture;
    this.#loadEnvironmentMap(THREE, renderer);

    /* Three-point-style: soft key + rim, ambient kept low — heavy ambient
       fill flattens the transmission effect and makes glass read as plastic. */
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(3, 5, 4);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-4, 2, -3);
    const fillLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(keyLight, rimLight, fillLight);

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

  #pageBackground(THREE) {
    const color = new THREE.Color('#faf6ee');
    try {
      /* Walk up to the nearest ancestor that actually paints a background so
         the canvas blends into its section, not the (possibly white) body. */
      let node = this.parentElement;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          color.setStyle(bg);
          break;
        }
        node = node.parentElement;
      }
    } catch (error) {
      /* keep default */
    }
    return color;
  }

  /* Optional studio HDRI (data-environment URL, .exr). Loaded lazily so the
     first frame never waits on a ~1MB texture; swaps the procedural env. */
  async #loadEnvironmentMap(THREE, renderer) {
    const url = this.getAttribute('data-environment');
    if (!url) return;
    try {
      const { EXRLoader } = await import('@tamarinse/exr-loader');
      const equirect = await new EXRLoader().loadAsync(url);
      if (!this.#scene || !this.#renderer) {
        equirect.dispose();
        return;
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(equirect).texture;
      equirect.dispose();
      pmrem.dispose();
      const previous = this.#envTexture;
      this.#scene.environment = env;
      this.#envTexture = env;
      previous?.dispose();
      this.#renderFrame();
    } catch (error) {
      /* keep the procedural environment */
    }
  }

  /* Hand-rolled bright "studio" captured with PMREM — a light box with two
     window strips, enough for believable glass and brushed metal. */
  #createEnvironment(THREE, renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0.92, 0.92, 0.9);

    const panel = (width, height, intensity) => {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(intensity, intensity, intensity),
      });
      return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    };

    const left = panel(3, 8, 2.6);
    left.position.set(-5, 2, 0);
    left.rotation.y = Math.PI / 2;

    const right = panel(3, 8, 1.4);
    right.position.set(5, 2, 0);
    right.rotation.y = -Math.PI / 2;

    const top = panel(10, 10, 1.8);
    top.position.set(0, 6, 0);
    top.rotation.x = Math.PI / 2;

    const back = panel(8, 6, 0.9);
    back.position.set(0, 2, -6);

    envScene.add(left, right, top, back);

    const texture = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
    envScene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    return texture;
  }

  /**
   * Clear glass supplement jar matched to the product photo:
   * silver two-tier cap, tan capsules inside, pale sage wrap label.
   */
  #buildBottle(THREE) {
    const group = new THREE.Group();

    /* ---- Glass jar (lathe silhouette: base → wall → shoulder → neck) ---- */
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      transmission: 1.0, // full light transmission = glass, not translucent plastic
      roughness: 0.05, // near-zero for crisp reflections
      thickness: 0.3, // thin-walled jar: keep low or the refraction over-distorts
      ior: 1.5, // standard glass index of refraction
      envMapIntensity: 1.2,
      clearcoat: 0.3, // subtle sheen — sells "glass" vs "acrylic" without over-gloss
      clearcoatRoughness: 0.1,
      attenuationColor: 0xffffff,
      attenuationDistance: 0.3,
      transparent: true,
    });

    const profilePoints = [
      [0.0, 0.02],
      [0.6, 0.02],
      [0.78, 0.08],
      [0.85, 0.28],
      [0.86, 1.5],
      [0.82, 1.72],
      [0.64, 1.92],
      [0.5, 2.02],
      [0.47, 2.24],
    ];
    const profile = profilePoints.map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), glassMaterial);

    /* ---- Silver cap: wide band + domed top ---- */
    const silverMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9dadb,
      metalness: 1,
      roughness: 0.3,
      envMapIntensity: 1.1,
    });
    const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.63, 0.42, 64), silverMaterial);
    capBand.position.y = 2.42;
    const capDome = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 0.14, 64), silverMaterial);
    capDome.position.y = 2.7;

    /* ---- Capsules inside (visible above and below the label) ---- */
    const capsuleGeometry = new THREE.CapsuleGeometry(0.085, 0.2, 4, 10);
    const capsuleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0,
      envMapIntensity: 0.4,
    });
    const capsuleCount = 120;
    const capsules = new THREE.InstancedMesh(capsuleGeometry, capsuleMaterial, capsuleCount);
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    const tanShades = [0x8f7a48, 0x83703f, 0x9c8752, 0x776437];
    for (let i = 0; i < capsuleCount; i += 1) {
      /* Random point inside the jar; radius tightens through the shoulder. */
      const y = 0.14 + Math.random() * 1.72;
      const maxRadius = y > 1.5 ? Math.max(0.18, 0.66 - (y - 1.5) * 0.9) : 0.66;
      const angle = Math.random() * TWO_PI;
      const radius = Math.sqrt(Math.random()) * maxRadius;
      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      dummy.rotation.set(Math.random() * TWO_PI, Math.random() * TWO_PI, Math.random() * TWO_PI);
      dummy.updateMatrix();
      capsules.setMatrixAt(i, dummy.matrix);
      capsules.setColorAt(i, shade.setHex(tanShades[i % tanShades.length]));
    }
    capsules.instanceMatrix.needsUpdate = true;
    if (capsules.instanceColor) capsules.instanceColor.needsUpdate = true;

    /* ---- Label: pale sage wrap, sits just outside the glass ---- */
    const labelTexture = this.#drawLabel(THREE);
    const labelMaterial = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.75,
      metalness: 0,
      envMapIntensity: 0.35,
    });
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.875, 0.875, 1.16, 72, 1, true),
      labelMaterial
    );
    label.position.y = 0.94;
    /* CylinderGeometry's UV seam (u=0) sits at +Z; the canvas art is centered
       at u=0.5, so half a turn brings it to face the camera. */
    label.rotation.y = Math.PI;

    group.add(glass, capBand, capDome, capsules, label);
    group.position.y = -1.35; /* centers the ~2.7-unit jar on the origin */
    return group;
  }

  /* Label art matched to the product photo: sage field, tamarind mark,
     TAMARINSE wordmark, positioning line, capsule count. */
  #drawLabel(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d9e5df';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    ctx.textAlign = 'center';

    /* Tamarind pod mark: arc of dark seeds + a leaf stroke */
    ctx.fillStyle = '#20261f';
    const seeds = [
      [-30, 8, 13],
      [-8, 18, 14],
      [16, 14, 13],
      [34, 0, 11],
    ];
    for (const [dx, dy, r] of seeds) {
      ctx.beginPath();
      ctx.arc(cx + dx, 88 + dy, r, 0, TWO_PI);
      ctx.fill();
    }
    ctx.strokeStyle = '#20261f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx + 14, 60, 44, Math.PI * 0.9, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 52, 42, 16, 7, -0.7, 0, TWO_PI);
    ctx.stroke();

    /* Wordmark */
    ctx.fillStyle = '#171c19';
    ctx.font = '500 62px "Helvetica Neue", Arial, sans-serif';
    ctx.save();
    ctx.letterSpacing = '20px';
    ctx.fillText('TAMARINSE', cx + 10, 230);
    ctx.restore();

    /* Positioning line */
    ctx.fillStyle = 'rgba(23, 28, 25, 0.78)';
    ctx.font = '600 24px "Helvetica Neue", Arial, sans-serif';
    ctx.save();
    ctx.letterSpacing = '3px';
    ctx.fillText('ENVIRONMENTAL DEFENSE &', cx, 296);
    ctx.fillText('DETOX PATHWAY SUPPORT†', cx, 330);
    ctx.restore();

    /* Divider + capsule count */
    ctx.strokeStyle = 'rgba(23, 28, 25, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 120, 375);
    ctx.lineTo(cx + 120, 375);
    ctx.stroke();

    ctx.fillStyle = 'rgba(23, 28, 25, 0.65)';
    ctx.font = '500 22px "Helvetica Neue", Arial, sans-serif';
    ctx.save();
    ctx.letterSpacing = '4px';
    ctx.fillText('60 CAPSULES — DIETARY SUPPLEMENT', cx, 424);
    ctx.restore();

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
        this.#elapsed += delta;
        const phase = (this.#elapsed / this.#bottlePeriodSeconds()) * TWO_PI;
        this.#idleRotation = LABEL_FORWARD + Math.sin(phase) * 0.42;
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
    let deltaToLabel = (LABEL_FORWARD - idle) % TWO_PI;
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

    if (this.#envTexture) {
      this.#envTexture.dispose();
      this.#envTexture = null;
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
