// ---------------------------------------------------------------------------
// Feature — abstract base class for all app modules
// ---------------------------------------------------------------------------
// Every feature (Live2D, Clock, Weather, Goals, Chat, ...) extends this.
// The FeatureRegistry manages discovery and lifecycle.
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all feature modules.
 *
 * Subclasses MUST implement:
 *   - mount(container: HTMLElement): Promise<void>
 *   - unmount(): Promise<void>
 *
 * Subclasses MAY override:
 *   - getWidgetData(): object | null
 *   - onResume(): void
 *   - onPause(): void
 *   - onTimeTick(now: Date): void
 */
export class Feature {
  /** @type {{ persona?: string, [key: string]: any }} */
  config;

  /** @type {HTMLElement | null} */
  container;

  /** @type {string} unique feature id */
  id;

  /** @type {"companion" | "tool" | "utility"} feature category */
  category;

  /**
   * @param {string} id - unique feature id
   * @param {"companion" | "tool" | "utility"} category
   * @param {object} [config={}]
   */
  constructor(id, category, config = {}) {
    this.id = id;
    this.category = category;
    this.config = config;
    this.container = null;
  }

  // -----------------------------------------------------------------------
  // Contract — subclasses MUST implement these
  // -----------------------------------------------------------------------

  /**
   * Mount the feature into the given DOM container.
   * Called when the feature tab is activated.
   * @param {HTMLElement} container
   * @returns {Promise<void>}
   */
  async mount(_container) {
    throw new Error(`Feature "${this.id}": mount() not implemented`);
  }

  /**
   * Unmount the feature and clean up resources.
   * Called when switching away from this feature's tab.
   * @returns {Promise<void>}
   */
  async unmount() {
    throw new Error(`Feature "${this.id}": unmount() not implemented`);
  }

  // -----------------------------------------------------------------------
  // Optional — widget data bridge
  // -----------------------------------------------------------------------

  /**
   * Return data to be sent to the native widget.
   * Override to provide widget content for this feature.
   * @returns {object | null}
   */
  getWidgetData() {
    return null;
  }

  // -----------------------------------------------------------------------
  // Lifecycle hooks — no-op by default
  // -----------------------------------------------------------------------

  /** Called when the app returns to foreground. */
  onResume() {}

  /** Called when the app enters background. */
  onPause() {}

  /**
   * Called on periodic time ticks (e.g. every minute).
   * Used for time-aware greetings, clock updates, etc.
   * @param {Date} _now
   */
  onTimeTick(_now) {}
}

export default Feature;
