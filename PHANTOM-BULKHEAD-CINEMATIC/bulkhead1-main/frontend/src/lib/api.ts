export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let csrf = '';
let csrfRequest: Promise<string> | null = null;

export async function csrfToken(): Promise<string> {
  if (!csrfRequest) csrfRequest = fetch('/api/v1/auth/csrf', { credentials: 'same-origin' })
    .then(async response => {
      if (!response.ok) throw new ApiError(response.status, 'Could not initialize a secure session');
      csrf = (await response.json()).csrf_token;
      return csrf;
    }).finally(() => { csrfRequest = null; });
  return csrfRequest;
}

export async function api<T = any>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const method = options.method || 'GET';
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (unsafe && !csrf) await csrfToken();
  const response = await fetch(`/api/v1${path}`, { ...options, credentials: 'same-origin',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(unsafe ? { 'X-CSRF-Token': csrf } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 403 && data.detail === 'CSRF validation failed' && retry) {
    await csrfToken();
    return api(path, options, false);
  }
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Please check the form values and try again';
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('bulkhead:unauthorized'));
    throw new ApiError(response.status, detail);
  }
  if (data.csrf_token) csrf = data.csrf_token;
  return data as T;
}

export function post<T = any>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
}
export function errorText(error: unknown) { return error instanceof Error ? error.message : 'Request failed'; }

export function savedInvite() {
  try { return sessionStorage.getItem('bulkhead.invite') || ''; } catch { return ''; }
}
export function forgetInvite() {
  try { sessionStorage.removeItem('bulkhead.invite'); } catch { /* Route-only invitation. */ }
}
