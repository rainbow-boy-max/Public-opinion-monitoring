import { ref } from 'vue';

export interface WebSearchLogStep {
  phase: 'validate' | 'http' | 'parse' | 'result' | 'done' | 'error';
  message: string;
  durationMs?: number;
  level?: 'info' | 'warn' | 'error';
  ts: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchTestHandle {
  abort: () => void;
  promise: Promise<{
    ok: boolean;
    items: WebSearchResult[];
    errorCode?: string;
    errorMessage?: string;
    totalDurationMs: number;
  }>;
}

export function useWebSearchTest() {
  const steps = ref<WebSearchLogStep[]>([]);
  const items = ref<WebSearchResult[]>([]);
  const running = ref(false);
  const done = ref(false);
  const errorMessage = ref<string | null>(null);
  const totalDurationMs = ref(0);

  let controller: AbortController | null = null;
  let startTime = 0;

  function reset(): void {
    steps.value = [];
    items.value = [];
    errorMessage.value = null;
    totalDurationMs.value = 0;
    done.value = false;
  }

  function pushStep(step: WebSearchLogStep): void {
    steps.value = [...steps.value, step];
  }

  async function readSse(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const { event, data } = parseSseFrame(raw);
        if (!event && !data) continue;
        if (event === 'step') {
          try {
            const step = JSON.parse(data) as WebSearchLogStep;
            pushStep(step);
          } catch {
            /* ignore */
          }
        } else if (event === 'result') {
          try {
            const r = JSON.parse(data) as { items: WebSearchResult[] };
            items.value = r.items || [];
          } catch {
            /* ignore */
          }
        } else if (event === 'done') {
          try {
            const r = JSON.parse(data) as { ok: boolean; count: number; totalDurationMs: number };
            totalDurationMs.value = r.totalDurationMs || Date.now() - startTime;
          } catch {
            totalDurationMs.value = Date.now() - startTime;
          }
        } else if (event === 'error') {
          try {
            const r = JSON.parse(data) as { message: string; errorCode: string };
            errorMessage.value = `[${r.errorCode}] ${r.message}`;
          } catch {
            errorMessage.value = (data || '').slice(0, 200);
          }
        }
      }
    }
  }

  function parseSseFrame(raw: string): { event: string; data: string } {
    let event = '';
    let data = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event += line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    return { event, data };
  }

  function runTest(query: string, opts?: { provider?: string }): WebSearchTestHandle {
    reset();
    running.value = true;
    startTime = Date.now();
    controller = new AbortController();
    const promise = (async () => {
      try {
        const token = localStorage.getItem('admin_token') || '';
        const resp = await fetch('/api/admin/web-search/test-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query, provider: opts?.provider }),
          signal: controller.signal,
        });
        if (resp.status === 401 || resp.status === 403) {
          throw new Error('WEB_SEARCH_AUTH_FAILED');
        }
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        await readSse(resp);
        running.value = false;
        done.value = true;
        return {
          ok: !errorMessage.value,
          items: items.value,
          errorCode: errorMessage.value ? extractCode(errorMessage.value) : undefined,
          errorMessage: errorMessage.value || undefined,
          totalDurationMs: totalDurationMs.value || Date.now() - startTime,
        };
      } catch (err: any) {
        running.value = false;
        done.value = true;
        errorMessage.value = err?.message || 'test failed';
        return {
          ok: false,
          items: items.value,
          errorCode: err?.message,
          errorMessage: err?.message,
          totalDurationMs: Date.now() - startTime,
        };
      }
    })();
    return {
      promise,
      abort: () => controller?.abort(),
    };
  }

  function extractCode(msg: string): string | undefined {
    const m = /\[([A-Z_]+)\]/.exec(msg);
    return m ? m[1] : undefined;
  }

  return { steps, items, running, done, errorMessage, totalDurationMs, runTest };
}
