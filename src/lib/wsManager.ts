// Runtime-only WebSocket connection manager.
//
// Live sockets, connection state, and message logs are intentionally kept OUT
// of the persisted reducer state (R5.2). They live here in module scope, keyed
// by tab id, and components subscribe to per-tab runtime state. This means a
// connection survives tab switches and is never written to localStorage.

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closing';

export type MessageDirection = 'outgoing' | 'incoming' | 'system';

export interface WsMessage {
  id: string;
  direction: MessageDirection;
  text: string;
  timestamp: number; // epoch ms
}

export interface TabWsState {
  state: ConnectionState;
  messages: WsMessage[];
}

interface Entry {
  socket: WebSocket | null;
  state: ConnectionState;
  messages: WsMessage[];
  connectTimeout: ReturnType<typeof setTimeout> | null;
  closeTimeout: ReturnType<typeof setTimeout> | null;
  listeners: Set<() => void>;
  // Cached immutable snapshot for useSyncExternalStore. Recreated only when
  // state or messages change, so getSnapshot returns a stable reference and
  // React does not loop.
  snapshot: TabWsState;
}

const CONNECT_TIMEOUT_MS = 10_000; // R2.6
const CLOSE_TIMEOUT_MS = 5_000; // R4.6
const MAX_MESSAGE_LENGTH = 100_000; // R3.1

const DEFAULT_STATE: TabWsState = { state: 'disconnected', messages: [] };

const entries = new Map<string, Entry>();

const newId = () => Math.random().toString(36).substring(2, 10);

function getOrCreate(tabId: string): Entry {
  let entry = entries.get(tabId);
  if (!entry) {
    entry = {
      socket: null,
      state: 'disconnected',
      messages: [],
      connectTimeout: null,
      closeTimeout: null,
      listeners: new Set(),
      snapshot: DEFAULT_STATE,
    };
    entries.set(tabId, entry);
  }
  return entry;
}

/** Rebuild the cached snapshot and notify subscribers. */
function commit(entry: Entry) {
  entry.snapshot = { state: entry.state, messages: entry.messages };
  entry.listeners.forEach(l => l());
}

function setState(entry: Entry, state: ConnectionState) {
  entry.state = state;
  commit(entry);
}

function appendMessage(entry: Entry, direction: MessageDirection, text: string) {
  entry.messages = [
    ...entry.messages,
    { id: newId(), direction, text, timestamp: Date.now() },
  ];
  commit(entry);
}

function clearTimers(entry: Entry) {
  if (entry.connectTimeout) {
    clearTimeout(entry.connectTimeout);
    entry.connectTimeout = null;
  }
  if (entry.closeTimeout) {
    clearTimeout(entry.closeTimeout);
    entry.closeTimeout = null;
  }
}

/** Tear down the socket and release resources without emitting a state change. */
function teardownSocket(entry: Entry) {
  clearTimers(entry);
  if (entry.socket) {
    // Detach handlers so no further messages are processed for this socket.
    entry.socket.onopen = null;
    entry.socket.onmessage = null;
    entry.socket.onerror = null;
    entry.socket.onclose = null;
    entry.socket = null;
  }
}

/** Validate a WebSocket endpoint URL (ws:// or wss:// only). */
export function isValidWsUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

export function getTabState(tabId: string): TabWsState {
  const entry = entries.get(tabId);
  if (!entry) return DEFAULT_STATE;
  return entry.snapshot;
}

