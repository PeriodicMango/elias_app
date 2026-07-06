// ---------------------------------------------------------------------------
// PMXModelRenderer — 3D MMD model via Three.js + MMDLoader
// ---------------------------------------------------------------------------
// Placeholder. When a .pmx model file is provided, loads it with Three.js
// and renders with MMDAnimationHelper for idle + motion playback.
//
// Requires: npm install three
// Model path: models/<persona>/model.pmx
// Motion path: models/<persona>/motions/idle.vmd (optional)
// ---------------------------------------------------------------------------

import { ModelRenderer } from "./ModelRenderer.js";

export class PMXModelRenderer extends ModelRenderer {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;

  /** @type {string} */
  #label = "PMX renderer — model not configured";

  async load(container, _modelPath) {
    this.container = container;

    this.#canvas = document.createElement("canvas");
    this.#canvas.style.cssText = "display: block; position: absolute; top: 0; left: 0;";
    container.appendChild(this.#canvas);

    // Placeholder text
    this.#drawLabel();
    this.loaded = true;

    // TODO: Three.js initialization
    // const scene = new THREE.Scene();
    // const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 100);
    // const renderer = new THREE.WebGLRenderer({ canvas: this.#canvas, alpha: true });
    // const loader = new MMDLoader();
    // const mesh = await loader.loadAsync(modelPath + "model.pmx");
    // const helper = new MMDAnimationHelper();
    // helper.add(mesh, { physics: true });
    // scene.add(mesh);
  }

  update(_deltaTime) {
    this.#drawLabel();
    // TODO: MMDAnimationHelper.update(deltaTime)
    // TODO: renderer.render(scene, camera)
  }

  dispose() {
    if (this.#canvas?.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;
    this.container = null;
    this.loaded = false;
    // TODO: renderer.dispose()
  }

  resize(w, h) {
    if (!this.#canvas) return;
    if (w > 0 && h > 0 && (this.#canvas.width !== w || this.#canvas.height !== h)) {
      this.#canvas.width = w;
      this.#canvas.height = h;
      this.#canvas.style.width = w + "px";
      this.#canvas.style.height = h + "px";
    }
  }

  #drawLabel() {
    if (!this.#canvas) return;
    const ctx = this.#canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.fillStyle = "var(--text-tertiary)";
    ctx.font = "16px var(--font)";
    ctx.textAlign = "center";
    ctx.fillText(this.#label, this.#canvas.width / 2, this.#canvas.height * 0.4);
  }
}

export default PMXModelRenderer;
