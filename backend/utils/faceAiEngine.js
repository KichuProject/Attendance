/**
 * Real AI Face Detection, Passive Anti-Spoofing & Recognition Engine (Backend - Pure JS + WASM)
 *
 * Neural Networks Loaded (all running on unified TensorFlow.js WASM backend, zero C++ builds):
 *  1. SSD MobileNet v1 + TinyFaceDetector (@vladmandic/face-api) — Human face detection
 *  2. 68-Point Facial Landmarks (@vladmandic/face-api)          — Face alignment
 *  3. ResNet-34 Face Recognition (@vladmandic/face-api)         — 128-D biometric face embedding
 *  4. Passive Anti-Spoof CNN (@vladmandic/human antispoof.json) — Real face vs printed photo / phone screen
 *  5. Passive Liveness CNN (@vladmandic/human liveness.json)    — Live person vs replay / spoof attack
 */

const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');

const MODEL_TAG = 'faceapi-resnet34-v1';

// Identity matching threshold (ResNet-34 128-D Euclidean distance)
// Same person: typically 0.18 - 0.48 | Different person: typically 0.62 - 0.95
const DEFAULT_MAX_DISTANCE = 0.52;

// Face detection thresholds
const MIN_SSD_CONFIDENCE = 0.45;
const MIN_TINY_CONFIDENCE = 0.45;
const MAX_DETECT_DIMENSION = 480;

// Passive Anti-Spoofing thresholds (@vladmandic/human antispoof + liveness CNNs)
const MIN_REAL_SCORE = 0.50;      // antispoof.json output (0..1)
const MIN_LIVE_SCORE = 0.50;      // liveness.json output (0..1)
const MIN_COMBINED_SCORE = 0.55;  // weighted average of real + live

let tf = null;
let faceapi = null;
let antispoofModel = null;
let livenessModel = null;
let initPromise = null;
let isInitialized = false;

/**
 * Custom local-filesystem TensorFlow.js IOHandler so GraphModels (.json + .bin)
 * load directly from disk on Windows & Linux without requiring fetch('file://') or tfjs-node.
 */
function createFsGraphModelHandler(modelJsonPath) {
  return {
    load: async () => {
      const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
      const modelDir = path.dirname(modelJsonPath);
      const weightSpecs = [];
      const weightBuffers = [];

      for (const group of modelJson.weightsManifest || []) {
        weightSpecs.push(...group.weights);
        for (const relPath of group.paths) {
          weightBuffers.push(fs.readFileSync(path.join(modelDir, relPath)));
        }
      }

      const merged = Buffer.concat(weightBuffers);
      const weightData = merged.buffer.slice(
        merged.byteOffset,
        merged.byteOffset + merged.byteLength
      );

      return {
        modelTopology: modelJson.modelTopology,
        format: modelJson.format,
        generatedBy: modelJson.generatedBy,
        convertedBy: modelJson.convertedBy,
        weightSpecs,
        weightData,
      };
    },
  };
}

/**
 * Lazily initializes unified TensorFlow.js WASM backend and loads all 5 neural networks from disk.
 */
