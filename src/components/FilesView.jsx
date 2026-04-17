import React from 'react';
import { Upload, FilePlus, FolderOpen, Code2, Trash2, Eye, Send } from 'lucide-react';

const FilesView = () => (
  <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
    <div className="page-header">
      <div>
        <div className="page-title">File Browser</div>
        <div className="breadcrumbs">Root <span>&gt;</span> Gcode_Library</div>
      </div>
      <div style={{display: 'flex', gap: '16px'}}>
        <button className="btn-secondary" style={{padding: '12px 24px'}}><Upload size={16}/> Upload File</button>
        <button className="btn-primary" style={{margin: 0, padding: '12px 24px', width: 'auto'}}><FilePlus size={16}/> New Script</button>
      </div>
    </div>
    
    <div className="files-layout">
      <div className="files-list">
        <div className="list-header">
          <div>File Identity</div>
          <div>Last Modified</div>
          <div>Size</div>
          <div>Status</div>
          <div>Ops</div>
        </div>
        
        <div className="file-item">
          <div className="file-name-col">
            <FolderOpen className="file-icon" size={20} />
            <div>
              <div className="file-name">DRONE_CHASSIS_V2.GCODE</div>
              <div className="file-path">PATH: /PROJECT_A/FABRICATION/</div>
            </div>
          </div>
          <div className="file-date">2023.10.24<br/>14:32</div>
          <div className="file-size">1.24 MB</div>
          <div><span className="status-badge validated">Validated</span></div>
          <div></div>
        </div>
        
        <div className="file-item selected">
          <div className="file-name-col">
            <Code2 className="file-icon" size={20} />
            <div>
              <div className="file-name">TURBINE_BLADE_FINISH.NC</div>
              <div className="file-path">PATH: /ROOT/ACTIVE_JOBS/</div>
            </div>
          </div>
          <div className="file-date">2023.10.25<br/>09:15</div>
          <div className="file-size">842 KB</div>
          <div><span className="status-badge ready">Ready</span></div>
          <div><Trash2 size={16} color="var(--text-muted)"/></div>
        </div>
        
        <div className="file-item">
          <div className="file-name-col">
            <Code2 className="file-icon" style={{color: 'var(--text-muted)'}} size={20} />
            <div>
              <div className="file-name" style={{color: 'var(--text-muted)'}}>CALIBRATION_PATTERN.GCODE</div>
              <div className="file-path">PATH: /SYSTEM/CORE/</div>
            </div>
          </div>
          <div className="file-date">2023.09.12<br/>11:00</div>
          <div className="file-size">45 KB</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start'}}>
            <span className="status-badge error" style={{fontSize: '0.5rem'}}>Checksum</span>
            <span className="status-badge error" style={{fontSize: '0.5rem'}}>Error</span>
          </div>
          <div></div>
        </div>

        <div className="file-item">
          <div className="file-name-col">
            <FolderOpen className="file-icon" size={20} />
            <div>
              <div className="file-name">ASSEMBLY_JIG_K14.GCODE</div>
              <div className="file-path">PATH: /PROJECT_A/FIXTURES/</div>
            </div>
          </div>
          <div className="file-date">2023.10.22<br/>18:44</div>
          <div className="file-size">2.1 MB</div>
          <div><span className="status-badge validated">Validated</span></div>
          <div></div>
        </div>
      </div>
      
      <div className="file-preview-pane">
        <div className="preview-header">
          <span className="preview-title">Preview</span>
          <Eye size={18} color="var(--text-secondary)" />
        </div>
        <div style={{padding: '0 20px', fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '16px'}}>File: TURBINE_BLADE_FINISH.NC</div>
        
        <div className="preview-visual">
           <div style={{position: 'absolute', top: '16px', right: '16px', textAlign: 'right', fontSize: '0.6rem', color: 'var(--accent-peach)'}}>EST. TIME<br/><span style={{fontSize: '0.8rem', fontFamily: 'var(--font-mono)'}}>01:42:15</span></div>
           <div style={{width: '60%', height: '60%', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: '80%', height: '80%', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                 <div style={{width: '40px', height: '40px', borderTop: '2px dashed var(--text-secondary)', borderRight: '2px dashed var(--text-secondary)', transform: 'rotate(45deg)'}}></div>
              </div>
           </div>
           <div style={{position: 'absolute', bottom: '16px', left: '16px', fontSize: '0.55rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)'}}>X: 142.45<br/>Y: 88.12<br/>Z: 12.00</div>
        </div>
        
        <div className="preview-stats">
          <div className="stat-box">
            <div className="stat-label">Total Lines</div>
            <div className="stat-val">14,204</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Min Clearance</div>
            <div className="stat-val" style={{color: 'var(--accent-peach)'}}>2.5mm</div>
          </div>
        </div>
        
        <button className="btn-action-cyan"><Send size={18}/> Send to Machine</button>
      </div>
    </div>
  </div>
);

export default FilesView;
