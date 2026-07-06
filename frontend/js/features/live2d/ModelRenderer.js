// ---------------------------------------------------------------------------
// ModelRenderer — abstract interface for character rendering backends
// ---------------------------------------------------------------------------
// Implementations:
//   CanvasPlaceholderRenderer — simple Canvas 2D figure (default, always works)
//   Live2DModelRenderer       — Cubism SDK (.moc3 models)
//   PMXModelRenderer          — Three.js + MMDLoader (.pmx models)
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all model renderers.
 *
 * Subclasses MUST implement:
 *   - load(container, modelPath): Promise<void>
 *   - update(deltaTime): void
 *   - dispose(): void
 *
 * Subclasses MAY override:
 *   - hitTest(x, y): string | null
 *   - playMotion(name): void
 *   - resize(w, h): void
 */
export class ModelRenderer {
  /** @type {HTMLElement | null} */
  container = null;

  /** @type {boolean} */
  loaded = false;

  /**
   * Initialize the renderer and load the model into the container.
   * @param {HTMLElement} container — DOM element to render into
   * @param {string} modelPath — path to model directory (e.g. "models/elias/")
   * @returns {Promise<void>}
   */
  async load(_container, _modelPath) {
    throw new Error("ModelRenderer.load() not implemented");
  }

  /**
   * Per-frame update. Called from requestAnimationFrame loop.
   * @param {number} _deltaTime — seconds since last frame
   */
  update(_deltaTime) {
    throw new Error("ModelRenderer.update() not implemented");
  }

  /**
   * Clean up GPU resources and DOM elements.
   */
  dispose() {
    throw new Error("ModelRenderer.dispose() not implemented");
  }

  /**
   * Hit-test a canvas coordinate against the model.
   * @param {number} _x — canvas-relative x
   * @param {number} _y — canvas-relative y
   * @returns {string | null} hit area ID (e.g. "head", "body") or null
   */
  hitTest(_x, _y) {
    return null;
  }

  /**
   * Play a named motion/animation.
   * @param {string} _name — motion name (e.g. "idle", "wave", "nod")
   */
  playMotion(_name) {
    // Optional — not all renderers support motion playback
  }

  /**
   * Handle container resize.
   * @param {number} _w — new width
   * @param {number} _h — new height
   */
  resize(_w, _h) {
    // Optional — renderer handles resize internally or via update loop
  }
}

export default ModelRenderer;
