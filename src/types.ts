export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface KV {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  type?: 'text' | 'file';
  file?: {
    name: string;
    type: string;
    base64: string;
  };
}

export interface HttpResponse {
  status: number;
  statusText: string;
  time: number;
  size: number;
  headers: Record<string, string>;
  cookies?: string[];
  data: any;
  isJson: boolean;
  error?: string;
}

export interface VisualTabGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
}

export interface RequestModel {
  id: string;
  name: string;
  customName?: string;
  method: HttpMethod;
  url: string;
  headers: KV[];
  params: KV[];
  bodyType: 'none' | 'form-data' | 'x-www-form-urlencoded' | 'json' | 'text';
  body: string;
  formData: KV[];
  urlencoded: KV[];
  inheritCookieFrom?: string;
  response?: HttpResponse;
  isLoading: boolean;
  visualGroupId?: string;
}

export interface TabGroupModel {
  id: string;
  tabs: RequestModel[];
  activeTabId: string | null;
  visualGroups: VisualTabGroup[];
  tabMode: 'horizontal' | 'vertical';
  isVerticalExpanded: boolean;
  isVerticalPinned: boolean;
  verticalWidth: number;
}

export interface SettingsModel {
  fontSize: number;
  theme: 'dark' | 'monako' | 'cyberpunk' | 'light';
}

export interface WorkspaceModel {
  id: string;
  name: string;
  tabGroups: TabGroupModel[];
  splitDirection: 'row' | 'col';
}
