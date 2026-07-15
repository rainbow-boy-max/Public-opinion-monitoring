import { AsyncLocalStorage } from 'async_hooks';

export const tenantStorage = new AsyncLocalStorage<{ tenantId: number }>();

export function getCurrentTenantId(): number | null {
  return tenantStorage.getStore()?.tenantId ?? null;
}

export function runWithTenant<T>(tenantId: number, fn: () => T): T {
  return tenantStorage.run({ tenantId }, fn);
}
