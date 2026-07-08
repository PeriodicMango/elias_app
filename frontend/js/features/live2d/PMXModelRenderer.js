// ---------------------------------------------------------------------------
// PMXModelRenderer — 3D MMD model via Three.js + MMDLoader
// ---------------------------------------------------------------------------
// Loads .pmx models with textures. Renders with a 4-light studio rig,
// MMDAnimationHelper-driven physics (skirt/hair), and code-driven idle
// animations (blinking, breathing, head movement) — no .vmd files needed.
//
// Requires: import map for "three" and "three/addons/" in index.html
// Model path: models/<persona>/<model>.pmx
// ---------------------------------------------------------------------------

import { ModelRenderer } from "./ModelRenderer.js";

// Dynamic imports — Three.js only loads when PMX renderer is used.
// The browser caches the module, so subsequent calls are instant.
async function loadThreeModules() {
  const [ns, mmd, helperMod] = await Promise.all([
    import("three"),
    import("three/addons/loaders/MMDLoader.js"),
    import("three/addons/animation/MMDAnimationHelper.js"),
  ]);
  // The 'three' module's default export IS the THREE namespace
  return {
    T: ns.default || ns,
    MMDLoader: mmd.MMDLoader,
    MMDAnimationHelper: helperMod.MMDAnimationHelper,
  };
}

// ---------------------------------------------------------------------------
// Bone & morph names to probe (Japanese / Chinese / English)
// ---------------------------------------------------------------------------
const HEAD_BONE_NAMES  = ["頭", "首", "head", "Head", "neck", "Neck"];
const BODY_BONE_NAMES  = ["上半身", "上半身2", "spine", "Spine", "chest", "Chest"];
const BLINK_MORPH_NAMES = ["まばたき", "blink", "Blink", "瞬き", "閉じる", "eyeClose"];

export class PMXModelRenderer extends ModelRenderer {
  // Three.js namespace — cached after load()
  /** @type {any | null} */
  #T = null;

  /** @type {HTMLCanvasElement | null} */
  #canvas = null;

  /** @type {HTMLDivElement | null} */
  #overlay = null;

  /** @type {import("three").Scene | null} */
  #scene = null;

  /** @type {import("three").PerspectiveCamera | null} */
  #camera = null;

  /** @type {import("three").WebGLRenderer | null} */
  #renderer = null;

  /** @type {import("three").SkinnedMesh | null} */
  #mesh = null;

  /** @type {any | null} */
  #helper = null;

  /** @type {import("three").Clock | null} */
  #clock = null;

  /** @type {import("three").Bone | null} */
  #headBone = null;

  /** @type {import("three").Bone | null} */
  #bodyBone = null;

  /** @type {number} */
  #blinkMorphIdx = -1;

  // Idle state ---------------------------------------------------------------
  #idleTime   = 0;
  #blinkTimer = 0;
  #nextBlink  = 3;
  #blinkState = 0;  // 0=open 1=closing 2=closed 3=opening

