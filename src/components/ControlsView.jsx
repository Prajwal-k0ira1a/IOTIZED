import React, { useState } from 'react';
import SolidTriangle from './SolidTriangle';

const ControlsView = ({ serial }) => {
  const [jogStep, setJogStep] = useState(1.0);
  const [feedRate, setFeedRate] = useState(1000);

  const jog = (dx, dy, dz = 0) => {
    if (!serial || !serial.connected) return;
    const x = (dx * jogStep).toFixed(3);
    const y = (dy * jogStep).toFixed(3);
    const z = (dz * jogStep).toFixed(3);
    
    // Using standard G0 instead of $J for compatibility with GRBL v0.9 and older CNC shields
    let cmd = `G91 G0 F${feedRate} `;
    if (dx !== 0) cmd += `X${x} `;
    if (dy !== 0) cmd += `Y${y} `;
    if (dz !== 0) cmd += `Z${z}`;
    
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
                <button className="pen-btn" style={{backgroundColor: 'var(--bg-main)'}} onClick={() => serial?.sendCommand('M3 S1000')}>DOWN</button>
                <button className="pen-btn" style={{backgroundColor: 'var(--bg-main)'}} onClick={() => serial?.sendCommand('M5')}>UP</button>
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
        
        <div className="panel" style={{flex: 1}}>
          <div className="panel-title">Calibration_Parameters</div>
          <div style={{fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase'}}>X-Axis Speed Limit (mm/s)</div>
          <div className="input-field">120.0</div>
          <div style={{fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase'}}>Y-Axis Acceleration (mm/s²)</div>
          <div className="input-field">3000.0</div>
          
          <div className="bed-preview mt-8">
            <div style={{position: 'absolute', top: '8px', left: '8px', fontSize: '0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)'}}>BED_PREVIEW [400x500MM]</div>
            <div style={{position: 'absolute', top: '50%', left: '70%', width: '16px', height: '16px', border: '1px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
               <div style={{width: '2px', height: '2px', backgroundColor: 'var(--accent-cyan)'}}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ControlsView;
