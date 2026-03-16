import React, { useContext } from 'react';
import { X, Monitor, Type } from 'lucide-react';
import { AppContext } from '../store';
import { SettingsModel } from '../types';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useContext(AppContext);
  const settings = state.settings;

  const updateSettings = (updater: (s: SettingsModel) => SettingsModel) => {
    dispatch({ type: 'UPDATE_SETTINGS', updater });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg-primary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary">
          <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Theme Setting */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-text-primary">
              <Monitor size={16} />
              <label className="text-sm font-medium">Theme</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'dark', name: 'Dark (Default)' },
                { id: 'monako', name: 'Monako' },
                { id: 'cyberpunk', name: 'Cyberpunk' },
                { id: 'light', name: 'Light' }
              ].map(theme => (
                <button
                  key={theme.id}
                  onClick={() => updateSettings(s => ({ ...s, theme: theme.id as any }))}
                  className={`px-3 py-2 rounded border text-sm text-left transition-colors ${
                    settings.theme === theme.id 
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' 
                      : 'border-border-primary hover:border-text-secondary text-text-secondary'
                  }`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Setting */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-text-primary">
              <div className="flex items-center space-x-2">
                <Type size={16} />
                <label className="text-sm font-medium">Editor Font Size</label>
              </div>
              <span className="text-xs font-mono bg-bg-tertiary px-2 py-1 rounded text-accent-primary">
                {settings.fontSize}px
              </span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="24" 
              step="1"
              value={settings.fontSize}
              onChange={(e) => updateSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
              className="w-full accent-accent-primary"
            />
            <div className="flex justify-between text-xs text-text-secondary">
              <span>10px</span>
              <span>24px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
