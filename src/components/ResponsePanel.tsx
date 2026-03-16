import React, { useState, useContext } from 'react';
import Editor from '@monaco-editor/react';
import { HttpResponse } from '../types';
import { AppContext } from '../store';

export default function ResponsePanel({ response, isLoading }: { response?: HttpResponse, isLoading: boolean }) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies'>('body');
  const { state } = useContext(AppContext);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
          <span>Sending request...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        Enter a URL and click Send to get a response
      </div>
    );
  }

  const statusColor = response.status >= 200 && response.status < 300 ? 'text-green-500' : 
                      response.status >= 400 ? 'text-red-500' : 'text-yellow-500';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getContentType = () => {
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) return 'json';
    if (contentType.includes('text/html')) return 'html';
    if (contentType.includes('text/plain')) return 'text';
    if (contentType.includes('application/javascript')) return 'javascript';
    if (contentType.includes('text/css')) return 'css';
    if (contentType.includes('application/xml')) return 'xml';
    return 'text';
  };

  const getEditorLanguage = () => {
    const type = getContentType();
    if (type === 'json') return 'json';
    if (type === 'html') return 'html';
    if (type === 'javascript') return 'javascript';
    if (type === 'css') return 'css';
    if (type === 'xml') return 'xml';
    return 'plaintext';
  };

  const formatData = (data: any, isJson: boolean) => {
    if (isJson) {
      return JSON.stringify(data, null, 2);
    }
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  const theme = state.settings.theme === 'light' ? 'light' : 'vs-dark';

  return (
    <div className="flex flex-col h-full">
      {/* Response Meta */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {['body', 'headers', 'cookies'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-1 text-sm font-medium transition-colors ${
                  activeTab === tab ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'headers' && <span className="ml-1 text-xs text-text-secondary">({Object.keys(response.headers).length})</span>}
                {tab === 'cookies' && response.cookies && <span className="ml-1 text-xs text-text-secondary">({response.cookies.length})</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1">
            <span className="text-text-secondary">Status:</span>
            <span className={`font-bold ${statusColor}`}>{response.status} {response.statusText}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-text-secondary">Time:</span>
            <span className="text-green-500">{response.time} ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-text-secondary">Size:</span>
            <span className="text-green-500">{formatSize(response.size)}</span>
          </div>
        </div>
      </div>

      {/* Response Content */}
      <div className="flex-1 overflow-auto bg-bg-primary">
        {activeTab === 'body' && (
          <Editor
            height="100%"
            language={getEditorLanguage()}
            theme={theme}
            value={formatData(response.data, response.isJson)}
            options={{
              readOnly: true,
              fontSize: state.settings.fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        )}
        {activeTab === 'headers' && (
          <div className="flex flex-col space-y-1 p-4">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex font-mono" style={{ fontSize: 'var(--editor-font-size)' }}>
                <span className="text-accent-primary w-1/3 break-words pr-4">{key}:</span>
                <span className="text-text-primary w-2/3 break-words">{value as string}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'cookies' && (
          <div className="flex flex-col space-y-2 p-4">
            {response.cookies && response.cookies.length > 0 ? (
              response.cookies.map((cookie, i) => (
                <div 
                  key={i} 
                  className="font-mono text-text-primary break-words border-b border-border-primary pb-2 mb-2 last:border-0"
                  style={{ fontSize: 'var(--editor-font-size)' }}
                >
                  {cookie}
                </div>
              ))
            ) : (
              <div className="text-sm text-text-secondary">No cookies received in this response.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
