# Elias App

Capacitor-powered companion app with Live2D interactive homepage and Android widget. Same codebase serves the web console and builds to native Android APK.

## Architecture

```
platforms/app/              ← this repo
  frontend/                 ← Web frontend (SPA)
    index.html
    css/
      main.css              ← Glassmorphism design system
      home.css              ← Homepage styles
      live2d.css            ← Live2D canvas + bubble overlay
    js/
      api.js                ← API client (configurable BASE, JWT fallback)
      app.js                ← SPA router + FeatureRegistry integration
      home.js               ← Homepage (widgets + greeting)
      core/
        Feature.js          ← Abstract base class for all features
        FeatureRegistry.js  ← Singleton: registration, lifecycle, tabs
        WidgetBridge.js     ← Interface: native widget data bridge
      features/
        live2d/             ← Live2DFeature (canvas + bubble + touch)
        chat/               ← ChatFeature (placeholder → existing API)
        goals/              ← GoalsFeature (placeholder → existing API)
        clock/              ← ClockFeature (placeholder)
        weather/            ← WeatherFeature (placeholder)
    live2d/
      README.md             ← Cubism SDK setup instructions
      cubism-core/          ← Cubism SDK for Web (download separately)
      models/               ← Live2D model files (.moc3, textures, motions)
  android/                  ← Capacitor Android platform
    app/src/main/java/com/elias/companion/widget/
      WidgetProvider.kt     ← Glance widget (placeholder)
  capacitor.config.ts       ← Capacitor configuration
  API.md                    ← Full REST API documentation
```

## Quick Start

```bash
npm install
```

### Web (browser development)

Visit `http://localhost:3457` — the Express server in `platforms/web/` serves this frontend.

### Android

```bash
# 1. Set up Android SDK (Android Studio)
# 2. Sync Capacitor
npx cap sync

# 3. Run on device/emulator
npx cap open android
```

For live reload during development, uncomment `server.url` in `capacitor.config.ts`.

### PWA (deprecated — replaced by Capacitor native app)

See git history for PWA manifest + service worker files.

## Feature System

The app uses an OOP Feature registry pattern:

```js
// All features extend the abstract base class
class MyFeature extends Feature {
  async mount(container) { /* render to DOM */ }
  async unmount() { /* clean up */ }
  getWidgetData() { return { ... }; }  // for native widget
}
```

The `FeatureRegistry` singleton manages registration, tab discovery, lifecycle broadcasting (resume/pause/timeTick), and widget data aggregation. Each feature tab in the sidebar is backed by a registered Feature instance.

## Testing

Tests are in `platforms/web/tests/` (Node.js vitest + jsdom):

```bash
cd ../web
npx vitest run
```

## API

See [API.md](API.md) for complete REST API reference.

## Live2D Setup

1. Download [Cubism SDK for Web](https://www.live2d.com/en/download/cubism-sdk/download-web/)
2. Place `live2dcubismcore.min.js` in `frontend/live2d/cubism-core/`
3. Place model files in `frontend/live2d/models/<persona>/`
4. The free Hiyori model is available for testing: https://www.live2d.com/en/download/sample-data/

The `Live2DFeature` currently renders a placeholder canvas. Once the SDK and model are in place, swap `Live2DModel.js` with the real Cubism implementation.

## Widget

Android Glance widget at `WidgetProvider.kt`. Currently a placeholder — renders persona name + greeting from SharedPreferences. Data is written by the `WidgetBridge` Capacitor plugin (interface defined in `frontend/js/core/WidgetBridge.js`).

## License

MIT
