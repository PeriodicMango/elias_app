// ---------------------------------------------------------------------------
// ChatFeature — connects to existing /api/chat backend
// ---------------------------------------------------------------------------

import { Feature } from "../../core/Feature.js";

export class ChatFeature extends Feature {
  constructor(config = {}) {
    super("chat", "companion", {
      icon: "💬",
      label: "Chat",
      persona: "elias",
      ...config,
    });
  }

  async mount(container) {
    this.container = container;
    // Placeholder: delegates to existing renderChat in app.js
    container.innerHTML = `
      <div class="card">
        <div class="card-header">💬 Chat</div>
        <div class="card-body">
          <p style="color:var(--text-secondary);">Chat — delegating to existing /api/chat backend.</p>
        </div>
      </div>`;
  }

  async unmount() {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
  }
}

export default ChatFeature;
