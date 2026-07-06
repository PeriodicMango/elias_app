// ---------------------------------------------------------------------------
// TouchHandler — hit-test + motion trigger
// ---------------------------------------------------------------------------
// Placeholder. With Cubism SDK, uses CubismModelMatrix hit-test API
// to detect which drawable area was touched, then triggers the
// corresponding motion/expression.
// ---------------------------------------------------------------------------

/**
 * Maps touch regions to motion groups and response types.
 *
 * @interface
 */
export class TouchHandler {
  /** @type {import("./Live2DModel.js").Live2DModel | null} */
  model = null;

  /**
   * Region definitions: [id, label, motionGroup, expressionId]
   * @type {Array<[string, string, string, string]>}
   */
  static REGIONS = [
    ["HitHead",   "head",   "TapHead",   ""],
    ["HitBody",   "body",   "TapBody",   ""],
    ["HitHead",   "head",   "Nod",       "Smile"],
    ["HitBody",   "chest",  "Shy",       "Blush"],
  ];

  /**
   * @param {import("./Live2DModel.js").Live2DModel} model
   */
  constructor(model) {
    this.model = model;
  }

  /**
   * Handle a touch at canvas coordinates.
   * @param {number} x
   * @param {number} y
   * @returns {{ region: string, motion: string } | null}
   */
  handle(x, y) {
    if (!this.model || !this.model.loaded) return null;

    const hitArea = this.model.hitTest(x, y);
    if (!hitArea) return null;

    const match = TouchHandler.REGIONS.find(([id]) => id === hitArea);
    if (!match) return null;

    const [, label, motion, expression] = match;
    this.model.startMotion(motion);
    if (expression) this.model.setExpression(expression);

    return { region: label, motion };
  }
}

export default TouchHandler;
