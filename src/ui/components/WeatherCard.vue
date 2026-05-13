<script setup lang="ts">
const props = defineProps<{
  weather: Record<string, unknown>;
}>();

const value = (key: string) => props.weather[key];
</script>

<template>
  <section class="weather-card">
    <div>
      <p class="card-label">Current weather</p>
      <h2>{{ value('location') }}</h2>
      <p class="condition">{{ value('conditions') }}</p>
    </div>

    <div class="temperature">{{ value('temperature') }}°C</div>

    <dl class="metric-grid">
      <div>
        <dt>Feels like</dt>
        <dd>{{ value('feelsLike') }}°C</dd>
      </div>
      <div>
        <dt>Humidity</dt>
        <dd>{{ value('humidity') }}%</dd>
      </div>
      <div>
        <dt>Wind</dt>
        <dd>{{ value('windSpeed') }} km/h</dd>
      </div>
      <div>
        <dt>Gust</dt>
        <dd>{{ value('windGust') }} km/h</dd>
      </div>
    </dl>
  </section>
</template>
