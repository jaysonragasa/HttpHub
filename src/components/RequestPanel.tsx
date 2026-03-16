import React, { useContext, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { AppContext } from '../store';
import { RequestModel, KV } from '../types';
import KeyValueEditor from './KeyValueEditor';
import ResponsePanel from './ResponsePanel';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

export default function RequestPanel({ workspaceId, groupId, request }: { workspaceId: string, groupId: string, request: RequestModel }) {
  const { state, dispatch } = useContext(AppContext);
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'headers' | 'body' | 'settings'>('params');

  const workspace = state.workspaces.find(w => w.id === workspaceId);
  const allTabs = workspace ? workspace.tabGroups.flatMap(g => g.tabs) : [];
  const otherTabs = allTabs.filter(t => t.id !== request.id);

  const updateRequest = (updater: (req: RequestModel) => RequestModel) => {
    dispatch({ type: 'UPDATE_REQUEST', workspaceId, groupId, tabId: request.id, updater });
  };

  const handleUrlChange = (newUrl: string) => {
    let updatedParams = [...request.params];
    
    const queryStart = newUrl.indexOf('?');
    if (queryStart !== -1) {
      const queryString = newUrl.slice(queryStart + 1);
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

  const handleSend = async () => {
    if (!request.url) return;
    
    updateRequest(r => ({ ...r, isLoading: true, response: undefined }));

    try {
      // Construct URL (params are already synced to request.url)
      const urlObj = new URL(request.url.startsWith('http') ? request.url : `http://${request.url}`);

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
        body: JSON.stringify({
          method: request.method,
          url: urlObj.toString(),
          headers,
          bodyType: request.bodyType,
          body: bodyPayload
        })
      });

      const data = await res.json();
      updateRequest(r => ({ ...r, isLoading: false, response: data }));

    } catch (error: any) {
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
          value={request.method}
          onChange={(e) => updateRequest(r => ({ ...r, method: e.target.value as any }))}
          className="bg-bg-tertiary border border-border-primary text-text-primary text-sm rounded px-3 py-2 outline-none focus:border-accent-hover font-bold w-24"
        >
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input 
          type="text"
          value={request.url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Enter request URL"
          className="flex-1 bg-bg-tertiary border border-border-primary text-text-primary text-sm rounded px-3 py-2 outline-none focus:border-accent-hover font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          style={{ fontSize: 'var(--editor-font-size)' }}
        />
        <button 
          onClick={handleSend}
          disabled={request.isLoading || !request.url}
          className="flex items-center space-x-2 bg-accent-primary hover:bg-accent-hover disabled:bg-bg-tertiary disabled:text-text-secondary text-white px-6 py-2 rounded text-sm font-medium transition-colors"
        >
          {request.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          <span>Send</span>
        </button>
      </div>

      {/* Request Config & Response Split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Request Config (Top Half) */}
        <div className="flex-1 flex flex-col border-b border-border-primary min-h-[200px]">
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
                      <option key={t.id} value={t.id}>{t.name || 'Untitled Request'}</option>
                    ))}
                  </select>
                  <p className="text-xs text-text-secondary">
                    Select a previous request to automatically include its received cookies in this request.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Response Panel (Bottom Half) */}
        <div className="flex-1 flex flex-col min-h-[200px] bg-bg-secondary">
          <ResponsePanel response={request.response} isLoading={request.isLoading} />
        </div>
      </div>
    </div>
  );
}
