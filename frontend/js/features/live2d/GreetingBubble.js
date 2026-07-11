// ---------------------------------------------------------------------------
// GreetingBubble — LLM-generated greeting text overlay
// ---------------------------------------------------------------------------
// Fetches /api/home/greeting and displays the persona's greeting
// as a floating speech bubble over the Live2D canvas.
// ---------------------------------------------------------------------------

import { getToken } from "../../api.js";

const GREETING_API = "/api/home/greeting";

export class GreetingBubble {
  /** @type {HTMLElement | null} */
  #el = null;

  /** @type {string} */
  #persona;

  /** @type {string} */
  #text = "";

  /** @type {boolean} */
  #visible = false;

  /**
   * @param {string} persona
   */
  constructor(persona = "elias") {
    this.#persona = persona;
  }

  /** @returns {string} */
  get persona() { return this.#persona; }
  set persona(p) {
    this.#persona = p;
    this.refresh();
  }

  /** @returns {string} */
  get text() { return this.#text; }

  /** @returns {boolean} */
  get visible() { return this.#visible; }

  // -----------------------------------------------------------------------
  // DOM
  // -----------------------------------------------------------------------

  /**
   * Create and mount the bubble element.
   * @param {HTMLElement} parent
   */
  mount(parent) {
    this.#el = document.createElement("div");
    this.#el.className = "greeting-bubble";
    this.#el.setAttribute("aria-live", "polite");
    parent.appendChild(this.#el);
  }

  /**
   * Remove from DOM.
   */
  unmount() {
    if (this.#el && this.#el.parentNode) {
      this.#el.parentNode.removeChild(this.#el);
    }
    this.#el = null;
  }

  // -----------------------------------------------------------------------
  // API
  // -----------------------------------------------------------------------

  /**
   * Fetch a fresh greeting from the backend.
   * @returns {Promise<string>}
   */
  async refresh() {
    try {
      const token = getToken();
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${GREETING_API}?persona=${encodeURIComponent(this.#persona)}`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.#text = data.greeting ?? "";
      if (this.#el) this.#el.textContent = this.#text;
      return this.#text;
    } catch (e) {
      console.warn("[GreetingBubble] fetch failed:", e);
      this.#text = "嗯。";
      if (this.#el) this.#el.textContent = this.#text;
      return this.#text;
    }
  }

  /**
   * Show the bubble with a fade-in animation.
   */
  show() {
    this.#visible = true;
    if (this.#el) {
      this.#el.classList.add("visible");
      this.#el.setAttribute("aria-hidden", "false");
    }
  }

  /**
   * Hide the bubble.
   */
  hide() {
    this.#visible = false;
    if (this.#el) {
      this.#el.classList.remove("visible");
      this.#el.setAttribute("aria-hidden", "true");
    }
  }
}

export default GreetingBubble;
