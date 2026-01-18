import { useState, useEffect, useCallback, useContext } from 'react';
import { AppContext } from '../app.js';
import type { ApiClient } from '../api/client.js';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiResult<T> extends UseApiState<T> {
  refetch: () => void;
}

export function useApi<T>(
  fetcher: (client: ApiClient) => Promise<T>,
  deps: unknown[] = []
): UseApiResult<T> {
  const { apiClient } = useContext(AppContext);
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await fetcher(apiClient);
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setState({ data: null, loading: false, error: message });
    }
  }, [apiClient, ...deps]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    ...state,
    refetch: fetch,
  };
}

export function useConnections() {
  return useApi((client) => client.listConnections());
}

export function useConnection(id: string) {
  return useApi((client) => client.getConnection(id), [id]);
}

export function useHealth(id: string) {
  return useApi((client) => client.checkHealth(id), [id]);
}

export function useSchema(id: string) {
  return useApi((client) => client.getSchema(id), [id]);
}