async function initFaceAiEngine() {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const startTime = Date.now();
    const wasm = require('@tensorflow/tfjs-backend-wasm');

    // Load @vladmandic/face-api Node WASM build and use its unified TFJS instance
    faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    tf = faceapi.tf;

    // Point WASM backend to local prebuilt .wasm binaries inside node_modules
    const wasmDistPath =
      path.join(
        path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')),
        'dist'
      ) + path.sep;
    wasm.setWasmPaths(wasmDistPath);

    try {
      await tf.setBackend('wasm');
      await tf.ready();
    } catch (wasmErr) {
      console.warn('[FaceAI] WASM backend unavailable, falling back to CPU:', wasmErr.message);
      await tf.setBackend('cpu');
      await tf.ready();
    }

    // 1. Load Face Detection, Landmark & ResNet-34 Recognition models from @vladmandic/face-api
    const faceApiModelDir = path.join(
      path.dirname(require.resolve('@vladmandic/face-api/package.json')),
      'model'
    );

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(faceApiModelDir);
    await faceapi.nets.tinyFaceDetector.loadFromDisk(faceApiModelDir);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(faceApiModelDir);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(faceApiModelDir);

    // 2. Load Passive Anti-Spoof & Liveness CNNs from @vladmandic/human/models
    const humanModelDir = path.join(
      __dirname,
      '..',
      'node_modules',
      '@vladmandic',
      'human',
      'models'
    );

    antispoofModel = await tf.loadGraphModel(
      createFsGraphModelHandler(path.join(humanModelDir, 'antispoof.json'))
    );
    livenessModel = await tf.loadGraphModel(
      createFsGraphModelHandler(path.join(humanModelDir, 'liveness.json'))
    );

    isInitialized = true;
    console.log(
      `[FaceAI] Loaded 5 neural models (SSD + Tiny + Landmarks68 + ResNet34 + AntiSpoof + Liveness) on '${tf.getBackend()}' in ${Date.now() - startTime}ms`
    );
    return true;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/**
 * Decodes a base64 JPEG string into:
 *  - fullTensor: full-resolution RGB Tensor3D [H, W, 3] (preserves sharp screen moire/paper textures for Anti-Spoof)
 *  - detectTensor: downscaled RGB Tensor3D (<= 480px) for fast face detection & recognition
 */
function decodeBase64ToTensors(base64Input) {
  if (!base64Input || typeof base64Input !== 'string') {
    throw new Error('Valid base64 image string is required');
  }

  const cleanBase64 = base64Input.replace(/^data:image\/\w+;base64,/, '').trim();
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length < 500) {
    throw new Error('Captured image is empty or corrupted');
  }

  const decoded = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 256 });
  const { width, height, data } = decoded;

  if (!width || !height || !data) {
    throw new Error('Failed to decode JPEG image');
  }

  // Convert RGBA -> RGB Int32Array for faceapi.tf
  const rgb = new Int32Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }

  const fullTensor = tf.tensor3d(rgb, [height, width, 3], 'int32');

  const maxDim = Math.max(width, height);
  if (maxDim > MAX_DETECT_DIMENSION) {
    const scale = MAX_DETECT_DIMENSION / maxDim;
    const newH = Math.max(64, Math.round(height * scale));
    const newW = Math.max(64, Math.round(width * scale));
    const detectTensor = tf.tidy(() =>
      tf.image.resizeBilinear(fullTensor, [newH, newW]).round().toInt()
    );
    return {
      fullTensor,
      fullWidth: width,
      fullHeight: height,
      detectTensor,
      detectWidth: newW,
      detectHeight: newH,
      isSeparateDetect: true,
    };
  }

  return {
    fullTensor,
    fullWidth: width,
    fullHeight: height,
    detectTensor: fullTensor,
    detectWidth: width,
    detectHeight: height,
    isSeparateDetect: false,
  };
}

/**
 * Rotates a 3D image tensor [H, W, 3] by 90° clockwise or 270° (counter-clockwise).
 */
function rotateTensor90(tensor, clockwise = true) {
  return tf.tidy(() => {
    const transposed = tensor.transpose([1, 0, 2]);
    return clockwise ? transposed.reverse(1) : transposed.reverse(0);
  });
}

/**
 * Runs SSD MobileNet v1 (with TinyFaceDetector fallback for backlit lighting)
 * + 68-Point Facial Landmarks + ResNet-34 128-D Descriptor.
 */
async function detectOnTensor(tensor) {
  const ssdOptions = new faceapi.SsdMobilenetv1Options({
    minConfidence: MIN_SSD_CONFIDENCE,
    maxResults: 5,
  });

  let detections = await faceapi
    .detectAllFaces(tensor, ssdOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections && detections.length > 0) {
    return detections;
  }

  // Fallback to TinyFaceDetector for backlit / strong overhead office light scenes
  const tinyOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: MIN_TINY_CONFIDENCE,
  });

  detections = await faceapi
    .detectAllFaces(tensor, tinyOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections || [];
}

