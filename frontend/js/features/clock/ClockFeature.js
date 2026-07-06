// ---------------------------------------------------------------------------
// ClockFeature — clock/alarm placeholder
// ---------------------------------------------------------------------------

import { Feature } from "../../core/Feature.js";

export class ClockFeature extends Feature {
  constructor(config = {}) {
    super("clock", "utility", {
      icon: "🕐",
      label: "Clock",
      ...config,
    });
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = `
      <div class="card">
        <div class="card-header">🕐 Clock</div>
        <div class="card-body">
          <p style="color:var(--text-secondary);">Clock feature — placeholder.</p>
        </div>
      </div>`;
  }

  async unmount() {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
  }
}

export default ClockFeature;
