// ---------------------------------------------------------------------------
// WeatherFeature — weather display placeholder
// ---------------------------------------------------------------------------

import { Feature } from "../../core/Feature.js";

export class WeatherFeature extends Feature {
  constructor(config = {}) {
    super("weather", "utility", {
      icon: "🌤️",
      label: "Weather",
      ...config,
    });
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = `
      <div class="card">
        <div class="card-header">🌤️ Weather</div>
        <div class="card-body">
          <p style="color:var(--text-secondary);">Weather feature — placeholder.</p>
        </div>
      </div>`;
  }

  async unmount() {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
  }
}

export default WeatherFeature;
