import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessageBox } from 'element-plus';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 分钟
const WARNING_TIME = 5 * 60 * 1000; // 提前 5 分钟警告

export function useIdleDetection(onLogout: () => void) {
  const idleTimer = ref<number | null>(null);
  const warningTimer = ref<number | null>(null);
  let warningShown = false;

  function resetTimers() {
    if (idleTimer.value) clearTimeout(idleTimer.value);
    if (warningTimer.value) clearTimeout(warningTimer.value);
    warningShown = false;

    warningTimer.value = window.setTimeout(() => {
      if (!warningShown) {
        warningShown = true;
        showWarning();
      }
    }, IDLE_TIMEOUT - WARNING_TIME);

    idleTimer.value = window.setTimeout(() => {
      performLogout();
    }, IDLE_TIMEOUT);
  }

  function showWarning() {
    ElMessageBox.alert(
      '您已长时间未操作，系统将在 5 分钟后自动退出登录。',
      '会话即将超时',
      {
        confirmButtonText: '继续操作',
        type: 'warning',
        callback: () => {
          resetTimers();
        },
      },
    );
  }

  function performLogout() {
    ElMessageBox.alert(
      '由于长时间未操作，您已自动退出登录。',
      '会话已超时',
      {
        confirmButtonText: '重新登录',
        type: 'info',
        showClose: false,
        closeOnClickModal: false,
        closeOnPressEscape: false,
      },
    ).then(() => {
      onLogout();
    });
  }

  function handleActivity() {
    resetTimers();
  }

  onMounted(() => {
    resetTimers();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
  });

  onUnmounted(() => {
    if (idleTimer.value) clearTimeout(idleTimer.value);
    if (warningTimer.value) clearTimeout(warningTimer.value);
    window.removeEventListener('mousemove', handleActivity);
    window.removeEventListener('keypress', handleActivity);
    window.removeEventListener('click', handleActivity);
    window.removeEventListener('scroll', handleActivity);
  });
}