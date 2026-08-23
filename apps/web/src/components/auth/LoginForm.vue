<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ error: string; isSubmitting: boolean }>();
const emit = defineEmits<{
  submit: [credentials: { email: string; password: string }];
}>();
const email = ref('');
const password = ref('');
const isPasswordVisible = ref(false);

function submit() {
  emit('submit', { email: email.value, password: password.value });
}
</script>

<template>
  <main class="auth-page">
    <a class="auth-logo" href="/" :aria-label="$t('app_name')"
      ><span class="auth-logo-mark" aria-hidden="true">S</span
      ><span class="auth-title">{{ $t('app_name') }}</span></a
    >
    <section class="auth-wrapper">
      <aside class="auth-visual" aria-hidden="true">
        <div class="auth-illustration">
          <span></span><span></span><span></span>
        </div>
      </aside>
      <section class="auth-card-v2" aria-labelledby="login-title">
        <form class="auth-card" @submit.prevent="submit">
          <header>
            <h1 id="login-title">
              {{ $t('login_title', { app: $t('app_name') }) }}
            </h1>
            <p>{{ $t('login_subtitle') }}</p>
          </header>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <label
            ><span>{{ $t('email') }}</span
            ><input
              v-model="email"
              autocomplete="email"
              autofocus
              inputmode="email"
              :placeholder="$t('email_placeholder')"
              type="email"
          /></label>
          <label
            ><span>{{ $t('password') }}</span
            ><span class="password-field"
              ><input
                v-model="password"
                autocomplete="current-password"
                placeholder="············"
                :type="isPasswordVisible ? 'text' : 'password'"
              /><v-btn
                type="button"
                class="password-toggle"
                variant="text"
                size="small"
                @click="isPasswordVisible = !isPasswordVisible"
                >{{ $t(isPasswordVisible ? 'hide' : 'show') }}</v-btn
              ></span
            ></label
          >
          <v-btn
            class="login-button"
            color="primary"
            type="submit"
            variant="flat"
            :loading="isSubmitting"
            block
            >{{ $t(isSubmitting ? 'logging_in' : 'login') }}</v-btn
          >
        </form>
      </section>
    </section>
  </main>
</template>
