<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ManagedUser, PermissionRole, UserFormInput } from '@/types/user';

const props = defineProps<{
  modelValue: boolean;
  user: ManagedUser | null;
  roles: PermissionRole[];
  error: string;
  isSaving: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [input: UserFormInput];
}>();
const form = ref<UserFormInput>(emptyForm());
const isEditing = computed(() => props.user !== null);
function emptyForm(): UserFormInput {
  return {
    username: '',
    email: '',
    password: '',
    permission_role_id:
      props.roles.find((role) => role.code === 'PLAYER')?.id ?? '',
    language_code: 'pt-BR',
    active: true,
  };
}
watch(
  () => [props.modelValue, props.user] as const,
  ([visible, user]) => {
    if (!visible) return;
    form.value = user
      ? {
          username: user.username,
          email: user.email,
          password: '',
          permission_role_id: user.permission_role_id,
          language_code: user.language_code,
          active: user.active,
        }
      : emptyForm();
  },
  { immediate: true }
);
function submit() {
  emit('submit', form.value);
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="540"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="modal-card"
      ><v-card-text
        ><form @submit.prevent="submit">
          <header>
            <p class="eyebrow">
              {{ $t(isEditing ? 'edit_registration' : 'new_registration') }}
            </p>
            <h2>{{ $t(isEditing ? 'edit_user' : 'register_user') }}</h2>
            <p>{{ $t('user_form_subtitle') }}</p>
          </header>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <label
            ><span>{{ $t('username') }}</span
            ><input
              v-model="form.username"
              autocomplete="username"
              maxlength="120"
              required
          /></label>
          <label
            ><span>{{ $t('email') }}</span
            ><input
              v-model="form.email"
              autocomplete="email"
              maxlength="320"
              required
              type="email"
          /></label>
          <label
            ><span>{{
              $t(isEditing ? 'new_password_optional' : 'password')
            }}</span
            ><input
              v-model="form.password"
              autocomplete="new-password"
              minlength="8"
              :required="!isEditing"
              type="password"
          /></label>
          <div class="form-grid">
            <label
              ><span>{{ $t('role') }}</span
              ><select v-model="form.permission_role_id" required>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select></label
            ><label
              ><span>{{ $t('game_language') }}</span
              ><select v-model="form.language_code">
                <option value="pt-BR">{{ $t('language_pt') }}</option>
                <option value="en">{{ $t('language_en') }}</option>
                <option value="es">{{ $t('language_es') }}</option>
              </select></label
            >
          </div>
          <label v-if="isEditing"
            ><span>{{ $t('status') }}</span
            ><select v-model="form.active">
              <option :value="true">{{ $t('active') }}</option>
              <option :value="false">{{ $t('inactive') }}</option>
            </select></label
          >
          <footer>
            <v-btn
              type="button"
              variant="outlined"
              @click="emit('update:modelValue', false)"
              >{{ $t('cancel') }}</v-btn
            ><v-btn
              color="primary"
              type="submit"
              variant="flat"
              :loading="isSaving"
              >{{ $t(isEditing ? 'save_changes' : 'register') }}</v-btn
            >
          </footer>
        </form></v-card-text
      ></v-card
    >
  </v-dialog>
</template>
