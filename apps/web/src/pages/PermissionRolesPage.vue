<script setup lang="ts">
import RolePermissions from '@/components/role/RolePermissions.vue';
import type { PermissionAction, PermissionRole } from '@/types/user';
defineProps<{ roles: PermissionRole[]; permissions: PermissionAction[] }>();
</script>
<template>
  <section class="page-content">
    <p class="eyebrow">{{ $t('administration') }}</p>
    <h1>{{ $t('roles') }}</h1>
    <article v-for="role in roles" :key="role.id" class="data-card">
      <div class="data-card-header">
        <strong>{{ role.name }}</strong
        ><span>{{
          role.is_system ? $t('system_role') : $t('custom_role')
        }}</span>
      </div>
      <RolePermissions :permissions="role.permissions ?? []" />
    </article>
  </section>
</template>
