import React from 'react';
import { HelpCircle, ZoomIn, Layers, LayoutDashboard, Eye, Maximize, Play, Pause, RotateCcw } from 'lucide-react';

const DashboardView = () => (
  <div className="dashboard-grid">
    <div className="status-bar">
      <div className="status-item">
        <div className="status-label">Connection <span className="status-dot"></span></div>
        <div className="status-value active">Active</div>
      </div>
      <div className="status-item">
        <div className="status-label">Machine Status <HelpCircle size={14} className="text-muted"/></div>
        <div className="status-value idle">IDLE</div>
      </div>
      <div className="status-item" style={{marginLeft: 'auto'}}>
        <div className="status-label">Work Coordinates <span style={{marginLeft: '24px', fontSize: '0.6rem'}}>UNIT: MM&nbsp;&nbsp;&nbsp;SCALE: 1.0</span></div>
        <div className="coord-group mt-2">
          <div className="coord-item">
            <span className="coord-label">X-Axis</span>
            <span className="coord-val">000.000</span>
          </div>
          <div className="coord-item">
            <span className="coord-label">Y-Axis</span>
            <span className="coord-val">000.000</span>
          </div>
          <div className="coord-item">
            <span className="coord-label">Z-Axis</span>
            <span className="coord-val">005.000</span>
          </div>
        </div>
      </div>
    </div>

    <div className="dashboard-main">
      <div className="visualizer-pane">
        <div className="viz-overlay-controls">
          <button className="viz-btn"><ZoomIn size={14} /> 100%</button>
          <button className="viz-btn"><Layers size={14} /> GCODE_PREVIEW_01.NC</button>
        </div>
        
        {/* Mock Blueprint drawing */}
        <div style={{width: '60%', height: '60%', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
           <div style={{position: 'absolute', inset: '20%', border: '1px dashed rgba(0, 240, 255, 0.2)', borderRadius: '50%'}}></div>
           <div style={{position: 'absolute', inset: '30%', border: '1px solid rgba(0, 240, 255, 0.1)', borderRadius: '50%'}}></div>
           <div style={{position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', border: '1px solid rgba(0, 240, 255, 0.1)'}}></div>
        </div>
        
        <div className="crosshair">
          <div className="crosshair-center"></div>
        </div>
        
        <div style={{position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '8px'}}>
          <button className="viz-btn" style={{padding: '8px'}}><LayoutDashboard size={16}/></button>
          <button className="viz-btn" style={{padding: '8px'}}><Eye size={16}/></button>
          <button className="viz-btn" style={{padding: '8px'}}><Maximize size={16}/></button>
        </div>
      </div>
      
      <div className="control-pane">
        <div className="control-section">
          <div className="section-title">Control Deck</div>
          <button className="btn-primary"><Play fill="currentColor" size={18} /> Start Job</button>
          <div className="btn-group">
            <button className="btn-secondary"><Pause size={14} /> Pause</button>
            <button className="btn-secondary"><RotateCcw size={14} /> Reset</button>
          </div>
          
          <div className="slider-group">
            <div className="slider-item">
              <div className="slider-header">
                <span>Feed Rate Override</span>
                <span>100%</span>
              </div>
              <div className="slider-track"><div className="slider-fill" style={{width: '100%'}}></div></div>
            </div>
            <div className="slider-item">
              <div className="slider-header">
                <span>Rapid Speed</span>
                <span>5000 MM/M</span>
              </div>
              <div className="slider-track"><div className="slider-fill" style={{width: '60%'}}></div></div>
            </div>
          </div>
        </div>
        
        <div className="control-section" style={{marginTop: 'auto', borderBottom: 'none'}}>
          <div className="metrics-list" style={{backgroundColor: 'var(--bg-panel)', padding: '16px', borderRadius: '4px'}}>
            <div className="metric-item">
              <span className="metric-label">Est. Completion</span>
              <span className="metric-val">-- : --</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Pen Pressure</span>
              <span className="metric-val">45g</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">G-Code Lines</span>
              <span className="metric-val">12,842</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Serial Port</span>
              <span className="metric-val cyan">/dev/ttyUSB0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardView;
