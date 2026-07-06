// ---------------------------------------------------------------------------
// IdleController — natural breathing, blinking, random idle motions
// ---------------------------------------------------------------------------
// Placeholder. With Cubism SDK, drives parameter updates for
// ParamBreath, ParamEyeLOpen/ROpen, and triggers random idle motions
// on a timer.
// ---------------------------------------------------------------------------

/**
 * Controls idle animations: breathing cycle, blinking, random motions.
 *
 * @interface
 */
export class IdleController {
  /** @type {import("./Live2DModel.js").Live2DModel | null} */
  model = null;

  /** @type {number} */
  #blinkTimer = 0;

  /** @type {number} */
  #idleMotionTimer = 0;

  /** @type {number} */
  #blinkPhase = 0; // 0=open, 1=closing, 2=closed, 3=opening

  /** @type {number} */
  #breathPhase = 0;

  /**
   * @param {import("./Live2DModel.js").Live2DModel} model
   */
  constructor(model) {
    this.model = model;
    this.#idleMotionTimer = 15 + Math.random() * 30; // random first idle
  }

  /**
   * Update idle state. Call once per frame with delta seconds.
   * @param {number} deltaSeconds
   */
  update(deltaSeconds) {
    this.#updateBreath(deltaSeconds);
    this.#updateBlink(deltaSeconds);
    this.#updateIdleMotion(deltaSeconds);
  }

  #updateBreath(dt) {
    this.#breathPhase += dt * 0.8; // ~5 second cycle
    // TODO: model.setParameter("ParamBreath", sin curve)
  }

  #updateBlink(dt) {
    this.#blinkTimer += dt;
    const blinkInterval = 3 + Math.random() * 5; // 3-8 seconds

    if (this.#blinkTimer > blinkInterval && this.#blinkPhase === 0) {
      this.#blinkPhase = 1;
      this.#blinkTimer = 0;
    }

    // Simple blink phases
    if (this.#blinkPhase > 0) {
      const blinkDt = dt * 10; // fast blink
      this.#blinkPhase += blinkDt;
      if (this.#blinkPhase >= 4) {
        this.#blinkPhase = 0;
      }
      // TODO: model.setParameter("ParamEyeLOpen", blink value)
      // TODO: model.setParameter("ParamEyeROpen", blink value)
    }
  }

  #updateIdleMotion(dt) {
    this.#idleMotionTimer -= dt;
    if (this.#idleMotionTimer <= 0) {
      // TODO: model.startMotion("Idle", randomMotionIndex)
      this.#idleMotionTimer = 15 + Math.random() * 30; // 15-45 seconds
    }
  }
}

export default IdleController;
