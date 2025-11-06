/**
 * Custom API hooks for PayWall402
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosError, CancelTokenSource } from 'axios';
import {
  // Content, // Not used
  ContentInfoResponse,
  UploadResponse,
  PaymentVerificationResponse,
  SearchFilters,
  SearchResults,
  CreatorStats,
  ApiError,
  AsyncState,
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Create axios instance with default config
 */
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor for adding auth tokens
 */
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token if available
    const csrfToken = localStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.data) {
      // Return the API error
      return Promise.reject(error.response.data);
    }

    // Network or other error
    const apiError: ApiError = {
      success: false,
      error: {
        message: error.message || 'An error occurred',
        statusCode: error.response?.status || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return Promise.reject(apiError);
  }
);

/**
 * Generic data fetching hook
 */
export function useApiRequest<T>(
  url: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    params?: any;
    dependencies?: any[];
    enabled?: boolean;
  }
): AsyncState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const cancelTokenRef = useRef<CancelTokenSource | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel previous request
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('Request cancelled');
    }

    // Create new cancel token
    cancelTokenRef.current = axios.CancelToken.source();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiClient.request<T>({
        url,
        method: options?.method || 'GET',
        data: options?.data,
        params: options?.params,
        cancelToken: cancelTokenRef.current.token,
      });

      setState({
        data: response.data,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (!axios.isCancel(error)) {
        setState({
          data: null,
          loading: false,
          error: error as Error,
        });
      }
    }
  }, [url, options?.method, options?.data, options?.params]);

  useEffect(() => {
    if (options?.enabled !== false) {
      fetchData();
    }

    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('Component unmounted');
      }
    };
  }, options?.dependencies || []);

  return {
    ...state,
    refetch: fetchData,
  };
}

/**
 * Hook for fetching content information
 */
export function useContent(contentId: string) {
  return useApiRequest<ContentInfoResponse>(
    `/api/content/${contentId}/info`,
    {
      dependencies: [contentId],
      enabled: !!contentId,
    }
  );
}

/**
 * Hook for uploading content
 */
export function useUpload() {
  const [state, setState] = useState({
    uploading: false,
    progress: 0,
    error: null as Error | null,
  });

  const upload = useCallback(async (formData: FormData): Promise<UploadResponse> => {
    setState({ uploading: true, progress: 0, error: null });

    try {
      const response = await apiClient.post<UploadResponse>(
        '/api/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setState((prev) => ({ ...prev, progress }));
          },
        }
      );

      setState({ uploading: false, progress: 100, error: null });
      return response.data;
    } catch (error) {
      setState({
        uploading: false,
        progress: 0,
        error: error as Error,
      });
      throw error;
    }
  }, []);

  return {
    upload,
    ...state,
  };
}

/**
 * Hook for payment verification
 */
export function usePayment() {
  const [state, setState] = useState({
    loading: false,
    error: null as Error | null,
  });

  const verifyPayment = useCallback(
    async (
      contentId: string,
      transactionSignature: string
    ): Promise<PaymentVerificationResponse> => {
      setState({ loading: true, error: null });

      try {
        const response = await apiClient.post<PaymentVerificationResponse>(
          '/api/payment/verify',
          {
            contentId,
            transactionSignature,
          }
        );

        setState({ loading: false, error: null });
        return response.data;
      } catch (error) {
        setState({ loading: false, error: error as Error });
        throw error;
      }
    },
    []
  );

  return {
    verifyPayment,
    ...state,
  };
}

/**
 * Hook for searching content
 */
export function useSearch(filters: SearchFilters) {
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<SearchResults>('/api/search', {
        params: filters,
      });

      setResults(response.data);
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    search();
  }, [search]);

  return {
    results,
    loading,
    error,
    refetch: search,
  };
}

/**
 * Hook for creator statistics
 */
export function useCreatorStats(
  creatorWallet: string,
  dateRange?: { start: Date; end: Date }
) {
  return useApiRequest<CreatorStats>(
    `/api/stats/${creatorWallet}`,
    {
      params: dateRange
        ? {
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString(),
          }
        : undefined,
      dependencies: [creatorWallet, dateRange?.start, dateRange?.end],
      enabled: !!creatorWallet,
    }
  );
}

/**
 * Hook for downloading content
 */
export function useDownload() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const download = useCallback(
    async (contentId: string, accessToken: string) => {
      setDownloading(true);
      setError(null);

      try {
        const response = await apiClient.get(`/api/content/${contentId}/download`, {
          params: { payment: accessToken },
          responseType: 'blob',
        });

        // Create download link
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers['content-disposition'];
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `download-${contentId}`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setDownloading(false);
      } catch (error) {
        setError(error as Error);
        setDownloading(false);
        throw error;
      }
    },
    []
  );

  return {
    download,
    downloading,
    error,
  };
}

/**
 * Hook for batch operations
 */
export function useBatchUpload() {
  const [state, setState] = useState({
    uploading: false,
    progress: 0,
    completed: 0,
    total: 0,
    errors: [] as Error[],
  });

  const batchUpload = useCallback(async (items: any[]) => {
    setState({
      uploading: true,
      progress: 0,
      completed: 0,
      total: items.length,
      errors: [],
    });

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const response = await apiClient.post('/api/upload', items[i]);
        results.push(response.data);

        setState((prev) => ({
          ...prev,
          completed: i + 1,
          progress: ((i + 1) / items.length) * 100,
        }));
      } catch (error) {
        errors.push(error as Error);
      }
    }

    setState((prev) => ({
      ...prev,
      uploading: false,
      progress: 100,
      errors,
    }));

    return { results, errors };
  }, []);

  return {
    batchUpload,
    ...state,
  };
}

/**
 * Hook for WebSocket connection
 */
export function useWebSocket(
  url: string,
  options?: {
    onMessage?: (data: any) => void;
    onError?: (error: Error) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
  }
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      options?.onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options?.onMessage?.(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (_error) => {
      options?.onError?.(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      setConnected(false);
      options?.onDisconnect?.();
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [url]);

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    connected,
    send,
  };
}

/**
 * Hook for local storage with SSR support
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

export default {
  useApiRequest,
  useContent,
  useUpload,
  usePayment,
  useSearch,
  useCreatorStats,
  useDownload,
  useBatchUpload,
  useWebSocket,
  useLocalStorage,
};