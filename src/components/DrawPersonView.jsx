import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Upload, Pause, Play, SkipForward, Copy, ChevronDown, ChevronUp,
  Download, Send, AlertCircle, User,
} from 'lucide-react';
import { PEN_DOWN_COMMAND, PEN_SERVO_SETTLE_COMMAND, PEN_UP_COMMAND } from '../constants/penControl';
import { generateSquiggleLines, rgbaToGray, rdpSimplify, drawSquigglesOnCanvas, squigglesToSvg } from '../utils/squiggleDraw';

const RAPID_FEED = 3000, DRAW_FEED = 1200, DEFAULT_STEP_DELAY = 500;
const fmt = (v) => Number(v.toFixed(2));
const clamp = (v, mn, mx) => { const p = Number(v); return Number.isFinite(p) ? Math.min(Math.max(p, mn), mx) : mn; };
const loadImg = (src) => new Promise((res, rej) => { const i = new window.Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Load failed')); i.src = src; });
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = (e) => res(e.target?.result); r.onerror = () => rej(new Error('Read failed')); r.readAsDataURL(f); });
const getLines = (c) => c.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'));
const getSpan = (a, b) => Math.abs(b - a);

const squiggleToGCode = (polylines, imgW, imgH, bounds, simplifyEps, connectEnds) => {
  const pxd = bounds.xMax >= bounds.xMin ? 1 : -1;
  const pyd = bounds.yMax >= bounds.yMin ? 1 : -1;
  const aw = Math.abs(bounds.xMax - bounds.xMin), ah = Math.abs(bounds.yMax - bounds.yMin);
  const sc = Math.min(aw / Math.max(imgW, 1), ah / Math.max(imgH, 1));
  const mx = (x) => fmt(bounds.xMin + pxd * x * sc);
  const my = (y) => { const fl = pyd >= 0 ? imgH - y : y; return fmt(bounds.yMin + pyd * fl * sc); };
  const cmds = ['; SquiggleDraw portrait', 'G21', 'G90', PEN_UP_COMMAND, PEN_SERVO_SETTLE_COMMAND, 'G0 F' + RAPID_FEED, 'G1 F' + DRAW_FEED];
  let segs = 0;
  if (connectEnds && polylines.length > 0) {
    const allPts = polylines.flat();
    const simplified = rdpSimplify(allPts, simplifyEps);
    if (simplified.length >= 2) {
      cmds.push('G0 X' + mx(simplified[0][0]) + ' Y' + my(simplified[0][1]));
      cmds.push(PEN_DOWN_COMMAND); cmds.push(PEN_SERVO_SETTLE_COMMAND);
      for (let i = 1; i < simplified.length; i++) cmds.push('G1 X' + mx(simplified[i][0]) + ' Y' + my(simplified[i][1]));
      cmds.push(PEN_UP_COMMAND); cmds.push(PEN_SERVO_SETTLE_COMMAND);
      segs = 1;
    }
  } else {
    for (const pl of polylines) {
      const s = rdpSimplify(pl, simplifyEps);
      if (s.length < 2) continue;
      cmds.push('G0 X' + mx(s[0][0]) + ' Y' + my(s[0][1]));
      cmds.push(PEN_DOWN_COMMAND); cmds.push(PEN_SERVO_SETTLE_COMMAND);
      for (let i = 1; i < s.length; i++) cmds.push('G1 X' + mx(s[i][0]) + ' Y' + my(s[i][1]));
      cmds.push(PEN_UP_COMMAND); cmds.push(PEN_SERVO_SETTLE_COMMAND);
      segs++;
    }
  }
  cmds.push('G0 X' + fmt(bounds.xMin) + ' Y' + fmt(bounds.yMin));
  cmds.push(PEN_UP_COMMAND); cmds.push(PEN_SERVO_SETTLE_COMMAND);
  return { content: cmds.join('\n'), commands: cmds, segments: segs };
};

