import React, { useState, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { HttpResponse } from '../types';
import { AppContext, formatSize } from '../store';
import NetworkGraphViewer from './NetworkGraphViewer';
import TreeGraphViewer from './TreeGraphViewer';
import { Network, Filter, X, FoldVertical, UnfoldVertical, FolderTree, Maximize2, Minimize2, Square } from 'lucide-react';
import { JSONPath } from 'jsonpath-plus';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

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

export default function ResponsePanel({ 
  response, 
  isLoading, 
  onCancel,
  filterPath = '', 
  onFilterChange 
}: { 
  response?: HttpResponse, 
  isLoading: boolean, 
  onCancel?: () => void,
  filterPath?: string,
  onFilterChange?: (val: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies'>('body');
  const [activeGraph, setActiveGraph] = useState<'none' | 'network' | 'tree'>('none');
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const { state } = useContext(AppContext);
  const editorRef = useRef<any>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGraphFullscreen) {
        setIsGraphFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGraphFullscreen]);

  const handleFoldAll = () => {
    if (!editorRef.current) return;
    try {
      editorRef.current.focus();
      const action = editorRef.current.getAction('editor.foldAll');
      if (action) {
        action.run();
      } else {
        editorRef.current.trigger('fold', 'editor.foldAll', null);
      }
    } catch (err) {
      console.error('Failed to fold all:', err);
    }
  };

  const handleUnfoldAll = () => {
    if (!editorRef.current) return;
    try {
      editorRef.current.focus();
      const action = editorRef.current.getAction('editor.unfoldAll');
      if (action) {
        action.run();
      } else {
        editorRef.current.trigger('unfold', 'editor.unfoldAll', null);
      }
    } catch (err) {
      console.error('Failed to unfold all:', err);
    }
  };

  const { formattedText, lineMap } = React.useMemo(() => {
    try {
      if (!response) return { formattedText: '', lineMap: {} };
      
      let dataToDisplay = response.data;
      const isXmlOrHtml = typeof dataToDisplay === 'string' && 
        (response.headers['content-type']?.includes('xml') || response.headers['content-type']?.includes('html') || dataToDisplay.trim().startsWith('<'));

      if (filterPath) {
        if (response.isJson) {
          try {
            let jsonPathQuery = filterPath;
            let wildcardPrefix = '';
            
            // Check for custom wildcard syntax like `$.data[*].length*`
            const wildcardMatch = filterPath.match(/^(.*)\.([a-zA-Z0-9_]+)\*$/);
            if (wildcardMatch) {
              jsonPathQuery = wildcardMatch[1] + '.*';
              wildcardPrefix = wildcardMatch[2];
            }

            const result = JSONPath({ 
              path: jsonPathQuery, 
              json: dataToDisplay, 
              resultType: wildcardPrefix ? 'all' : 'value' 
            });

            if (wildcardPrefix) {
              dataToDisplay = result
                .filter((r: any) => String(r.parentProperty).startsWith(wildcardPrefix))
                .map((r: any) => r.value);
            } else {
              dataToDisplay = result;
            }
          } catch (e: any) {
            return { formattedText: `JSONPath Error:\n${e.message}`, lineMap: {} };
          }
        } else if (isXmlOrHtml) {
          try {
            const doc = new DOMParser({
              locator: false,
              errorHandler: () => {}
            }).parseFromString(dataToDisplay, 'text/xml');
            
            const result = xpath.select(filterPath, doc as any);
            if (Array.isArray(result)) {
              dataToDisplay = result.map(n => n.toString ? n.toString() : String(n)).join('\n');
            } else if (result && typeof (result as any).toString === 'function') {
              dataToDisplay = (result as any).toString();
            } else {
              dataToDisplay = String(result);
            }
          } catch (e: any) {
            return { formattedText: `XPath Error:\n${e.message}`, lineMap: {} };
          }
        }
      }

      // If we filtered a JSON array or object, or original response is JSON
      if (response.isJson || (filterPath && typeof dataToDisplay !== 'string')) {
        return stringifyAndMap(dataToDisplay);
      }
      
      // XML or Text
      if (typeof dataToDisplay === 'string') return { formattedText: dataToDisplay, lineMap: {} };
      return { formattedText: JSON.stringify(dataToDisplay, null, 2), lineMap: {} };
      
    } catch (e: any) {
      console.error(e);
      return { formattedText: String(e.stack || e), lineMap: {} };
    }
  }, [response, filterPath]);

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
          <div className="flex flex-col items-center space-y-2">
            <span className="text-sm">Sending request...</span>
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-bg-secondary hover:bg-red-950/40 text-text-secondary hover:text-red-400 border border-border-primary hover:border-red-500/40 transition-colors shadow-xs"
                title="Stop waiting and cancel request"
              >
                <Square size={11} className="fill-current text-red-500" />
                <span>Stop Request</span>
              </button>
            )}
          </div>
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
      <div className={`flex-1 bg-bg-primary ${activeTab === 'body' ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
        {activeTab === 'body' && (
          <>
            {/* Filter & Actions Bar */}
            <div className="flex items-center space-x-2 px-4 py-2 border-b border-border-primary bg-bg-secondary shrink-0">
              <Filter size={14} className="text-text-secondary shrink-0" />
              <input
                type="text"
                value={filterPath}
                onChange={(e) => onFilterChange?.(e.target.value)}
                placeholder={response.isJson ? "Filter with JSONPath (e.g. $.store.book[*].author)" : "Filter with XPath (e.g. //title/text())"}
                className="flex-1 bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-accent-hover font-mono min-w-0"
              />
              {filterPath && (
                <button
                  onClick={() => onFilterChange?.('')}
                  className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary shrink-0"
                  title="Clear filter"
                >
                  <X size={14} />
                </button>
              )}

              <div className="h-4 w-px bg-border-primary mx-1 shrink-0" />

              <button
                onClick={handleFoldAll}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-bg-tertiary hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-primary transition-colors shrink-0"
                title="Fold All (Collapse all blocks)"
              >
                <FoldVertical size={13} />
                <span>Fold All</span>
              </button>

              <button
                onClick={handleUnfoldAll}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-bg-tertiary hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-primary transition-colors shrink-0"
                title="Unfold All (Expand all blocks)"
              >
                <UnfoldVertical size={13} />
                <span>Unfold All</span>
              </button>

              {response.isJson && (
                <div className="flex items-center space-x-1.5 shrink-0">
                  <div className="h-4 w-px bg-border-primary mx-1" />
                  <button
                    onClick={() => setActiveGraph(activeGraph === 'network' ? 'none' : 'network')}
                    className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      activeGraph === 'network' 
                        ? 'bg-accent-primary text-white hover:bg-accent-hover' 
                        : 'bg-bg-tertiary hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-primary'
                    }`}
                    title="Toggle Network Graph"
                  >
                    <Network size={13} />
                    <span>Network Graph</span>
                  </button>

                  <button
                    onClick={() => setActiveGraph(activeGraph === 'tree' ? 'none' : 'tree')}
                    className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      activeGraph === 'tree' 
                        ? 'bg-accent-primary text-white hover:bg-accent-hover' 
                        : 'bg-bg-tertiary hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-primary'
                    }`}
                    title="Toggle Tree Graph"
                  >
                    <FolderTree size={13} />
                    <span>Tree Graph</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex flex-1 w-full relative min-h-0">
              <div className={`h-full ${response.isJson && activeGraph !== 'none' ? 'w-1/2 border-r border-border-primary' : 'w-full'} relative`}>
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
                    folding: true,
                    foldingHighlight: true,
                    foldingStrategy: 'auto',
                    showFoldingControls: 'always',
                  }}
                />
              </div>

              {response.isJson && activeGraph !== 'none' && !isGraphFullscreen && (
                <div className="w-1/2 h-full bg-bg-primary flex flex-col border-l border-border-primary relative">
                  {/* Split Header */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary bg-bg-secondary shrink-0">
                    <div className="flex items-center bg-bg-tertiary rounded p-0.5 border border-border-primary">
                      <button
                        onClick={() => setActiveGraph('network')}
                        className={`flex items-center space-x-1 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                          activeGraph === 'network'
                            ? 'bg-accent-primary text-white shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Network size={12} />
                        <span>Network</span>
                      </button>
                      <button
                        onClick={() => setActiveGraph('tree')}
                        className={`flex items-center space-x-1 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                          activeGraph === 'tree'
                            ? 'bg-accent-primary text-white shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <FolderTree size={12} />
                        <span>Tree</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setIsGraphFullscreen(true)}
                        className="flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded bg-bg-tertiary hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-primary transition-colors"
                        title="Full Screen"
                      >
                        <Maximize2 size={12} />
                        <span>Full Screen</span>
                      </button>
                      <button
                        onClick={() => setActiveGraph('none')}
                        className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary transition-colors"
                        title="Close Graph"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 w-full h-full relative overflow-hidden">
                    {activeGraph === 'network' && (
                      <NetworkGraphViewer 
                        data={response.data} 
                        onNodeClick={handleNodeClick}
                        isFullscreen={false}
                        onToggleFullscreen={() => setIsGraphFullscreen(true)}
                      />
                    )}
                    {activeGraph === 'tree' && (
                      <TreeGraphViewer 
                        data={response.data} 
                        onNodeClick={handleNodeClick}
                        isFullscreen={false}
                        onToggleFullscreen={() => setIsGraphFullscreen(true)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Graph Overlay Modal */}
            {response.isJson && activeGraph !== 'none' && isGraphFullscreen && createPortal(
              <div className="fixed inset-0 z-[9999] bg-bg-primary flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary bg-bg-secondary shrink-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center bg-bg-tertiary rounded-md p-0.5 border border-border-primary">
                      <button
                        onClick={() => setActiveGraph('network')}
                        className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                          activeGraph === 'network'
                            ? 'bg-accent-primary text-white shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Network size={13} />
                        <span>Network Graph</span>
                      </button>
                      <button
                        onClick={() => setActiveGraph('tree')}
                        className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                          activeGraph === 'tree'
                            ? 'bg-accent-primary text-white shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <FolderTree size={13} />
                        <span>Tree Graph</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsGraphFullscreen(false)}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-bg-tertiary hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-primary transition-colors"
                      title="Exit Full Screen (Esc)"
                    >
                      <Minimize2 size={13} />
                      <span>Exit Full Screen</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveGraph('none');
                        setIsGraphFullscreen(false);
                      }}
                      className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary transition-colors"
                      title="Close Graph"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full h-full relative overflow-hidden">
                  {activeGraph === 'network' && (
                    <NetworkGraphViewer 
                      data={response.data} 
                      onNodeClick={handleNodeClick}
                      isFullscreen={true}
                      onToggleFullscreen={() => setIsGraphFullscreen(false)}
                    />
                  )}
                  {activeGraph === 'tree' && (
                    <TreeGraphViewer 
                      data={response.data} 
                      onNodeClick={handleNodeClick}
                      isFullscreen={true}
                      onToggleFullscreen={() => setIsGraphFullscreen(false)}
                    />
                  )}
                </div>
              </div>,
              document.body
            )}
          </>
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
