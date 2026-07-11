// ---------------------------------------------------------------------------
// CanvasPlaceholderRenderer — simple Canvas 2D figure
// Default renderer when no 3D/Live2D model is configured.
// Implements ModelRenderer interface.
// ---------------------------------------------------------------------------

import { ModelRenderer } from "./ModelRenderer.js";

export class CanvasPlaceholderRenderer extends ModelRenderer {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;

  /** @type {{ x: number, y: number }} */
  #mousePos = { x: 0, y: 0 };

  #onPointerMove = (e) => {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.#mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // -----------------------------------------------------------------------
  // ModelRenderer contract
  // -----------------------------------------------------------------------

  async load(container, _modelPath) {
    this.container = container;

    this.#canvas = document.createElement("canvas");
    this.#canvas.style.cssText = "display: block; width: 100%; height: 100%;";
    container.appendChild(this.#canvas);

    container.addEventListener("pointermove", this.#onPointerMove);
    this.loaded = true;
  }

  update(_deltaTime) {
    if (!this.#canvas || !this.container) return;
    const ctx = this.#canvas.getContext("2d");
    if (!ctx) return;

    const w = this.#canvas.width;
    const h = this.#canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Simple figure
    const cx = w / 2;
    const cy = h * 0.35;
    const headR = Math.min(w, h) * 0.15;

    // Body
    ctx.fillStyle = "rgba(91,154,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.8, cy + headR + 40);
    ctx.lineTo(cx + headR * 0.8, cy + headR + 40);
    ctx.lineTo(cx + headR * 1.2, cy + headR + 120);
    ctx.lineTo(cx - headR * 1.2, cy + headR + 120);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = "rgba(91,154,255,0.20)";
    ctx.beginPath();
    ctx.arc(cx, cy, headR, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (follow pointer)
    const dx = Math.max(-4, Math.min(4, (this.#mousePos.x - cx) * 0.02));
    const dy = Math.max(-3, Math.min(3, (this.#mousePos.y - cy) * 0.02));
    ctx.fillStyle = "rgba(45,48,72,0.5)";
    ctx.beginPath();
    ctx.arc(cx - headR * 0.35 + dx, cy - headR * 0.1 + dy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + headR * 0.35 + dx, cy - headR * 0.1 + dy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = "rgba(45,48,72,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.3, headR * 0.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Label (use explicit colors — Canvas 2D doesn't resolve CSS var())
    ctx.fillStyle = "#888";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Model not configured", cx, h * 0.75);
  }

  dispose() {
    if (this.container) {
      this.container.removeEventListener("pointermove", this.#onPointerMove);
    }
    if (this.#canvas?.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;
    this.container = null;
    this.loaded = false;
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
}

export default CanvasPlaceholderRenderer;
