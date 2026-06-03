/**
 * SquiggleDraw – converts a raster image into horizontal sine-wave polylines
 * whose amplitude tracks pixel darkness (dark → big squiggle, light → flat).
 */

/* ── helpers ── */

export const rgbaToGray = (rgba, w, h) => {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const a = rgba[p + 3] / 255;
    g[i] = a < 0.1
      ? 255
      : rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114;
  }
  return g;
};

/** Sample brightness with bilinear interpolation for smoother squiggles */
const sampleGray = (gray, w, h, fx, fy) => {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const dx = fx - x0, dy = fy - y0;
  const tl = gray[y0 * w + x0], tr = gray[y0 * w + x1];
  const bl = gray[y1 * w + x0], br = gray[y1 * w + x1];
  return tl * (1 - dx) * (1 - dy) + tr * dx * (1 - dy) +
         bl * (1 - dx) * dy + br * dx * dy;
};

/* ── main generator ── */

/**
 * @param {Float32Array} gray  – grayscale image (0-255 per pixel)
 * @param {number} w           – image width
 * @param {number} h           – image height
 * @param {object} opts
 * @returns {number[][][]}     – array of polylines, each is [[x,y], …]
 */
export const generateSquiggleLines = (gray, w, h, opts = {}) => {
  const {
    numberOfLines   = 100,
    squiggleStrength = 10,   // max amplitude multiplier
    detail           = 8,    // sample points per sine cycle
    frequency        = 80,   // sine cycles across image width
    blackPoint       = 0,
    whitePoint        = 255,
    invertColors     = false,
    connectEnds      = false,
  } = opts;

  const lineSpacing = h / numberOfLines;
  const totalPts = Math.max(frequency * detail, w);
  const polylines = [];

  for (let li = 0; li < numberOfLines; li++) {
    const yBase = li * lineSpacing + lineSpacing / 2;
    const pts = [];

    for (let i = 0; i <= totalPts; i++) {
      const x = (i / totalPts) * (w - 1);
      const sampleY = Math.min(yBase, h - 1);

      let bri = sampleGray(gray, w, h, x, sampleY);

      // levels
      let norm = (bri - blackPoint) / Math.max(whitePoint - blackPoint, 1);
      norm = Math.max(0, Math.min(1, norm));
      if (invertColors) norm = 1 - norm;

      const amp = (1 - norm) * squiggleStrength * lineSpacing * 0.4;
      const phase = (i / totalPts) * frequency * Math.PI * 2;
      const yOff = amp * Math.sin(phase);

      pts.push([x, yBase + yOff]);
    }
    polylines.push(pts);
  }

  // connect ends: reverse alternating lines so pen travels continuously
  if (connectEnds) {
    for (let i = 1; i < polylines.length; i += 2) polylines[i].reverse();
  }

  return polylines;
};

/* ── RDP simplification (reduces G-code size) ── */

export const rdpSimplify = (pts, epsilon) => {
  if (pts.length <= 2) return pts;
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const len = Math.hypot(ex - sx, ey - sy);

  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = len < 1e-6
      ? Math.hypot(px - sx, py - sy)
      : Math.abs((ey - sy) * px - (ex - sx) * py + ex * sy - ey * sx) / len;
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > epsilon) {
    const l = rdpSimplify(pts.slice(0, maxI + 1), epsilon);
    const r = rdpSimplify(pts.slice(maxI), epsilon);
    return [...l.slice(0, -1), ...r];
  }
  return [pts[0], pts[pts.length - 1]];
};

/* ── Draw squiggles onto a 2D canvas ── */

export const drawSquigglesOnCanvas = (ctx, polylines, w, h, lineWidth = 1) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const pl of polylines) {
    if (pl.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(pl[0][0], pl[0][1]);
    for (let i = 1; i < pl.length; i++) ctx.lineTo(pl[i][0], pl[i][1]);
    ctx.stroke();
  }
};

/* ── Generate SVG string for download ── */

export const squigglesToSvg = (polylines, w, h, lineWidth = 1) => {
  const paths = polylines.map((pl) => {
    if (pl.length < 2) return '';
    const d = 'M ' + pl.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ');
    return `<path d="${d}" fill="none" stroke="#000" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).filter(Boolean).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#fff"/>
  ${paths}
</svg>`;
};
