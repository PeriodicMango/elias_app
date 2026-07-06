// ---------------------------------------------------------------------------
// Live2DModelRenderer — Cubism SDK for Web
// ---------------------------------------------------------------------------
// Placeholder. When Cubism SDK and .moc3 model files are provided,
// loads and renders the model with WebGL.
//
// Requires: Cubism SDK for Web (live2dcubismcore.min.js)
// Model path: models/<persona>/<persona>.model3.json
// ---------------------------------------------------------------------------

import { ModelRenderer } from "./ModelRenderer.js";

export class Live2DModelRenderer extends ModelRenderer {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;

  /** @type {string} */
  #label = "Live2D renderer — Cubism SDK not installed";

  async load(container, _modelPath) {
    this.container = container;

    this.#canvas = document.createElement("canvas");
    this.#canvas.style.cssText = "display: block; position: absolute; top: 0; left: 0;";
    container.appendChild(this.#canvas);

    this.#drawLabel();
    this.loaded = true;

    // TODO: Cubism SDK initialization
    // CubismFramework.initialize();
    // const model = new LAppModel();
    // model.loadAssets(modelPath);
    // model.update();
  }

  update(_deltaTime) {
    this.#drawLabel();
    // TODO: CubismFramework.update()
  }

  dispose() {
    if (this.#canvas?.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;
    this.container = null;
    this.loaded = false;
    // TODO: CubismFramework.dispose()
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

export default Live2DModelRenderer;
