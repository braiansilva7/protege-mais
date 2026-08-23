<script setup lang="ts">
import type { PermissionAction, PermissionRole } from '@/types/user';
defineProps<{ role: PermissionRole | null; permissions: PermissionAction[] }>();
</script>
<template>
  <v-card
    ><v-card-title>{{ role?.name }}</v-card-title
    ><v-card-text>{{ permissions.join(', ') }}</v-card-text></v-card
  >
</template>