/**
 * Runs Passive Anti-Spoofing (antispoof.json + liveness.json) on the detected face crop.
 * Matches @vladmandic/human preprocessing verbatim:
 *  - Enlarges face box by 1.4x and squarifies around face center
 *  - Crops from full-resolution image to preserve high-frequency screen moire / paper artifacts
 *  - Normalizes pixels to [0..1] float32
 *  - Evaluates antispoof (128x128) -> realScore and liveness (32x32) -> liveScore
 */
async function runPassiveAntiSpoof(sourceTensor, imgW, imgH, box, detectW, detectH) {
  if (!antispoofModel || !livenessModel) {
    throw new Error('Passive Anti-Spoof models are not initialized');
  }

  // Map bounding box from detection resolution to full-resolution source tensor coordinates
  const scaleX = imgW / Math.max(1, detectW);
  const scaleY = imgH / Math.max(1, detectH);

  const bx = box.x * scaleX;
  const by = box.y * scaleY;
  const bw = box.width * scaleX;
  const bh = box.height * scaleY;

  // Enlarge box by 1.4x and squarify (matching @vladmandic/human blazeface/facemeshutil)
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const side = Math.max(bw, bh) * 1.4;

  const y1 = Math.max(0, Math.min(1, (cy - side / 2) / imgH));
  const y2 = Math.max(0, Math.min(1, (cy + side / 2) / imgH));
  const x1 = Math.max(0, Math.min(1, (cx - side / 2) / imgW));
  const x2 = Math.max(0, Math.min(1, (cx + side / 2) / imgW));

  let realScore = 0;
  let liveScore = 0;

  const t4 = tf.tidy(() => sourceTensor.toFloat().expandDims(0));
  const crop128 = tf.tidy(() =>
    tf.image.cropAndResize(t4, [[y1, x1, y2, x2]], [0], [128, 128]).div(255)
  );
  const crop32 = tf.tidy(() =>
    tf.image.cropAndResize(t4, [[y1, x1, y2, x2]], [0], [32, 32]).div(255)
  );

  let antiOut = null;
  let liveOut = null;
  try {
    antiOut = antispoofModel.execute(crop128);
    liveOut = livenessModel.execute(crop32);

    const antiData = await antiOut.data();
    const liveData = await liveOut.data();

    realScore = Number((antiData[0] || 0).toFixed(4));
    liveScore = Number((liveData[0] || 0).toFixed(4));
  } finally {
    tf.dispose([t4, crop128, crop32, antiOut, liveOut]);
  }

  const combinedScore = Number((realScore * 0.55 + liveScore * 0.45).toFixed(4));
  const passed =
    realScore >= MIN_REAL_SCORE &&
    liveScore >= MIN_LIVE_SCORE &&
    combinedScore >= MIN_COMBINED_SCORE;

  console.log(
    `[FaceAI AntiSpoof] Real: ${(realScore * 100).toFixed(1)}% (min ${MIN_REAL_SCORE * 100}%) | Live: ${(liveScore * 100).toFixed(1)}% (min ${MIN_LIVE_SCORE * 100}%) | Combined: ${(combinedScore * 100).toFixed(1)}% | Result: ${passed ? 'LIVE PASS' : 'SPOOF BLOCKED'}`
  );

  return {
    passed,
    realScore,
    liveScore,
    combinedScore,
    realPercent: Math.round(realScore * 100),
    livePercent: Math.round(liveScore * 100),
  };
}

/**
 * Maps screen-space normalized oval bounds { cx, cy, rx, ry, screenW, screenH }
 * into the captured JPEG image's exact normalized [0..1] coordinate space,
 * accounting for CameraView's center-crop FILL aspect ratio scaling.
 */
