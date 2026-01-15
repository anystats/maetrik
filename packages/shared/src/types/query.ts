export interface QueryRequest {
  question: string;
  connection: string;
  format?: ('data' | 'summary' | 'chart')[];
  options?: {
    limit?: number;
    timeout?: number;
  };
}

export interface QueryResponseData {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryResponseMeta {
  sql: string;
  duration: number;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

export interface QueryResponse {
  success: true;
  data: QueryResponseData;
  summary?: string;
  chart?: Record<string, unknown>;
  meta: QueryResponseMeta;
}

export interface QueryError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type QueryApiResult = QueryResponse | QueryError;

