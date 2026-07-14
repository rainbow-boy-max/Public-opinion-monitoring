const ENDPOINT = '/api/admin/front-metrics';
const START_MARKS = new Map<string, number>();

interface MetricPayload {
  name: string;
  durationMs?: number;
  page?: string;
  extra?: Record<string, unknown>;
  ts: number;
}

let token: string | null = null;
export function setPerfToken(t: string | null): void {
  token = t;
}

function getToken(): string | null {
  if (token !== null) return token;
  try {
    return localStorage.getItem('admin_token');
  } catch {
    return null;
  }
}

function report(payload: MetricPayload): void {
  const t = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    /* fallback */
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body,
    keepalive: true,
  }).catch(() => {
    /* ignore */
  });
}

export function startMark(name: string): void {
  START_MARKS.set(name, performance.now());
}

export function endMark(name: string, extra?: Record<string, unknown>): void {
  const start = START_MARKS.get(name);
  if (start === undefined) return;
  START_MARKS.delete(name);
  const durationMs = performance.now() - start;
  report({
    name,
    durationMs: Math.round(durationMs * 100) / 100,
    page: typeof location !== 'undefined' ? location.pathname : undefined,
    extra,
    ts: Date.now(),
  });
}

export function reportMetric(name: string, durationMs: number, extra?: Record<string, unknown>): void {
  report({
    name,
    durationMs: Math.round(durationMs * 100) / 100,
    page: typeof location !== 'undefined' ? location.pathname : undefined,
    extra,
    ts: Date.now(),
  });
}

export function reportError(name: string, message: string): void {
  report({
    name,
    page: typeof location !== 'undefined' ? location.pathname : undefined,
    extra: { level: 'error', message },
    ts: Date.now(),
  });
}

let paintObserved = false;
export function observePaint(): void {
  if (paintObserved || typeof PerformanceObserver === 'undefined') return;
  paintObserved = true;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          reportMetric('fcp', entry.startTime);
        } else if (entry.name === 'largest-contentful-paint') {
          reportMetric('lcp', entry.startTime);
        }
      }
    });
    obs.observe({ type: 'paint', buffered: true });
  } catch {
    /* ignore */
  }
}
