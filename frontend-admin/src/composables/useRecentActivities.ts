import { onMounted, onUnmounted, ref } from 'vue';
import http from '@/utils/http';

export interface ActivityItem {
  id: number;
  module: string;
  action: string;
  title: string;
  content?: string | null;
  type: 'primary' | 'success' | 'info' | 'warning' | 'danger';
  createdAt: string;
  actionTarget?: string | null;
}

const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 30000;

function getStoredToken(): string {
  try {
    return localStorage.getItem('admin_token') || '';
  } catch {
    return '';
  }
}

export function useRecentActivities(limit = 20) {
  const items = ref<ActivityItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const connected = ref(false);
  const unauthorized = ref(false);

  let es: EventSource | null = null;
  let reconnectTimer: number | undefined;
  let reconnectAttempts = 0;
  let manualClose = false;

  async function fetchInitial(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await http.get('/admin/dashboard/recent-activities', {
        params: { limit },
      });
      items.value = (res?.items || []).slice(0, limit);
    } catch (err: any) {
      error.value = err?.message || 'fetch recent activities failed';
    } finally {
      loading.value = false;
    }
  }

  function teardown(): void {
    if (es) {
      manualClose = true;
      try {
        es.close();
      } catch {
        /* ignore */
      }
      es = null;
    }
  }

  function connect(): void {
    if (es) return;
    if (unauthorized.value) return;
    const token = getStoredToken();
    const url =
      '/api/admin/dashboard/recent-activities/stream' +
      (token ? `?token=${encodeURIComponent(token)}` : '');
    try {
      const source = new EventSource(url, { withCredentials: true });
      source.addEventListener('open', () => {
        connected.value = true;
        reconnectAttempts = 0;
        error.value = null;
      });
      source.addEventListener('error', () => {
        connected.value = false;
        // EventSource 在浏览器关闭或鉴权失败时不会给出 httpStatus，区分方式：
        // - readyState === CLOSED 时一般服务端关闭（鉴权失败或正常 close）
        // - 否则是网络抖动，可重连
        const closed = source.readyState === EventSource.CLOSED;
        try {
          source.close();
        } catch {
          /* ignore */
        }
        if (manualClose) {
          manualClose = false;
          return;
        }
        es = null;
        if (closed) {
          // 鉴权失败 / 服务端主动断开：直接停止重连并标记错误。
          error.value = '实时连接已断开，可能未登录或登录已失效';
          unauthorized.value = true;
          return;
        }
        // 网络抖动：5s / 10s / 20s / 30s 退避
        const delay = Math.min(MAX_RECONNECT_DELAY, RECONNECT_DELAY * 2 ** reconnectAttempts);
        reconnectAttempts++;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, delay);
      });
      source.addEventListener('activity', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as ActivityItem;
          items.value = [payload, ...items.value.filter((x) => x.id !== payload.id)].slice(
            0,
            limit,
          );
        } catch {
          /* ignore */
        }
      });
      source.addEventListener('ping', () => {
        connected.value = true;
      });
      es = source;
    } catch (err: any) {
      connected.value = false;
      error.value = err?.message || 'sse connect failed';
    }
  }

  function reconnect(): void {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY);
  }

  function disconnect(): void {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    teardown();
    connected.value = false;
  }

  function manualReconnect(): void {
    reconnectAttempts = 0;
    unauthorized.value = false;
    error.value = null;
    teardown();
    connect();
  }

  onMounted(() => {
    fetchInitial();
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return { items, loading, error, connected, unauthorized, reconnect: manualReconnect };
}
