import { defineStore } from 'pinia';
import { ref } from 'vue';
import http from '@/utils/http';

interface AdminUser {
  id: number;
  username: string;
  role: string;
  authStatus: string;
  firstLogin?: boolean;
}

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const token = ref(localStorage.getItem('admin_token') || '');
  const user = ref<AdminUser | null>(
    JSON.parse(localStorage.getItem('admin_user') || 'null'),
  );

  async function login(username: string, password: string): Promise<{ passwordChangeRequired: boolean }> {
    const data = await http.post('/auth/login', { username, password });
    token.value = data.token;
    user.value = {
      id: data.user.id,
      username: data.user.username,
      role: data.user.role,
      authStatus: data.user.authStatus,
      firstLogin: data.passwordChangeRequired,
    };
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(user.value));
    return { passwordChangeRequired: data.passwordChangeRequired };
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await http.post('/auth/change-password', { oldPassword, newPassword });
    if (user.value) {
      user.value.firstLogin = false;
      localStorage.setItem('admin_user', JSON.stringify(user.value));
    }
  }

  function logout(): void {
    token.value = '';
    user.value = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }

  return { token, user, login, changePassword, logout };
});
