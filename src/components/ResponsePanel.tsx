import React, { useState, useContext, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { HttpResponse } from '../types';
import { AppContext, formatSize } from '../store';
import NetworkGraphViewer from './NetworkGraphViewer';
import { Network } from 'lucide-react';

function stringifyAndMap(obj: any): { formattedText: string, lineMap: Record<string, number> } {
  const map: Record<string, number> = {};
  let line = 1;
  let out = '';

  function emit(str: string) {
    out += str;
    line += (str.match(/\n/g) || []).length;
  }

  function walk(val: any, indent: string, path: string) {
    if (val === null) {
      emit('null');
    } else if (typeof val === 'string') {
      emit(JSON.stringify(val));
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      emit(String(val));
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        emit('[]');
      } else {
        emit('[\n');
        for (let i = 0; i < val.length; i++) {
          const newPath = path ? `${path}[${i}]` : `[${i}]`;
          emit(indent + '  ');
          map[newPath] = line;
          walk(val[i], indent + '  ', newPath);
          if (i < val.length - 1) emit(',');
          emit('\n');
        }
        emit(indent + ']');
      }
    } else if (typeof val === 'object') {
      const keys = Object.keys(val);
      if (keys.length === 0) {
        emit('{}');
      } else {
        emit('{\n');
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const newPath = path ? `${path}.${k}` : `${k}`;
          emit(indent + '  ' + JSON.stringify(k) + ': ');
          map[newPath] = line;
          walk(val[k], indent + '  ', newPath);
          if (i < keys.length - 1) emit(',');
          emit('\n');
        }
        emit(indent + '}');
      }
    } else {
      emit('null');
    }
  }

  walk(obj, '', '');
  return { formattedText: out, lineMap: map };
}

function pathToString(path: (string | number)[]): string {
  return path.map(p => typeof p === 'number' ? `[${p}]` : `.${p}`).join('').replace(/^\./, '');
}

export default function ResponsePanel({ response, isLoading }: { response?: HttpResponse, isLoading: boolean }) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies'>('body');
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const { state } = useContext(AppContext);
  const editorRef = useRef<any>(null);

  const { formattedText, lineMap } = React.useMemo(() => {
    try {
      if (!response) return { formattedText: '', lineMap: {} };
      if (!response.isJson) {
        if (typeof response.data === 'string') return { formattedText: response.data, lineMap: {} };
        return { formattedText: JSON.stringify(response.data, null, 2), lineMap: {} };
      }
      
      return stringifyAndMap(response.data);
    } catch (e: any) {
      console.error(e);
      return { formattedText: String(e.stack || e), lineMap: {} };
    }
  }, [response]);

  const handleNodeClick = (node: any) => {
    if (!editorRef.current || !node.path || node.path.length === 0) return;
    
    const pathStr = pathToString(node.path);
    const targetLine = lineMap[pathStr];
    
    if (targetLine) {
      const model = editorRef.current.getModel();
      if (model) {
        editorRef.current.revealLineInCenter(targetLine);
        const lineContent = model.getLineContent(targetLine);
        editorRef.current.setSelection({
          startLineNumber: targetLine,
          startColumn: 1,
          endLineNumber: targetLine,
          endColumn: lineContent.length + 1
        });
        editorRef.current.focus();
      }
    }
  };

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

  const theme = state.settings.theme === 'light' ? 'light' : 'vs-dark';

  return (
    <div className="flex flex-col h-full">
      {/* Response Content */}
      <div className={`flex-1 bg-bg-primary ${activeTab === 'body' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {activeTab === 'body' && (
          <div className="flex h-full w-full">
            <div className={`h-full ${response.isJson && isGraphExpanded ? 'w-1/2 border-r border-border-primary' : 'w-full'} relative`}>
              <Editor
            height="100%"
            language={getEditorLanguage()}
            theme={theme}
              value={formattedText}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                readOnly: true,
                fontSize: state.settings.fontSize,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
            {response.isJson && (
              <button
                onClick={() => setIsGraphExpanded(!isGraphExpanded)}
                className={`absolute top-4 right-4 z-10 p-2 rounded shadow-md transition-colors ${
                  isGraphExpanded 
                    ? 'bg-accent-primary text-white hover:bg-accent-hover' 
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-border-primary'
                }`}
                title={isGraphExpanded ? "Hide Network Graph" : "Show Network Graph"}
              >
                <Network size={16} />
              </button>
            )}
          </div>
          {response.isJson && isGraphExpanded && (
            <div className="w-1/2 h-full bg-bg-primary">
              <NetworkGraphViewer data={response.data} onNodeClick={handleNodeClick} />
            </div>
          )}
        </div>
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

      {/* Response Meta + Tab Bar (bottom) */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-t border-border-primary">
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
                {tab === 'cookies' && <span className="ml-1 text-xs text-text-secondary">({response.cookies?.length ?? 0})</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1">
            <span className="text-text-secondary">Status:</span>
            <span className="font-bold text-accent-primary">{response.status} {response.statusText}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-text-secondary">Time:</span>
            <span className="text-text-primary">{response.time} ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-text-secondary">Size:</span>
            <span className="text-text-primary">{formatSize(response.size)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
