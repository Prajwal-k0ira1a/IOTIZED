import React from 'react';
import { Terminal as TerminalIcon, Trash, Download, RefreshCw } from 'lucide-react';

const TerminalView = () => (
  <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
    <div className="terminal-layout">
      <div className="terminal-main">
        <div className="term-header">
          <div className="term-dots">
            <div className="term-dot"></div>
            <div className="term-dot"></div>
            <div className="term-dot"></div>
          </div>
          <div className="term-title">Console_Output.Log</div>
          <div className="term-actions">
            <button className="term-btn"><Trash size={12}/> Clear Log</button>
            <button className="term-btn"><Download size={12}/> Export Log</button>
            <button className="term-btn active"><RefreshCw size={12}/> Auto-Scroll</button>
          </div>
        </div>
        
        <div className="term-output">
          <div className="log-line"><span className="log-time">12:44:01</span><span className="log-msg">G21 ; set units to millimeters</span></div>
          <div className="log-line"><span className="log-time">12:44:01</span><span className="log-msg response">&gt;&gt; ok</span></div>
          <div className="log-line"><span className="log-time">12:44:02</span><span className="log-msg">G90 ; use absolute coordinates</span></div>
          <div className="log-line"><span className="log-time">12:44:02</span><span className="log-msg response">&gt;&gt; ok</span></div>
          <div className="log-line"><span className="log-time">12:44:05</span><span className="log-msg">M104 S200 ; set extruder temp</span></div>
          <div className="log-line"><span className="log-time">12:44:10</span><span className="log-msg error">[SYSTEM_ERROR] - HEATER_FAULT: TO SENSOR DISCONNECTED</span></div>
          <div className="log-line"><span className="log-time">12:44:10</span><span className="log-msg response">&gt;&gt; halt triggered</span></div>
          <div className="log-line"><span className="log-time">12:45:12</span><span className="log-msg">M999 ; reset system after fault</span></div>
          <div className="log-line"><span className="log-time">12:45:13</span><span className="log-msg response">&gt;&gt; system re-initialized. ready.</span></div>
          <div className="log-line"><span className="log-time">12:45:15</span><span className="log-msg">G28 X0 Y0 ; homing x and y axes</span></div>
          <div className="log-line"><span className="log-time">12:45:18</span><span className="log-msg response">&gt;&gt; homing complete</span></div>
          <div className="log-line"><span className="log-time">12:45:20</span><span className="log-msg">G1 F200 E3 ; prime extruder</span></div>
          <div className="log-line"><span className="log-time">12:45:20</span><span className="log-msg response">&gt;&gt; ok</span></div>
          
          <div className="log-prompt">root@plotter_os:~$ <span></span></div>
        </div>
        
        <div className="term-input-bar">
          <TerminalIcon size={16} color="var(--text-secondary)" />
          <input type="text" className="term-input" placeholder="ENTER G-CODE COMMAND..." />
          <div style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>HEX_MODE: OFF</div>
          <button className="btn-action-cyan" style={{margin: 0, padding: '8px 16px', fontSize: '0.75rem'}}>Send Cmd</button>
        </div>
      </div>
      
      <div className="term-side">
        <div className="side-panel">
          <div className="panel-title" style={{marginBottom: '16px'}}>Live_Metrics</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.05em'}}>X-AXIS_POS</span>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: '1.25rem'}}>142.04</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.05em'}}>Y-AXIS_POS</span>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: '1.25rem'}}>88.50</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.05em'}}>BUFFER_LOAD</span>
              <div style={{width: '60px', height: '4px', backgroundColor: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden'}}>
                 <div style={{width: '45%', height: '100%', backgroundColor: 'var(--accent-cyan)'}}></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="side-panel" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          <div className="panel-title">Process_Visualizer</div>
          <div className="process-grid">
             <div className="process-cell"></div>
             <div className="process-cell"></div>
             <div className="process-cell"></div>
             <div className="process-cell"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default TerminalView;
