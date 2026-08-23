<script setup lang="ts">
import type { PermissionAction } from '@/types/user';
defineProps<{ permissions: PermissionAction[] }>();
</script>
<template>
  <ul>
    <li v-for="permission in permissions" :key="permission">
      {{ permission }}
    </li>
  </ul>
</template>
