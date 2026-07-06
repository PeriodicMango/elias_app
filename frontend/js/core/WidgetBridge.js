// ---------------------------------------------------------------------------
// WidgetBridge — native widget data bridge (Android Glance / iOS WidgetKit)
// ---------------------------------------------------------------------------
// Sends feature data to the native home screen widget.
// In the Capacitor build, this writes to SharedPreferences that the native
// widget reads on refresh.
//
// For web (non-Capacitor), this is a no-op stub.
//
// Data flow: Features → FeatureRegistry.collectWidgetData() → WidgetBridge
// ---------------------------------------------------------------------------

/**
 * Bridge to native home screen widget.
 *
 * In the Capacitor build, replace with a plugin-backed implementation
 * that writes widget data to the native layer.
 */
export class WidgetBridge {
  /**
   * Sync feature data to the native widget.
   * Called periodically from the app time tick loop.
   * @param {import("./FeatureRegistry.js").FeatureRegistry} registry
   * @returns {Promise<void>}
   */
  async syncFromFeatures(registry) {
    const data = registry.collectWidgetData();
    if (Object.keys(data).length === 0) return;
    await this.#update(data);
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Write data to the native widget layer.
   * @param {object} data — keyed by feature id
   */
  async #update(data) {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.log("[WidgetBridge] sync:", data);
    }
    // TODO: Capacitor plugin — write to SharedPreferences
    // Capacitor.Plugins.EliasWidget.updateWidget(data);
  }
}

/** Singleton instance. */
export const widgetBridge = new WidgetBridge();

export default WidgetBridge;
