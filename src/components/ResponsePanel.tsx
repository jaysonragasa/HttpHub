import React, { useState } from 'react';
import { HttpResponse } from '../types';

export default function ResponsePanel({ response, isLoading }: { response?: HttpResponse, isLoading: boolean }) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies'>('body');

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Sending request...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Enter a URL and click Send to get a response
      </div>
    );
  }

  const statusColor = response.status >= 200 && response.status < 300 ? 'text-green-400' : 
                      response.status >= 400 ? 'text-red-400' : 'text-yellow-400';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatData = (data: any, isJson: boolean) => {
    if (isJson) {
      return JSON.stringify(data, null, 2);
    }
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Response Meta */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#141620] border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {['body', 'headers', 'cookies'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-1 text-sm font-medium transition-colors ${
                  activeTab === tab ? 'text-emerald-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'headers' && <span className="ml-1 text-xs text-gray-500">({Object.keys(response.headers).length})</span>}
                {tab === 'cookies' && response.cookies && <span className="ml-1 text-xs text-gray-500">({response.cookies.length})</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">Status:</span>
            <span className={`font-bold ${statusColor}`}>{response.status} {response.statusText}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">Time:</span>
            <span className="text-green-400">{response.time} ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">Size:</span>
            <span className="text-green-400">{formatSize(response.size)}</span>
          </div>
        </div>
      </div>

      {/* Response Content */}
      <div className="flex-1 overflow-auto p-4 no-scrollbar bg-[#0a0c10]">
        {activeTab === 'body' && (
          <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-words">
            {formatData(response.data, response.isJson)}
          </pre>
        )}
        {activeTab === 'headers' && (
          <div className="flex flex-col space-y-1">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex text-sm font-mono">
                <span className="text-emerald-400 w-1/3 break-words pr-4">{key}:</span>
                <span className="text-gray-300 w-2/3 break-words">{value}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'cookies' && (
          <div className="flex flex-col space-y-2">
            {response.cookies && response.cookies.length > 0 ? (
              response.cookies.map((cookie, i) => (
                <div key={i} className="text-sm font-mono text-gray-300 break-words border-b border-gray-800 pb-2 mb-2 last:border-0">
                  {cookie}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No cookies received in this response.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
