import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ApiMessage, LoginResponse } from '@/types/api';
import type {
  AuthenticatedUser,
  ManagedUser,
  PermissionRole,
  UserFormInput,
} from '@/types/user';
import { localeFromLanguage } from '@/utils/locale';

const apiUrl = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
const tokenStorageKey = 'protege-mais.access-token';

function getMessage(data: unknown, fallback: string): string {
  return data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
    ? data.message
    : fallback;
}

export function useManagerApi() {
  const { locale, t } = useI18n();
  const user = ref<AuthenticatedUser | null>(null);
  const users = ref<ManagedUser[]>([]);
  const roles = ref<PermissionRole[]>([]);
  const loginError = ref('');
  const usersError = ref('');
  const saveUserError = ref('');
  const isLoggingIn = ref(false);
  const isLoadingUsers = ref(false);
  const isSavingUser = ref(false);
  const isDeletingUser = ref(false);

  function setUserLanguage(authenticatedUser: AuthenticatedUser) {
    locale.value = localeFromLanguage(authenticatedUser.language_code);
  }

  function authorizationHeaders(): Record<string, string> {
    const token = sessionStorage.getItem(tokenStorageKey);
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Accept-Language': locale.value,
    };
  }

  async function login(email: string, password: string) {
    loginError.value = '';
    if (!email.trim() || !password) {
      loginError.value = t('login_credentials_required');
      return;
    }
    isLoggingIn.value = true;
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': locale.value,
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await response.json().catch(() => null)) as
        LoginResponse | ApiMessage | null;
      if (
        !response.ok ||
        !data ||
        !('access_token' in data) ||
        !('user' in data)
      ) {
        loginError.value = getMessage(data, t('login_failed'));
        return;
      }
      sessionStorage.setItem(tokenStorageKey, data.access_token);
      user.value = data.user;
      setUserLanguage(data.user);
    } catch {
      loginError.value = t('api_connection_failed');
    } finally {
      isLoggingIn.value = false;
    }
  }

  async function restoreSession() {
    if (!sessionStorage.getItem(tokenStorageKey)) return;
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: authorizationHeaders(),
      });
      const data = (await response.json().catch(() => null)) as {
        user?: AuthenticatedUser;
      } | null;
      if (!response.ok || !data?.user) {
        sessionStorage.removeItem(tokenStorageKey);
        return;
      }
      user.value = data.user;
      setUserLanguage(data.user);
    } catch {
      sessionStorage.removeItem(tokenStorageKey);
    }
  }

  async function loadUsers() {
    isLoadingUsers.value = true;
    usersError.value = '';
    try {
      const response = await fetch(`${apiUrl}/api/v1/users`, {
        headers: authorizationHeaders(),
      });
      const data = (await response.json().catch(() => null)) as
        ({ users?: ManagedUser[] } & ApiMessage) | null;
      if (!response.ok || !data?.users) {
        usersError.value = getMessage(data, t('load_users_failed'));
        return;
      }
      users.value = data.users;
    } catch {
      usersError.value = t('load_users_connection_failed');
    } finally {
      isLoadingUsers.value = false;
    }
  }
  async function loadRoles() {
    const response = await fetch(`${apiUrl}/api/v1/permission-roles`, {
      headers: authorizationHeaders(),
    });
    const data = (await response.json().catch(() => null)) as {
      roles?: PermissionRole[];
    } | null;
    if (response.ok && data?.roles) roles.value = data.roles;
  }

  async function saveUser(
    input: UserFormInput,
    targetUser: ManagedUser | null
  ) {
    saveUserError.value = '';
    isSavingUser.value = true;
    try {
      const payload = {
        ...input,
        ...(targetUser && !input.password ? { password: undefined } : {}),
      };
      const response = await fetch(
        targetUser
          ? `${apiUrl}/api/v1/users/${targetUser.id}`
          : `${apiUrl}/api/v1/users`,
        {
          method: targetUser ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authorizationHeaders(),
          },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json().catch(() => null)) as
        ({ user?: ManagedUser } & ApiMessage) | null;
      if (!response.ok || !data?.user) {
        saveUserError.value = getMessage(data, t('save_user_failed'));
        return false;
      }
      users.value = targetUser
        ? users.value.map((item) =>
            item.id === data.user?.id ? data.user : item
          )
        : [data.user, ...users.value];
      return true;
    } catch {
      saveUserError.value = t('save_user_connection_failed');
      return false;
    } finally {
      isSavingUser.value = false;
    }
  }

  async function deleteUser(managedUser: ManagedUser): Promise<boolean> {
    usersError.value = '';
    isDeletingUser.value = true;
    try {
      const response = await fetch(`${apiUrl}/api/v1/users/${managedUser.id}`, {
        method: 'DELETE',
        headers: authorizationHeaders(),
      });
      const data = (await response
        .json()
        .catch(() => null)) as ApiMessage | null;
      if (!response.ok) {
        usersError.value = getMessage(data, t('delete_user_failed'));
        return false;
      }
      users.value = users.value.filter((item) => item.id !== managedUser.id);
      return true;
    } catch {
      usersError.value = t('delete_user_connection_failed');
      return false;
    } finally {
      isDeletingUser.value = false;
    }
  }

  function logout() {
    sessionStorage.removeItem(tokenStorageKey);
    user.value = null;
    users.value = [];
  }
  return {
    user,
    users,
    roles,
    loginError,
    usersError,
    saveUserError,
    isLoggingIn,
    isLoadingUsers,
    isSavingUser,
    isDeletingUser,
    login,
    restoreSession,
    loadUsers,
    loadRoles,
    saveUser,
    deleteUser,
    logout,
  };
}
