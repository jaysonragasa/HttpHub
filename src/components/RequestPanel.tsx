import React, { useContext, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { AppContext } from '../store';
import { RequestModel } from '../types';
import KeyValueEditor from './KeyValueEditor';
import ResponsePanel from './ResponsePanel';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

export default function RequestPanel({ workspaceId, groupId, request }: { workspaceId: string, groupId: string, request: RequestModel }) {
  const { dispatch } = useContext(AppContext);
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'headers' | 'body'>('params');

  const updateRequest = (updater: (req: RequestModel) => RequestModel) => {
    dispatch({ type: 'UPDATE_REQUEST', workspaceId, groupId, tabId: request.id, updater });
  };

  const handleSend = async () => {
    if (!request.url) return;
    
    updateRequest(r => ({ ...r, isLoading: true, response: undefined }));

    try {
      // Construct URL with params
      const urlObj = new URL(request.url.startsWith('http') ? request.url : `http://${request.url}`);
      request.params.filter(p => p.enabled && p.key).forEach(p => {
        urlObj.searchParams.append(p.key, p.value);
      });

      // Construct headers
      const headers: Record<string, string> = {};
      request.headers.filter(h => h.enabled && h.key).forEach(h => {
        headers[h.key] = h.value;
      });

      if (request.bodyType === 'json') {
        headers['Content-Type'] = 'application/json';
      } else if (request.bodyType === 'text') {
        headers['Content-Type'] = 'text/plain';
      }

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: request.method,
          url: urlObj.toString(),
          headers,
          body: request.bodyType !== 'none' ? request.body : undefined
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
      <div className="flex items-center p-3 space-x-2 border-b border-gray-800">
        <select 
          value={request.method}
          onChange={(e) => updateRequest(r => ({ ...r, method: e.target.value as any }))}
          className="bg-[#1a1d27] border border-gray-700 text-gray-200 text-sm rounded px-3 py-2 outline-none focus:border-emerald-500 font-bold w-24"
        >
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input 
          type="text"
          value={request.url}
          onChange={(e) => updateRequest(r => ({ ...r, url: e.target.value, name: e.target.value || 'Untitled Request' }))}
          placeholder="Enter request URL"
          className="flex-1 bg-[#1a1d27] border border-gray-700 text-gray-200 text-sm rounded px-3 py-2 outline-none focus:border-emerald-500 font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button 
          onClick={handleSend}
          disabled={request.isLoading || !request.url}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded text-sm font-medium transition-colors"
        >
          {request.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          <span>Send</span>
        </button>
      </div>

      {/* Request Config & Response Split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Request Config (Top Half) */}
        <div className="flex-1 flex flex-col border-b border-gray-800 min-h-[200px]">
          <div className="flex items-center space-x-4 px-4 border-b border-gray-800">
            {['params', 'headers', 'body'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab as any)}
                className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'params' && request.params.filter(p => p.key).length > 0 && <span className="ml-1 text-xs text-gray-500">({request.params.filter(p => p.key).length})</span>}
                {tab === 'headers' && request.headers.filter(h => h.key).length > 0 && <span className="ml-1 text-xs text-gray-500">({request.headers.filter(h => h.key).length})</span>}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {activeSubTab === 'params' && (
              <KeyValueEditor 
                items={request.params} 
                onChange={(params) => updateRequest(r => ({ ...r, params }))} 
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
                  {['none', 'json', 'text'].map(type => (
                    <label key={type} className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name={`bodyType-${request.id}`} 
                        value={type} 
                        checked={request.bodyType === type}
                        onChange={(e) => updateRequest(r => ({ ...r, bodyType: e.target.value as any }))}
                        className="text-emerald-500 focus:ring-emerald-500 bg-gray-800 border-gray-700"
                      />
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </label>
                  ))}
                </div>
                {request.bodyType !== 'none' && (
                  <textarea
                    value={request.body}
                    onChange={(e) => updateRequest(r => ({ ...r, body: e.target.value }))}
                    className="flex-1 bg-[#1a1d27] border border-gray-700 rounded p-3 text-sm font-mono text-gray-300 outline-none focus:border-emerald-500 resize-none"
                    placeholder={request.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Enter text body...'}
                  />
                )}
                {request.bodyType === 'none' && (
                  <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                    This request does not have a body
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Response Panel (Bottom Half) */}
        <div className="flex-1 flex flex-col min-h-[200px] bg-[#0a0c10]">
          <ResponsePanel response={request.response} isLoading={request.isLoading} />
        </div>
      </div>
    </div>
  );
}
