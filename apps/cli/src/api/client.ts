// API response types (matching server endpoints)

export interface Connection {
  id: string;
  type: string;
  name?: string;
  description?: string;
  enabled: boolean;
}

export interface ConnectionDetails extends Connection {
  credentials: Record<string, unknown>;
}

export interface HealthResult {
  healthy: boolean;
  note?: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
}

export interface SchemaDefinition {
  tables: SchemaTable[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiClient {
  constructor(public baseUrl: string) {}

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new NetworkError(
        `Cannot connect to server at ${this.baseUrl}`
      );
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!json.success || !json.data) {
      throw new ApiError(
        json.error?.code ?? 'UNKNOWN_ERROR',
        json.error?.message ?? 'An unknown error occurred'
      );
    }

    return json.data;
  }

  async listConnections(): Promise<Connection[]> {
    return this.request<Connection[]>('/api/v1/connections');
  }

  async getConnection(id: string): Promise<ConnectionDetails> {
    return this.request<ConnectionDetails>(`/api/v1/connections/${encodeURIComponent(id)}`);
  }

  async checkHealth(id: string): Promise<HealthResult> {
    return this.request<HealthResult>(`/api/v1/connections/${encodeURIComponent(id)}/health`);
  }

  async getSchema(id: string): Promise<SchemaDefinition> {
    return this.request<SchemaDefinition>(`/api/v1/connections/${encodeURIComponent(id)}/schema`);
  }

  async ping(): Promise<boolean> {
    try {
      await this.listConnections();
      return true;
    } catch {
      return false;
    }
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
