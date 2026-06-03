/**
 * Edge detection & polyline tracing utilities for portrait → G-code pipeline.
 */

/** 3×3 Gaussian blur */
const gaussianBlur3x3 = (gray, w, h) => {
  const out = new Float32Array(w * h);
  const k = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0, ki = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          s += gray[(y + dy) * w + (x + dx)] * k[ki++];
      out[y * w + x] = s / 16;
    }
  }
  // copy borders
  for (let x = 0; x < w; x++) { out[x] = gray[x]; out[(h - 1) * w + x] = gray[(h - 1) * w + x]; }
  for (let y = 0; y < h; y++) { out[y * w] = gray[y * w]; out[y * w + w - 1] = gray[y * w + w - 1]; }
  return out;
};

/** Sobel edge detection → binary edge map */
export const sobelEdges = (rgbaData, w, h, threshold = 40) => {
  // Build grayscale (transparent pixels → white)
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const a = rgbaData[idx + 3] / 255;
    gray[i] = a < 0.1
      ? 255
      : rgbaData[idx] * 0.299 + rgbaData[idx + 1] * 0.587 + rgbaData[idx + 2] * 0.114;
  }

  const blurred = gaussianBlur3x3(gray, w, h);

  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = blurred[(y - 1) * w + (x - 1)];
      const tc = blurred[(y - 1) * w + x];
      const tr = blurred[(y - 1) * w + (x + 1)];
      const ml = blurred[y * w + (x - 1)];
      const mr = blurred[y * w + (x + 1)];
      const bl = blurred[(y + 1) * w + (x - 1)];
      const bc = blurred[(y + 1) * w + x];
      const br = blurred[(y + 1) * w + (x + 1)];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * w + x] = mag > threshold ? 1 : 0;
    }
  }
  return edges;
};

/** 8-connected edge pixel tracing → array of polylines */
export const traceEdgePixels = (edges, w, h) => {
  const visited = new Uint8Array(w * h);
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const polylines = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!edges[idx] || visited[idx]) continue;

      const poly = [[x, y]];
      visited[idx] = 1;
      let cx = x, cy = y, found = true;

      while (found) {
        found = false;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (!edges[ni] || visited[ni]) continue;
          visited[ni] = 1;
          poly.push([nx, ny]);
          cx = nx; cy = ny;
          found = true;
          break;
        }
      }

      if (poly.length >= 3) polylines.push(poly);
    }
  }
  return polylines;
};

/** Ramer-Douglas-Peucker polyline simplification */
export const rdpSimplify = (pts, epsilon) => {
  if (pts.length <= 2) return pts;

  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const len = Math.hypot(ex - sx, ey - sy);

  let maxDist = 0, maxIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const dist = len < 1e-6
      ? Math.hypot(px - sx, py - sy)
      : Math.abs((ey - sy) * px - (ex - sx) * py + ex * sy - ey * sx) / len;
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(pts.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
};

/**
 * Full pipeline: RGBA ImageData → simplified polylines.
 * @param {Uint8ClampedArray} rgbaData
 * @param {number} w
 * @param {number} h
 * @param {{ edgeThreshold?: number, simplifyEpsilon?: number }} opts
 */
export const imageToEdgePolylines = (rgbaData, w, h, { edgeThreshold = 40, simplifyEpsilon = 1.2 } = {}) => {
  const edges = sobelEdges(rgbaData, w, h, edgeThreshold);
  const raw = traceEdgePixels(edges, w, h);
  return raw
    .map((pl) => rdpSimplify(pl, simplifyEpsilon))
    .filter((pl) => pl.length >= 2);
};
