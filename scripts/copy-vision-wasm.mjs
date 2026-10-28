// Copies the MediaPipe vision runtime (face detection on the intake form) from
// node_modules to public/vendor/mediapipe, so it is served from our own origin
// (the CSP allows no third-party scripts). Runs before `dev` and `build`; the
// copy is not committed. Only the SIMD build is used (every current browser).
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const from = "node_modules/@mediapipe/tasks-vision/wasm";
const to = "public/vendor/mediapipe";
mkdirSync(to, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) copyFileSync(join(from, file), join(to, file));