function resolveImageOval(ovalBounds, imgW, imgH) {
  // Default center oval if client didn't send measured screen bounds
  const defaultOval = { cx: 0.5, cy: 0.44, rx: 0.28, ry: 0.24 };

  if (!ovalBounds || typeof ovalBounds !== 'object') {
    return defaultOval;
  }

  const rawCx = Number(ovalBounds.cx);
  const rawCy = Number(ovalBounds.cy);
  const rawRx = Number(ovalBounds.rx);
  const rawRy = Number(ovalBounds.ry);
  const screenW = Number(ovalBounds.screenW);
  const screenH = Number(ovalBounds.screenH);

  if (
    !Number.isFinite(rawCx) ||
    !Number.isFinite(rawCy) ||
    !Number.isFinite(rawRx) ||
    !Number.isFinite(rawRy) ||
    rawRx <= 0.05 ||
    rawRy <= 0.05
  ) {
    return defaultOval;
  }

  // If valid screen dimensions were supplied, apply exact FILL center-crop mapping
  if (Number.isFinite(screenW) && Number.isFinite(screenH) && screenW > 0 && screenH > 0) {
    const scale = Math.max(screenW / imgW, screenH / imgH);
    const renderedW = imgW * scale;
    const renderedH = imgH * scale;
    const offsetX = (renderedW - screenW) / 2;
    const offsetY = (renderedH - screenH) / 2;

    const screenCx = rawCx * screenW;
    const screenCy = rawCy * screenH;
    const screenRx = rawRx * screenW;
    const screenRy = rawRy * screenH;

    return {
      cx: Math.max(0.1, Math.min(0.9, (screenCx + offsetX) / renderedW)),
      cy: Math.max(0.1, Math.min(0.9, (screenCy + offsetY) / renderedH)),
      rx: Math.max(0.1, Math.min(0.49, screenRx / renderedW)),
      ry: Math.max(0.1, Math.min(0.49, screenRy / renderedH)),
    };
  }

  return {
    cx: Math.max(0.1, Math.min(0.9, rawCx)),
    cy: Math.max(0.1, Math.min(0.9, rawCy)),
    rx: Math.max(0.1, Math.min(0.49, rawRx)),
    ry: Math.max(0.1, Math.min(0.49, rawRy)),
  };
}

/**
 * Checks whether a normalized point (nx, ny) lies inside an ellipse { cx, cy, rx, ry }
 * scaled by optional `radiusScale`.
 */
function ellipseDistSq(nx, ny, oval, radiusScale = 1.0) {
  const dx = (nx - oval.cx) / Math.max(0.01, oval.rx * radiusScale);
  const dy = (ny - oval.cy) / Math.max(0.01, oval.ry * radiusScale);
  return { dx, dy, distSq: dx * dx + dy * dy };
}

/**
 * Strictly validates that the detected face center, key facial landmarks
 * (eyes, nose, mouth), and face size sit cleanly inside the exact oval frame.
 */
function validateFaceInsideOval(face, imgW, imgH, oval) {
  const box = face.detection.box;
  const faceCx = (box.x + box.width / 2) / imgW;
  const faceCy = (box.y + box.height / 2) / imgH;

  const { dx, dy, distSq: centerDistSq } = ellipseDistSq(faceCx, faceCy, oval, 1.0);

  // 1. Face center must sit clearly inside the oval (within ~78% of oval radius from center)
  if (centerDistSq > 0.62) {
    let hint = 'Face is outside the oval! Center your face inside the oval frame.';
    if (Math.abs(dx) > Math.abs(dy)) {
      hint = 'Face is outside the oval! Move your face horizontally into the center of the oval.';
    } else if (dy < 0) {
      hint = 'Face is too high! Move down slightly so your face sits inside the oval.';
    } else {
      hint = 'Face is too low! Move up slightly so your face sits inside the oval.';
    }
    return { ok: false, code: 'FACE_OUTSIDE_OVAL', error: hint };
  }

  // 2. Core facial landmarks (left eye, right eye, nose tip, mouth corners) must lie strictly inside the oval
  if (face.landmarks) {
    const pts = face.landmarks.positions || [];
    const keyIndices = [36, 39, 42, 45, 30, 48, 54];
    for (const idx of keyIndices) {
      const pt = pts[idx];
      if (!pt) continue;
      const px = pt.x / imgW;
      const py = pt.y / imgH;
      const { distSq } = ellipseDistSq(px, py, oval, 1.0);
      if (distSq > 1.02) {
        return {
          ok: false,
          code: 'FACE_OUTSIDE_OVAL',
          error: 'Keep your full face (eyes, nose & mouth) completely inside the oval.',
        };
      }
    }
  }

  // 3. Face size relative to oval (prevent tiny distant faces inside the oval)
  const ovalWidthPx = oval.rx * 2 * imgW;
  const faceToOvalRatio = box.width / Math.max(1, ovalWidthPx);
  if (faceToOvalRatio < 0.28) {
    return {
      ok: false,
      code: 'FACE_UNCLEAR',
      error: 'Move closer to the camera so your face fills the oval frame.',
    };
  }

  return { ok: true };
}

