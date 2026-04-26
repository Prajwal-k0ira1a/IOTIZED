import React, { useState } from 'react';
import SolidTriangle from './SolidTriangle';
import { PEN_DOWN_ANGLE, PEN_DOWN_COMMAND, PEN_UP_ANGLE, PEN_UP_COMMAND } from '../constants/penControl';

const clampTarget = (value, min, max) => Math.min(Math.max(value, min), max);
const PREVIEW_SIZE = 260;
const PREVIEW_PADDING = 24;

const mapToPreview = (value, min, max, size) => {
  if (Math.abs(max - min) < 0.0001) {
    return size / 2;
  }

  return ((value - min) / (max - min)) * size;
};

const buildPreviewPath = (xMin, xMax, yMin, yMax) => {
  const width = xMax - xMin || 1;
  const height = yMax - yMin || 1;
  const cx = xMin + width * 0.52;
  const cy = yMin + height * 0.52;

  const points = [
    [xMin + width * 0.18, yMin + height * 0.18],
    [xMin + width * 0.28, yMin + height * 0.24],
    [xMin + width * 0.35, yMin + height * 0.36],
    [xMin + width * 0.42, yMin + height * 0.44],
    [xMin + width * 0.47, yMin + height * 0.48],
    [xMin + width * 0.44, yMin + height * 0.57],
    [xMin + width * 0.48, yMin + height * 0.64],
    [xMin + width * 0.58, yMin + height * 0.65],
    [xMin + width * 0.64, yMin + height * 0.57],
    [xMin + width * 0.61, yMin + height * 0.48],
    [xMin + width * 0.66, yMin + height * 0.41],
    [xMin + width * 0.72, yMin + height * 0.31],
    [xMin + width * 0.80, yMin + height * 0.18],
    [cx + width * 0.31, cy],
    [cx, cy + height * 0.31],
    [cx - width * 0.31, cy],
    [xMin + width * 0.18, yMin + height * 0.18],
  ];

  return points
    .map(([x, y], index) => {
      const px = PREVIEW_PADDING + mapToPreview(x, xMin, xMax, PREVIEW_SIZE);
      const py = PREVIEW_PADDING + (PREVIEW_SIZE - mapToPreview(y, yMin, yMax, PREVIEW_SIZE));
      return `${index === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(' ');
};

const ControlsPreview = ({ coordinates, serial }) => {
  const xMin = Math.min(coordinates?.xMin ?? 0, coordinates?.xMax ?? 200);
  const xMax = Math.max(coordinates?.xMin ?? 0, coordinates?.xMax ?? 200);
  const yMin = Math.min(coordinates?.yMin ?? 0, coordinates?.yMax ?? 200);
  const yMax = Math.max(coordinates?.yMin ?? 0, coordinates?.yMax ?? 200);
  const currentX = clampTarget(Number(serial?.position?.x ?? xMin), xMin, xMax);
  const currentY = clampTarget(Number(serial?.position?.y ?? yMin), yMin, yMax);

  const currentPx = PREVIEW_PADDING + mapToPreview(currentX, xMin, xMax, PREVIEW_SIZE);
  const currentPy = PREVIEW_PADDING + (PREVIEW_SIZE - mapToPreview(currentY, yMin, yMax, PREVIEW_SIZE));
  const xAxisY = PREVIEW_PADDING + PREVIEW_SIZE;
  const yAxisX = PREVIEW_PADDING;
  const pathData = buildPreviewPath(xMin, xMax, yMin, yMax);
  const gridLines = Array.from({ length: 16 }, (_, index) => PREVIEW_PADDING + (index * PREVIEW_SIZE) / 15);

  return (
    <div className="bed-preview mt-8">
      <div className="bed-preview-label">PATH_VISUALIZER</div>
      <div className="bed-preview-meta bed-preview-meta-top">{(xMax - xMin).toFixed(0)} mm</div>
      <div className="bed-preview-meta bed-preview-meta-side">{(yMax - yMin).toFixed(0)} mm</div>

      <svg viewBox={`0 0 ${PREVIEW_SIZE + PREVIEW_PADDING * 2} ${PREVIEW_SIZE + PREVIEW_PADDING * 2}`} className="bed-preview-svg" aria-label="Machine path preview">
        <rect
          x={PREVIEW_PADDING}
          y={PREVIEW_PADDING}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className="bed-preview-surface"
        />

        {gridLines.map((line) => (
          <React.Fragment key={`grid-${line}`}>
            <line x1={PREVIEW_PADDING} y1={line} x2={PREVIEW_PADDING + PREVIEW_SIZE} y2={line} className="bed-grid-line" />
            <line x1={line} y1={PREVIEW_PADDING} x2={line} y2={PREVIEW_PADDING + PREVIEW_SIZE} className="bed-grid-line" />
          </React.Fragment>
        ))}

        <line x1={yAxisX} y1={PREVIEW_PADDING} x2={yAxisX} y2={PREVIEW_PADDING + PREVIEW_SIZE} className="bed-axis bed-axis-y" />
        <line x1={PREVIEW_PADDING} y1={xAxisY} x2={PREVIEW_PADDING + PREVIEW_SIZE} y2={xAxisY} className="bed-axis bed-axis-x" />

        <path d={pathData} className="bed-outline-path" />

        <line x1={yAxisX} y1={currentPy} x2={currentPx} y2={currentPy} className="bed-travel-line" />
        <line x1={currentPx} y1={xAxisY} x2={currentPx} y2={currentPy} className="bed-travel-line bed-travel-line-y" />

        <circle cx={currentPx} cy={currentPy} r="7" className="bed-head-glow" />
        <circle cx={currentPx} cy={currentPy} r="4" className="bed-head-core" />
      </svg>
    </div>
  );
};

const ControlsView = ({ serial, coordinates }) => {
  const [jogStep, setJogStep] = useState(1.0);
  const [feedRate, setFeedRate] = useState(1000);

  const returnToStart = async () => {
    if (!serial || !serial.connected) return;
    await serial.sendCommand(`G90 G0 F${feedRate} X0 Y0`);
  };

  const jog = (dx, dy, dz = 0) => {
    if (!serial || !serial.connected) return;
    const xMin = Math.min(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0);
    const xMax = Math.max(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0);
    const yMin = Math.min(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0);
    const yMax = Math.max(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0);

    const currentX = Number(serial?.position?.x ?? 0);
    const currentY = Number(serial?.position?.y ?? 0);
    const nextX = clampTarget(currentX + dx * jogStep, xMin, xMax);
    const nextY = clampTarget(currentY + dy * jogStep, yMin, yMax);
    const limitedDx = nextX - currentX;
    const limitedDy = nextY - currentY;

    if (dx !== 0 && Math.abs(limitedDx) < 0.0005 && dy === 0 && dz === 0) {
      return;
    }

    if (dy !== 0 && Math.abs(limitedDy) < 0.0005 && dx === 0 && dz === 0) {
      return;
    }

    if (dx !== 0 && dy !== 0 && Math.abs(limitedDx) < 0.0005 && Math.abs(limitedDy) < 0.0005) {
      return;
    }

    const x = limitedDx.toFixed(3);
    const y = limitedDy.toFixed(3);
    const z = (dz * jogStep).toFixed(3);
    
    // Using standard G0 instead of $J for compatibility with GRBL v0.9 and older CNC shields
    let cmd = `G91 G0 F${feedRate} `;
    if (Math.abs(limitedDx) >= 0.0005) cmd += `X${x} `;
    if (Math.abs(limitedDy) >= 0.0005) cmd += `Y${y} `;
    if (dz !== 0) cmd += `Z${z}`;

    if (cmd.trim() === `G91 G0 F${feedRate}`) {
      return;
    }
    
    serial.sendCommand(cmd.trim());
    // Switch back to absolute mode just in case
    setTimeout(() => serial.sendCommand('G90'), 50);
  };

  return (
  <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
    <div className="page-header">
      <div>
        <div className="page-title" style={{fontSize: '1.25rem'}}>Manual_Motion_Control</div>
        <div className="breadcrumbs" style={{color: 'var(--text-muted)'}}>Axis_Calibration // Jog_Interface</div>
      </div>
      <div style={{display: 'flex', gap: '16px'}}>
        <button className="btn-secondary" style={{padding: '12px 24px'}} onClick={() => serial?.sendCommand('G92 X0 Y0 Z0')}>Set Zero</button>
        <button className="btn-secondary" style={{padding: '12px 24px'}} onClick={returnToStart}>Return To Start</button>
        <button className="btn-primary" style={{margin: 0, padding: '12px 24px', width: 'auto', color: '#111'}} onClick={() => serial?.sendCommand('$H')}>Home All Axes</button>
      </div>
    </div>
    
    <div className="controls-layout">
      <div className="controls-col-main">
        <div className="panel" style={{flex: 1}}>
          <div className="panel-title">
            <span>Kinetic_Input_Array</span>
            <div style={{display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden'}}>
              <span style={{padding: '6px 12px', fontSize: '0.6rem', borderRight: '1px solid var(--border-color)'}}>JOG STEP</span>
              <button style={{padding: '6px 12px', fontSize: '0.65rem', backgroundColor: jogStep === 0.1 ? 'var(--accent-cyan)' : 'var(--bg-main)', color: jogStep === 0.1 ? 'black' : 'white'}} onClick={() => setJogStep(0.1)}>0.1</button>
              <button style={{padding: '6px 12px', fontSize: '0.65rem', backgroundColor: jogStep === 1.0 ? 'var(--accent-cyan)' : 'var(--bg-main)', color: jogStep === 1.0 ? 'black' : 'white'}} onClick={() => setJogStep(1.0)}>1.0</button>
              <button style={{padding: '6px 12px', fontSize: '0.65rem', backgroundColor: jogStep === 10.0 ? 'var(--accent-cyan)' : 'var(--bg-main)', color: jogStep === 10.0 ? 'black' : 'white'}} onClick={() => setJogStep(10.0)}>10</button>
            </div>
          </div>
          
          <div className="jog-interface">
            <div className="xy-pad">
              <button className="pad-btn pad-up-left" onClick={() => jog(-1, 1)}><SolidTriangle angle={-45} /></button>
              <button className="pad-btn pad-up" onClick={() => jog(0, 1)}><SolidTriangle angle={0} /></button>
              <button className="pad-btn pad-up-right" onClick={() => jog(1, 1)}><SolidTriangle angle={45} /></button>
              <button className="pad-btn pad-left" onClick={() => jog(-1, 0)}><SolidTriangle angle={-90} /></button>
              <button className="pad-btn pad-right" onClick={() => jog(1, 0)}><SolidTriangle angle={90} /></button>
              <button className="pad-btn pad-down-left" onClick={() => jog(-1, -1)}><SolidTriangle angle={-135} /></button>
              <button className="pad-btn pad-down" onClick={() => jog(0, -1)}><SolidTriangle angle={180} /></button>
              <button className="pad-btn pad-down-right" onClick={() => jog(1, -1)}><SolidTriangle angle={135} /></button>
              <div className="pad-center">XY_PAD</div>
            </div>
            
            <div className="z-pad">
              <button className="pad-btn" style={{position: 'relative'}} onClick={() => jog(0, 0, 1)}><SolidTriangle angle={0} /></button>
              <div className="z-label">Z</div>
              <button className="pad-btn" style={{position: 'relative'}} onClick={() => jog(0, 0, -1)}><SolidTriangle angle={180} /></button>
              <div style={{fontSize: '0.55rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center'}}>PEN STATE</div>
              <div className="pen-state">
                <button className="pen-btn" style={{backgroundColor: 'var(--bg-main)'}} onClick={() => serial?.sendCommand(PEN_DOWN_COMMAND)}>DOWN {PEN_DOWN_ANGLE}°</button>
                <button className="pen-btn" style={{backgroundColor: 'var(--bg-main)'}} onClick={() => serial?.sendCommand(PEN_UP_COMMAND)}>UP {PEN_UP_ANGLE}°</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="controls-col-side">
        <div className="panel pos-panel">
          <div className="panel-title">Real_Time_Position <span className="status-dot"></span></div>
          <div className="pos-list">
            <div className="pos-item">
              <div className="pos-label">X_AXIS</div>
              <div className="pos-val">{serial?.position?.x?.toFixed(3) || '0.000'} <span className="pos-unit">MM</span></div>
            </div>
            <div className="pos-item">
              <div className="pos-label">Y_AXIS</div>
              <div className="pos-val">{serial?.position?.y?.toFixed(3) || '0.000'} <span className="pos-unit">MM</span></div>
            </div>
            <div className="pos-item">
              <div className="pos-label">Z_AXIS</div>
              <div className="pos-val">{serial?.position?.z?.toFixed(3) || '0.000'} <span className="pos-unit">MM</span></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Travel_Limits</div>
          <div style={{fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.6}}>
            X: {Math.min(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0).toFixed(2)} to {Math.max(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0).toFixed(2)} mm
          </div>
          <div style={{fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.6}}>
            Y: {Math.min(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0).toFixed(2)} to {Math.max(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0).toFixed(2)} mm
          </div>
          <div style={{fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px'}}>
            Jog commands are clamped to stay inside these bounds.
          </div>
        </div>
        
        <div className="panel" style={{flex: 1}}>
          <div className="panel-title">Calibration_Parameters</div>
          <div style={{fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase'}}>X-Axis Speed Limit (mm/s)</div>
          <div className="input-field">120.0</div>
          <div style={{fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase'}}>Y-Axis Acceleration (mm/s²)</div>
          <div className="input-field">3000.0</div>
          
          <ControlsPreview coordinates={coordinates} serial={serial} />
        </div>
      </div>
    </div>
  </div>
  );
};

export default ControlsView;
