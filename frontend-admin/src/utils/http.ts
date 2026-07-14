import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { ElNotification, ElMessage } from 'element-plus';
import { getI18n, getLanguage, tMessage, tHint, tAction } from './i18n';

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
});

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 让 401/4xx/5xx 都进入 error 分支
instance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const lang = getLanguage();

    if (status === 401) {
      // Token 失效 → 清本地 + 跳转登录
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/change-password')) {
        showErrorNotification(data?.errorCode || 'AUTH_TOKEN_INVALID', data, lang);
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      }
      return Promise.reject(buildError(data, 'AUTH_TOKEN_INVALID', status));
    }

    if (status === 403) {
      // 角色不足 → 不跳转，但提示
      showErrorNotification(data?.errorCode || 'AUTH_INSUFFICIENT_PERMISSIONS', data, lang);
      return Promise.reject(buildError(data, 'AUTH_INSUFFICIENT_PERMISSIONS', status));
    }

    if (status === 404) {
      // 资源不存在：仅在明确 errorCode 时才弹
      if (data?.errorCode) {
        showErrorNotification(data.errorCode, data, lang);
      }
      return Promise.reject(buildError(data, 'NOT_FOUND', status));
    }

    if (status === 422) {
      showErrorNotification(data?.errorCode || 'KB_FILE_PARSE_FAILED', data, lang);
      return Promise.reject(buildError(data, 'KB_FILE_PARSE_FAILED', status));
    }

    if (status === 429) {
      showErrorNotification(data?.errorCode || 'RATE_LIMITED', data, lang);
      return Promise.reject(buildError(data, 'RATE_LIMITED', status));
    }

    if (status >= 500) {
      showErrorNotification(data?.errorCode || 'INTERNAL_ERROR', data, lang);
      return Promise.reject(buildError(data, 'INTERNAL_ERROR', status));
    }

    // 4xx 中其他 - 仅当有 errorCode 时弹（如 VALIDATION_FAILED, USER_ALREADY_EXISTS）
    if (data?.errorCode) {
      showErrorNotification(data.errorCode, data, lang);
    } else {
      const msg = data?.messageZh || data?.message || (lang === 'zh' ? '请求失败' : 'Request failed');
      ElMessage({
        message: msg,
        type: 'error',
        duration: 5000,
      });
    }
    return Promise.reject(buildError(data, data?.errorCode, status));
  },
);

function buildError(data: any, fallbackCode?: string, status?: number): any {
  return {
    code: data?.code || status,
    errorCode: data?.errorCode || fallbackCode || 'INTERNAL_ERROR',
    message: data?.messageZh || data?.message,
    messageEn: data?.messageEn,
    hint: data?.hintZh,
    hintEn: data?.hintEn,
    actionZh: data?.actionZh,
    actionEn: data?.actionEn,
    actionTarget: data?.actionTarget,
    details: data?.details,
    status,
  };
}

function showErrorNotification(code: string, data: any, lang: 'zh' | 'en'): void {
  const entry = getI18n(code, lang) || getI18n('INTERNAL_ERROR', lang)!;
  const title = tMessage(code, lang);
  const messageZh = tMessage(code, 'zh');
  const messageEn = tMessage(code, 'en');
  const hintZh = tHint(code, 'zh');
  const hintEn = tHint(code, 'en');
  const action = tAction(code, lang);
  const target = entry.actionTarget;

  // 使用 dangerouslyUseHTMLString 提供丰富结构：双语 + 解决办法 + 错误码
  const html = `
    <div class="i18n-err">
      <div class="i18n-err__bilingual">
        <div class="i18n-err__zh">${escapeHtml(messageZh)}</div>
        <div class="i18n-err__en">${escapeHtml(messageEn)}</div>
      </div>
      <div class="i18n-err__hint">
        <div class="i18n-err__hint-zh">💡 ${escapeHtml(hintZh)}</div>
        <div class="i18n-err__hint-en">💡 ${escapeHtml(hintEn)}</div>
      </div>
      <div class="i18n-err__footer">
        <code class="i18n-err__code">${escapeHtml(code)}</code>
        ${
          target
            ? `<a href="javascript:void(0)" class="i18n-err__action" data-action="${escapeHtml(target)}">↪ ${escapeHtml(action.text)}</a>`
            : `<span class="i18n-err__action i18n-err__action--static">${escapeHtml(action.text)}</span>`
        }
      </div>
    </div>
  `;

  ElNotification({
    title: `⚠ ${title}`,
    message: html,
    type: 'error',
    duration: 10000,
    dangerouslyUseHTMLString: true,
    customClass: 'i18n-notification',
  });

  // 全局监听 action 点击：路由跳转
  setTimeout(() => {
    const actionEl = document.querySelector('.i18n-err__action[data-action]');
    if (actionEl) {
      actionEl.addEventListener('click', () => {
        const tgt = actionEl.getAttribute('data-action');
        if (tgt) {
          window.location.href = tgt;
        }
      });
    }
  }, 0);
}

function escapeHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default instance;
