import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Trash, Download, RefreshCw } from 'lucide-react';

const TerminalView = ({ serial }) => {
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serial?.logs, autoScroll]);

  const handleSend = () => {
    if (input.trim() && serial) {
      serial.sendCommand(input.trim());
      setInput('');
    }
  };

  const handleExportLog = () => {
    if (!serial?.logs?.length) return;

    const content = serial.logs
      .map((log) => `[${log.time}] ${log.type.toUpperCase()}: ${log.msg}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plotter-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
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
            <button className="term-btn" onClick={() => serial?.setLogs([])}><Trash size={12}/> Clear Log</button>
            <button className="term-btn" onClick={handleExportLog}><Download size={12}/> Export Log</button>
            <button className={`term-btn ${autoScroll ? 'active' : ''}`} onClick={() => setAutoScroll(!autoScroll)}><RefreshCw size={12}/> Auto-Scroll</button>
          </div>
        </div>
        
        <div className="term-output" style={{overflowY: 'auto', flex: 1}}>
          {serial?.logs.map((log, i) => (
            <div key={i} className="log-line">
              <span className="log-time">{log.time}</span>
              <span className={`log-msg ${log.type === 'response' ? 'response' : ''}`}>{log.msg}</span>
            </div>
          ))}
          
          <div className="log-prompt">root@plotter_os:~$ <span></span></div>
          <div ref={endRef} />
        </div>
        
        <div className="term-input-bar">
          <TerminalIcon size={16} color="var(--text-secondary)" />
          <input 
            type="text" 
            className="term-input" 
            placeholder="ENTER G-CODE COMMAND..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <div style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>HEX_MODE: OFF</div>
          <button className="btn-action-cyan" style={{margin: 0, padding: '8px 16px', fontSize: '0.75rem'}} onClick={handleSend}>Send Cmd</button>
        </div>
      </div>
      
      <div className="term-side">
        <div className="side-panel">
          <div className="panel-title" style={{marginBottom: '16px'}}>Live_Metrics</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.05em'}}>X-AXIS_POS</span>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: '1.25rem'}}>{serial?.position?.x?.toFixed(2) || '0.00'}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.05em'}}>Y-AXIS_POS</span>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: '1.25rem'}}>{serial?.position?.y?.toFixed(2) || '0.00'}</span>
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
};

export default TerminalView;
