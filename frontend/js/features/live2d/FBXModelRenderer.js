// ---------------------------------------------------------------------------
// FBXModelRenderer — FBX models via Three.js FBXLoader
// ---------------------------------------------------------------------------
// Loads .fbx models with embedded textures and animations.
// Uses AnimationMixer for motion clips and code-driven idle animations
// (breathing, head look-around, blink morphs).
//
// Requires: import map for "three" and "three/addons/" in index.html
// Model path: models/<persona>/<model>.fbx
// ---------------------------------------------------------------------------

import { ModelRenderer } from "./ModelRenderer.js";
import * as T from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";

// ---------------------------------------------------------------------------
// Bone & morph names to probe
// ---------------------------------------------------------------------------
const HEAD_BONE_NAMES  = ["頭", "首", "head", "Head", "neck", "Neck", "Head_M", "head_end"];
const UPPER_BODY_NAMES = ["上半身", "上半身2", "spine", "Spine", "chest", "Chest", "Spine1", "Spine2"];
const BLINK_MORPH_NAMES = ["まばたき", "blink", "Blink", "瞬き", "閉じる", "eyeClose", "eyes_close"];

export class FBXModelRenderer extends ModelRenderer {
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

  /** @type {import("three").Group | null} */
  #group = null;

  /** @type {import("three").SkinnedMesh | null} */
  #mesh = null;

  /** @type {import("three").Clock | null} */
  #clock = null;

  /** @type {import("three").AnimationMixer | null} */
  #mixer = null;

  /** @type {import("three").Bone | null} */
  #headBone = null;

  /** @type {import("three").Bone | null} */
  #upperBody = null;

  /** @type {{ bone: import("three").Bone; finger: number; side: number }[]} */
  #fingerBones = [];

  /** @type {number} */
  #blinkMorphIdx = -1;

  /** @type {number} */
  #baseY = 0;

  // Idle state ---------------------------------------------------------------
  #idleTime   = 0;
  #blinkTimer = 0;
  #nextBlink  = 3;
  #blinkState = 0;

  // Motion state -------------------------------------------------------------
  #actionCount = 0;

  // Nod animation ------------------------------------------------------------
  #nodTime = 0;

  // -----------------------------------------------------------------------
  // ModelRenderer contract
  // -----------------------------------------------------------------------

  async load(container, modelPath) {
    this.container = container;

    // Loading overlay
    this.#overlay = document.createElement("div");
    this.#overlay.textContent = "Loading model…";
    this.#overlay.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "color:var(--text-tertiary);font:14px var(--font);z-index:1;pointer-events:none;";
    container.appendChild(this.#overlay);

    // Frame
    const frame = document.createElement("div");
    frame.className = "model-frame";
    container.appendChild(frame);

    // Canvas
    this.#canvas = document.createElement("canvas");
    this.#canvas.id = "live2d-canvas";
    frame.appendChild(this.#canvas);

    // Scene
    this.#scene = new T.Scene();

    // Camera
    this.#camera = new T.PerspectiveCamera(45, 2, 0.1, 200);
    this.#camera.position.set(0, 1, 5);
    this.#camera.lookAt(0, 1, 0);

    // Renderer
    this.#renderer = new T.WebGLRenderer({
      canvas: this.#canvas,
      alpha: true,
      antialias: true,
    });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.toneMapping = T.NoToneMapping;
    this.#renderer.outputColorSpace = T.SRGBColorSpace;

    // Lighting — flat even illumination for anime look
    this.#scene.add(new T.AmbientLight(0xffffff, 1.5));
    this.#scene.add(new T.HemisphereLight(0xffffff, 0xd0c8e0, 0.6));

    // Load FBX model
    try {
      console.log("[FBX] Loading model:", modelPath);
      const manager = new T.LoadingManager();
      // Register TGA loader so .tga textures work (common in MMD-sourced FBX)
      manager.addHandler(/\.tga$/i, new TGALoader(manager));

      const loader = new FBXLoader(manager);
      // Set resource path to the model's directory so textures resolve
      const dirPath = modelPath.substring(0, modelPath.lastIndexOf("/") + 1);
      loader.setResourcePath(dirPath);
      this.#group = await new Promise((resolve, reject) => {
        loader.load(
          modelPath,
          (group) => resolve(group),
          (p) => {
            if (p.loaded && p.total) {
              this.#showOverlay(`Loading model… ${Math.round((p.loaded / p.total) * 100)}%`);
            }
          },
          (err) => reject(new Error(`FBXLoader error (${modelPath}): ${err?.message || err}`)),
        );
      });

