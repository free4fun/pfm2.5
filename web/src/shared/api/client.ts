export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export async function apiFetch<T = any>(
  path: string,
  opts: { method?: HttpMethod; body?: any; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw text */ }
  if (!res.ok) {
    throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }
  return json ?? ({} as T);
}
