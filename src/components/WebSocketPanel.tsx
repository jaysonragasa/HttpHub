import React, { useContext, useSyncExternalStore, useEffect, useRef } from 'react';
import { Plug, PlugZap, Loader2, Send, Trash2, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { AppContext } from '../store';
import { RequestModel } from '../types';
import {
  subscribe,
  getTabState,
  connect,
  disconnect,
  send,
  clearMessages,
  isValidWsUrl,
  type ConnectionState,
  type MessageDirection,
} from '../lib/wsManager';

const stateLabel: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  closing: 'Closing…',
};

const stateColor: Record<ConnectionState, string> = {
  disconnected: 'text-text-secondary',
  connecting: 'text-yellow-500',
  connected: 'text-green-500',
  closing: 'text-yellow-500',
};

function directionMeta(direction: MessageDirection) {
  switch (direction) {
    case 'outgoing':
      return { icon: <ArrowUp size={12} />, color: 'text-blue-400', label: 'Sent' };
    case 'incoming':
      return { icon: <ArrowDown size={12} />, color: 'text-green-400', label: 'Received' };
    default:
      return { icon: <Info size={12} />, color: 'text-text-secondary', label: 'System' };
  }
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

export default function WebSocketPanel({ workspaceId, groupId, request }: { workspaceId: string, groupId: string, request: RequestModel }) {
  const { dispatch } = useContext(AppContext);
  const tabId = request.id;

  // Subscribe to the runtime-only manager for this tab.
  const tabState = useSyncExternalStore(
    cb => subscribe(tabId, cb),
    () => getTabState(tabId),
  );
  const { state, messages } = tabState;

  const wsUrl = request.wsUrl || '';
  const draft = request.wsDraft || '';
  const isConnected = state === 'connected';
  const isBusy = state === 'connecting' || state === 'closing';
  const urlValid = isValidWsUrl(wsUrl);

  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the log to the newest entry.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const updateRequest = (updater: (req: RequestModel) => RequestModel) => {
    dispatch({ type: 'UPDATE_REQUEST', workspaceId, groupId, tabId, updater });
  };

  const handleConnectToggle = () => {
    if (isConnected || isBusy) {
      disconnect(tabId);
    } else {
      connect(tabId, wsUrl);
    }
  };

  const handleSend = () => {
    const ok = send(tabId, draft);
    if (ok) {
      // R3.3: clear the composer after a successful send.
      updateRequest(r => ({ ...r, wsDraft: '' }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection Bar */}
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
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => updateRequest(r => ({ ...r, wsUrl: e.target.value, name: e.target.value || 'Untitled Request' }))}
          placeholder="ws://localhost:8080 or wss://example.com/socket"
          disabled={isConnected || isBusy}
          className="flex-1 bg-bg-tertiary border border-border-primary text-text-primary text-sm rounded px-3 py-2 outline-none focus:border-accent-hover font-mono disabled:opacity-60"
          onKeyDown={(e) => e.key === 'Enter' && !isConnected && !isBusy && urlValid && handleConnectToggle()}
          style={{ fontSize: 'var(--editor-font-size)' }}
        />
        <button
          onClick={handleConnectToggle}
          disabled={!isConnected && !isBusy && !urlValid}
          className={`flex items-center space-x-2 px-5 py-2 rounded text-sm font-medium transition-colors text-white ${
            isConnected || isBusy
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-accent-primary hover:bg-accent-hover disabled:bg-bg-tertiary disabled:text-text-secondary'
          }`}
          title={isConnected || isBusy ? 'Disconnect' : 'Connect'}
        >
          {state === 'connecting' || state === 'closing' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isConnected ? (
            <PlugZap size={16} />
          ) : (
            <Plug size={16} />
          )}
          <span>{isConnected || isBusy ? 'Disconnect' : 'Connect'}</span>
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-bg-secondary border-b border-border-primary text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-text-secondary">Status:</span>
          <span className={`font-bold ${stateColor[state]}`}>{stateLabel[state]}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-text-secondary">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
          <button
            onClick={() => clearMessages(tabId)}
            disabled={messages.length === 0}
            className="flex items-center space-x-1 text-text-secondary hover:text-text-primary disabled:opacity-40"
            title="Clear messages"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Message Log */}
      <div ref={logRef} className="flex-1 overflow-y-auto bg-bg-primary p-2 space-y-1 no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-secondary text-sm">
            No messages yet. Connect and send a message to begin.
          </div>
        ) : (
          messages.map(msg => {
            const meta = directionMeta(msg.direction);
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-2 px-2 py-1.5 rounded ${
                  msg.direction === 'system' ? 'bg-bg-secondary/50' : 'hover:bg-bg-secondary'
                }`}
              >
                <span className={`flex items-center shrink-0 mt-0.5 ${meta.color}`} title={meta.label}>
                  {meta.icon}
                </span>
                <span className="text-[10px] text-text-secondary font-mono shrink-0 mt-1 w-16">
                  {formatTime(msg.timestamp)}
                </span>
                <pre
                  className={`flex-1 whitespace-pre-wrap break-words font-mono ${
                    msg.direction === 'system' ? 'text-text-secondary italic' : 'text-text-primary'
                  }`}
                  style={{ fontSize: 'var(--editor-font-size)' }}
                >
                  {msg.text}
                </pre>
              </div>
            );
          })
        )}
      </div>

      {/* Message Composer */}
      <div className="flex items-end space-x-2 p-3 border-t border-border-primary bg-bg-secondary">
        <textarea
          value={draft}
          onChange={(e) => updateRequest(r => ({ ...r, wsDraft: e.target.value }))}
          placeholder={isConnected ? 'Type a message…  (Enter to send, Shift+Enter for newline)' : 'Connect to send messages'}
          disabled={!isConnected}
          rows={2}
          className="flex-1 bg-bg-tertiary border border-border-primary rounded p-2 font-mono text-text-primary outline-none focus:border-accent-hover resize-none disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (isConnected) handleSend();
            }
          }}
          style={{ fontSize: 'var(--editor-font-size)' }}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !draft.trim()}
          className="flex items-center space-x-2 bg-accent-primary hover:bg-accent-hover disabled:bg-bg-tertiary disabled:text-text-secondary text-white px-5 py-2 rounded text-sm font-medium transition-colors"
        >
          <Send size={16} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
