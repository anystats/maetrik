// Use relative URL by default (works with Next.js rewrites proxy)
// Set NEXT_PUBLIC_API_URL only if you need to bypass the proxy
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Types
export interface HealthBucket {
  bucket_start: string;
  health_status: 'green' | 'yellow' | 'red';
  degradation_message?: string;
}

export interface Connection {
  id: string;
  type: string;
  name?: string;
  description?: string;
  enabled: boolean;
  health_status?: 'green' | 'yellow' | 'red';
  health_log?: HealthBucket[];
}

export interface ConnectionOptions {
  timeoutMs?: number;
  idleTimeoutMs?: number;
  maxConnections?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ConnectionDetailsOptions {
  credentials: Record<string, unknown>;
  connection?: ConnectionOptions;
}

export interface ConnectionDetails extends Connection {
  options?: ConnectionDetailsOptions;
}

export interface CreateConnectionInput {
  id: string;
  type: string;
  options: ConnectionDetailsOptions;
  name?: string;
  description?: string;
}

export interface UpdateConnectionInput {
  options?: Partial<ConnectionDetailsOptions>;
  name?: string;
  description?: string;
  enabled?: boolean;
}

export interface HealthCheckResult {
  healthy: boolean;
  note?: string;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!data.success) {
    throw new ApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "An unknown error occurred",
      res.status
    );
  }

  return data.data;
}

// Connection API calls

export async function listConnections(): Promise<Connection[]> {
  // TODO: Add pagination support when API supports it
  return fetchApi<Connection[]>("/api/v1/connections");
}

export async function getConnection(id: string): Promise<ConnectionDetails> {
  return fetchApi<ConnectionDetails>(`/api/v1/connections/${encodeURIComponent(id)}`);
}

export async function createConnection(
  input: CreateConnectionInput
): Promise<Connection> {
  return fetchApi<Connection>("/api/v1/connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateConnection(
  id: string,
  input: UpdateConnectionInput
): Promise<Connection> {
  return fetchApi<Connection>(`/api/v1/connections/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteConnection(id: string): Promise<void> {
  await fetchApi<{ deleted: string }>(`/api/v1/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function testConnection(id: string): Promise<HealthCheckResult> {
  return fetchApi<HealthCheckResult>(`/api/v1/connections/${encodeURIComponent(id)}/health`);
}

// Data source types
export interface OptionsFieldDefinition {
  label?: string;
  type?: 'text' | 'password' | 'number' | 'boolean';
  placeholder?: string;
  helpText?: string;
  sensitive?: boolean;
  required?: boolean;
  default?: unknown;
  visibleWhen?: string[];
}

export interface DataSourceType {
  type: string;
  name: string;
  description?: string;
  image?: string;  // Base64 data URI
  optionsFields?: Record<string, OptionsFieldDefinition>;
}

export async function listDataSourceTypes(): Promise<DataSourceType[]> {
  return fetchApi<DataSourceType[]>("/api/v1/datasources/types");
}
