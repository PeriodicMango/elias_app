// ---------------------------------------------------------------------------
// GoalsFeature — connects to existing /api/goals
// ---------------------------------------------------------------------------

import { Feature } from "../../core/Feature.js";

export class GoalsFeature extends Feature {
  constructor(config = {}) {
    super("goals", "tool", {
      icon: "📋",
      label: "Goals",
      ...config,
    });
  }

  async mount(container) {
    this.container = container;
    // Reuse existing goals rendering from app.js
    // This placeholder signals that the feature exists and will
    // delegate to the existing renderGoals function.
    container.innerHTML = `
      <div class="card">
        <div class="card-header">📋 Goals</div>
        <div class="card-body">
          <p style="color:var(--text-secondary);">Goals — delegating to existing /api/goals backend.</p>
        </div>
      </div>`;
  }

  async unmount() {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
  }
}

export default GoalsFeature;
