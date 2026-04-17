import React, { useState } from 'react';
import './App.css';
import { 
  Settings, Terminal as TerminalIcon, HelpCircle, LayoutDashboard, 
  Gamepad2, FolderOpen, Code2, Activity, History
} from 'lucide-react';

import DashboardView from './components/DashboardView';
import FilesView from './components/FilesView';
import ControlsView from './components/ControlsView';
import TerminalView from './components/TerminalView';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="app-container">
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">PLOTTER_OS <span>V1.0</span></div>
          <div className="system-status">
            <span className="status-dot"></span>
            {activeTab === 'controls' ? 'SYSTEM_STABLE' : activeTab === 'terminal' ? 'SYSTEM_STATUS: OK \u00A0\u00A0\u00A0 LINK: STABLE' : 'SYSTEM READY'}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn"><Settings size={20} /></button>
          <button className="icon-btn"><TerminalIcon size={20} /></button>
          <button className="icon-btn"><HelpCircle size={20} /></button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <div className="active-unit">
            <div className="unit-label">{activeTab === 'terminal' ? <span className="status-dot" style={{display: 'inline-block', marginRight: '8px'}}></span> : null}Active Unit</div>
            <div className="unit-name">CONTROL_UNIT_01</div>
            <div className="unit-status">Operational</div>
          </div>

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
            
            {activeTab !== 'dashboard' && activeTab !== 'terminal' && (
              <div style={{padding: '0 24px', marginBottom: '16px'}}>
                <button className="btn-emergency peach" style={{margin: 0, width: '100%', padding: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-pink)', color: '#111', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Emergency Stop</button>
              </div>
            )}

            <div className="nav-item">
              <Activity size={20} />
              Diagnostics
            </div>
            <div className="nav-item">
              <History size={20} />
              Logs
            </div>
          </nav>
          
          <div className="sidebar-footer">
            {(activeTab === 'dashboard' || activeTab === 'terminal') ? (
              <button className="btn-emergency">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', border: '2px solid white', borderRadius: '50%', padding: '2px'}}>
                   <div style={{width: '100%', height: '100%', backgroundColor: 'white', clipPath: 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)'}}></div>
                </div>
                Emergency Stop
              </button>
            ) : null}
            
            {(activeTab !== 'dashboard' && activeTab !== 'terminal') && (
               <div style={{padding: '12px 24px', fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', backgroundColor: '#0d0e12', borderTop: '1px solid var(--border-color)'}}>
                 <span>LINK: <span style={{color: 'white'}}>ETHERNET_CONNECTED</span> &nbsp;&nbsp; LATENCY: <span style={{color: 'white'}}>12ms</span></span>
                 {activeTab === 'files' && <span>STORAGE: 2.4GB / 16GB <div style={{display: 'inline-block', width: '40px', height: '4px', backgroundColor: 'var(--bg-main)', verticalAlign: 'middle', marginLeft: '8px'}}><div style={{width: '15%', height: '100%', backgroundColor: 'var(--accent-yellow)'}}></div></div></span>}
               </div>
            )}
          </div>
        </aside>

        <main className="content-area">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'files' && <FilesView />}
          {activeTab === 'controls' && <ControlsView />}
          {activeTab === 'terminal' && <TerminalView />}
        </main>
      </div>
    </div>
  );
}

export default App;
