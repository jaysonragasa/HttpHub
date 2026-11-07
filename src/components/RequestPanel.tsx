import React, { useContext, useState, useRef, useEffect } from 'react';
import { Send, Loader2, Rows2, Columns2, AlertTriangle, Square } from 'lucide-react';
import { AppContext, DIVIDER_THICKNESS, clampSplitRatio } from '../store';
import { RequestModel, KV } from '../types';
import KeyValueEditor from './KeyValueEditor';
import ResponsePanel from './ResponsePanel';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Map of tab request ID -> active AbortController to allow immediate cancellation
const activeRequests = new Map<string, AbortController>();

export default function RequestPanel({ workspaceId, groupId, request }: { workspaceId: string, groupId: string, request: RequestModel }) {
  const { state, dispatch } = useContext(AppContext);
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'headers' | 'body' | 'settings'>('params');

  // Layout_Preference (global, persisted on SettingsModel)
  const { layoutOrientation, splitRatio } = state.settings;
  const isSideBySide = layoutOrientation === 'side-by-side';
  // Container measured via ref + ResizeObserver for pointer-drag math.
  const containerRef = useRef<HTMLDivElement>(null);
  // Live ratio held in local state during a drag; null when not dragging.
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const draggingRef = useRef(false);
  // Measured size along the active axis (width when side-by-side, height when stacked).
  const [axisSize, setAxisSize] = useState(0);
  // Before the first measurement, fall back to the stored ratio.
  const effectiveRatio = dragRatio ?? splitRatio;
  const configShare = effectiveRatio;
  const responseShare = 1 - effectiveRatio;

  // Measure the container along the active axis and keep it in sync with a ResizeObserver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setAxisSize(isSideBySide ? rect.width : rect.height);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSideBySide]);

  const commitRatio = (ratio: number) =>
    dispatch({ type: 'UPDATE_SETTINGS', updater: s => ({ ...s, splitRatio: ratio }) });

  // Layout_Toggle: flip orientation between stacked and side-by-side (R3.2, R3.3).
  const toggleOrientation = () =>
    dispatch({
      type: 'UPDATE_SETTINGS',
      updater: s => ({
        ...s,
        layoutOrientation: s.layoutOrientation === 'stacked' ? 'side-by-side' : 'stacked',
      }),
    });

  const handleDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragRatio(effectiveRatio);
  };

  const handleDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = isSideBySide ? rect.width : rect.height;
    if (size <= 0) return;
    const offset = isSideBySide ? e.clientX - rect.left : e.clientY - rect.top;
    const rawRatio = offset / size;
    setDragRatio(clampSplitRatio(rawRatio, size));
  };

  const handleDividerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    // Commit the final live ratio via a single dispatch, then read from the store.
    const finalRatio = dragRatio ?? splitRatio;
    commitRatio(finalRatio);
    setDragRatio(null);
  };

  const workspace = state.workspaces.find(w => w.id === workspaceId);
  const allTabs = workspace ? workspace.tabGroups.flatMap(g => g.tabs) : [];
  const otherTabs = allTabs.filter(t => t.id !== request.id);

  const updateRequest = (updater: (req: RequestModel) => RequestModel) => {
    dispatch({ type: 'UPDATE_REQUEST', workspaceId, groupId, tabId: request.id, updater });
  };

  const handleUrlChange = (newUrl: string) => {
    let updatedParams = [...request.params];
    
    const sanitizedUrl = newUrl.replace(/[\r\n]/g, '');
    const queryStart = sanitizedUrl.indexOf('?');
    if (queryStart !== -1) {
      const queryString = sanitizedUrl.slice(queryStart + 1);
      const searchParams = new URLSearchParams(queryString);
      
      const parsedParams: {key: string, value: string}[] = [];
      searchParams.forEach((value, key) => {
        parsedParams.push({ key, value });
      });

      const disabledParams = request.params.filter(p => !p.enabled);
      
      updatedParams = parsedParams.map(p => ({
        id: Math.random().toString(36).substring(7),
        key: p.key,
        value: p.value,
        enabled: true
      }));
      
      updatedParams = [...updatedParams, ...disabledParams];
    } else {
      updatedParams = request.params.filter(p => !p.enabled);
    }
    
    if (updatedParams.length === 0 || updatedParams[updatedParams.length - 1].key !== '' || updatedParams[updatedParams.length - 1].value !== '') {
      updatedParams.push({ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true });
    }

    updateRequest(r => ({ ...r, url: newUrl, name: newUrl || 'Untitled Request', params: updatedParams }));
  };

  const handleParamsChange = (newParams: KV[]) => {
    let newUrl = request.url;
    const queryStart = newUrl.indexOf('?');
    const baseUrl = queryStart !== -1 ? newUrl.slice(0, queryStart) : newUrl;
    
    const enabledParams = newParams.filter(p => p.enabled && p.key);
    if (enabledParams.length > 0) {
      const searchParams = new URLSearchParams();
      enabledParams.forEach(p => searchParams.append(p.key, p.value));
      newUrl = `${baseUrl}?${searchParams.toString().replace(/\+/g, '%20')}`;
    } else {
      newUrl = baseUrl;
    }

    updateRequest(r => ({ ...r, params: newParams, url: newUrl }));
  };

  const handleStop = () => {
    if (activeRequests.has(request.id)) {
      activeRequests.get(request.id)?.abort();
      activeRequests.delete(request.id);
    }
    updateRequest(r => ({
      ...r,
      isLoading: false,
      response: {
        status: 0,
        statusText: 'Cancelled',
        time: 0,
        size: 0,
        headers: {},
        data: 'Request cancelled by user',
        isJson: false,
        error: 'Request cancelled by user'
      }
    }));
  };

  const handleSend = async () => {
    if (!request.url) return;
    
    if (activeRequests.has(request.id)) {
      activeRequests.get(request.id)?.abort();
      activeRequests.delete(request.id);
    }

    const abortController = new AbortController();
    activeRequests.set(request.id, abortController);

    updateRequest(r => ({ ...r, isLoading: true, response: undefined }));

    try {
      // Construct URL (params are already synced to request.url)
      const sanitizedUrl = request.url.replace(/[\r\n]/g, '');
      const urlObj = new URL(sanitizedUrl.startsWith('http') ? sanitizedUrl : `http://${sanitizedUrl}`);

      // Construct headers
      const headers: Record<string, string> = {};
      request.headers.filter(h => h.enabled && h.key).forEach(h => {
        if (h.value === '<calculated when request is sent>') {
          return; // Skip auto-calculated headers
        }
        headers[h.key] = h.value;
      });

      // Inherit cookies
      if (request.inheritCookieFrom) {
        const inheritedTab = allTabs.find(t => t.id === request.inheritCookieFrom);
        if (inheritedTab && inheritedTab.response && inheritedTab.response.cookies) {
          const cookieParts = inheritedTab.response.cookies.map(c => c.split(';')[0]);
          if (cookieParts.length > 0) {
            const existingCookieKey = Object.keys(headers).find(k => k.toLowerCase() === 'cookie');
            if (existingCookieKey) {
              headers[existingCookieKey] = `${headers[existingCookieKey]}; ${cookieParts.join('; ')}`;
            } else {
              headers['Cookie'] = cookieParts.join('; ');
            }
          }
        }
      }

      let bodyPayload: any = undefined;
      if (request.bodyType !== 'none') {
        if (request.bodyType === 'json' || request.bodyType === 'text') {
          bodyPayload = request.body;
        } else if (request.bodyType === 'form-data') {
          bodyPayload = {};
          request.formData.filter(f => f.enabled && f.key).forEach(f => {
            if (f.type === 'file' && f.file) {
              bodyPayload[f.key] = {
                type: 'file',
                file: f.file
              };
            } else {
              bodyPayload[f.key] = f.value;
            }
          });
        } else if (request.bodyType === 'x-www-form-urlencoded') {
          bodyPayload = {};
          request.urlencoded.filter(u => u.enabled && u.key).forEach(u => {
            bodyPayload[u.key] = u.value;
          });
        }
      }

      if (request.bodyType === 'json') {
        headers['Content-Type'] = 'application/json';
      } else if (request.bodyType === 'text') {
        headers['Content-Type'] = 'text/plain';
      } else if (request.bodyType === 'x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (request.bodyType === 'form-data') {
        // We set it to multipart/form-data here, but the server will strip it
        // so that fetch can auto-generate the boundary
        headers['Content-Type'] = 'multipart/form-data';
      }

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          method: request.method,
          url: urlObj.toString(),
          headers,
          bodyType: request.bodyType,
          body: bodyPayload
        })
      });

      const data = await res.json();
      activeRequests.delete(request.id);
      updateRequest(r => ({ ...r, isLoading: false, response: data }));

    } catch (error: any) {
      activeRequests.delete(request.id);
      if (error.name === 'AbortError') {
        // Cancelled by handleStop
        return;
      }
      updateRequest(r => ({ 
        ...r, 
        isLoading: false, 
        response: {
          status: 0,
          statusText: 'Error',
          time: 0,
          size: 0,
          headers: {},
          data: error.message,
          isJson: false,
          error: error.message
        }
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="flex items-center p-3 space-x-2 border-b border-border-primary">
        <select
          value={request.connectionType ?? 'http'}
          onChange={(e) => updateRequest(r => ({ ...r, connectionType: e.target.value as any }))}
          className="bg-bg-tertiary border border-border-primary text-text-accent text-xs rounded px-2 py-2 outline-none focus:border-accent-hover font-bold shrink-0"
          title="Connection type"
        >
          <option value="http">HTTP</option>
          <option value="websocket">WS</option>
        </select>
        <select 
          value={request.method}
          onChange={(e) => updateRequest(r => ({ ...r, method: e.target.value as any }))}
          className="bg-bg-tertiary border border-border-primary text-text-primary text-sm rounded px-3 py-2 outline-none focus:border-accent-hover font-bold w-24"
        >
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <textarea 
          value={request.url}
          onChange={(e) => {
            handleUrlChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
          }}
          placeholder="Enter request URL"
          className="flex-1 bg-bg-tertiary border border-border-primary text-text-primary text-sm rounded px-3 py-2 outline-none focus:border-accent-hover font-mono resize-y min-h-[38px] leading-tight no-scrollbar"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{ fontSize: 'var(--editor-font-size)' }}
          rows={1}
        />
        {request.isLoading ? (
          <button 
            onClick={handleStop}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded text-sm font-medium transition-colors shadow-sm"
            title="Stop waiting and cancel request"
          >
            <Square size={13} className="fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button 
            onClick={handleSend}
            disabled={!request.url}
            className="flex items-center space-x-2 bg-accent-primary hover:bg-accent-hover disabled:bg-bg-tertiary disabled:text-text-secondary text-white px-6 py-2 rounded text-sm font-medium transition-colors"
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        )}

        {/* Layout_Toggle: icon reflects the action it will perform (R3.1, R3.9) */}
        <button
          onClick={toggleOrientation}
          title={isSideBySide ? 'Switch to stacked layout' : 'Switch to side-by-side layout'}
          aria-label={isSideBySide ? 'Switch to stacked layout' : 'Switch to side-by-side layout'}
          className="flex items-center justify-center bg-bg-tertiary border border-border-primary text-text-primary hover:border-accent-hover rounded px-3 py-2 transition-colors"
        >
          {isSideBySide ? <Rows2 size={16} /> : <Columns2 size={16} />}
        </button>

        {/* settingsPersistError indicator: non-blocking save-failure notice (R4.5) */}
        {state.settingsPersistError && (
          <span
            role="alert"
            title="Layout preference could not be saved"
            className="flex items-center justify-center text-accent-primary"
          >
            <AlertTriangle size={16} />
          </span>
        )}
      </div>

      {/* Request Config & Response Split */}
      <div
        ref={containerRef}
        className={`flex-1 flex overflow-hidden ${isSideBySide ? 'flex-row' : 'flex-col'}`}
      >
        {/* Request Config (Request_Config_Region) */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ flexBasis: `${configShare * 100}%`, flexGrow: 0, flexShrink: 0, minWidth: 200, minHeight: 200 }}
        >
          <div className="flex items-center space-x-4 px-4 border-b border-border-primary">
            {['params', 'headers', 'body', 'settings'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab as any)}
                className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === tab ? 'border-accent-hover text-text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'params' && request.params.filter(p => p.key).length > 0 && <span className="ml-1 text-xs text-text-secondary">({request.params.filter(p => p.key).length})</span>}
                {tab === 'headers' && request.headers.filter(h => h.key).length > 0 && <span className="ml-1 text-xs text-text-secondary">({request.headers.filter(h => h.key).length})</span>}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {activeSubTab === 'params' && (
              <KeyValueEditor 
                items={request.params} 
                onChange={handleParamsChange} 
                placeholderKey="Query Param"
              />
            )}
            {activeSubTab === 'headers' && (
              <KeyValueEditor 
                items={request.headers} 
                onChange={(headers) => updateRequest(r => ({ ...r, headers }))} 
                placeholderKey="Header"
              />
            )}
            {activeSubTab === 'body' && (
              <div className="flex flex-col h-full space-y-2">
                <div className="flex items-center space-x-4">
                  {['none', 'form-data', 'x-www-form-urlencoded', 'json', 'text'].map(type => (
                    <label key={type} className="flex items-center space-x-2 text-sm text-text-primary cursor-pointer">
                      <input 
                        type="radio" 
                        name={`bodyType-${request.id}`} 
                        value={type} 
                        checked={request.bodyType === type}
                        onChange={(e) => updateRequest(r => ({ ...r, bodyType: e.target.value as any }))}
                        className="text-accent-primary focus:ring-accent-primary bg-bg-tertiary border-border-primary"
                      />
                      <span>{type === 'x-www-form-urlencoded' ? 'x-www-form-urlencoded' : type === 'form-data' ? 'form-data' : type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </label>
                  ))}
                </div>
                {(request.bodyType === 'json' || request.bodyType === 'text') && (
                  <textarea
                    value={request.body}
                    onChange={(e) => updateRequest(r => ({ ...r, body: e.target.value }))}
                    className="flex-1 bg-bg-tertiary border border-border-primary rounded p-3 font-mono text-text-primary outline-none focus:border-accent-hover resize-none"
                    placeholder={request.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Enter text body...'}
                    style={{ fontSize: 'var(--editor-font-size)' }}
                  />
                )}
                {request.bodyType === 'form-data' && (
                  <KeyValueEditor 
                    items={request.formData} 
                    onChange={(formData) => updateRequest(r => ({ ...r, formData }))} 
                    placeholderKey="Key"
                    isFormData={true}
                  />
                )}
                {request.bodyType === 'x-www-form-urlencoded' && (
                  <KeyValueEditor 
                    items={request.urlencoded} 
                    onChange={(urlencoded) => updateRequest(r => ({ ...r, urlencoded }))} 
                    placeholderKey="Key"
                  />
                )}
                {request.bodyType === 'none' && (
                  <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                    This request does not have a body
                  </div>
                )}
              </div>
            )}
            {activeSubTab === 'settings' && (
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-text-primary">Inherit Cookies From</label>
                  <select
                    value={request.inheritCookieFrom || ''}
                    onChange={(e) => updateRequest(r => ({ ...r, inheritCookieFrom: e.target.value }))}
                    className="bg-bg-tertiary border border-border-primary text-text-primary text-sm rounded px-3 py-2 outline-none focus:border-accent-hover w-full max-w-md"
                  >
                    <option value="">None</option>
                    {otherTabs.map(t => (
                      <option key={t.id} value={t.id}>{t.customName || t.name || 'Untitled Request'}</option>
                    ))}
                  </select>
                  <p className="text-xs text-text-secondary">
                    Select a previous request to automatically include its received cookies in this request.
                  </p>
                </div>
                <div className="flex flex-col space-y-2 mt-4 border-t border-border-primary pt-4 max-w-md">
                  <label className="flex items-center space-x-2 text-sm text-text-primary cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={request.isCookieParent || false}
                      onChange={(e) => {
                        dispatch({ type: 'SET_COOKIE_PARENT', workspaceId, tabId: e.target.checked ? request.id : null });
                      }}
                      className="text-accent-primary focus:ring-accent-primary bg-bg-tertiary border-border-primary rounded"
                    />
                    <span>Set as Cookie Parent</span>
                  </label>
                  <p className="text-xs text-text-secondary">
                    When checked, any new tabs created will automatically inherit cookies from this tab. Only one tab per workspace can be the parent.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel_Divider between regions */}
        <div
          role="separator"
          aria-orientation={isSideBySide ? 'vertical' : 'horizontal'}
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
          className={`flex-shrink-0 bg-border-primary hover:bg-accent-hover transition-colors ${
            isSideBySide ? 'cursor-col-resize' : 'cursor-row-resize'
          }`}
          style={
            isSideBySide
              ? { width: DIVIDER_THICKNESS, height: '100%' }
              : { height: DIVIDER_THICKNESS, width: '100%' }
          }
        />

        {/* Response Panel (Response_Region) */}
        <div
          className="flex flex-col overflow-hidden bg-bg-secondary"
          style={{ flexBasis: `${responseShare * 100}%`, flexGrow: 0, flexShrink: 0, minWidth: 200, minHeight: 200 }}
        >
          <ResponsePanel 
            response={request.response} 
            isLoading={request.isLoading} 
            onCancel={handleStop}
            filterPath={request.responseFilter || ''}
            onFilterChange={(f) => updateRequest(r => ({ ...r, responseFilter: f }))}
          />
        </div>
      </div>
    </div>
  );
}