/**
 * Full AI pipeline on a base64 JPEG camera photo:
 *  1. Human face detection
 *  2. Oval-only filtering & strict inside-oval center + landmark containment check (faces outside oval are rejected)
 *  3. Passive Anti-Spoof + Liveness check on full-res crop (blocks printed photos & phone screens)
 *  4. ResNet-34 128-D face embedding extraction
 */
async function extractFaceDescriptor(base64Image, ovalBounds = null) {
  await initFaceAiEngine();

  let decodedObj;
  try {
    decodedObj = decodeBase64ToTensors(base64Image);
  } catch (err) {
    return {
      ok: false,
      code: 'INVALID_IMAGE',
      error: 'Could not read camera photo. Please try capturing again.',
    };
  }

  const {
    fullTensor,
    fullWidth,
    fullHeight,
    detectTensor,
    detectWidth,
    detectHeight,
    isSeparateDetect,
  } = decodedObj;

  const extraTensors = [];

  try {
    let activeDetectW = detectWidth;
    let activeDetectH = detectHeight;
    let activeFullTensor = fullTensor;
    let activeFullW = fullWidth;
    let activeFullH = fullHeight;

    let detections = await detectOnTensor(detectTensor);

    // Rotation fallback if an Android camera returns a 90°/270° rotated frame
    if (detections.length === 0) {
      const rot90 = rotateTensor90(detectTensor, true);
      extraTensors.push(rot90);
      detections = await detectOnTensor(rot90);
      if (detections.length > 0) {
        activeDetectW = detectHeight;
        activeDetectH = detectWidth;
        if (isSeparateDetect) {
          const fullRot90 = rotateTensor90(fullTensor, true);
          extraTensors.push(fullRot90);
          activeFullTensor = fullRot90;
        } else {
          activeFullTensor = rot90;
        }
        activeFullW = fullHeight;
        activeFullH = fullWidth;
      }
    }

    if (detections.length === 0) {
      const rot270 = rotateTensor90(detectTensor, false);
      extraTensors.push(rot270);
      detections = await detectOnTensor(rot270);
      if (detections.length > 0) {
        activeDetectW = detectHeight;
        activeDetectH = detectWidth;
        if (isSeparateDetect) {
          const fullRot270 = rotateTensor90(fullTensor, false);
          extraTensors.push(fullRot270);
          activeFullTensor = fullRot270;
        } else {
          activeFullTensor = rot270;
        }
        activeFullW = fullHeight;
        activeFullH = fullWidth;
      }
    }

    if (detections.length === 0) {
      return {
        ok: false,
        code: 'NO_FACE',
        error: 'No face detected! Position your face clearly inside the oval in good lighting.',
      };
    }

    // Resolve exact screen oval in photo coordinates and ONLY inspect faces inside the oval
    const activeOval = resolveImageOval(ovalBounds, activeDetectW, activeDetectH);

    const facesInsideOval = detections.filter((d) => {
      const b = d.detection.box;
      const cx = (b.x + b.width / 2) / activeDetectW;
      const cy = (b.y + b.height / 2) / activeDetectH;
      return ellipseDistSq(cx, cy, activeOval, 1.0).distSq <= 1.0;
    });

    if (facesInsideOval.length === 0) {
      // A face exists in the frame, but it is OUTSIDE the oval!
      const nearest = detections[0];
      const ovalCheck = validateFaceInsideOval(nearest, activeDetectW, activeDetectH, activeOval);
      return {
        ok: false,
        code: 'FACE_OUTSIDE_OVAL',
        error: ovalCheck.error || 'Face is outside the oval! Position your face inside the oval frame.',
      };
    }

    if (facesInsideOval.length > 1) {
      return {
        ok: false,
        code: 'MULTIPLE_FACES',
        error: `Multiple faces detected inside the oval (${facesInsideOval.length}). Only 1 employee is allowed.`,
      };
    }

    const face = facesInsideOval[0];
    const score = Number(face.detection.score.toFixed(4));
    const box = face.detection.box;

    // Strictly verify face center, eyes/nose/mouth landmarks, and size sit inside the oval
    const ovalCheck = validateFaceInsideOval(face, activeDetectW, activeDetectH, activeOval);
    if (!ovalCheck.ok) {
      return ovalCheck;
    }

    // --- Passive Anti-Spoof & Liveness Verification (on unmasked full-res tensor) ---
    const antiSpoof = await runPassiveAntiSpoof(
      activeFullTensor,
      activeFullW,
      activeFullH,
      box,
      activeDetectW,
      activeDetectH
    );

    if (!antiSpoof.passed) {
      return {
        ok: false,
        code: 'SPOOF_DETECTED',
        error: `Live face required! Photo or screen spoof detected (Real: ${antiSpoof.realPercent}%, Live: ${antiSpoof.livePercent}%). Please scan your real face directly.`,
        antiSpoof,
      };
    }

    const descriptor = Array.from(face.descriptor, (v) => Number(v.toFixed(6)));

    return {
      ok: true,
      model: MODEL_TAG,
      descriptor,
      confidence: score,
      antiSpoof,
      faceBox: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    };
  } finally {
    fullTensor.dispose();
    if (isSeparateDetect) {
      detectTensor.dispose();
    }
    for (const t of extraTensors) {
      t.dispose();
    }
  }
}

