<script setup lang="ts">
import type { ManagedUser } from '@/types/user';
defineProps<{ user: ManagedUser | null; isDeleting: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <v-dialog
    :model-value="user !== null"
    max-width="460"
    persistent
    @update:model-value="
      (visible) => {
        if (!visible && !isDeleting) emit('close');
      }
    "
  >
    <v-card class="delete-dialog-card"
      ><v-card-title>{{ $t('delete_user_question') }}</v-card-title
      ><v-card-text>{{
        $t('delete_user_confirmation', { name: user?.username })
      }}</v-card-text
      ><v-card-actions
        ><v-spacer /><v-btn
          variant="text"
          :disabled="isDeleting"
          @click="emit('close')"
          >{{ $t('cancel') }}</v-btn
        ><v-btn
          color="error"
          variant="flat"
          :loading="isDeleting"
          @click="emit('confirm')"
          >{{ $t('delete_user') }}</v-btn
        ></v-card-actions
      ></v-card
    >
  </v-dialog>
</template>
