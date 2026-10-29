# Gamia static hosting

Published game: https://gamia-ai-games.com/game/qianli-zou-dan-qi/

The host bootstrap enables the same full-art/settings/camera UI defaults on the canonical Gamia apex and www hosts, using history.replaceState to retain subpaths without document-reload loops.

Build the static artifact with `node tools/build-pages.mjs <output-directory> --optimize-web`. The optional web profile creates content-addressed WebP derivatives from assets/manifest.json, verifies image dimensions and exact alpha, and rewrites only image paths in the generated manifest. Original source images and numeric/collision metadata remain unchanged. RGB is high-quality lossy (opaque Q88, transparent Q90); the alpha channel is lossless. A complete conversion receipt is written to web-optimization.json.

The web profile bundles SpecLoader.ts with Vite into browser JavaScript, retains its existing URL path, and versions the runtime import by the compiled content hash. Static hosting must serve release.webProfile.compiledModules with Content-Type application/javascript; charset=utf-8. This avoids storage MIME inference of .ts as a transport-stream video. The compiled loader defaults were deep-compared with all eleven raw JSON specs.

A release.json file records the gameplay source commit and SHA256 hashes for the scripts, generated manifest, compiled module, optimization receipt, and HTML. The Gamia deployment freezes this directory into games/qianli-zou-dan-qi/{commit}/ and rewrites the canonical /game/ path to it.

Gamia source/deployment owner is D:/Codex/Droi-AI-landing-temp(Rebuild stage2）. Its deploy/publish-qianli-home.ps1 handles immutable object upload, MIME/cache metadata, scoped URL-map updates and fingerprint checks. It does not redeploy unrelated frontend/worker changes. Its scripts/verify-qianli-home-release.mjs checks actual homepage selection, art, play link, browser startup, compiled loader, keyboard movement, pause/resume and enemy spawning on the public domain.

2026-10-29 gameplay baseline remains 2bf29f87fc2f6011c37c683e324a6363672e80d2 (previous public full clear). Hosting artifact 04dc76ab646c328055a7148d7ddaf134de5f0442 changes the host bootstrap and packaging only. Do not describe the short Gamia hosting acceptance as a second full campaign clear.