/**
 * Parses a stored `users.face_embedding` DB column.
 * Returns { valid: true, descriptor: number[] } ONLY if created by our real neural model.
 */
function parseStoredFaceTemplate(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return { valid: false, descriptor: null };
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (
      parsed &&
      !Array.isArray(parsed) &&
      parsed.model === MODEL_TAG &&
      Array.isArray(parsed.descriptor) &&
      parsed.descriptor.length === 128
    ) {
      return { valid: true, descriptor: parsed.descriptor };
    }
    return { valid: false, descriptor: null };
  } catch {
    return { valid: false, descriptor: null };
  }
}

/**
 * Serializes a 128-D neural face descriptor for storage in `users.face_embedding`.
 */
function serializeFaceTemplate(descriptor) {
  return JSON.stringify({
    model: MODEL_TAG,
    version: 1,
    enrolledAt: new Date().toISOString(),
    descriptor,
  });
}

/**
 * Compares two 128-D ResNet-34 face descriptors.
 * Uses Euclidean distance (primary metric for face-api ResNet-34) + Cosine similarity (secondary).
 */
function compareFaceDescriptors(
  registeredDescriptor,
  liveDescriptor,
  maxDistance = DEFAULT_MAX_DISTANCE
) {
  if (
    !Array.isArray(registeredDescriptor) ||
    !Array.isArray(liveDescriptor) ||
    registeredDescriptor.length !== 128 ||
    liveDescriptor.length !== 128
  ) {
    throw new Error('Both face descriptors must be 128-dimensional arrays');
  }

  let sqDiffSum = 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 128; i++) {
    const a = Number(registeredDescriptor[i]) || 0;
    const b = Number(liveDescriptor[i]) || 0;
    const diff = a - b;
    sqDiffSum += diff * diff;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  const distance = Math.sqrt(sqDiffSum);
  const cosine = normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  const matchPercent = Math.max(0, Math.min(100, Math.round((1 - distance / 1.1) * 100)));

  return {
    matched: distance <= maxDistance,
    distance: Number(distance.toFixed(4)),
    cosine: Number(cosine.toFixed(4)),
    threshold: maxDistance,
    matchPercent,
  };
}

module.exports = {
  MODEL_TAG,
  DEFAULT_MAX_DISTANCE,
  initFaceAiEngine,
  extractFaceDescriptor,
  resolveImageOval,
  validateFaceInsideOval,
  parseStoredFaceTemplate,
  serializeFaceTemplate,
  compareFaceDescriptors,
};
