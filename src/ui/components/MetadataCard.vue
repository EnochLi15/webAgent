<script setup lang="ts">
const props = defineProps<{
  metadata: Record<string, unknown>;
}>();

const text = (key: string) => String(props.metadata[key] ?? '');
</script>

<template>
  <section class="metadata-card">
    <div class="metadata-status">
      <span>{{ text('status') }}</span>
      <span>{{ text('contentType') || 'unknown content type' }}</span>
    </div>

    <h2>{{ text('title') || text('finalUrl') }}</h2>
    <p v-if="text('description')" class="description">{{ text('description') }}</p>
    <a :href="text('finalUrl')" target="_blank" rel="noreferrer">{{ text('finalUrl') }}</a>
  </section>
</template>
