<script setup lang="ts">
import type { AuthenticatedUser } from '@/types/user';
defineProps<{ user: AuthenticatedUser; canManageUsers: boolean }>();
const emit = defineEmits<{ openUsers: [] }>();
</script>

<template>
  <section class="page-content dashboard-page">
    <p class="eyebrow">{{ $t('dashboard_eyebrow') }}</p>
    <h1>{{ $t('dashboard_greeting', { name: user.username }) }}</h1>
    <p class="page-subtitle">{{ $t('dashboard_subtitle') }}</p>
    <article v-if="canManageUsers" class="quick-action-card">
      <div>
        <p class="eyebrow">{{ $t('administration') }}</p>
        <h2>{{ $t('manage_users_title') }}</h2>
        <p>{{ $t('manage_users_description') }}</p>
      </div>
      <v-btn
        color="primary"
        type="button"
        variant="flat"
        @click="emit('openUsers')"
        >{{ $t('open_users') }}</v-btn
      >
    </article>
  </section>
</template>
