export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface KV {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  time: number;
  size: number;
  headers: Record<string, string>;
  data: any;
  isJson: boolean;
  error?: string;
}

export interface RequestModel {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KV[];
  params: KV[];
  bodyType: 'none' | 'json' | 'text';
  body: string;
  response?: HttpResponse;
  isLoading: boolean;
}

export interface TabGroupModel {
  id: string;
  tabs: RequestModel[];
  activeTabId: string | null;
}

export interface WorkspaceModel {
  id: string;
  name: string;
  tabGroups: TabGroupModel[];
  splitDirection: 'row' | 'col';
}
