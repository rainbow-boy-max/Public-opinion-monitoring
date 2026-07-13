import { defineStore } from 'pinia';
import { ref } from 'vue';
import http from '@/utils/http';

interface UserInfo {
  id: number;
  username: string;
  authStatus: string;
}

export const useUserAuthStore = defineStore('userAuth', () => {
  const token = ref(localStorage.getItem('user_token') || '');
  const user = ref<UserInfo | null>(
    JSON.parse(localStorage.getItem('user_info') || 'null'),
  );

  async function login(username: string, password: string): Promise<void> {
    const data = await http.post('/auth/login', { username, password });
    token.value = data.token;
    user.value = {
      id: data.user.id,
      username: data.user.username,
      authStatus: data.user.authStatus,
    };
    localStorage.setItem('user_token', data.token);
    localStorage.setItem('user_info', JSON.stringify(user.value));
  }

  async function register(payload: {
    username: string;
    phone: string;
    password: string;
    code: string;
  }): Promise<void> {
    const data = await http.post('/auth/register', payload);
    token.value = data.token;
    user.value = {
      id: data.user.id,
      username: data.user.username,
      authStatus: data.user.authStatus,
    };
    localStorage.setItem('user_token', data.token);
    localStorage.setItem('user_info', JSON.stringify(user.value));
  }

  async function sendSms(phone: string, scene: 'login' | 'register' | 'reset'): Promise<void> {
    await http.post('/auth/send-sms-code', { phone, scene });
  }

  async function refreshUser(): Promise<void> {
    const res = await http.get('/verify/status');
    if (user.value) user.value.authStatus = res.authStatus;
    localStorage.setItem('user_info', JSON.stringify(user.value));
  }

  function logout(): void {
    token.value = '';
    user.value = null;
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_info');
  }

  return { token, user, login, register, sendSms, refreshUser, logout };
});
