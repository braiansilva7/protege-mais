<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import LoginForm from '@/components/auth/LoginForm.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import DashboardPage from '@/pages/DashboardPage.vue';
import UsersPage from '@/pages/UsersPage.vue';
import { useManagerApi } from '@/composables/useManagerApi';
import type { Page } from '@/types/navigation';
import type { ManagedUser, UserFormInput } from '@/types/user';

const api = useManagerApi();
const {
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
} = api;
const currentPage = ref<Page>('dashboard');
const canManageUsers = computed(
  () => user.value?.permissions.includes('users.view') ?? false
);

async function openUsers() {
  if (!canManageUsers.value) return;
  currentPage.value = 'users';
  await Promise.all([api.loadUsers(), api.loadRoles()]);
}

function navigate(page: Page) {
  if (page === 'users') void openUsers();
  else currentPage.value = page;
}

async function saveUser(input: UserFormInput, target: ManagedUser | null) {
  return api.saveUser(input, target);
}

async function deleteUser(user: ManagedUser) {
  return api.deleteUser(user);
}
function logout() {
  api.logout();
  currentPage.value = 'dashboard';
}

onMounted(() => void api.restoreSession());
</script>

<template>
  <v-app>
    <LoginForm
      v-if="!user"
      :error="loginError"
      :is-submitting="isLoggingIn"
      @submit="({ email, password }) => api.login(email, password)"
    />
    <AppLayout
      v-else
      :user="user"
      :current-page="currentPage"
      @navigate="navigate"
      @logout="logout"
    >
      <DashboardPage
        v-if="currentPage === 'dashboard'"
        :user="user"
        :can-manage-users="canManageUsers"
        @open-users="openUsers"
      />
      <UsersPage
        v-else
        :users="users"
        :roles="roles"
        :error="usersError"
        :is-loading="isLoadingUsers"
        :is-saving="isSavingUser"
        :save-error="saveUserError"
        :is-deleting="isDeletingUser"
        :save-user="saveUser"
        :delete-user="deleteUser"
        @refresh="api.loadUsers"
      />
    </AppLayout>
  </v-app>
</template>
