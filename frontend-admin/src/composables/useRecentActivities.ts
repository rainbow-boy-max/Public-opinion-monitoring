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

export function useRecentActivities(limit = 20) {
  const items = ref<ActivityItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const connected = ref(false);

  let es: EventSource | null = null;
  let reconnectTimer: number | undefined;

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

  function connect(): void {
    if (es) return;
    try {
      es = new EventSource('/api/admin/dashboard/recent-activities/stream', {
        withCredentials: true,
      });
      es.addEventListener('open', () => {
        connected.value = true;
      });
      es.addEventListener('error', () => {
        connected.value = false;
        if (es) {
          es.close();
          es = null;
        }
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY);
      });
      es.addEventListener('activity', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as ActivityItem;
          items.value = [payload, ...items.value.filter((x) => x.id !== payload.id)].slice(0, limit);
        } catch {
          /* ignore */
        }
      });
    } catch (err: any) {
      connected.value = false;
      error.value = err?.message || 'sse connect failed';
    }
  }

  function disconnect(): void {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    if (es) {
      es.close();
      es = null;
    }
    connected.value = false;
  }

  onMounted(() => {
    fetchInitial();
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return { items, loading, error, connected };
}
