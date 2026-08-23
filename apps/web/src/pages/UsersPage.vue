<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import UserDeleteDialog from '@/components/user/UserDeleteDialog.vue';
import UserFormDialog from '@/components/user/UserFormDialog.vue';
import type {
  ManagedUser,
  PermissionRole,
  UserFormInput,
  LanguageCode,
} from '@/types/user';
import { formatDate } from '@/utils/formatters';
import { localeFromLanguage } from '@/utils/locale';

const props = defineProps<{
  users: ManagedUser[];
  roles: PermissionRole[];
  error: string;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string;
  isDeleting: boolean;
  saveUser: (
    input: UserFormInput,
    target: ManagedUser | null
  ) => Promise<boolean>;
  deleteUser: (user: ManagedUser) => Promise<boolean>;
}>();
const emit = defineEmits<{ refresh: [] }>();
const { t, locale } = useI18n();
const isFormOpen = ref(false);
const editingUser = ref<ManagedUser | null>(null);
const userPendingDeletion = ref<ManagedUser | null>(null);
function languageLabel(language: LanguageCode) {
  return t(`language_${localeFromLanguage(language)}`);
}
function createUser() {
  editingUser.value = null;
  isFormOpen.value = true;
}
function editUser(user: ManagedUser) {
  editingUser.value = user;
  isFormOpen.value = true;
}
async function save(input: UserFormInput) {
  if (await props.saveUser(input, editingUser.value)) closeForm();
}
function closeForm() {
  isFormOpen.value = false;
  editingUser.value = null;
}
async function confirmDelete() {
  if (
    userPendingDeletion.value &&
    (await props.deleteUser(userPendingDeletion.value))
  )
    userPendingDeletion.value = null;
}
</script>

<template>
  <section class="page-content users-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ $t('administration') }}</p>
        <h1>{{ $t('users') }}</h1>
        <p class="page-subtitle">{{ $t('users_subtitle') }}</p>
      </div>
      <v-btn color="primary" type="button" variant="flat" @click="createUser">{{
        $t('new_user')
      }}</v-btn>
    </div>
    <article class="data-card">
      <div class="data-card-header">
        <div>
          <h2>{{ $t('all_users') }}</h2>
          <p>{{ $t('users_found', { count: users.length }) }}</p>
        </div>
        <v-btn
          class="refresh-button"
          type="button"
          variant="outlined"
          size="small"
          :loading="isLoading"
          @click="emit('refresh')"
          >{{ $t('refresh') }}</v-btn
        >
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-else-if="isLoading" class="empty-state">{{ $t('loading_users') }}</p>
      <p v-else-if="!users.length" class="empty-state">{{ $t('no_users') }}</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ $t('user') }}</th>
              <th>{{ $t('role') }}</th>
              <th>{{ $t('language') }}</th>
              <th>{{ $t('status') }}</th>
              <th>{{ $t('registered_at') }}</th>
              <th>{{ $t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="managedUser in users" :key="managedUser.id">
              <td>
                <strong>{{ managedUser.username }}</strong
                ><span>{{ managedUser.email }}</span>
              </td>
              <td>
                <span class="tag role-tag">{{
                  managedUser.permission_role?.name ?? '-'
                }}</span>
              </td>
              <td>{{ languageLabel(managedUser.language_code) }}</td>
              <td>
                <span
                  :class="[
                    'tag',
                    managedUser.active ? 'active-tag' : 'inactive-tag',
                  ]"
                  >{{ $t(managedUser.active ? 'active' : 'inactive') }}</span
                >
              </td>
              <td>{{ formatDate(managedUser.created_at, locale) }}</td>
              <td class="row-actions">
                <v-btn
                  type="button"
                  variant="text"
                  size="small"
                  @click="editUser(managedUser)"
                  >{{ $t('edit') }}</v-btn
                ><v-btn
                  class="danger-action"
                  color="error"
                  type="button"
                  variant="text"
                  size="small"
                  @click="userPendingDeletion = managedUser"
                  >{{ $t('delete') }}</v-btn
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
    <UserFormDialog
      :model-value="isFormOpen"
      :user="editingUser"
      :roles="roles"
      :error="saveError"
      :is-saving="isSaving"
      @update:model-value="
        (visible) => {
          if (!visible) closeForm();
        }
      "
      @submit="save"
    />
    <UserDeleteDialog
      :user="userPendingDeletion"
      :is-deleting="isDeleting"
      @close="userPendingDeletion = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
