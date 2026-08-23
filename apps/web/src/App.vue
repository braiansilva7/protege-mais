<template>
  <v-app>
    <v-main class="foundation-shell">
      <main class="foundation-card" aria-labelledby="foundation-title">
        <div class="brand-mark" aria-hidden="true">P+</div>
        <p class="foundation-eyebrow">{{ $t('foundation_eyebrow') }}</p>
        <h1 id="foundation-title">{{ $t('foundation_title') }}</h1>
        <p class="foundation-description">
          {{ $t('foundation_description') }}
        </p>
        <span class="foundation-status">{{ $t('foundation_status') }}</span>
      </main>
    </v-main>
  </v-app>
</template>
