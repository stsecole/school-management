// ===== أنواع المساعد الذكي =====

export type ProviderId =
  | 'zai'
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'local';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  role: 'assistant';
  model?: string;
  tokensUsed?: number;
  finishReason?: string;
}

export interface ChatChunk {
  delta: string;
  done?: boolean;
  finishReason?: string;
}

export interface AISettings {
  enabled: boolean;
  activeProvider: ProviderId;
  providers: Record<
    ProviderId,
    {
      apiKey: string;
      model: string;
      baseUrl?: string;
    }
  >;
  maxTokens: number;
  temperature: number;
}

export interface AIProvider {
  id: ProviderId;
  name: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<ChatChunk>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

export const PROVIDER_DEFAULTS: Record<
  ProviderId,
  { name: string; defaultModel: string; baseUrl?: string; needsApiKey: boolean }
> = {
  zai: {
    name: 'Z.AI',
    defaultModel: 'glm-4.6',
    needsApiKey: false,
  },
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    needsApiKey: true,
  },
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsApiKey: true,
  },
  claude: {
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    needsApiKey: true,
  },
  deepseek: {
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    needsApiKey: true,
  },
  local: {
    name: 'محلي (دون اتصال)',
    defaultModel: 'local-fallback',
    needsApiKey: false,
  },
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: true,
  activeProvider: 'zai',
  providers: {
    zai: { apiKey: '', model: PROVIDER_DEFAULTS.zai.defaultModel },
    openai: {
      apiKey: '',
      model: PROVIDER_DEFAULTS.openai.defaultModel,
      baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
    },
    gemini: {
      apiKey: '',
      model: PROVIDER_DEFAULTS.gemini.defaultModel,
      baseUrl: PROVIDER_DEFAULTS.gemini.baseUrl,
    },
    claude: {
      apiKey: '',
      model: PROVIDER_DEFAULTS.claude.defaultModel,
      baseUrl: PROVIDER_DEFAULTS.claude.baseUrl,
    },
    deepseek: {
      apiKey: '',
      model: PROVIDER_DEFAULTS.deepseek.defaultModel,
      baseUrl: PROVIDER_DEFAULTS.deepseek.baseUrl,
    },
    local: { apiKey: '', model: PROVIDER_DEFAULTS.local.defaultModel },
  },
  maxTokens: 2048,
  temperature: 0.7,
};

export interface ActionBlock {
  action: string;
  params: Record<string, any>;
  description?: string;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data?: any;
  message?: string;
  display?: {
    type: 'table' | 'chart' | 'text' | 'card';
    title?: string;
    columns?: string[];
    rows?: any[];
    chart?: {
      type: 'bar' | 'line' | 'pie' | 'area';
      data: any[];
      xKey?: string;
      yKeys?: string[];
    };
    cards?: { label: string; value: string | number; icon?: string }[];
  };
  action?: ActionBlock;
}
