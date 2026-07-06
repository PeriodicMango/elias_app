// ---------------------------------------------------------------------------
// FeatureRegistry — discovery, lifecycle, and tab integration
// ---------------------------------------------------------------------------
// Singleton registry. Features register themselves. The SPA router
// (app.js) queries the registry for tab definitions and mount/unmount.
// ---------------------------------------------------------------------------

import { Feature } from "./Feature.js";

/** @type {FeatureRegistry | null} */
let _instance = null;

export class FeatureRegistry {
  /** @type {Map<string, Feature>} */
  #features = new Map();

  /** @type {Feature | null} */
  #activeFeature = null;

  /** @type {Array<{id: string, icon: string, label: string}>} */
  #tabOverrides = [];

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  static get instance() {
    if (!_instance) _instance = new FeatureRegistry();
    return _instance;
  }

  /** Reset singleton (for testing). */
  static reset() {
    _instance = null;
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a feature instance.
   * @param {Feature} feature
   */
  register(feature) {
    if (!(feature instanceof Feature)) {
      throw new TypeError("FeatureRegistry.register: expected Feature instance");
    }
    if (this.#features.has(feature.id)) {
      console.warn(`FeatureRegistry: "${feature.id}" already registered, overwriting.`);
    }
    this.#features.set(feature.id, feature);
  }

  /**
   * Define tab overrides — which features appear as sidebar tabs.
   * @param {Array<{id: string, icon: string, label: string}>} tabs
   */
  setTabs(tabs) {
    this.#tabOverrides = tabs;
  }

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  /**
   * Get all registered feature IDs.
   * @returns {string[]}
   */
  list() {
    return [...this.#features.keys()];
  }

  /**
   * Get a feature by ID.
   * @param {string} id
   * @returns {Feature | undefined}
   */
  get(id) {
    return this.#features.get(id);
  }

  /**
   * Get features by category.
   * @param {"companion" | "tool" | "utility"} category
   * @returns {Feature[]}
   */
  byCategory(category) {
    return [...this.#features.values()].filter((f) => f.category === category);
  }

  /**
   * Get tab definitions for sidebar rendering.
   * @returns {Array<{id: string, icon: string, label: string}>}
   */
  getTabs() {
    return this.#tabOverrides.length > 0
      ? this.#tabOverrides
      : [...this.#features.values()].map((f) => ({
          id: f.id,
          icon: f.config.icon ?? "?",
          label: f.config.label ?? f.id,
        }));
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Activate a feature tab. Unmounts previous, mounts new.
   * @param {string} id
   * @param {HTMLElement} container
   * @returns {Promise<Feature | null>}
   */
  async activate(id, container) {
    if (this.#activeFeature && this.#activeFeature.id === id) {
      return this.#activeFeature;
    }

    // Unmount previous
    if (this.#activeFeature) {
      try {
        await this.#activeFeature.unmount();
      } catch (e) {
        console.error(`FeatureRegistry: unmount "${this.#activeFeature.id}" failed:`, e);
      }
      this.#activeFeature = null;
    }

    // Mount new
    const feature = this.#features.get(id);
    if (!feature) {
      console.warn(`FeatureRegistry: feature "${id}" not registered.`);
      return null;
    }

    try {
      await feature.mount(container);
      this.#activeFeature = feature;
      return feature;
    } catch (e) {
      console.error(`FeatureRegistry: mount "${id}" failed:`, e);
      return null;
    }
  }

  /**
   * Broadcast lifecycle event to all registered features.
   * @param {"onResume" | "onPause"} event
   */
  broadcast(event) {
    for (const feature of this.#features.values()) {
      try {
        feature[event]();
      } catch (e) {
        console.error(`FeatureRegistry: ${event} on "${feature.id}" failed:`, e);
      }
    }
  }

  /**
   * Broadcast time tick to all registered features.
   * @param {Date} now
   */
  tick(now) {
    for (const feature of this.#features.values()) {
      try {
        feature.onTimeTick(now);
      } catch (e) {
        console.error(`FeatureRegistry: onTimeTick on "${feature.id}" failed:`, e);
      }
    }
  }

  /**
   * Collect widget data from all features.
   * @returns {object}
   */
  collectWidgetData() {
    const data = {};
    for (const feature of this.#features.values()) {
      const wd = feature.getWidgetData();
      if (wd) data[feature.id] = wd;
    }
    return data;
  }
}

export default FeatureRegistry;
