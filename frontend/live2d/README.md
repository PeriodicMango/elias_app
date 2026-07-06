# Live2D Cubism SDK for Web

This directory contains the Cubism SDK for Web runtime.

## Setup

1. Download the Cubism SDK for Web from the [Live2D website](https://www.live2d.com/en/download/cubism-sdk/download-web/)
2. Extract and place the following files here:
   - `live2dcubismcore.min.js` — Cubism Core (WebAssembly)
   - `live2dcubismcore.d.ts` — TypeScript declarations (optional)

3. For model files, place them in `live2d/models/<persona>/`:
   - `<persona>.model3.json` — model manifest
   - `<persona>.moc3` — compiled model
   - `<persona>.<index>.png` — textures
   - `motions/*.motion3.json` — animations
   - `expressions/*.exp3.json` — expressions (optional)
   - `<persona>.physics3.json` — physics (optional)

## Free test model

Until custom persona models are ready, use the free Hiyori model:
- Download: https://www.live2d.com/en/download/sample-data/
- Place in: `live2d/models/hiyori/`

## License

The Cubism SDK Runtime is subject to the Live2D Proprietary Software License.
For annual revenue under 10 million yen (~$67K USD), the publishing license
fee is waived.

See: https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html
