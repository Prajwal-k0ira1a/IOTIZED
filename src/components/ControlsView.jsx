import React from 'react';
import SolidTriangle from './SolidTriangle';

const ControlsView = () => (
  <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
    <div className="page-header">
      <div>
        <div className="page-title" style={{fontSize: '1.25rem'}}>Manual_Motion_Control</div>
        <div className="breadcrumbs" style={{color: 'var(--text-muted)'}}>Axis_Calibration // Jog_Interface</div>
      </div>
      <div style={{display: 'flex', gap: '16px'}}>
        <button className="btn-secondary" style={{padding: '12px 24px'}}>Set Zero</button>
        <button className="btn-primary" style={{margin: 0, padding: '12px 24px', width: 'auto', color: '#111'}}>Home All Axes</button>
      </div>
    </div>
    
    <div className="controls-layout">
      <div className="controls-col-main">
        <div className="panel" style={{flex: 1}}>
          <div className="panel-title">
            <span>Kinetic_Input_Array</span>
            <div style={{display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden'}}>
              <span style={{padding: '6px 12px', fontSize: '0.6rem', borderRight: '1px solid var(--border-color)'}}>JOG STEP</span>
              <button style={{padding: '6px 12px', fontSize: '0.65rem', backgroundColor: 'var(--bg-main)'}}>0.1</button>
              <button style={{padding: '6px 12px', fontSize: '0.65rem', backgroundColor: 'var(--accent-cyan)', color: 'black'}}>1.0</button>
              <button style={{padding: '6px 12px', fontSize: '0.65rem', backgroundColor: 'var(--bg-main)'}}>10</button>
            </div>
          </div>
          
          <div className="jog-interface">
            <div className="xy-pad">
              <button className="pad-btn pad-up-left"><SolidTriangle angle={-45} /></button>
              <button className="pad-btn pad-up"><SolidTriangle angle={0} /></button>
              <button className="pad-btn pad-up-right"><SolidTriangle angle={45} /></button>
              <button className="pad-btn pad-left"><SolidTriangle angle={-90} /></button>
              <button className="pad-btn pad-right"><SolidTriangle angle={90} /></button>
              <button className="pad-btn pad-down-left"><SolidTriangle angle={-135} /></button>
              <button className="pad-btn pad-down"><SolidTriangle angle={180} /></button>
              <button className="pad-btn pad-down-right"><SolidTriangle angle={135} /></button>
              <div className="pad-center">XY_PAD</div>
            </div>
            
            <div className="z-pad">
              <button className="pad-btn" style={{position: 'relative'}}><SolidTriangle angle={0} /></button>
              <div className="z-label">Z</div>
              <button className="pad-btn" style={{position: 'relative'}}><SolidTriangle angle={180} /></button>
              <div style={{fontSize: '0.55rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center'}}>PEN STATE</div>
              <div className="pen-state">
                <button className="pen-btn active">DOWN</button>
                <button className="pen-btn" style={{backgroundColor: 'var(--bg-main)'}}>UP</button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="charts-row">
          <div className="panel chart-panel">
            <div className="chart-header">
              <span>Motor Temperature</span>
              <span>42.4°C</span>
            </div>
            <div className="bar-chart">
              {[30, 32, 35, 36, 40, 42, 45, 50, 55, 60].map((h, i) => (
                <div key={i} className="chart-bar" style={{height: `${h}%`, opacity: 0.3 + (i*0.07)}}></div>
              ))}
            </div>
          </div>
          <div className="panel chart-panel">
            <div className="chart-header">
              <span>Power Load</span>
              <span>18.2W</span>
            </div>
            <div className="bar-chart">
              {[20, 22, 18, 25, 20, 30, 28, 35, 25, 40].map((h, i) => (
                <div key={i} className="chart-bar" style={{height: `${h}%`, opacity: 0.3 + (i*0.07)}}></div>
              ))}
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
              <div className="pos-val">142.080 <span className="pos-unit">MM</span></div>
            </div>
            <div className="pos-item">
              <div className="pos-label">Y_AXIS</div>
              <div className="pos-val">094.215 <span className="pos-unit">MM</span></div>
            </div>
            <div className="pos-item">
              <div className="pos-label">Z_AXIS</div>
              <div className="pos-val">005.000 <span className="pos-unit">MM</span></div>
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

export default ControlsView;