      this.#scene.add(this.#group);

      // Keep all bones — the cape/skirt bones (下摆_) are part of the visible
      // mesh skinning. Without them the cloth mesh detaches and flies up.
      // Note: 16K bone count is high but the motion only targets ~50 of them.
      // Bone count after load: ${totalChildren} (console logged below)

      // Flatten materials — PMX-style anime look: self-illuminated, no specular
      this.#group.traverse((child) => {
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            if (m.roughness !== undefined) m.roughness = 0;
            if (m.metalness !== undefined) m.metalness = 0;
            if (m.specular !== undefined) m.specular.set(0, 0, 0);
            if (m.envMapIntensity !== undefined) m.envMapIntensity = 0;
            // Self-illuminate: copy diffuse map to emissive
            if (m.map && !m.emissiveMap) {
              m.emissive = new T.Color(0xffffff);
              m.emissiveMap = m.map;
              m.emissiveIntensity = 0.5;
            }
            m.needsUpdate = true;
          }
        }
      });

      // Fix textures — FBXLoader sometimes creates placeholder textures
      // for missing images. Reload them from the model directory.
      const texLoader = new T.TextureLoader();
      texLoader.setPath(dirPath);
      const tgaLoader = new TGALoader();
      tgaLoader.setPath(dirPath);

      this.#group.traverse((child) => {
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            if (m.map && !m.map.image) {
              // Try to reload the texture from the model directory
              const src = m.map.name || m.map.sourceFile;
              if (src) {
                console.log("[FBX] Reloading texture:", src);
                if (/\.tga$/i.test(src)) {
                  m.map = tgaLoader.load(src);
                } else {
                  m.map = texLoader.load(src);
                }
                m.map.colorSpace = T.SRGBColorSpace;
                m.map.flipY = false;
                m.needsUpdate = true;
              }
            }
            // Ensure textures have correct color space
            if (m.map?.image) m.map.colorSpace = T.SRGBColorSpace;
          }
        }
      });

      // Find the first SkinnedMesh for hit-testing and morph targets
      this.#group.traverse((child) => {
        if (child.isSkinnedMesh && !this.#mesh) {
          this.#mesh = child;
        }
      });

      // Probe skeleton
      this.#probeRig();

      // Fit camera BEFORE any animation so bounding box is accurate
      this.#fitCamera();

      // Slight Y offset for framing
      if (this.#mesh) {
        this.#mesh.position.y += 0.3;
        this.#baseY = this.#mesh.position.y;
      }

      // Arms down from T-pose plus relaxed fingers
      // Arms set by motion animation when loaded; fallback to code-driven pose
      this.#setIdlePose();
      this.#actionCount = 0;

      // Bone name remap: Mixamo → MMD (Japanese standard names)
      const MIXAMO_TO_MMD = {
        mixamorigHips: "センター",
        mixamorigSpine: "上半身",
        mixamorigSpine1: "上半身1",
        mixamorigSpine2: "上半身2",
        mixamorigNeck: "首",
        mixamorigHead: "頭",
        mixamorigHeadTop_End: "頭先",
        mixamorigRightShoulder: "右肩",
        mixamorigRightArm: "右腕",
        mixamorigRightForeArm: "右ひじ",
        mixamorigRightHand: "右手首",
        mixamorigLeftShoulder: "左肩",
        mixamorigLeftArm: "左腕",
        mixamorigLeftForeArm: "左ひじ",
        mixamorigLeftHand: "左手首",
        mixamorigRightUpLeg: "右足",
        mixamorigRightLeg: "右ひざ",
        mixamorigRightFoot: "右足首",
        mixamorigRightToeBase: "右つま先",
        mixamorigLeftUpLeg: "左足",
        mixamorigLeftLeg: "左ひざ",
        mixamorigLeftFoot: "左足首",
        mixamorigLeftToeBase: "左つま先",
      };

      // Check if model has baked animations
      console.log("[FBX] Model animations:", this.#group.animations?.length || 0);

      // Animations — load motion.fbx from the same directory if present
      const motionPath = dirPath + "_motion.fbx";
      this.#mixer = new T.AnimationMixer(this.#group);
      try {
        const motionLoader = new FBXLoader();
        motionLoader.setResourcePath(dirPath);
        const motionGroup = await new Promise((resolve, reject) => {
          motionLoader.load(
            motionPath,
            (g) => resolve(g),
            undefined,
            (err) => reject(err),
          );
        });
        if (motionGroup.animations?.length > 0) {
          console.log("[FBX] Motion loaded:", motionGroup.animations.length, "clips");
          let remapped = 0, skipped = 0;

          for (const clip of motionGroup.animations) {
            // Clone tracks with remapped bone names
            const remappedTracks = [];
            for (const track of clip.tracks) {
              const match = track.name.match(/^(.*?)\.(position|quaternion|scale)$/);
              const [, boneName, prop] = match;
              if (prop !== "quaternion") { skipped++; continue; }
              // Skip arm tracks — Mixamo arm quaternions are relative to
              // A-pose but MMD arms start in T-pose, causing them to point
              // straight backward. Code-driven pose handles arms instead.
              if (/shoulder|arm|forearm|hand|thumb|index|middle|ring|pinky/i.test(boneName)) {
                skipped++; continue;
              }
              const mmdBone = MIXAMO_TO_MMD[boneName];
              if (mmdBone) {
                const newTrack = track.clone();
                newTrack.name = `${mmdBone}.${prop}`;
                remappedTracks.push(newTrack);
                remapped++;
              } else {
                skipped++;
              }
            }
            // Create a new clip with remapped tracks
            const remappedClip = new T.AnimationClip(clip.name, clip.duration, remappedTracks);
            const action = this.#mixer.clipAction(remappedClip);
            action.play();
          }
          this.#actionCount = remappedTracks.length > 0 ? 1 : 0;
          console.log("[FBX] Tracks remapped:", remapped, "skipped:", skipped);
          console.log("[FBX] Mixer action count:", this.#actionCount);
        }
      } catch (e) {
        console.log("[FBX] No motion file, using baked animations if any");
        if (this.#group.animations?.length > 0) {
          for (const clip of this.#group.animations) {
            this.#mixer.clipAction(clip).play();
          }
        }
      }

      this.#hideOverlay();
      this.loaded = true;
    } catch (err) {
      console.error("[FBX] Failed to load model:", err, "| URL:", modelPath);
      this.#showOverlay(`${err.message || err}`);
    }

    this.#clock = new T.Clock();
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  update(_deltaTime) {
    if (!this.loaded || !this.#renderer || !this.#scene || !this.#camera || !this.#clock) return;

    const dt = Math.min(this.#clock.getDelta(), 0.1);

    // FBX animation mixer
    if (this.#mixer) this.#mixer.update(dt);

    // Code-driven idle (skip if mixer is playing animation)
    if (!this.#mixer || this.#actionCount === 0) {
      this.#applyIdle(dt);
    }

    // Render
    this.#renderer.render(this.#scene, this.#camera);
  }

  // -----------------------------------------------------------------------
  // Hit test
  // -----------------------------------------------------------------------

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
    // Use bounding-box ratio for head/body detection (same approach as PMX renderer)
    const box = new T.Box3().setFromObject(this.#mesh);
    const h = box.max.y - box.min.y;
    if (h <= 0) return "body";
    const relY = (hits[0].point.y - box.min.y) / h;
    return relY > 0.72 ? "head" : "body";
  }

  // -----------------------------------------------------------------------
  // Motion
  // -----------------------------------------------------------------------

  playMotion(_region) {
    if (!this.#headBone) return;
    this.#nodTime = 0.001;
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
    if (this.#mixer) {
      this.#mixer.stopAllAction();
      this.#mixer = null;
    }
    if (this.#group) {
      this.#group.traverse((child) => {
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
      if (this.#group.parent) this.#group.parent.remove(this.#group);
      this.#group = null;
    }
    if (this.#renderer) { this.#renderer.dispose(); this.#renderer = null; }
    this.#hideOverlay();
    if (this.#canvas?.parentNode) this.#canvas.parentNode.removeChild(this.#canvas);
    this.#canvas = null;
    this.#scene  = null;
    this.#camera = null;
    this.#mesh   = null;
    this.#headBone = null;
    this.#upperBody = null;
    this.#fingerBones = [];
    this.#clock  = null;
    this.container = null;
    this.loaded  = false;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  #fitCamera() {
    const target = this.#group;
    if (!target || !this.#camera) return;
    // Diagnose what we have
    let meshCount = 0, geoCount = 0, totalChildren = 0;
    const types = {};
    target.traverse((child) => {
      totalChildren++;
      types[child.type] = (types[child.type] || 0) + 1;
      if (child.isMesh || child.isSkinnedMesh) {
        meshCount++;
        if (child.geometry) {
          geoCount++;
          child.geometry.computeBoundingBox();
        }
      }
    });
    console.log("[FBX] Total children:", totalChildren, "types:", JSON.stringify(types), "meshes:", meshCount, "with geometry:", geoCount);
    // Show first-level structure
    const topTypes = target.children.map(c => c.type + (c.name ? "('"+c.name+"')" : ""));
    console.log("[FBX] Top-level children:", JSON.stringify(topTypes));

    if (meshCount === 0) {
      console.warn("[FBX] No meshes in group — using default camera");
      this.#camera.position.set(0, 1, 8);
      this.#camera.lookAt(0, 1, 0);
    } else {
      const box = new T.Box3().setFromObject(target);
      const center = box.getCenter(new T.Vector3());
      const size   = box.getSize(new T.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      console.log("[FBX] Bounding box — center:", center.toArray(), "size:", size.toArray(), "maxDim:", maxDim);
      if (maxDim > 0) {
        const dist = maxDim * 1.8;
        const eyeY = center.y + size.y * 0.15;
        this.#camera.position.set(center.x, eyeY, center.z + dist);
        this.#camera.lookAt(center.x, center.y + size.y * 0.05, center.z);
        this.#camera.near = 0.01;
        this.#camera.far  = dist * 10;
      } else {
        this.#camera.position.set(0, 1, 8);
        this.#camera.lookAt(0, 1, 0);
        this.#camera.near = 0.01;
        this.#camera.far = 100;
      }
    }
    this.#camera.updateProjectionMatrix();
  }

  #probeRig() {
    if (!this.#group) return;
    const skeleton = this.#mesh?.skeleton;
    this.#group.traverse((child) => {
      if (!child.isBone) return;
      const b = /** @type {import("three").Bone} */ (child);
      // Head
      if (!this.#headBone && HEAD_BONE_NAMES.some(n => b.name.includes(n))) {
        this.#headBone = b;
      }
      // Upper body
      if (!this.#upperBody && UPPER_BODY_NAMES.some(n => b.name.includes(n))) {
        this.#upperBody = b;
      }
      // Fingers
      const info = this.#classifyFinger(b.name);
      if (info.finger >= 0) {
        this.#fingerBones.push({ bone: b, finger: info.finger, side: info.side });
      }
    });
    // Blink morph
    if (this.#mesh?.morphTargetDictionary) {
      for (const name of BLINK_MORPH_NAMES) {
        if (this.#mesh.morphTargetDictionary[name] !== undefined) {
          this.#blinkMorphIdx = this.#mesh.morphTargetDictionary[name];
          break;
        }
      }
    }
  }

  // -- idle pose & animation -------------------------------------------------

  #setIdlePose() {
    // Arms down from T-pose — detect Japanese and English bone names
    this.#group?.traverse((child) => {
      if (!child.isBone) return;
      const b = /** @type {import("three").Bone} */ (child);
      const name = b.name;
      const low = name.toLowerCase();
      // Left upper arm (左腕 / left upper arm) — rotate down
      if (name === "左腕" || /left.*upper.*arm|upperarm_l|l_upperarm/i.test(low)) {
        b.rotateZ(-1.2); b.rotateX(0.1);
      }
      // Right upper arm
      if (name === "右腕" || /right.*upper.*arm|upperarm_r|r_upperarm/i.test(low)) {
        b.rotateZ(1.2); b.rotateX(0.1);
      }
      // Left elbow (左ひじ / 左肘) — slight bend
      if (name === "左ひじ" || name === "左肘" || /left.*forearm|forearm_l|left.*elbow|l_elbow/i.test(low)) {
        b.rotateX(0.15);
      }
      // Right elbow
      if (name === "右ひじ" || name === "右肘" || /right.*forearm|forearm_r|right.*elbow|r_elbow/i.test(low)) {
        b.rotateX(0.15);
      }
      // Left wrist (左手首 / 左手) — slight bend
      if (name === "左手首" || name === "左手" || /left.*hand|hand_l|l_hand/i.test(low)) {
        b.rotateX(0.06);
      }
      // Right wrist
      if (name === "右手首" || name === "右手" || /right.*hand|hand_r|r_hand/i.test(low)) {
        b.rotateX(0.06);
      }
    });
    this.#probeFingers();
  }

  // Finger classification — same logic as PMX renderer
  #classifyFinger(name) {
    const info = { finger: -1, side: 0 };
    if (/[左lL]|Left/i.test(name))       info.side = -1;
    else if (/[右rR]|Right/i.test(name)) info.side = 1;

    if (/[拇大]拇指|thumb/i.test(name))           info.finger = 0;
    else if (/[食人]指|[人]指|index/i.test(name))  info.finger = 1;
    else if (/[中中]指(?!骨)|middle/i.test(name))  info.finger = 2;
    else if (/[无无]名指|[薬薬]指|ring/i.test(name)) info.finger = 3;
    else if (/[小]指(?!骨)|pink/i.test(name))      info.finger = 4;
    else if (/[指指]|finger/i.test(name))          info.finger = -1;

    return info;
  }

  #fingerCurl = [0.18, 0.15, 0.25, 0.38, 0.50];

  #poseFinger(bone, fingerIdx, side) {
    const name = bone.name;
    const isTip  = /[３3]|[先先]|tip|distal/i.test(name);
    const isMid  = /[２2]|[中中]|mid/i.test(name);
    const sign   = side === 0 ? 1 : side;

    if (fingerIdx === 0) {
      if (isTip)        bone.rotateZ(0.25 * sign);
      else if (isMid) { bone.rotateZ(0.20 * sign); bone.rotateX(-0.10 * sign); }
      else            { bone.rotateY(-0.15 * sign); bone.rotateZ(0.25 * sign); bone.rotateX(-0.08 * sign); }
      return;
    }

    const curl = this.#fingerCurl[fingerIdx] ?? 0.25;
    let adduct = 0;
    if (fingerIdx === 1)      adduct = -0.04;
    else if (fingerIdx === 3) adduct =  0.04;
    else if (fingerIdx === 4) adduct =  0.07;
    const adductX = adduct * sign;

    if (isTip)        { bone.rotateZ(curl * sign); bone.rotateX(adductX * 0.5); }
    else if (isMid)   { bone.rotateZ(curl * 0.65 * sign); bone.rotateX(adductX); }
    else              { bone.rotateZ(curl * 0.35 * sign); bone.rotateX(adductX); }
  }

  #probeFingers() {
    for (const { bone, finger, side } of this.#fingerBones) {
      this.#poseFinger(bone, finger, side);
    }
  }

  // -- idle animation --------------------------------------------------------

  #applyIdle(dt) {
    if (!this.#group) return;
    this.#idleTime += dt;

    // Micro body sway
    this.#group.rotation.y = Math.sin(this.#idleTime * 0.25) * 0.005;
    this.#group.position.y = (this.#baseY || 0) + Math.sin(this.#idleTime * 0.5) * 0.008;

    // Head look-around
    if (this.#headBone) {
      this.#headBone.rotation.x = Math.sin(this.#idleTime * 0.35) * 0.004;
      this.#headBone.rotation.y = Math.sin(this.#idleTime * 0.2 + 1.2) * 0.012;
      this.#headBone.rotation.z = Math.sin(this.#idleTime * 0.3 + 0.7) * 0.003;
    }

    // Breathing
    if (this.#upperBody) {
      this.#upperBody.rotation.x = Math.sin(this.#idleTime * 0.6) * 0.004;
    }

    // Smooth head nod (tap acknowledgement)
    if (this.#headBone && this.#nodTime > 0) {
      this.#nodTime += dt;
      const NOD_DURATION = 0.35, NOD_ANGLE = 0.12;
      if (this.#nodTime >= NOD_DURATION) {
        this.#nodTime = 0;
      } else {
        const t = this.#nodTime / NOD_DURATION;
        this.#headBone.rotation.x += Math.sin(t * Math.PI * 2) * NOD_ANGLE;
      }
    }

    // Blink
    this.#updateBlink(dt);
  }

  #updateBlink(dt) {
    const influences = this.#mesh?.morphTargetInfluences;
    if (!influences || this.#blinkMorphIdx < 0) return;
    this.#blinkTimer += dt;
    const CLOSE = 0.05, HOLD = 0.06, OPEN = 0.08;
    switch (this.#blinkState) {
      case 0: // open
        if (this.#blinkTimer >= this.#nextBlink) {
          this.#blinkTimer = 0; this.#blinkState = 1; this.#nextBlink = 2 + Math.random() * 5;
        }
        break;
      case 1: // closing
        influences[this.#blinkMorphIdx] = Math.min(1, this.#blinkTimer / CLOSE);
        if (this.#blinkTimer >= CLOSE) { this.#blinkTimer = 0; this.#blinkState = 2; }
        break;
      case 2: // closed
        influences[this.#blinkMorphIdx] = 1;
        if (this.#blinkTimer >= HOLD) { this.#blinkTimer = 0; this.#blinkState = 3; }
        break;
      case 3: // opening
        influences[this.#blinkMorphIdx] = Math.max(0, 1 - this.#blinkTimer / OPEN);
        if (this.#blinkTimer >= OPEN) {
          this.#blinkTimer = 0; this.#blinkState = 0; influences[this.#blinkMorphIdx] = 0;
        }
        break;
    }
  }

  // -- overlay helpers -------------------------------------------------------

  #showOverlay(text) {
    if (this.#overlay) this.#overlay.textContent = text;
  }

  #hideOverlay() {
    if (this.#overlay?.parentNode) this.#overlay.parentNode.removeChild(this.#overlay);
    this.#overlay = null;
  }
}

export default FBXModelRenderer;
