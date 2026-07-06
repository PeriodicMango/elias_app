// ---------------------------------------------------------------------------
// Live2DFeature — Live2D companion homepage
// ---------------------------------------------------------------------------
// Placeholder: renders a canvas with basic idle animation.
// Full Live2D model rendering requires Cubism SDK for Web (live2d/cubism-core/).
// ---------------------------------------------------------------------------

import { Feature } from "../../core/Feature.js";

export class Live2DFeature extends Feature {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;

  /** @type {number | null} */
  #rafId = null;

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;

  /** @type {{ x: number, y: number }} */
  #mousePos = { x: 0, y: 0 };

  constructor(config = {}) {
    super("live2d", "companion", {
      icon: "👧", // 👧
      label: "Companion",
      persona: "elias",
      ...config,
    });
  }

  /** @returns {string} */
  get persona() {
    return this.config.persona ?? "elias";
  }

  // -----------------------------------------------------------------------
  // Contract
  // -----------------------------------------------------------------------

  async mount(container) {
    this.container = container;

    // Clear container and set as positioning anchor
    container.innerHTML = "";
    container.style.position = "relative";
    container.style.overflow = "hidden";
    this.#canvas = document.createElement("canvas");
    this.#canvas.id = "live2d-canvas";
    this.#canvas.style.cssText = `
      display: block;
      position: absolute;
      top: 0; left: 0;
    `;

    container.appendChild(this.#canvas);

    // ResizeObserver — update canvas resolution immediately on resize
    // (prevents CSS stretching during sidebar transition)
    this.#resizeObserver = new ResizeObserver(() => this.#resizeCanvas());
    this.#resizeObserver.observe(container);
    this.#resizeCanvas();

    // Mouse tracking for future touch interaction
    container.addEventListener("pointermove", this.#onPointerMove);
    container.addEventListener("pointerdown", this.#onPointerDown);

    // Start placeholder render loop
    this.#startRenderLoop();
  }

  async unmount() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }

    if (this.container) {
      this.container.removeEventListener("pointermove", this.#onPointerMove);
      this.container.removeEventListener("pointerdown", this.#onPointerDown);
    }

    if (this.#canvas && this.#canvas.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }
    this.#canvas = null;
    this.container = null;
  }

  getWidgetData() {
    return {
      persona: this.persona,
      type: "live2d",
    };
  }

  onResume() {
    if (!this.#rafId) this.#startRenderLoop();
  }

  onPause() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Canvas sizing
  // -----------------------------------------------------------------------

  #resizeCanvas() {
    if (!this.#canvas || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w > 0 && h > 0 && (this.#canvas.width !== w || this.#canvas.height !== h)) {
      this.#canvas.width = w;
      this.#canvas.height = h;
      this.#canvas.style.width = w + "px";
      this.#canvas.style.height = h + "px";
    }
  }

  // -----------------------------------------------------------------------
  // Placeholder render loop
  // -----------------------------------------------------------------------

  #startRenderLoop() {
    const draw = () => {
      this.#rafId = requestAnimationFrame(draw);
      this.#drawPlaceholder();
    };
    this.#rafId = requestAnimationFrame(draw);
  }

  #drawPlaceholder() {
    if (!this.#canvas) return;
    const ctx = this.#canvas.getContext("2d");
    if (!ctx) return;

    const w = this.#canvas.width;
    const h = this.#canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw a simple placeholder figure (circle head + trapezoid body)
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

    // Eyes (follow mouse)
    const dx = Math.max(-4, Math.min(4, (this.#mousePos.x - cx) * 0.02));
    const dy = Math.max(-3, Math.min(3, (this.#mousePos.y - cy) * 0.02));
    ctx.fillStyle = "rgba(45,48,72,0.5)";
    ctx.beginPath();
    ctx.arc(cx - headR * 0.35 + dx, cy - headR * 0.1 + dy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + headR * 0.35 + dx, cy - headR * 0.1 + dy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (subtle smile)
    ctx.strokeStyle = "rgba(45,48,72,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.3, headR * 0.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Label
    ctx.fillStyle = "var(--text-tertiary)";
    ctx.font = "14px var(--font)";
    ctx.textAlign = "center";
    ctx.fillText("Live2D placeholder — Cubism SDK pending", cx, h * 0.75);
  }

  // -----------------------------------------------------------------------
  // Input handlers
  // -----------------------------------------------------------------------

  #onPointerMove = (e) => {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.#mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  #onPointerDown = (_e) => {
    // Placeholder: tap triggers a greeting bubble refresh
    // TODO: Cubism hit-test → motion trigger
    const event = new CustomEvent("elias-live2d-tap", {
      bubbles: true,
      detail: { persona: this.persona },
    });
    this.container?.dispatchEvent(event);
  };
}

export default Live2DFeature;
