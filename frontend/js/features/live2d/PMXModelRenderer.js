// ---------------------------------------------------------------------------
// PMXModelRenderer — 3D MMD model via Three.js + MMDLoader
// ---------------------------------------------------------------------------
// Loads .pmx models with textures. Renders with a 4-light studio rig
// and code-driven idle animations (blinking, breathing, head movement).
//
// Requires: import map for "three" and "three/addons/" in index.html
// Model path: models/<persona>/<model>.pmx
// ---------------------------------------------------------------------------

import { ModelRenderer } from "./ModelRenderer.js";
import * as T from "three";
import { MMDLoader } from "three/addons/loaders/MMDLoader.js";

// ---------------------------------------------------------------------------
// Bone & morph names to probe (Japanese / Chinese / English)
// ---------------------------------------------------------------------------
const HEAD_BONE_NAMES  = ["頭", "首", "head", "Head", "neck", "Neck"];
const BODY_BONE_NAMES  = ["上半身", "上半身2", "spine", "Spine", "chest", "Chest"];
const BLINK_MORPH_NAMES = ["まばたき", "blink", "Blink", "瞬き", "閉じる", "eyeClose"];

export class PMXModelRenderer extends ModelRenderer {
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

    // Frame ------------------------------------------------------------------
    const frame = document.createElement("div");
    frame.className = "model-frame";
    container.appendChild(frame);

    // Canvas -----------------------------------------------------------------
    this.#canvas = document.createElement("canvas");
    this.#canvas.style.cssText = "display:block;position:absolute;top:0;left:0;";
    frame.appendChild(this.#canvas);

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
    this.#renderer.toneMapping = T.NoToneMapping;
    this.#renderer.outputColorSpace = T.SRGBColorSpace;

    // Lighting rig — flatter anime-style (3 lights) --------------------------
    // 1. Ambient — bright even fill
    this.#scene.add(new T.AmbientLight(0xffffff, 0.8));

    // 2. Hemisphere — subtle sky/ground gradient
    this.#scene.add(new T.HemisphereLight(0xffffff, 0xb0a8c0, 0.3));

    // 3. Key directional — front-facing, no shadows for clean anime look
    const key = new T.DirectionalLight(0xfff5ee, 2.0);
    key.position.set(0, 15, 10);
    this.#scene.add(key);

    // Load PMX model ----------------------------------------------------------
    const step = (label) => (err) => { throw new Error(`${label}: ${err?.message || err}`); };
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
          (err) => reject(new Error(`MMDLoader error (${modelPath}): ${err?.message || err}`)),
        );
      });

      this.#scene.add(this.#mesh);

      // Add portrait frame around the canvas
      try {
        this.#probeRig(this.#mesh.skeleton, this.#mesh.morphTargetDictionary);
      } catch (e) { throw step("Skeleton probe")(e); }

      // Fit camera to model bounding box
      try {
        this.#fitCamera();
      } catch (e) { throw step("Camera fit")(e); }

      this.#hideOverlay();
      this.loaded = true;
    } catch (err) {
      console.error("[PMX] Failed to load model:", err, "| URL:", modelPath);
      this.#showOverlay(`${err.message || err}`);
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

    const dt = Math.min(this.#clock.getDelta(), 0.1);

    // Code-driven idle animations
    if (this.#mesh) this.#applyIdle(dt);

    // Render frame
    this.#renderer.render(this.#scene, this.#camera);
  }

  // -----------------------------------------------------------------------
  // Hit test
  // -----------------------------------------------------------------------

  /**
   * @param {number} x — canvas-relative x
   * @param {number} y — canvas-relative y
   * @returns {string | null}
   */
  hitTest(x, y) {
    if (!this.#mesh || !this.#camera || !this.#canvas) return null;

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

    const box = new T.Box3().setFromObject(this.#mesh);
    const h = box.max.y - box.min.y;
    if (h <= 0) return "body";
    const relY = (hits[0].point.y - box.min.y) / h;
    return relY > 0.72 ? "head" : "body";
  }

  /**
   * Tap feedback — quick scale bounce.
   */
  playMotion(_region) {
    // Subtle acknowledgement — brief position bob instead of scale jump
    if (!this.#mesh) return;
    const originalY = this.#mesh.position.y;
    this.#mesh.position.y = originalY + 0.2;
    setTimeout(() => {
      if (this.#mesh) this.#mesh.position.y = originalY;
    }, 150);
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

    if (this.#renderer) {
      this.#renderer.dispose();
      this.#renderer = null;
    }

    this.#hideOverlay();
    if (this.#canvas?.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;

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

  #fitCamera() {
    if (!this.#mesh || !this.#camera) return;
    const box = new T.Box3().setFromObject(this.#mesh);
    const center = box.getCenter(new T.Vector3());
    const size   = box.getSize(new T.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 0) return;

    const dist = maxDim * 0.9;
    const eyeY = center.y + size.y * 0.35;
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

    const CLOSE = 0.05;
    const HOLD  = 0.06;
    const OPEN  = 0.08;

    switch (this.#blinkState) {
      case 0:
        if (this.#blinkTimer >= this.#nextBlink) {
          this.#blinkState = 1;
          this.#blinkTimer = 0;
        }
        break;
      case 1: {
        const t = Math.min(this.#blinkTimer / CLOSE, 1);
        influences[this.#blinkMorphIdx] = t;
        if (t >= 1) { this.#blinkState = 2; this.#blinkTimer = 0; }
        break;
      }
      case 2:
        if (this.#blinkTimer >= HOLD) {
          this.#blinkState = 3;
          this.#blinkTimer = 0;
        }
        break;
      case 3: {
        const t = Math.min(this.#blinkTimer / OPEN, 1);
        influences[this.#blinkMorphIdx] = 1 - t;
        if (t >= 1) {
          this.#blinkState = 0;
          this.#blinkTimer = 0;
          this.#nextBlink = 2.5 + Math.random() * 3.5;
        }
        break;
      }
    }
  }

  // -- overlay helpers -------------------------------------------------------

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
