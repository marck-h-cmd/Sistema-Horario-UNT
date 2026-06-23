import type { ApiResponse } from '@/lib/tipos';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function clearAuthAndRedirect() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/auth/login';
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/renovar-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json: ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }> =
      await res.json();

    if (!json.success || !json.data) return null;

    localStorage.setItem('accessToken', json.data.tokens.accessToken);
    localStorage.setItem('refreshToken', json.data.tokens.refreshToken);
    document.cookie = `auth_token=${json.data.tokens.accessToken}; path=/; max-age=86400; SameSite=Lax`;
    return json.data.tokens.accessToken;
  } catch {
    return null;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  skipAuth?: boolean;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const base = path.startsWith('http') ? path : path.startsWith('/') ? path : `/${path}`;
  if (!params) return base;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { params, body, skipAuth, headers: customHeaders, ...init } = options;
  const url = buildUrl(path, params);

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const requestBody =
    body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body);

  let response = await fetch(url, {
    ...init,
    headers,
    body: requestBody,
  });

  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, { ...init, headers, body: requestBody });
    } else {
      clearAuthAndRedirect();
    }
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/pdf') || contentType.includes('text/csv')) {
    if (!response.ok) {
      throw new ApiClientError('Error al descargar archivo', 'DOWNLOAD_ERROR', response.status);
    }
    return {
      success: true,
      data: (await response.blob()) as unknown as T,
    };
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    if (response.status === 404 && json.error?.code === 'USER_NOT_FOUND') {
      clearAuthAndRedirect();
    }
    throw new ApiClientError(
      json.error?.message || 'Error en la solicitud',
      json.error?.code || 'UNKNOWN_ERROR',
      response.status,
      json.error?.details
    );
  }

  return json;
}

export async function apiGet<T>(path: string, params?: RequestOptions['params']) {
  return apiRequest<T>(path, { method: 'GET', params });
}

export async function apiPost<T>(path: string, body?: unknown, params?: RequestOptions['params']) {
  return apiRequest<T>(path, { method: 'POST', body, params });
}

export async function apiPut<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, { method: 'PUT', body });
}

export async function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: 'DELETE' });
}

export async function downloadFile(
  path: string,
  params?: RequestOptions['params'],
  filename = 'reporte.pdf'
): Promise<void> {
  const token = getAccessToken();
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new ApiClientError(
      err?.error?.message || 'Error al descargar',
      err?.error?.code || 'DOWNLOAD_ERROR',
      response.status
    );
  }

  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
