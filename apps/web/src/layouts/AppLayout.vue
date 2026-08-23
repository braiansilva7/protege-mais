<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import verticalNavigation from '@/navigation/vertical';
import type { Page } from '@/types/navigation';
import type { AuthenticatedUser } from '@/types/user';

const props = defineProps<{ user: AuthenticatedUser; currentPage: Page }>();
const emit = defineEmits<{ navigate: [page: Page]; logout: [] }>();
const { t } = useI18n();
const navigationItems = computed(() =>
  verticalNavigation.filter(
    (item) =>
      !item.permissions ||
      item.permissions.some((permission) =>
        props.user.permissions.includes(permission)
      )
  )
);
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="/" :aria-label="$t('app_name')"
        ><span class="auth-logo-mark" aria-hidden="true">S</span
        ><span>{{ $t('app_name') }}</span></a
      >
      <nav class="navigation" :aria-label="$t('app_name')">
        <v-btn
          v-for="item in navigationItems"
          :key="item.page"
          :class="{ active: currentPage === item.page }"
          variant="text"
          @click="emit('navigate', item.page)"
          ><span aria-hidden="true">{{ item.icon }}</span>
          {{ $t(item.title) }}</v-btn
        >
      </nav>
      <div class="sidebar-footer">
        <strong>{{ user.username }}</strong
        ><span>{{ user.permission_role?.name }}</span>
      </div>
    </aside>
    <section class="app-content">
      <header class="topbar">
        <v-btn
          class="mobile-brand"
          type="button"
          variant="text"
          @click="emit('navigate', 'dashboard')"
          >{{ $t('app_name') }}</v-btn
        >
        <div class="topbar-user">
          <div>
            <strong>{{ user.username }}</strong
            ><span>{{ user.email }}</span>
          </div>
          <v-btn
            class="logout-button"
            type="button"
            variant="outlined"
            size="small"
            @click="emit('logout')"
            >{{ $t('logout') }}</v-btn
          >
        </div>
      </header>
      <slot />
    </section>
  </main>
</template>
