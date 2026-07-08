// ---------------------------------------------------------------------------
// Live2DFeature — companion homepage with pluggable model renderer
// ---------------------------------------------------------------------------
// Supports three rendering backends via the ModelRenderer interface:
//   "canvas" — CanvasPlaceholderRenderer (default, always works)
//   "pmx"    — PMXModelRenderer (Three.js + MMDLoader, .pmx models)
//   "live2d" — Live2DModelRenderer (Cubism SDK, .moc3 models)
// ---------------------------------------------------------------------------

import { Feature } from "../../core/Feature.js";
import { GreetingBubble } from "./GreetingBubble.js";
import { CanvasPlaceholderRenderer } from "./CanvasPlaceholderRenderer.js";
import { PMXModelRenderer } from "./PMXModelRenderer.js?v=33";
import { Live2DModelRenderer } from "./Live2DModelRenderer.js";

/** @param {string} type */
function createRenderer(type) {
  switch (type) {
    case "pmx":    return new PMXModelRenderer();
    case "live2d": return new Live2DModelRenderer();
    default:       return new CanvasPlaceholderRenderer();
  }
}

export class Live2DFeature extends Feature {
  /** @type {import("./ModelRenderer.js").ModelRenderer | null} */
  #renderer = null;

  /** @type {GreetingBubble | null} */
  #bubble = null;

  /** @type {number | null} */
  #rafId = null;

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;

  /** @type {number} */
  #lastFrameTime = 0;

  constructor(config = {}) {
    super("live2d", "companion", {
      icon: "\u{1F9B8}",
      label: "Companion",
      persona: "elias",
      rendererType: "canvas", // "canvas" | "pmx" | "live2d"
      modelPath: "",
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
    container.innerHTML = "";
    container.style.position = "relative";
    container.style.overflow = "hidden";

    // Model renderer
    const type = this.config.rendererType ?? "canvas";
    const rawPath = this.config.modelPath || `models/${this.persona}/`;
    // Normalize: ensure path is relative to frontend root with models/ prefix
    const modelPath = rawPath.startsWith("/") || rawPath.startsWith("models/")
      ? rawPath
      : `models/${rawPath}`;
    this.#renderer = createRenderer(type);
    await this.#renderer.load(container, modelPath);

    // Greeting bubble overlay
    this.#bubble = new GreetingBubble(this.persona);
    this.#bubble.mount(container);
    this.#bubble.refresh().then(() => this.#bubble.show());

    // ResizeObserver
    this.#resizeObserver = new ResizeObserver(() => this.#resizeCanvas());
    this.#resizeObserver.observe(container);
    this.#resizeCanvas();

    // Tap handler
    container.addEventListener("pointerdown", this.#onPointerDown);

    // Render loop
    this.#lastFrameTime = performance.now();
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

    if (this.#bubble) {
      this.#bubble.unmount();
      this.#bubble = null;
    }

    if (this.container) {
      this.container.removeEventListener("pointerdown", this.#onPointerDown);
    }

    if (this.#renderer) {
      this.#renderer.dispose();
      this.#renderer = null;
    }
    this.container = null;
  }

  getWidgetData() {
    return { persona: this.persona, type: "live2d" };
  }

  onResume() {
    if (!this.#rafId) {
      this.#lastFrameTime = performance.now();
      this.#startRenderLoop();
    }
  }

  onPause() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  #resizeCanvas() {
    if (!this.#renderer || !this.container) return;
    this.#renderer.resize(this.container.clientWidth, this.container.clientHeight);
  }

  #startRenderLoop() {
    const draw = (now) => {
      this.#rafId = requestAnimationFrame(draw);
      const dt = (now - this.#lastFrameTime) / 1000;
      this.#lastFrameTime = now;
      if (this.#renderer) this.#renderer.update(dt);
    };
    this.#rafId = requestAnimationFrame(draw);
  }

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  #onPointerDown = (e) => {
    if (!this.#renderer || !this.container) return;
    // Refresh greeting on tap
    if (this.#bubble) this.#bubble.refresh().then(() => this.#bubble.show());
    // Hit test against model
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = this.#renderer.hitTest(x, y);
    if (hit) this.#renderer.playMotion(hit);
  };

  // -----------------------------------------------------------------------
  // Model switching
  // -----------------------------------------------------------------------

  /**
   * Hot-switch the model without re-creating the feature instance.
   * If currently mounted, unmounts then re-mounts with the new config.
   * @param {string} rendererType — "canvas" | "pmx" | "live2d"
   * @param {string} modelPath — path to the model file
   */
  async switchModel(rendererType, modelPath) {
    const wasMounted = this.#renderer !== null;
    if (wasMounted) await this.unmount();
    this.config.rendererType = rendererType;
    this.config.modelPath = modelPath;
    if (wasMounted && this.container) await this.mount(this.container);
  }

  // -----------------------------------------------------------------------
  // Speech bubble style customization (placeholder)
  // -----------------------------------------------------------------------

  /**
   * Set the greeting bubble style.
   * @param {{ position?: "top" | "bottom", animation?: "fade" | "slide" }} style
   */
  setBubbleStyle(style) {
    if (!this.#bubble) return;
    console.log("[Live2D] bubble style:", style);
  }
}

export default Live2DFeature;
