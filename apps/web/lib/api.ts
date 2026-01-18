// Use relative URL by default (works with Next.js rewrites proxy)
// Set NEXT_PUBLIC_API_URL only if you need to bypass the proxy
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Types
export interface Connection {
  id: string;
  type: string;
  name?: string;
  description?: string;
  enabled: boolean;
}

export interface ConnectionDetails extends Connection {
  credentials?: Record<string, unknown>;
}

export interface CreateConnectionInput {
  id: string;
  type: string;
  credentials: Record<string, unknown>;
  name?: string;
  description?: string;
}

export interface UpdateConnectionInput {
  credentials?: Record<string, unknown>;
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
export interface DataSourceType {
  type: string;
  name: string;
  description?: string;
  image?: string;  // Base64 data URI
}

export async function listDataSourceTypes(): Promise<DataSourceType[]> {
  return fetchApi<DataSourceType[]>("/api/v1/datasources/types");
}
