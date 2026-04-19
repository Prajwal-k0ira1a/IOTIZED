import React, { useState } from 'react';
import './App.css';
import { 
  Settings, Terminal as TerminalIcon, HelpCircle, LayoutDashboard, 
  Gamepad2, FolderOpen, Code2, Plug, PlugZap
} from 'lucide-react';

import DashboardView from './components/DashboardView';
import FilesView from './components/FilesView';
import ControlsView from './components/ControlsView';
import TerminalView from './components/TerminalView';
import { useSerial } from './hooks/useSerial';

const EmergencyButton = ({ style, onEmergency }) => (
  <button className="btn-emergency" style={style} onClick={onEmergency}>
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', border: '2px solid white', borderRadius: '50%', padding: '2px'}}>
       <div style={{width: '100%', height: '100%', backgroundColor: 'white', clipPath: 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)'}}></div>
    </div>
    Emergency Stop
  </button>
);

function App() {
  const [activeTab, setActiveTab] = useState('controls');
  const serial = useSerial();

  const handleEmergency = () => {
    // Soft Reset
    serial.sendRealtimeCommand('\x18');
  };

  return (
    <div className="app-container">
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">PLOTTER_OS <span>V1.0</span></div>
          <div className="system-status">
            <span className={`status-dot ${serial.connected ? 'active' : ''}`} style={{backgroundColor: serial.connected ? 'var(--accent-cyan)' : 'var(--text-muted)'}}></span>
            {serial.connected ? `SYSTEM_STATUS: ${serial.status} \u00A0\u00A0\u00A0 LINK: ACTIVE` : 'SYSTEM DISCONNECTED'}
          </div>
        </div>
        <div className="topbar-actions">
          <button 
            className="btn-action-cyan" 
            style={{margin: 0, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: serial.connected ? 'transparent' : 'var(--accent-cyan)', color: serial.connected ? 'var(--accent-cyan)' : 'black', border: serial.connected ? '1px solid var(--accent-cyan)' : 'none'}}
            onClick={serial.connected ? serial.disconnect : serial.connect}
          >
            {serial.connected ? <PlugZap size={16} /> : <Plug size={16} />}
            {serial.connected ? 'DISCONNECT' : 'CONNECT'}
          </button>
          <button className="icon-btn"><Settings size={20} /></button>
          <button className="icon-btn" onClick={() => setActiveTab('terminal')}><TerminalIcon size={20} /></button>
          <button className="icon-btn"><HelpCircle size={20} /></button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
        
          <nav className="nav-menu">
            <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <LayoutDashboard size={20} />
              Dashboard
            </div>
            <div className={`nav-item ${activeTab === 'controls' ? 'active' : ''}`} onClick={() => setActiveTab('controls')}>
              <Gamepad2 size={20} />
              Controls
            </div>
            <div className={`nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
              <FolderOpen size={20} />
              Files
            </div>
            <div className={`nav-item ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
              <Code2 size={20} />
              Terminal
            </div>
            
            <div className="nav-spacer"></div>
            
          </nav>
          
          <div className="sidebar-footer">
            <EmergencyButton onEmergency={handleEmergency} />
          </div>
        </aside>

        <main className="content-area">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'files' && <FilesView />}
          {activeTab === 'controls' && <ControlsView serial={serial} />}
          {activeTab === 'terminal' && <TerminalView serial={serial} />}
        </main>
      </div>
    </div>
  );
}

export default App;