const parseToolpath = (lines, bounds) => {
  let cx = bounds.xMin, cy = bounds.yMin, pd = false;
  const segs = [], pos = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim().toUpperCase();
    if (l === PEN_DOWN_COMMAND.trim().toUpperCase()) { pd = true; pos[i] = { x: cx, y: cy, penDown: pd }; continue; }
    if (l === PEN_UP_COMMAND.trim().toUpperCase()) { pd = false; pos[i] = { x: cx, y: cy, penDown: pd }; continue; }
    if (!l.startsWith('G0') && !l.startsWith('G1')) { pos[i] = { x: cx, y: cy, penDown: pd }; continue; }
    const xm = l.match(/X(-?\d*\.?\d+)/i), ym = l.match(/Y(-?\d*\.?\d+)/i);
    const nx = xm ? Number(xm[1]) : cx, ny = ym ? Number(ym[1]) : cy;
    if (nx !== cx || ny !== cy) segs.push({ startX: cx, startY: cy, endX: nx, endY: ny, kind: l.startsWith('G1') && pd ? 'draw' : 'rapid', lineIndex: i });
    cx = nx; cy = ny; pos[i] = { x: cx, y: cy, penDown: pd };
  }
  return { segments: segs, positions: pos, finalPosition: { x: cx, y: cy, penDown: pd } };
};

