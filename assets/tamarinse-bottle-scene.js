/**
 * <tamarinse-bottle-scene> — isolated WebGL hero bottle.
 *
 * Spec (MASTER_PROMPT.md):
 * - lazy-init: Three.js scene is only constructed when the element nears the
 *   viewport; render loop pauses entirely (not just hides) when off screen.
 * - idle state: continuous Y rotation, one turn per --t-bottle-period
 *   (default 24s), delta-time driven so speed is frame-rate independent.
 * - grab-to-rotate: pointer events (mouse/touch/pen) spin the jar directly,
 *   with inertia on release; touch-action pan-y keeps vertical swipes
 *   scrolling the page. After ~2s idle the jar eases back to label-forward.
 * - scroll state: progress from the shared scroll controller eases the bottle
 *   to a label-forward pose and locks it.
 * - fallbacks: prefers-reduced-motion → static label-forward pose (one frame,
 *   no loop). Low device tier / no WebGL → static fallback image, proactively.
 * - disposal: geometry/material/texture/renderer all released in
 *   disconnectedCallback. No leaks when scrolled past and back.
 *
 * Model: clear glass jar with a brushed-silver cap, tan capsules inside, and
 * the pale-sage Tamarinse label — procedurally matched to the client's
 * product photo (assets/tamarinse-bottle-photo-hires.jpg). If a real GLB
 * ever lands, swap it in inside #buildBottle() keeping the label facing +Z
 * at rotation 0 so LABEL_FORWARD stays valid.
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

/* ---- Grab-to-rotate tuning ---- */
/* A drag across the full element width spins the jar this many turns. */
const DRAG_TURNS_PER_WIDTH = 1.4;
/* Flick inertia: exponential decay rate and velocity floor/ceiling (rad/s). */
const SPIN_DAMPING = 2.4;
const SPIN_MIN = 0.04;
const SPIN_MAX = 10;
/* Hands-off delay before the jar eases back to the label-forward sway. */
const RETURN_DELAY_S = 1.6;
const RETURN_RATE = 3.2;

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

  /* ---- Grab-to-rotate state ---- */
  #userOffset = 0; /* radians added on top of the sway/lock pose */
  #dragging = false;
  #dragPointerId = null;
  #dragLastX = 0;
  #dragLastTime = 0;
  #spinVelocity = 0; /* rad/s, inertia after release */
  #restElapsed = 0; /* seconds since the jar came to rest */

  #onPointerDown = (event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.#dragging = true;
    this.#dragPointerId = event.pointerId;
    this.#dragLastX = event.clientX;
    this.#dragLastTime = event.timeStamp;
    this.#spinVelocity = 0;
    this.setAttribute('data-grabbing', '');
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointer already released (fast tap) — drag ends on pointerup anyway */
    }
  };

  #onPointerMove = (event) => {
    if (!this.#dragging || event.pointerId !== this.#dragPointerId) return;
    const dx = event.clientX - this.#dragLastX;
    const dt = Math.max((event.timeStamp - this.#dragLastTime) / 1000, 1e-4);
    this.#dragLastX = event.clientX;
    this.#dragLastTime = event.timeStamp;

    const width = this.clientWidth || 1;
    const dRotation = (dx / width) * TWO_PI * DRAG_TURNS_PER_WIDTH;
    this.#userOffset += dRotation;
    /* Smoothed release velocity so a jittery last event can't fling it. */
    this.#spinVelocity = this.#spinVelocity * 0.7 + (dRotation / dt) * 0.3;

    /* Reduced motion / paused loop: direct manipulation still renders. */
    if (this.#rafId === null) this.#renderFrame();
  };

  #onPointerEnd = (event) => {
    if (!this.#dragging || event.pointerId !== this.#dragPointerId) return;
    this.#dragging = false;
    this.#dragPointerId = null;
    this.#restElapsed = 0;
    this.removeAttribute('data-grabbing');
    const max = this.#staticPose ? 0 : SPIN_MAX;
    this.#spinVelocity = Math.min(max, Math.max(-max, this.#spinVelocity));
    if (Math.abs(this.#spinVelocity) < SPIN_MIN) this.#spinVelocity = 0;
  };

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

    /* Grab-to-rotate: pointer events cover mouse, touch, and pen. The canvas
       gets touch-action: pan-y (hero stylesheet) so horizontal drags rotate
       the jar while vertical swipes keep scrolling the page. */
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', this.#onPointerDown);
    canvas.addEventListener('pointermove', this.#onPointerMove);
    canvas.addEventListener('pointerup', this.#onPointerEnd);
    canvas.addEventListener('pointercancel', this.#onPointerEnd);
    this.#disposers.push(() => {
      canvas.removeEventListener('pointerdown', this.#onPointerDown);
      canvas.removeEventListener('pointermove', this.#onPointerMove);
      canvas.removeEventListener('pointerup', this.#onPointerEnd);
      canvas.removeEventListener('pointercancel', this.#onPointerEnd);
    });

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

    /* Elegant jar silhouette: flat vertical wall → gentle shoulder → straight
       neck → lip. The straight neck section is what separates "apothecary
       jar" from "grenade" — never blend shoulder directly into the cap. */
    const profilePoints = [
      [0.0, 0.02],
      [0.72, 0.02],
      [0.76, 0.1],
      [0.76, 2.05], // straight body wall — tall vertical section
      [0.73, 2.2], // shoulder begins, gentle convex curve
      [0.6, 2.35],
      [0.44, 2.49], // shoulder ends
      [0.44, 2.69], // neck — straight vertical section
      [0.46, 2.73], // tiny lip flare where cap seats
    ];
    const profile = profilePoints.map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), glassMaterial);

    /* ---- Silver cap: short, near-cylindrical, ~74% of body width.
       Straight sides and low height keep it reading as a screw cap on a
       neck, never a mushroom dome overhanging the jar. ---- */
    const silverMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9dadb,
      metalness: 1,
      roughness: 0.3,
      envMapIntensity: 1.1,
    });
    const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.53, 0.22, 64), silverMaterial);
    capBand.position.y = 2.8; /* band bottom overlaps the neck lip — no gap */
    /* Top plate is near-flush: barely taller or narrower than the band, so
       there's no visible bevel ring — just a thin closing edge. */
    const capDome = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.52, 0.05, 64), silverMaterial);
    capDome.position.y = 2.935;

    /* ---- Capsules inside (visible above and below the label) ---- */
    /* Sized so ~60 capsules plausibly fill the jar: small pills, and the fill
       stops below the shoulder leaving realistic headspace at the top. */
    const capsuleGeometry = new THREE.CapsuleGeometry(0.06, 0.15, 4, 10);
    const capsuleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0,
      envMapIntensity: 0.4,
    });
    const capsuleCount = 260;
    const capsules = new THREE.InstancedMesh(capsuleGeometry, capsuleMaterial, capsuleCount);
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    const tanShades = [0x8f7a48, 0x83703f, 0x9c8752, 0x776437];
    for (let i = 0; i < capsuleCount; i += 1) {
      const y = 0.14 + Math.random() * 1.76; /* tops out at 1.9, below the shoulder */
      const maxRadius = 0.58;
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
      new THREE.CylinderGeometry(0.775, 0.775, 1.25, 72, 1, true),
      labelMaterial
    );
    label.position.y = 1.08;
    /* CylinderGeometry's UV seam (u=0) sits at +Z; the canvas art is centered
       at u=0.5, so half a turn brings it to face the camera. */
    label.rotation.y = Math.PI;

    group.add(glass, capBand, capDome, capsules, label);
    group.position.y = -1.48; /* centers the ~2.96-unit jar on the origin */
    return group;
  }

  /* Label art matched to the product photo: sage field, real Tamarinse logo
     (mark + wordmark), positioning line, capsule count. The logo bitmap
     (data-logo URL) decodes async, so the label first paints with procedural
     stand-in art and repaints the moment the real art is ready. */
  #drawLabel(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    this.#paintLabel(canvas, null);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const logoUrl = this.getAttribute('data-logo');
    if (logoUrl) {
      const logo = new Image();
      logo.onload = () => {
        if (!this.#renderer) return; /* scene already torn down */
        this.#paintLabel(canvas, logo);
        texture.needsUpdate = true;
        this.#renderFrame();
      };
      logo.src = logoUrl;
    }

    return texture;
  }

  #paintLabel(canvas, logo) {
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d9e5df';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    ctx.textAlign = 'center';

    if (logo) {
      /* Real logo asset (893×290): tamarind mark occupies x 0–281,
         wordmark ink occupies (321, 127) to (893, 188). Drawn as two crops
         so they can be stacked vertically like the product label.

         The 2048px texture wraps the full 360° label, so only ~±40° (~455px)
         faces the camera without wrapping out of view around the curve —
         all art must stay inside that band or its edges get clipped. */
      const markHeight = 112;
      const markWidth = (281 / 290) * markHeight;
      ctx.drawImage(logo, 0, 0, 281, 290, cx - markWidth / 2, 30, markWidth, markHeight);

      const wordWidth = 440;
      const wordHeight = (61 / 572) * wordWidth;
      ctx.drawImage(logo, 321, 127, 572, 61, cx - wordWidth / 2, 192, wordWidth, wordHeight);
    } else {
      /* Procedural stand-in: seeds arc + typeset wordmark */
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

      ctx.fillStyle = '#171c19';
      ctx.font = '500 48px "Helvetica Neue", Arial, sans-serif';
      ctx.save();
      ctx.letterSpacing = '14px';
      ctx.fillText('TAMARINSE', cx + 7, 226);
      ctx.restore();
    }

    /* Positioning line */
    ctx.fillStyle = 'rgba(23, 28, 25, 0.78)';
    ctx.font = '600 21px "Helvetica Neue", Arial, sans-serif';
    ctx.save();
    ctx.letterSpacing = '3px';
    ctx.fillText('ENVIRONMENTAL DEFENSE &', cx, 298);
    ctx.fillText('DETOX PATHWAY SUPPORT†', cx, 330);
    ctx.restore();

    /* Divider + capsule count */
    ctx.strokeStyle = 'rgba(23, 28, 25, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 110, 372);
    ctx.lineTo(cx + 110, 372);
    ctx.stroke();

    ctx.fillStyle = 'rgba(23, 28, 25, 0.65)';
    ctx.font = '500 18px "Helvetica Neue", Arial, sans-serif';
    ctx.save();
    ctx.letterSpacing = '2.5px';
    ctx.fillText('60 CAPSULES — DIETARY SUPPLEMENT', cx, 420);
    ctx.restore();
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

      /* While the visitor holds, flicks, or has recently spun the jar, the
         ambient sway pauses — their rotation is the rotation. */
      const interacting = this.#dragging || this.#spinVelocity !== 0 || this.#userOffset !== 0;

      if (this.#scrollBlend < 1 && !interacting) {
        this.#elapsed += delta;
        const phase = (this.#elapsed / this.#bottlePeriodSeconds()) * TWO_PI;
        this.#idleRotation = LABEL_FORWARD + Math.sin(phase) * 0.42;
        this.#lockBase = null;
      } else if (this.#scrollBlend >= 1 && this.#lockBase === null) {
        this.#lockBase = this.#idleRotation;
      }

      if (!this.#dragging) {
        if (this.#spinVelocity !== 0) {
          /* Flick inertia with exponential decay. */
          this.#userOffset += this.#spinVelocity * delta;
          const decayed = this.#spinVelocity * Math.exp(-SPIN_DAMPING * delta);
          this.#spinVelocity = Math.abs(decayed) < SPIN_MIN ? 0 : decayed;
          this.#restElapsed = 0;
        } else if (this.#userOffset !== 0) {
          /* Hands off: wait, then ease back to the nearest label-forward
             turn (multiple of 2π) so the return takes the shortest path. */
          this.#restElapsed += delta;
          if (this.#restElapsed >= RETURN_DELAY_S) {
            const target = Math.round(this.#userOffset / TWO_PI) * TWO_PI;
            const next = target + (this.#userOffset - target) * Math.exp(-RETURN_RATE * delta);
            this.#userOffset = Math.abs(next - target) < 0.002 ? 0 : next;
          }
        }
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
    this.#bottle.rotation.y = idle + deltaToLabel * eased + this.#userOffset;

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
