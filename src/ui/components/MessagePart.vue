<script setup lang="ts">
import type { UIMessage } from 'ai';
import MetadataCard from './MetadataCard.vue';
import WeatherCard from './WeatherCard.vue';

type MessagePart = UIMessage['parts'][number] & {
  state?: string;
  output?: unknown;
  input?: unknown;
  errorText?: string;
};

defineProps<{
  part: MessagePart;
  role: UIMessage['role'];
}>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
</script>

<template>
  <p v-if="part.type === 'text' && part.text" class="text-part">{{ part.text }}</p>

  <div v-else-if="part.type === 'tool-get-weather'" class="tool-part">
    <div v-if="part.state === 'input-available' || part.state === 'input-streaming'" class="pending-card">
      <span class="pending-spinner" aria-hidden="true"></span>
      <span>Fetching weather...</span>
    </div>
    <WeatherCard v-else-if="part.state === 'output-available' && isRecord(part.output)" :weather="part.output" />
    <div v-else-if="part.state === 'output-error'" class="error-card">{{ part.errorText }}</div>
  </div>

  <WeatherCard
    v-else-if="part.type === 'data-weather-card' && isRecord(part.data) && isRecord(part.data.output)"
    :weather="part.data.output"
  />

  <div v-else-if="part.type === 'tool-fetch-url-metadata'" class="tool-part">
    <div v-if="part.state === 'input-available' || part.state === 'input-streaming'" class="pending-card">
      <span class="pending-spinner" aria-hidden="true"></span>
      <span>Inspecting URL...</span>
    </div>
    <MetadataCard v-else-if="part.state === 'output-available' && isRecord(part.output)" :metadata="part.output" />
    <div v-else-if="part.state === 'output-error'" class="error-card">{{ part.errorText }}</div>
  </div>

  <MetadataCard
    v-else-if="part.type === 'data-url-metadata-card' && isRecord(part.data) && isRecord(part.data.output)"
    :metadata="part.data.output"
  />

  <details v-else-if="part.type.startsWith('tool-')" class="raw-part">
    <summary>{{ part.type }}</summary>
    <pre>{{ JSON.stringify(part, null, 2) }}</pre>
  </details>

  <div v-else-if="part.type === 'data-om-status'" class="sr-only">Memory status updated</div>
</template>
