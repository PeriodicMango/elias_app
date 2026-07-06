// ---------------------------------------------------------------------------
// DEPRECATED — replaced by ModelRenderer + Live2DModelRenderer
// Use Live2DFeature with rendererType: "live2d" instead.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

/**
 * Interface for a Live2D model instance.
 *
 * Implement with Cubism SDK: load .model3.json, attach to renderer,
 * update on each frame, handle motion/expression/parameter updates.
 *
 * @interface
 */
export class Live2DModel {
  /** @type {string} */
  modelPath;

  /** @type {boolean} */
  loaded = false;

  /**
   * @param {string} modelPath - path to .model3.json relative to frontend/
   */
  constructor(modelPath) {
    this.modelPath = modelPath;
  }

  /**
   * Load the model and its assets.
   * @returns {Promise<void>}
   */
  async load() {
    // Placeholder
    // TODO: LAppModel.loadAssets(this.modelPath)
    //       → CubismFramework.initialize()
    //       → model.loadAssets()
    //       → createRenderer()
    this.loaded = true;
    console.log(`[Live2DModel] Placeholder: ${this.modelPath} (load not implemented)`);
  }

  /**
   * Update model parameters. Called once per frame.
   * @param {number} _deltaSeconds
   */
  update(_deltaSeconds) {
    // Placeholder
    // TODO: model.update()
    //       physics.evaluate()
    //       pose.updateParameters()
  }

  /**
   * Hit-test against the model's drawables.
   * @param {number} _x - canvas x coordinate
   * @param {number} _y - canvas y coordinate
   * @returns {string | null} hit area ID or null
   */
  hitTest(_x, _y) {
    // Placeholder
    return null;
    // TODO: model.hitTest(x, y) → hitAreaName
  }

  /**
   * Start a motion animation.
   * @param {string} _group - motion group name
   * @param {number} [_no=0] - motion number within the group
   */
  startMotion(_group, _no = 0) {
    // Placeholder
    // TODO: model.startMotion(group, no, priority)
  }

  /**
   * Set an expression.
   * @param {string} _expressionId
   */
  setExpression(_expressionId) {
    // Placeholder
    // TODO: model.setExpression(expressionId)
  }

  /**
   * Release model resources.
   */
  release() {
    this.loaded = false;
    // TODO: model.release()
    //       CubismFramework.dispose()
  }
}

export default Live2DModel;