  // -----------------------------------------------------------------------
  // ModelRenderer contract
  // -----------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {string} modelPath — full path to the .pmx file
   */
  async load(container, modelPath) {
    this.container = container;

    // Loading overlay --------------------------------------------------------
    this.#overlay = document.createElement("div");
    this.#overlay.textContent = "Loading model…";
    this.#overlay.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "color:var(--text-tertiary);font:14px var(--font);z-index:1;pointer-events:none;";
    container.appendChild(this.#overlay);

    // Canvas -----------------------------------------------------------------
    this.#canvas = document.createElement("canvas");
    this.#canvas.style.cssText = "display:block;position:absolute;top:0;left:0;";
    container.appendChild(this.#canvas);

    // Load Three.js modules (cached after first import) -----------------------

    let T, MMDLoader, MMDAnimationHelper;
    try {
      const mods = await loadThreeModules();
      T = mods.T;
      MMDLoader = mods.MMDLoader;
      MMDAnimationHelper = mods.MMDAnimationHelper;
      this.#T = T; // cache for hitTest/resize/dispose
    } catch (err) {
      console.error("[PMX] Failed to load Three.js:", err);
      this.#showOverlay("Three.js failed to load");
      this.loaded = true;
      return;
    }

    // Scene ------------------------------------------------------------------
    this.#scene = new T.Scene();

    // Camera -----------------------------------------------------------------
    this.#camera = new T.PerspectiveCamera(45, 2, 0.1, 100);
    this.#camera.position.set(0, 10, 22);
    this.#camera.lookAt(0, 10, 0);

    // Renderer ---------------------------------------------------------------
    this.#renderer = new T.WebGLRenderer({
      canvas: this.#canvas,
      alpha: true,
      antialias: true,
    });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.#renderer.toneMapping = T.ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 1.1;
    this.#renderer.outputColorSpace = T.SRGBColorSpace;

    // Lighting rig (4 lights) ------------------------------------------------
    // 1. Ambient — prevents pure-black shadows
    this.#scene.add(new T.AmbientLight(0xffffff, 0.6));

    // 2. Hemisphere — sky/ground color gradient
    this.#scene.add(new T.HemisphereLight(0xd4e4ff, 0x3a2a1a, 0.5));

    // 3. Key directional light (casts shadows) — upper front-right
    const key = new T.DirectionalLight(0xfff5ee, 2.5);
    key.position.set(5, 18, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near   = 0.5;
    key.shadow.camera.far    = 60;
    key.shadow.camera.left   = -15;
    key.shadow.camera.right  = 15;
    key.shadow.camera.top    = 25;
    key.shadow.camera.bottom = -5;
    key.shadow.bias       = -0.0005;
    key.shadow.normalBias = 0.02;
    this.#scene.add(key);

    // 4. Rim light — behind the model, separates silhouette from background
    const rim = new T.DirectionalLight(0xb0c8ff, 1.8);
    rim.position.set(-3, 12, -8);
    this.#scene.add(rim);

    // Ground shadow receiver (invisible plane) --------------------------------
    const ground = new T.Mesh(
      new T.PlaneGeometry(50, 50),
      new T.ShadowMaterial({ opacity: 0.25 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.#scene.add(ground);

    // Load PMX model ----------------------------------------------------------
    try {
      const loader = new MMDLoader();
      this.#mesh = await new Promise((resolve, reject) => {
        loader.load(
          modelPath,
          (mesh) => resolve(mesh),
          (p) => {
            if (p.loaded && p.total) {
              this.#showOverlay(`Loading model… ${Math.round((p.loaded / p.total) * 100)}%`);
            }
          },
          reject,
        );
      });

      this.#scene.add(this.#mesh);

      // Physics helper (drives skirt/hair physics even without .vmd animation)
      this.#helper = new MMDAnimationHelper({ afterglow: 2.0 });
      this.#helper.add(this.#mesh, { animation: null, physics: true });

      // Probe skeleton & morph targets for idle animation hooks
      this.#probeRig(this.#mesh.skeleton, this.#mesh.morphTargetDictionary);

      // Fit camera to model bounding box
      this.#fitCamera();

      this.#hideOverlay();
      this.loaded = true;
    } catch (err) {
      console.error("[PMX] Failed to load model:", err);
      this.#showOverlay("Failed to load model");
      this.loaded = true;
    }

    // Stagger the idle phase
    this.#idleTime = Math.random() * Math.PI * 2;
    this.#clock = new T.Clock();
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  /** @param {number} _deltaTime — unused; we use Clock.getDelta() for accuracy */
  update(_deltaTime) {
    if (!this.loaded || !this.#renderer || !this.#scene || !this.#camera || !this.#clock) return;

    const dt = Math.min(this.#clock.getDelta(), 0.1); // cap to prevent spiral

    // MMD physics (skirt, hair, accessories)
    if (this.#helper) this.#helper.update(dt);

    // Code-driven idle animations
    if (this.#mesh) this.#applyIdle(dt);

    // Render frame
    this.#renderer.render(this.#scene, this.#camera);
  }

  // -----------------------------------------------------------------------
  // Hit test (synchronous — uses cached THREE namespace)
  // -----------------------------------------------------------------------

  /**
   * @param {number} x — canvas-relative x
   * @param {number} y — canvas-relative y
   * @returns {string | null}
   */
  hitTest(x, y) {
    const T = this.#T;
    if (!T || !this.#mesh || !this.#camera || !this.#canvas) return null;

    const rect = this.#canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const ndc = new T.Vector2(
      (x / rect.width) * 2 - 1,
      -(y / rect.height) * 2 + 1,
    );

    const raycaster = new T.Raycaster();
    raycaster.setFromCamera(ndc, this.#camera);

    const hits = raycaster.intersectObject(this.#mesh, true);
    if (hits.length === 0) return null;

    // Classify hit by vertical position within bounding box
    const box = new T.Box3().setFromObject(this.#mesh);
    const h = box.max.y - box.min.y;
    if (h <= 0) return "body";
    const relY = (hits[0].point.y - box.min.y) / h;
    return relY > 0.72 ? "head" : "body";
  }

  /**
   * Tap feedback — quick scale bounce.
   * @param {string} _region
   */
  playMotion(_region) {
    if (!this.#mesh) return;
    this.#mesh.scale.set(1.03, 1.03, 1.03);
    setTimeout(() => {
      if (this.#mesh) this.#mesh.scale.set(1, 1, 1);
    }, 100);
  }

  // -----------------------------------------------------------------------
  // Resize
  // -----------------------------------------------------------------------

  resize(w, h) {
    if (!this.#canvas || !this.#renderer || !this.#camera) return;
    if (w <= 0 || h <= 0) return;
    if (this.#canvas.width === w && this.#canvas.height === h) return;

    this.#renderer.setSize(w, h, false);
    this.#camera.aspect = w / h;
    this.#camera.updateProjectionMatrix();
  }

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  dispose() {
    // Remove MMD helper
    if (this.#helper && this.#mesh) {
      this.#helper.remove(this.#mesh);
      this.#helper = null;
    }

    // Dispose mesh tree (geometries, materials, textures)
    if (this.#mesh) {
      this.#mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            for (const key of Object.keys(m)) {
              const v = m[key];
              if (v && v.isTexture) v.dispose();
            }
            m.dispose();
          }
        }
      });
      if (this.#mesh.parent) this.#mesh.parent.remove(this.#mesh);
      this.#mesh = null;
    }

    // Dispose WebGL renderer
    if (this.#renderer) {
      this.#renderer.dispose();
      this.#renderer = null;
    }

    // Remove DOM
    this.#hideOverlay();
    if (this.#canvas?.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;

    this.#T       = null;
    this.#scene   = null;
    this.#camera  = null;
    this.#headBone = null;
    this.#bodyBone = null;
    this.#clock   = null;
    this.container = null;
    this.loaded   = false;
  }

  // =======================================================================
  // Private helpers
  // =======================================================================

  /** Fit camera to model bounding box. */
  #fitCamera() {
    const T = this.#T;
    if (!T || !this.#mesh || !this.#camera) return;
    const box = new T.Box3().setFromObject(this.#mesh);
    const center = box.getCenter(new T.Vector3());
    const size   = box.getSize(new T.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 0) return;

    const dist = maxDim * 1.6;
    const eyeY = center.y + size.y * 0.15;
    this.#camera.position.set(center.x, eyeY, center.z + dist);
    this.#camera.lookAt(center.x, eyeY, center.z);
    this.#camera.near = 0.1;
    this.#camera.far  = dist * 5;
    this.#camera.updateProjectionMatrix();
  }

  /**
   * Find bones and morph targets for idle animations.
   * @param {import("three").Skeleton | null} skeleton
   * @param {Record<string, number> | undefined} morphDict
   */
  #probeRig(skeleton, morphDict) {
    if (skeleton) {
      for (const name of HEAD_BONE_NAMES) {
        const b = skeleton.getBoneByName(name);
        if (b) { this.#headBone = b; break; }
      }
      for (const name of BODY_BONE_NAMES) {
        const b = skeleton.getBoneByName(name);
        if (b) { this.#bodyBone = b; break; }
      }
    }
    if (morphDict) {
      for (const name of BLINK_MORPH_NAMES) {
        if (morphDict[name] !== undefined) {
          this.#blinkMorphIdx = morphDict[name];
          break;
        }
      }
    }
  }

  // -- idle animation --------------------------------------------------------

  /** @param {number} dt */
  #applyIdle(dt) {
    if (!this.#mesh) return;

    // Gentle whole-body sway
    this.#mesh.rotation.y = Math.sin(this.#idleTime * 0.35) * 0.04;

    // Subtle breathing bob
    this.#mesh.position.y = Math.sin(this.#idleTime * 0.7) * 0.06;

    // Head bone — slow look-around
    if (this.#headBone) {
      this.#headBone.rotation.x = Math.sin(this.#idleTime * 0.45) * 0.015;
      this.#headBone.rotation.y = Math.sin(this.#idleTime * 0.4 + 1.2) * 0.04;
      this.#headBone.rotation.z = Math.sin(this.#idleTime * 0.35 + 0.7) * 0.01;
    }

    // Body bone — subtle breathing tilt
    if (this.#bodyBone) {
      this.#bodyBone.rotation.x = Math.sin(this.#idleTime * 0.8) * 0.008;
    }

    // Blink morph
    this.#updateBlink(dt);
  }

  #updateBlink(dt) {
    const influences = this.#mesh?.morphTargetInfluences;
    if (!influences || this.#blinkMorphIdx < 0) return;

    this.#blinkTimer += dt;

    const CLOSE = 0.05;  // 50ms
    const HOLD  = 0.06;  // 60ms
    const OPEN  = 0.08;  // 80ms

    switch (this.#blinkState) {
      case 0: // open — waiting for next blink
        if (this.#blinkTimer >= this.#nextBlink) {
          this.#blinkState = 1;
          this.#blinkTimer = 0;
        }
        break;
      case 1: { // closing
        const t = Math.min(this.#blinkTimer / CLOSE, 1);
        influences[this.#blinkMorphIdx] = t;
        if (t >= 1) { this.#blinkState = 2; this.#blinkTimer = 0; }
        break;
      }
      case 2: // closed — brief hold
        if (this.#blinkTimer >= HOLD) {
          this.#blinkState = 3;
          this.#blinkTimer = 0;
        }
        break;
      case 3: { // opening
        const t = Math.min(this.#blinkTimer / OPEN, 1);
        influences[this.#blinkMorphIdx] = 1 - t;
        if (t >= 1) {
          this.#blinkState = 0;
          this.#blinkTimer = 0;
          this.#nextBlink = 2.5 + Math.random() * 3.5; // 2.5–6s
        }
        break;
      }
    }
  }

  // -- overlay helpers -------------------------------------------------------

  /** @param {string} text */
  #showOverlay(text) {
    if (this.#overlay) {
      this.#overlay.textContent = text;
      this.#overlay.style.display = "";
    }
  }

  #hideOverlay() {
    if (this.#overlay) {
      this.#overlay.remove();
      this.#overlay = null;
    }
  }
}

export default PMXModelRenderer;