export function subscribe(tabId: string, listener: () => void): () => void {
  const entry = getOrCreate(tabId);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

/** Open a connection for a tab. Records validation/connect failures in the log. */
export function connect(tabId: string, url: string) {
  const entry = getOrCreate(tabId);

  if (entry.state === 'connecting' || entry.state === 'connected') {
    return; // already active
  }

  if (!isValidWsUrl(url)) {
    appendMessage(entry, 'system', `Invalid WebSocket URL: "${url}". Use ws:// or wss://.`);
    setState(entry, 'disconnected');
    return;
  }

  setState(entry, 'connecting');

  let socket: WebSocket;
  try {
    socket = new WebSocket(url.trim());
  } catch (err: any) {
    appendMessage(entry, 'system', `Failed to open connection: ${err?.message ?? String(err)}`);
    setState(entry, 'disconnected');
    return;
  }

  entry.socket = socket;

  // R2.6: bound the connecting state with a 10s timeout.
  entry.connectTimeout = setTimeout(() => {
    if (entry.state === 'connecting') {
      appendMessage(entry, 'system', 'Connection attempt timed out after 10s.');
      teardownSocket(entry);
      setState(entry, 'disconnected');
    }
  }, CONNECT_TIMEOUT_MS);

  socket.onopen = () => {
    if (entry.connectTimeout) {
      clearTimeout(entry.connectTimeout);
      entry.connectTimeout = null;
    }
    appendMessage(entry, 'system', `Connected to ${url.trim()}`);
    setState(entry, 'connected');
  };

  socket.onmessage = (event: MessageEvent) => {
    const data = event.data;
    if (typeof data === 'string') {
      appendMessage(entry, 'incoming', data);
    } else if (data instanceof Blob) {
      data.text().then(text => appendMessage(entry, 'incoming', text)).catch(() => {
        appendMessage(entry, 'incoming', '[binary blob]');
      });
    } else {
      appendMessage(entry, 'incoming', '[binary data]');
    }
  };

  socket.onerror = () => {
    if (entry.state === 'connecting') {
      appendMessage(entry, 'system', 'Connection failed.');
    } else {
      appendMessage(entry, 'system', 'Connection error.');
    }
  };

  socket.onclose = (event: CloseEvent) => {
    // R4.7: record closure with the reason reported by the endpoint.
    const reason = event.reason ? ` (${event.reason})` : '';
    appendMessage(entry, 'system', `Connection closed [code ${event.code}]${reason}`);
    teardownSocket(entry);
    setState(entry, 'disconnected');
  };
}

/** Send a message over the tab's connection. Returns true if transmitted. */
export function send(tabId: string, text: string): boolean {
  const entry = entries.get(tabId);
  if (!entry || entry.state !== 'connected' || !entry.socket) {
    return false;
  }
  if (!text || !text.trim()) {
    return false; // R3.4: ignore empty/whitespace-only sends
  }
  const payload = text.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) : text;
  try {
    entry.socket.send(payload);
    appendMessage(entry, 'outgoing', payload);
    return true;
  } catch (err: any) {
    // R3.9: record send failure; caller retains composer text.
    appendMessage(entry, 'system', `Send failed: ${err?.message ?? String(err)}`);
    return false;
  }
}

/** Begin closing (or abort a pending connect) for a tab. */
export function disconnect(tabId: string) {
  const entry = entries.get(tabId);
  if (!entry) return;

  // R4.5: aborting while still connecting.
  if (entry.state === 'connecting') {
    appendMessage(entry, 'system', 'Connection attempt aborted.');
    try {
      entry.socket?.close();
    } catch {
      /* ignore */
    }
    teardownSocket(entry);
    setState(entry, 'disconnected');
    return;
  }

  if (entry.state !== 'connected' || !entry.socket) return;

  setState(entry, 'closing');
  try {
    entry.socket.close();
  } catch {
    /* ignore */
  }

  // R4.6: force-terminate if not closed within 5s.
  entry.closeTimeout = setTimeout(() => {
    if (entry.state === 'closing') {
      appendMessage(entry, 'system', 'Close timed out; connection force-terminated.');
      teardownSocket(entry);
      setState(entry, 'disconnected');
    }
  }, CLOSE_TIMEOUT_MS);
}

/** Clear the message log for a tab (does not affect the connection). */
export function clearMessages(tabId: string) {
  const entry = entries.get(tabId);
  if (!entry) return;
  entry.messages = [];
  commit(entry);
}

/**
 * Dispose a tab's connection and runtime state entirely (R4.4). Called when a
 * tab is permanently removed so no socket leaks.
 */
export function dispose(tabId: string) {
  const entry = entries.get(tabId);
  if (!entry) return;
  try {
    entry.socket?.close();
  } catch {
    /* ignore */
  }
  teardownSocket(entry);
  entries.delete(tabId);
}
