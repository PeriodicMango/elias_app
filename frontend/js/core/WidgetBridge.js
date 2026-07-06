// ---------------------------------------------------------------------------
// WidgetBridge — interface for native widget data exchange
// ---------------------------------------------------------------------------
// Placeholder. In the Capacitor build, this will be backed by a Capacitor
// plugin that writes to Android SharedPreferences (or a ContentProvider)
// so the Glance widget can read persona name + latest greeting.
//
// For web (non-Capacitor), this is a no-op stub.
// ---------------------------------------------------------------------------

/**
 * Interface for native widget data bridge.
 *
 * In the Capacitor build, replace this with a plugin-backed implementation
 * that writes widget data to the native layer.
 *
 * @interface
 */
export class WidgetBridge {
  /**
   * Update the data visible to the native widget.
   * @param {object} data - key-value pairs (persona, greeting, unread, ...)
   * @returns {Promise<void>}
   */
  async update(data) {
    // Placeholder: log to console in dev, no-op in prod.
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.log("[WidgetBridge] update:", data);
    }
    // TODO: Capacitor plugin — write to SharedPreferences
    // Capacitor.Plugins.EliasWidget.updateWidget(data);
  }

  /**
   * Schedule the widget refresh interval.
   * @param {number} intervalMinutes
   * @returns {Promise<void>}
   */
  async scheduleRefresh(_intervalMinutes) {
    // Placeholder
    // TODO: Capacitor plugin — schedule WorkManager periodic task
  }
}

/** Singleton instance. */
export const widgetBridge = new WidgetBridge();

export default WidgetBridge;