/* ─── Toolpath Preview (matches FilesView) ─── */
const ToolpathPreview = ({ coordinates, commandLines, currentStep }) => {
  const mb = useMemo(() => {
    const xMin = Math.min(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0);
    const xMax = Math.max(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0);
    const yMin = Math.min(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0);
    const yMax = Math.max(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0);
    return { xMin, xMax, yMin, yMax, width: xMax - xMin, height: yMax - yMin };
  }, [coordinates]);
  const tp = useMemo(() => parseToolpath(commandLines, mb), [commandLines, mb]);
  const vs = 260, pad = 18, iw = vs - pad * 2, ih = vs - pad * 2;
  const scale = Math.min(iw / Math.max(mb.width, 1), ih / Math.max(mb.height, 1));
  const pw = mb.width * scale, ph = mb.height * scale;
  const ox = pad + (iw - pw) / 2, oy = pad + (ih - ph) / 2;
  const mp = (x, y) => ({ x: ox + (x - mb.xMin) * scale, y: oy + ph - (y - mb.yMin) * scale });
  const drawPath = tp.segments.filter(s => s.kind === 'draw').map(s => { const a = mp(s.startX, s.startY), b = mp(s.endX, s.endY); return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`; }).join(' ');
  const rapidPath = tp.segments.filter(s => s.kind === 'rapid').map(s => { const a = mp(s.startX, s.startY), b = mp(s.endX, s.endY); return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`; }).join(' ');
  const ci = commandLines.length === 0 ? -1 : Math.min(currentStep, commandLines.length - 1);
  const cp = tp.positions[ci] ?? { x: mb.xMin, y: mb.yMin, penDown: false };
  const dot = mp(cp.x, cp.y);
  return (
    <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '12px' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Toolpath Visualizer</div>
      <div style={{ background: 'linear-gradient(180deg, #dbe6f3 0%, #cfdbec 100%)', borderRadius: '4px', border: '1px solid rgba(90,110,140,0.35)', padding: '8px' }}>
        <svg viewBox={`0 0 ${vs} ${vs}`} style={{ width: '100%', height: '220px', display: 'block' }}>
          <rect x={ox} y={oy} width={pw} height={ph} fill="rgba(255,255,255,0.08)" stroke="rgba(89,108,133,0.4)" />
          {Array.from({ length: 15 }, (_, i) => (
            <React.Fragment key={i}>
              <line x1={ox + (pw * i) / 14} y1={oy} x2={ox + (pw * i) / 14} y2={oy + ph} stroke="rgba(98,118,146,0.35)" strokeWidth="1" />
              <line x1={ox} y1={oy + (ph * i) / 14} x2={ox + pw} y2={oy + (ph * i) / 14} stroke="rgba(98,118,146,0.35)" strokeWidth="1" />
            </React.Fragment>
          ))}
          <line x1={ox} y1={oy + ph} x2={ox + pw} y2={oy + ph} stroke="#ff3737" strokeWidth="2.5" />
          <line x1={ox} y1={oy} x2={ox} y2={oy + ph} stroke="#3cc96b" strokeWidth="2.5" />
          {rapidPath && <path d={rapidPath} fill="none" stroke="rgba(70,125,255,0.65)" strokeWidth="1.25" strokeDasharray="3 3" strokeLinecap="round" />}
          {drawPath && <path d={drawPath} fill="none" stroke="#cf4f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
          <circle cx={dot.x} cy={dot.y} r="6.5" fill="rgba(255,229,71,0.45)" />
          <circle cx={dot.x} cy={dot.y} r="4" fill="#f7e548" stroke="#fff4b0" strokeWidth="1" />
        </svg>
      </div>
      <div style={{ marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Draw: {tp.segments.filter(s => s.kind === 'draw').length}</span>
        <span>Rapid: {tp.segments.filter(s => s.kind === 'rapid').length}</span>
      </div>
      <div style={{ marginTop: '4px', fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
        <span>X{cp.x.toFixed(2)} Y{cp.y.toFixed(2)}</span>
        <span>{cp.penDown ? 'Pen: DOWN' : 'Pen: UP'}</span>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
const DrawPersonView = ({ serial, coordinates }) => {
  const canvasRef = useRef(null);
  const [originalPreview, setOriginalPreview] = useState('');
  const [imageGray, setImageGray] = useState(null);
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [numberOfLines, setNumberOfLines] = useState(100);
  const [squiggleStrength, setSquiggleStrength] = useState(10);
  const [detail, setDetail] = useState(8);
  const [frequency, setFrequency] = useState(80);
  const [lineWidth, setLineWidth] = useState(1);
  const [blackPoint, setBlackPoint] = useState(0);
  const [whitePoint, setWhitePoint] = useState(255);
  const [invertColors, setInvertColors] = useState(false);
  const [connectEnds, setConnectEnds] = useState(true);
  const [simplifyEps, setSimplifyEps] = useState(0.3);

  const [gcodeResult, setGcodeResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isSendingStep, setIsSendingStep] = useState(false);
  const [stepDelay, setStepDelay] = useState(DEFAULT_STEP_DELAY);
  const [isGcodeExpanded, setIsGcodeExpanded] = useState(true);

  const wsW = useMemo(() => getSpan(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0), [coordinates]);
  const wsH = useMemo(() => getSpan(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0), [coordinates]);
  const [plotWidth, setPlotWidth] = useState(wsW);
  const [plotHeight, setPlotHeight] = useState(wsH);
  const [plotPct, setPlotPct] = useState(100);
  useEffect(() => { setPlotWidth(wsW); setPlotHeight(wsH); setPlotPct(100); }, [wsW, wsH]);

  const bounds = useMemo(() => {
    const xd = (coordinates?.xMax ?? 0) >= (coordinates?.xMin ?? 0) ? 1 : -1;
    const yd = (coordinates?.yMax ?? 0) >= (coordinates?.yMin ?? 0) ? 1 : -1;
    return { xMin: fmt(coordinates?.xMin ?? 0), xMax: fmt((coordinates?.xMin ?? 0) + xd * clamp(plotWidth, 1, wsW)),
             yMin: fmt(coordinates?.yMin ?? 0), yMax: fmt((coordinates?.yMin ?? 0) + yd * clamp(plotHeight, 1, wsH)) };
  }, [coordinates, plotWidth, plotHeight, wsW, wsH]);

  const updatePlotSize = (field, value) => {
    const mx = field === 'width' ? wsW : wsH;
    const c = clamp(value, 1, mx);
    const next = { width: field === 'width' ? c : plotWidth, height: field === 'height' ? c : plotHeight };
    setPlotWidth(next.width); setPlotHeight(next.height);
    const wp = (next.width / Math.max(wsW, 1)) * 100, hp = (next.height / Math.max(wsH, 1)) * 100;
    setPlotPct(clamp(Math.round(Math.min(wp, hp)), 10, 100));
  };
  const updatePlotPct = (p) => { const v = clamp(p, 10, 100); setPlotPct(v); setPlotWidth(clamp(wsW * v / 100, 1, wsW)); setPlotHeight(clamp(wsH * v / 100, 1, wsH)); };

  const squiggleLines = useMemo(() => {
    if (!imageGray) return [];
    return generateSquiggleLines(imageGray, imgW, imgH, { numberOfLines, squiggleStrength, detail, frequency, blackPoint, whitePoint, invertColors, connectEnds });
  }, [imageGray, imgW, imgH, numberOfLines, squiggleStrength, detail, frequency, blackPoint, whitePoint, invertColors, connectEnds]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !imageGray || squiggleLines.length === 0) return;
    c.width = imgW; c.height = imgH;
    drawSquigglesOnCanvas(c.getContext('2d'), squiggleLines, imgW, imgH, lineWidth);
  }, [squiggleLines, lineWidth, imageGray, imgW, imgH]);

  const commandLines = useMemo(() => gcodeResult ? getLines(gcodeResult.content) : [], [gcodeResult]);
  const progressPercent = commandLines.length === 0 ? 0 : Math.round((currentStep / commandLines.length) * 100);
  const previewW = Math.max(8, (plotWidth / Math.max(wsW, 1)) * 100);
  const previewH = Math.max(8, (plotHeight / Math.max(wsH, 1)) * 100);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const input = e.target;
    setGcodeResult(null); setCurrentStep(0); setIsProcessing(true);
    try {
      const url = await readFile(file); setOriginalPreview(url);
      const img = await loadImg(url);
      const sc = Math.min(1, 400 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      setImageGray(rgbaToGray(cx.getImageData(0, 0, w, h).data, w, h)); setImgW(w); setImgH(h);
      setStatusMessage('Image loaded. Adjust parameters, then prepare to run.');
    } catch (err) { setStatusMessage('Error: ' + (err?.message || 'Failed')); }
    setIsProcessing(false); input.value = '';
  }, []);

  const handleGenerate = useCallback(() => {
    if (squiggleLines.length === 0) return;
    setStatusMessage('Generating G-code...');
    const result = squiggleToGCode(squiggleLines, imgW, imgH, bounds, simplifyEps, connectEnds);
    setGcodeResult(result); setCurrentStep(0);
    setStatusMessage('Squiggle G-code prepared. ' + result.segments + ' segments, ' + getLines(result.content).length + ' commands.');
  }, [squiggleLines, imgW, imgH, bounds, simplifyEps, connectEnds]);

  const handleSaveSvg = useCallback(() => {
    if (squiggleLines.length === 0) return;
    const svg = squigglesToSvg(squiggleLines, imgW, imgH, lineWidth);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = 'squiggle.svg'; a.click();
  }, [squiggleLines, imgW, imgH, lineWidth]);

  const handleDefaults = () => { setNumberOfLines(100); setSquiggleStrength(10); setDetail(8); setFrequency(80); setLineWidth(1); setBlackPoint(0); setWhitePoint(255); setInvertColors(false); setConnectEnds(true); setSimplifyEps(0.3); };

  const sendStep = useCallback(async () => {
    if (!serial?.connected) { alert('Connect first.'); return false; }
    if (!gcodeResult || currentStep >= commandLines.length) return false;
    try {
      setIsSendingStep(true);
      const line = commandLines[currentStep];
      setStatusMessage('Sending step ' + (currentStep + 1) + '/' + commandLines.length + ': ' + line);
      if (serial?.sendCommand) await serial.sendCommand(line);
      else if (serial?.sendGCode) await serial.sendGCode([line]);
      setCurrentStep(p => p + 1);
      setStatusMessage('Step ' + (currentStep + 1) + ' sent.');
      return true;
    } catch (err) { setIsRunning(false); setStatusMessage(err?.message || 'Send failed'); return false; }
    finally { setIsSendingStep(false); }
  }, [serial, gcodeResult, commandLines, currentStep]);

  useEffect(() => {
    if (!isRunning || isSendingStep || !gcodeResult) return;
    if (currentStep >= commandLines.length) { setIsRunning(false); setStatusMessage('Execution complete.'); return; }
    const t = setTimeout(async () => { if (!(await sendStep())) setIsRunning(false); }, stepDelay);
    return () => clearTimeout(t);
  }, [isRunning, isSendingStep, gcodeResult, currentStep, commandLines.length, stepDelay, sendStep]);

  useEffect(() => { if (serial?.lastEmergencyStopAt) { setIsRunning(false); setIsSendingStep(false); setStatusMessage('Emergency stop.'); } }, [serial?.lastEmergencyStopAt]);

  const handleRun = () => {
    if (!serial?.connected || !gcodeResult) return;
    if (currentStep >= commandLines.length) { if (window.confirm('Restart?')) setCurrentStep(0); else return; }
    setStatusMessage('Auto step-by-step started.'); setIsRunning(true);
  };

  const handleSendAll = async () => {
    if (!serial?.connected || !gcodeResult) return;
    try { await serial.sendGCode(gcodeResult.commands); setCurrentStep(commandLines.length); setStatusMessage('All sent!'); }
    catch (err) { setStatusMessage(err?.message || 'Failed'); }
  };

  const controlFieldStyle = { width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' };
  const quietButtonStyle = { padding: '10px 16px', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap' };

  return (
    <div className="fv-root">
      <div className="page-header">
        <div>
          <div className="page-title">SquiggleDraw Portrait</div>
          <div className="breadcrumbs">Upload_Photo <span>&gt;</span> Adjust_Squiggles <span>&gt;</span> Generate_GCode</div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {statusMessage && <div className="fv-status-msg">{statusMessage}</div>}
        </div>
      </div>

      <div className="fv-body">
        {/* ═══ LEFT PANEL ═══ */}
        <div className="fv-left">
          {/* Squiggle Canvas Preview */}
          <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Squiggle Preview</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveSvg} disabled={squiggleLines.length === 0} className="fv-action-btn" title="Save SVG"><Download size={12} /> SVG</button>
                {gcodeResult && <button onClick={() => { navigator.clipboard.writeText(gcodeResult.content); setStatusMessage('G-code copied.'); }} className="fv-action-btn" title="Copy G-code"><Copy size={12} /> Copy</button>}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', minHeight: '300px' }}>
              {!imageGray ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                  <User size={40} style={{ opacity: 0.3 }} />
                  <div style={{ fontSize: '0.85rem' }}>No portrait loaded</div>
                  <div style={{ fontSize: '0.75rem' }}>Upload a photo to generate squiggle art</div>
                </div>
              ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', justifyContent: 'center', maxWidth: '100%' }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', maxHeight: '450px', objectFit: 'contain', display: 'block' }} />
                </div>
              )}
            </div>
          </div>

          {/* G-code Viewer */}
          <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Full G-code Viewer</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setIsGcodeExpanded(p => !p)} className="fv-action-btn" title={isGcodeExpanded ? 'Collapse' : 'Expand'}>
                  {isGcodeExpanded ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Show</>}
                </button>
                {gcodeResult && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>Step {Math.min(currentStep + 1, commandLines.length || 1)}/{commandLines.length || 0}</div>}
              </div>
            </div>
            {isGcodeExpanded && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', maxHeight: '260px' }}>
                {gcodeResult ? commandLines.map((line, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '12px', padding: '4px 16px', backgroundColor: i === currentStep ? 'rgba(0,240,255,0.08)' : 'transparent', borderLeft: i === currentStep ? '3px solid var(--accent-cyan)' : '3px solid transparent', color: i < currentStep ? 'var(--text-muted)' : i === currentStep ? 'var(--accent-cyan)' : 'white' }}>
                    <div style={{ opacity: 0.7 }}>{i + 1}</div>
                    <div style={{ wordBreak: 'break-word' }}>{line}</div>
                  </div>
                )) : (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <User size={24} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <div style={{ fontSize: '0.75rem' }}>Upload a portrait and generate G-code to view commands here.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toolpath */}
          {gcodeResult && <ToolpathPreview coordinates={coordinates} commandLines={commandLines} currentStep={currentStep} />}
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Mode card */}
          <div style={{ backgroundColor: 'rgba(0,240,255,0.08)', border: '1px solid var(--accent-cyan)', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <User size={18} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>SquiggleDraw Portrait</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Convert any portrait into sine-wave line art for pen plotting.</div>
                </div>
              </div>
            </div>

            <label style={{ padding: '10px 14px', backgroundColor: 'var(--accent-cyan)', color: 'black', borderRadius: '4px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isProcessing ? 0.7 : 1 }}>
              <Upload size={14} /> Upload Portrait
              <input type="file" onChange={handleFileUpload} accept=".png,.jpg,.jpeg,image/png,image/jpeg" style={{ display: 'none' }} disabled={isProcessing} />
            </label>

            {originalPreview && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>Image loaded ({imgW}×{imgH}px)</div>}

            {/* Squiggle params */}
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Squiggle Parameters</div>
              {[
                ['Lines', numberOfLines, 10, 300, 5, setNumberOfLines],
                ['Strength', squiggleStrength, 1, 30, 1, setSquiggleStrength],
                ['Detail', detail, 2, 30, 1, setDetail],
                ['Frequency', frequency, 10, 300, 5, setFrequency],
                ['Line Width', lineWidth, 0.5, 5, 0.5, setLineWidth],
                ['Black Pt', blackPoint, 0, 254, 1, setBlackPoint],
                ['White Pt', whitePoint, 1, 255, 1, setWhitePoint],
              ].map(([label, val, min, max, step, setter]) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 48px', gap: '8px', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  <span>{label}</span>
                  <input type="range" min={min} max={max} step={step} value={val} onChange={e => setter(Number(e.target.value))} style={{ width: '100%' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', textAlign: 'right' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={invertColors} onChange={e => setInvertColors(e.target.checked)} /> Invert
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={connectEnds} onChange={e => setConnectEnds(e.target.checked)} /> Connect
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 48px', gap: '8px', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              <span>Simplify</span>
              <input type="range" min={0.05} max={2} step={0.05} value={simplifyEps} onChange={e => setSimplifyEps(Number(e.target.value))} style={{ width: '100%' }} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', textAlign: 'right' }}>{simplifyEps}</span>
            </div>

            <button onClick={handleGenerate} disabled={squiggleLines.length === 0} style={{ ...quietButtonStyle, cursor: squiggleLines.length === 0 ? 'not-allowed' : 'pointer', opacity: squiggleLines.length === 0 ? 0.5 : 1 }}>
              Prepare Squiggle G-code
            </button>
            <button onClick={handleDefaults} style={{ ...quietButtonStyle, fontSize: '0.7rem', padding: '8px 12px', color: 'var(--text-secondary)' }}>Reset Defaults</button>
          </div>

          {/* Plot Size */}
          <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>Plot Size</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Set the physical drawing area before generating G-code.</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 112px', gap: '10px', alignItems: 'end' }}>
              <div style={{ display: 'grid', gap: '8px' }}><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Plot Area Size</div><input type="range" min="10" max="100" step="5" value={plotPct} onChange={e => updatePlotPct(Number(e.target.value))} style={{ width: '100%' }} /></div>
              <input type="number" min="10" max="100" step="5" value={plotPct} onChange={e => updatePlotPct(Number(e.target.value))} style={{ ...controlFieldStyle }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px' }}>
              <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Width (max {wsW.toFixed(2)})</div><input type="number" min="1" max={wsW} step="0.5" value={plotWidth} onChange={e => updatePlotSize('width', e.target.value)} style={controlFieldStyle} /></div>
              <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Height (max {wsH.toFixed(2)})</div><input type="number" min="1" max={wsH} step="0.5" value={plotHeight} onChange={e => updatePlotSize('height', e.target.value)} style={controlFieldStyle} /></div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>Target box: X{bounds.xMin}..{bounds.xMax} Y{bounds.yMin}..{bounds.yMax}</div>
            <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Size Visualization</div>
              <div style={{ height: '160px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.16)', position: 'relative', background: 'linear-gradient(180deg, rgba(0,240,255,0.03), rgba(255,255,255,0.01))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <div style={{ width: previewW + '%', height: previewH + '%', border: '2px solid var(--accent-cyan)', borderRadius: '4px', backgroundColor: 'rgba(0,240,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textAlign: 'center', padding: '6px' }}>
                  {fmt(plotWidth)} × {fmt(plotHeight)}
                </div>
                <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>Full area: {wsW.toFixed(2)} × {wsH.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Execution Controls */}
          <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Execution Controls</div>
            {gcodeResult ? (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Completed</div><div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{currentStep}/{commandLines.length}</div></div>
                <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Progress</div><div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-yellow)' }}>{progressPercent}%</div></div>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '999px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}><div style={{ width: progressPercent + '%', height: '100%', backgroundColor: 'var(--accent-cyan)', transition: 'width 0.2s ease' }} /></div>
              <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Auto step delay</div><input type="range" min="150" max="2000" step="50" value={stepDelay} onChange={e => setStepDelay(Number(e.target.value))} disabled={isRunning} style={{ width: '100%' }} /><div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{stepDelay} ms between commands</div></div>
              <button onClick={sendStep} disabled={!gcodeResult || isSendingStep || currentStep >= commandLines.length} style={{ padding: '10px 14px', backgroundColor: 'var(--accent-peach)', color: 'black', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: currentStep >= commandLines.length ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: currentStep >= commandLines.length ? 0.5 : 1 }}><SkipForward size={16} /> Send Next Step</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleRun} disabled={!gcodeResult || isRunning} style={{ flex: 1, padding: '10px 14px', backgroundColor: 'var(--accent-cyan)', color: 'black', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isRunning ? 0.5 : 1 }}><Play size={16} /> Run</button>
                <button onClick={() => { setIsRunning(false); setStatusMessage('Paused.'); }} disabled={!isRunning} style={{ flex: 1, padding: '10px 14px', backgroundColor: 'var(--bg-panel)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: !isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !isRunning ? 0.5 : 1 }}><Pause size={16} /> Pause</button>
              </div>
              <button onClick={() => { setIsRunning(false); setCurrentStep(0); setStatusMessage('Reset.'); }} style={{ padding: '10px 14px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Reset Step Counter</button>
              <button onClick={handleSendAll} disabled={!serial?.connected || !gcodeResult} style={{ padding: '10px 14px', backgroundColor: 'rgba(0,240,255,0.15)', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: serial?.connected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: serial?.connected ? 1 : 0.5 }}><Send size={16} /> Send All At Once</button>
            </>) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <User size={24} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <div style={{ fontSize: '0.75rem' }}>Upload a portrait and prepare G-code to enable execution.</div>
              </div>
            )}
          </div>

          {/* Help / Connection status */}
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.4)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Adjust squiggle parameters live, then click "Prepare Squiggle G-code" to generate. Use step-by-step execution to plot safely. Area: X{coordinates.xMin}..{coordinates.xMax} Y{coordinates.yMin}..{coordinates.yMax}.
          </div>
          <div style={{ padding: '12px 16px', backgroundColor: serial?.connected ? 'rgba(0,240,255,0.1)' : 'rgba(211,26,31,0.1)', border: '1px solid ' + (serial?.connected ? 'var(--accent-cyan)' : 'var(--accent-red)'), borderRadius: '4px', display: 'flex', gap: '8px' }}>
            <AlertCircle size={16} style={{ color: serial?.connected ? 'var(--accent-cyan)' : 'var(--accent-red)', flexShrink: 0 }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {serial?.connected ? <><div style={{ fontWeight: 600 }}>Plotter Connected</div><div>{serial?.status}</div></> : <><div style={{ fontWeight: 600 }}>Plotter Disconnected</div><div>Connect first to execute G-code.</div></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawPersonView;
