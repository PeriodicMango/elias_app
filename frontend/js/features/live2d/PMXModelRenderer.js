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
import { MMDAnimationHelper } from "three/addons/animation/MMDAnimationHelper.js";

// ---------------------------------------------------------------------------
// Bone & morph names to probe (Japanese / Chinese / English)
// ---------------------------------------------------------------------------
const HEAD_BONE_NAMES  = ["頭", "首", "head", "Head", "neck", "Neck"];
const BODY_BONE_NAMES  = ["上半身", "上半身2", "spine", "Spine", "chest", "Chest"];
const BLINK_MORPH_NAMES = ["まばたき", "blink", "Blink", "瞬き", "閉じる", "eyeClose"];
const HAIR_BONE_NAMES = [
  "中劉海1", "左劉海1", "右劉海1",
  "左側髪1-1", "右側髪1-1",
  "後髪", "後碎髮1", "右下側髪1",
  "右辮子1", "左後側髪1-1", "左後側髪2-1",
];
// Skirt/cape chain root bones — first bone of each physics chain
const CHAIN_ROOT_NAMES = [
  "右長披肩1", "左長披肩1",
  "領巾",
];

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

  // -- Skeleton bones ---------------------------------------------------------
  /** @type {import("three").Bone | null} */
  #headBone = null;
  /** @type {import("three").Bone | null} */
  #neckBone = null;
  /** @type {import("three").Bone | null} */
  #upperBody = null;   // spine/chest
  /** @type {import("three").Bone | null} */
  #lowerBody = null;   // pelvis
  /** @type {import("three").Bone | null} */
  #groove = null;      // center of gravity
  /** @type {import("three").Bone | null} */
  #lShoulder = null;
  /** @type {import("three").Bone | null} */
  #rShoulder = null;
  /** @type {import("three").Bone | null} */
  #lUpperArm = null;
  /** @type {import("three").Bone | null} */
  #rUpperArm = null;
  /** @type {import("three").Bone | null} */
  #lElbow = null;
  /** @type {import("three").Bone | null} */
  #rElbow = null;
  /** @type {import("three").Bone | null} */
  #lWrist = null;
  /** @type {import("three").Bone | null} */
  #rWrist = null;
  /** @type {import("three").Bone | null} */
  #lKnee = null;
  /** @type {import("three").Bone | null} */
  #rKnee = null;
  /** @type {import("three").Bone | null} */
  #lLegIK = null;
  /** @type {import("three").Bone | null} */
  #rLegIK = null;
  /** @type {import("three").Bone[]} */
  #hairBones = [];
  /** @type {import("three").Bone[]} */
  #chainRoots = [];
  /** @type {{ bone: import("three").Bone; finger: number; side: number }[]} */
  #fingerBones = [];

  /** @type {number} */
  #blinkMorphIdx = -1;

  /** @type {number} — base Y position (set after fitCamera + offset) */
  #baseY = 0;

  /** @type {import("three/addons/animation/MMDAnimationHelper.js").MMDAnimationHelper | null} */
  #helper = null;

  // Nod animation state ------------------------------------------------------
  #nodTime   = 0;  // progresses from 0→1 over NOD_DURATION, then resets
  static NOD_DURATION = 0.35;  // total nod cycle in seconds
  static NOD_ANGLE    = 0.12;  // peak forward head tilt in radians

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

    // Canvas — fills the frame via CSS (#live2d-canvas)
    this.#canvas = document.createElement("canvas");
    this.#canvas.id = "live2d-canvas";
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

      // Enable MMD physics — handles cloth/hair rigid-body simulation
      this.#helper = new MMDAnimationHelper({
        afterglow: 0.5,
        pmxAnimation: false,
        physics: true,
      });
      this.#helper.add(this.#mesh, { physics: true });

      try {
        this.#probeRig(this.#mesh.skeleton, this.#mesh.morphTargetDictionary);
      } catch (e) { throw step("Skeleton probe")(e); }

      // Fit camera to model bounding box
      try {
        this.#fitCamera();
      } catch (e) { throw step("Camera fit")(e); }

      // Move model higher in frame and record base Y
      this.#mesh.position.y += 1.5;
      this.#baseY = this.#mesh.position.y;

      // Set initial idle pose (arms relaxed, slight head tilt)
      this.#setIdlePose();

      this.#hideOverlay();
      this.loaded = true;
    } catch (err) {
      console.error("[PMX] Failed to load model:", err, "| URL:", modelPath);
      this.#showOverlay(`${err.message || err}`);
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

    // MMD physics — cloth, hair, rigid-body simulation (prevents clipping)
    if (this.#helper) this.#helper.update(dt);

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
    // Trigger a smooth head nod — animated in #applyIdle over NOD_DURATION.
    // Smooth motion doesn't shock MMDPhysics, so hair flows naturally.
    if (!this.#headBone) return;
    this.#nodTime = 0.001; // start the nod cycle
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

    this.#helper = null;

    this.#hideOverlay();
    if (this.#canvas?.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;

    this.#scene   = null;
    this.#camera  = null;
    this.#headBone = null;
    this.#neckBone = null;
    this.#upperBody = null;
    this.#lowerBody = null;
    this.#groove = null;
    this.#lShoulder = null;
    this.#rShoulder = null;
    this.#lUpperArm = null;
    this.#rUpperArm = null;
    this.#lWrist = null;
    this.#rWrist = null;
    this.#lElbow = null;
    this.#rElbow = null;
    this.#lKnee = null;
    this.#rKnee = null;
    this.#lLegIK = null;
    this.#rLegIK = null;
    this.#fingerBones = [];
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
      // -- Core / torso --
      for (const name of HEAD_BONE_NAMES) {
        const b = skeleton.getBoneByName(name);
        if (b) { this.#headBone = b; break; }
      }
      this.#neckBone = skeleton.getBoneByName("首") || skeleton.getBoneByName("neck") || skeleton.getBoneByName("Neck");
      for (const name of BODY_BONE_NAMES) {
        const b = skeleton.getBoneByName(name);
        if (b) { this.#upperBody = b; break; }
      }
      this.#lowerBody = skeleton.getBoneByName("下半身") || skeleton.getBoneByName("lower body") || skeleton.getBoneByName("pelvis");
      this.#groove    = skeleton.getBoneByName("センター") || skeleton.getBoneByName("groove") || skeleton.getBoneByName("中心");
      // -- Shoulders --
      this.#lShoulder = skeleton.getBoneByName("左肩") || skeleton.getBoneByName("左肩P") || skeleton.getBoneByName("leftShoulder");
      this.#rShoulder = skeleton.getBoneByName("右肩") || skeleton.getBoneByName("右肩P") || skeleton.getBoneByName("rightShoulder");
      // -- Arms --
      this.#lUpperArm = skeleton.getBoneByName("左腕") || skeleton.getBoneByName("左上腕");
      this.#rUpperArm = skeleton.getBoneByName("右腕") || skeleton.getBoneByName("右上腕");
      this.#lElbow    = skeleton.getBoneByName("左ひじ") || skeleton.getBoneByName("左肘") || skeleton.getBoneByName("leftElbow");
      this.#rElbow    = skeleton.getBoneByName("右ひじ") || skeleton.getBoneByName("右肘") || skeleton.getBoneByName("rightElbow");
      this.#lWrist    = skeleton.getBoneByName("左手首") || skeleton.getBoneByName("左手") || skeleton.getBoneByName("leftWrist");
      this.#rWrist    = skeleton.getBoneByName("右手首") || skeleton.getBoneByName("右手") || skeleton.getBoneByName("rightWrist");
      // -- Legs / IK --
      this.#lKnee     = skeleton.getBoneByName("左ひざ") || skeleton.getBoneByName("左膝") || skeleton.getBoneByName("leftKnee");
      this.#rKnee     = skeleton.getBoneByName("右ひざ") || skeleton.getBoneByName("右膝") || skeleton.getBoneByName("rightKnee");
      this.#lLegIK    = skeleton.getBoneByName("左足ＩＫ") || skeleton.getBoneByName("左足首ＩＫ") || skeleton.getBoneByName("leg IK L");
      this.#rLegIK    = skeleton.getBoneByName("右足ＩＫ") || skeleton.getBoneByName("右足首ＩＫ") || skeleton.getBoneByName("leg IK R");
      // -- Hair / chains --
      for (const name of HAIR_BONE_NAMES) {
        const b = skeleton.getBoneByName(name);
        if (b) this.#hairBones.push(b);
      }
      for (const name of CHAIN_ROOT_NAMES) {
        const b = skeleton.getBoneByName(name);
        if (b) this.#chainRoots.push(b);
      }
      // Skirt hem chains (下摆_0_1 through 下摆_14_1)
      for (let i = 0; i <= 14; i++) {
        const b = skeleton.getBoneByName(`下摆_${i}_1`);
        if (b) this.#chainRoots.push(b);
      }
      console.log("[PMX] Chain roots found:", this.#chainRoots.length, "hair bones:", this.#hairBones.length);
    }
    if (morphDict) {
      for (const name of BLINK_MORPH_NAMES) {
        if (morphDict[name] !== undefined) {
          this.#blinkMorphIdx = morphDict[name];
          break;
        }
      }
    }
    // Finger curl — probe for common MMD finger bone patterns
    this.#probeFingers(skeleton);
  }

  /**
   * Classify a finger bone: returns { finger: 0-4, side: -1|0|1 }.
   * finger: 0=thumb 1=index 2=middle 3=ring 4=pinky
   * side: -1=left, 1=right, 0=unknown
   */
  #classifyFinger(name) {
    const info = { finger: -1, side: 0 };
    // Detect side
    if (/[左lL]|Left/i.test(name))       info.side = -1;
    else if (/[右rR]|Right/i.test(name))  info.side = 1;

    // Classify finger
    if (/[拇大]拇指|thumb/i.test(name))           info.finger = 0;
    else if (/[食人]指|[人]指|index/i.test(name))  info.finger = 1;
    else if (/[中中]指(?!骨)|middle/i.test(name))  info.finger = 2;
    else if (/[无无]名指|[薬薬]指|ring/i.test(name)) info.finger = 3;
    else if (/[小]指(?!骨)|pink/i.test(name))      info.finger = 4;
    else if (/[指指]|finger/i.test(name))          info.finger = -1;

    return info;
  }

  /** Progressive curl strength per finger (0=thumb, 4=pinky). */
  #fingerCurl = [0.18, 0.15, 0.25, 0.38, 0.50];

  /**
   * Pose one finger bone with natural progressive curl + adduction.
   * `side` is -1 (left) or 1 (right) — mirrors Z rotations so both hands
   * curl inward toward their respective palms.
   */
  #poseFinger(bone, fingerIdx, side) {
    const name = bone.name;
    const isTip  = /[３3]|[先先]|tip|distal/i.test(name);
    const isMid  = /[２2]|[中中]|mid/i.test(name);
    const sign   = side === 0 ? 1 : side; // left=-1, right=+1

    // --- Thumb: relaxed forward + inward toward palm ---
    if (fingerIdx === 0) {
      if (isTip) {
        bone.rotateZ(0.25 * sign);
      } else if (isMid) {
        bone.rotateZ(0.20 * sign);
        bone.rotateX(-0.10 * sign);
      } else {
        bone.rotateY(-0.15 * sign);
        bone.rotateZ(0.25 * sign);
        bone.rotateX(-0.08 * sign);
      }
      return;
    }

    // --- Fingers 1-4: soft 'C' curve — all three joints bend ---
    const curl = this.#fingerCurl[fingerIdx] ?? 0.25;

    // Adduction: bring toward middle finger (mirrored per side)
    // Uses X-axis rotation — mirrored for left/right
    let adduct = 0;
    if (fingerIdx === 1)      adduct = -0.04;
    else if (fingerIdx === 3) adduct =  0.04;
    else if (fingerIdx === 4) adduct =  0.07;
    const adductX = adduct * sign; // mirror per hand

    // Primary curl via Z-axis rotation (fingers bend forward toward palm)
    if (isTip) {
      bone.rotateZ(curl * sign);
      bone.rotateX(adductX * 0.5);
    } else if (isMid) {
      bone.rotateZ(curl * 0.65 * sign);
      bone.rotateX(adductX);
    } else {
      bone.rotateZ(curl * 0.35 * sign);
      bone.rotateX(adductX);
    }
  }

  /** Find finger bones, classify, and pose both hands. */
  #probeFingers(skeleton) {
    if (!skeleton) return;
    for (const b of skeleton.bones) {
      const { finger, side } = this.#classifyFinger(b.name);
      if (finger >= 0) {
        this.#fingerBones.push({ bone: b, finger, side });
      }
    }
    if (this.#fingerBones.length === 0) {
      console.log("[PMX] No finger bones matched");
      return;
    }
    for (const { bone, finger, side } of this.#fingerBones) {
      this.#poseFinger(bone, finger, side);
    }
    console.log("[PMX] Fingers posed:", this.#fingerBones.length);
  }

  // -- idle pose & animation -------------------------------------------------

  // Base pose — anchors that idle animations oscillate around
  #basePose = {
    headX: 0.04, headY: 0.02, headZ: 0.01,
    neckX: 0.06,
    upperX: 0.04, upperY: 0, upperZ: 0,
  };

  /**
   * Natural relaxed standing pose, bone-by-bone.
   * Torso: pelvis tilted back, spine tilted forward → neutral upright.
   * Groove: dropped slightly for weighted stance.
   * Shoulders: dropped + rotated forward.
   * Arms: A-pose (15-20° out), elbows bent 5-10°, palms face inward.
   * Legs: IK feet shoulder-width, toes slightly outward.
   * Head: slight downward tilt, neck follows cervical curve.
   */
  #setIdlePose() {
    // Arms down from A-pose to hanging (minimal — VMD for full pose)
    if (this.#lUpperArm) this.#lUpperArm.rotateZ(-0.75);
    if (this.#rUpperArm) this.#rUpperArm.rotateZ(0.75);
    this.#probeFingers();
  }

  #applyIdle(dt) {
    if (!this.#mesh) return;

    this.#idleTime += dt;

    // Micro-sway — amplitudes tuned to avoid triggering physics vibrations
    // while keeping the model looking alive. MMDPhysics handles cloth/hair.
    this.#mesh.rotation.y = Math.sin(this.#idleTime * 0.25) * 0.005;
    this.#mesh.position.y = this.#baseY + Math.sin(this.#idleTime * 0.5) * 0.008;

    // Head — subtle look-around, anchored to base pose
    if (this.#headBone) {
      this.#headBone.rotation.x = this.#basePose.headX + Math.sin(this.#idleTime * 0.35) * 0.003;
      this.#headBone.rotation.y = this.#basePose.headY + Math.sin(this.#idleTime * 0.2 + 1.2) * 0.01;
      this.#headBone.rotation.z = this.#basePose.headZ + Math.sin(this.#idleTime * 0.3 + 0.7) * 0.002;
    }

    // Body — breathing, anchored to base pose
    if (this.#upperBody) {
      this.#upperBody.rotation.x = this.#basePose.upperX + Math.sin(this.#idleTime * 0.6) * 0.004;
      this.#upperBody.rotation.y = this.#basePose.upperY + Math.sin(this.#idleTime * 0.4 + 1.5) * 0.001;
      this.#upperBody.rotation.z = this.#basePose.upperZ + Math.sin(this.#idleTime * 0.5 + 0.8) * 0.001;
    }

    // Smooth head nod (triggered by tap/click — playMotion)
    if (this.#headBone && this.#nodTime > 0) {
      this.#nodTime += dt;
      if (this.#nodTime >= PMXModelRenderer.NOD_DURATION) {
        // Nod complete — reset to base pose (idle will take over next frame)
        this.#nodTime = 0;
      } else {
        // Sine curve: forward then back, smooth start/end
        const t = this.#nodTime / PMXModelRenderer.NOD_DURATION;
        const nod = Math.sin(t * Math.PI * 2) * PMXModelRenderer.NOD_ANGLE;
        this.#headBone.rotation.x = this.#basePose.headX + nod;
      }
    }

    // Chain/hair physics handled by MMDAnimationHelper (physics: true).
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
