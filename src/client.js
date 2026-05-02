import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

const API_BASE = process.env.REVENSI_API_BASE ?? 'https://api.revensi.com';
const USER_AGENT = `revensi-cli/${pkg.version} (node/${process.versions.node})`;
const DEFAULT_TIMEOUT_MS = 30_000;

export class RevensiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'RevensiError';
    this.status = status;
    this.code = code;
  }
}

export async function scan({ domain, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      body: JSON.stringify({ domain }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new RevensiError(`Request timed out after ${timeoutMs / 1000}s`, { code: 'TIMEOUT' });
    }
    throw new RevensiError(`Network error: ${err.message}`, { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (res.ok) return body;

  throw new RevensiError(mapErrorMessage(res, body), {
    status: res.status,
    code: body?.code,
  });
}

function mapErrorMessage(res, body) {
  const serverMsg = body?.error || body?.message;
  switch (res.status) {
    case 401:
      return 'Invalid API key. Set REVENSI_API_KEY or pass --api-key.';
    case 403:
      return serverMsg || 'Forbidden — your key lacks permission for this resource.';
    case 404:
      return serverMsg || 'Not found.';
    case 429: {
      const retry = res.headers.get('retry-after');
      return retry
        ? `Rate limited. Retry after ${retry}s.`
        : 'Rate limited. Slow down and try again.';
    }
    default:
      if (res.status >= 500) {
        return serverMsg
          ? `Revensi API error (${res.status}): ${serverMsg}`
          : `Revensi API error (${res.status}). Try again shortly.`;
      }
      return serverMsg || `Request failed (${res.status}).`;
  }
}
