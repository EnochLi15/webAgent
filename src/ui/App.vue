<script setup lang="ts">
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Chat } from '@ai-sdk/vue';
import { computed, ref } from 'vue';
import MessagePart from './components/MessagePart.vue';

const input = ref('上海天气怎么样？');
const agentId = ref<'web-agent' | 'weather-agent'>('web-agent');
const threadId = ref(`thread-${crypto.randomUUID()}`);
const resourceId = ref('local-user');

const chat = new Chat<UIMessage>({
  transport: new DefaultChatTransport({
    api: '/chat/web-agent',
    prepareSendMessagesRequest({ messages }) {
      return {
        api: `/chat/${agentId.value}`,
        body: {
          messages,
          memory: {
            thread: threadId.value,
            resource: resourceId.value,
          },
        },
      };
    },
  }),
});

const status = computed(() => chat.status);
const error = computed(() => chat.error);
const isBusy = computed(() => chat.status === 'submitted' || chat.status === 'streaming');

const submitMessage = async () => {
  const text = input.value.trim();
  if (!text || isBusy.value) {
    return;
  }

  input.value = '';
  await chat.sendMessage({
    role: 'user',
    parts: [{ type: 'text', text }],
  });
};

const usePrompt = (text: string) => {
  input.value = text;
};

const startNewThread = () => {
  threadId.value = `thread-${crypto.randomUUID()}`;
  chat.messages = [];
  chat.clearError();
};
</script>

<template>
  <main class="app-shell">
    <section class="chat-panel" aria-label="Mastra generative UI chat">
      <header class="topbar">
        <div>
          <p class="eyebrow">Mastra + AI SDK + Vue</p>
          <h1>Generative UI Console</h1>
        </div>

        <div class="controls">
          <select v-model="agentId" :disabled="isBusy" aria-label="Agent">
            <option value="web-agent">Web Agent</option>
            <option value="weather-agent">Weather Agent</option>
          </select>
          <button class="secondary-button" type="button" :disabled="isBusy" @click="startNewThread">
            New thread
          </button>
        </div>
      </header>

      <div class="prompt-row" aria-label="Example prompts">
        <button type="button" @click="usePrompt('上海天气怎么样？')">Weather card</button>
        <button type="button" @click="usePrompt('抓取 https://mastra.ai 的 metadata')">URL metadata</button>
        <button type="button" @click="usePrompt('比较北京和深圳今天适合户外活动吗？')">Activity fit</button>
      </div>

      <div class="messages" aria-live="polite">
        <article
          v-for="message in chat.messages"
          :key="message.id"
          class="message"
          :class="`message-${message.role}`"
        >
          <div class="message-role">{{ message.role }}</div>
          <div class="parts">
            <template
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${index}`"
            >
              <p v-if="part.type === 'text'" class="text-part">{{ part.text }}</p>
              <MessagePart v-else :part="part" :role="message.role" />
            </template>
          </div>
        </article>

        <div v-if="chat.messages.length === 0" class="empty-state">
          <p>Ask for weather, URL metadata, or browser-backed web work.</p>
        </div>
      </div>

      <p v-if="error" class="error">{{ error.message }}</p>

      <form class="composer" @submit.prevent="submitMessage">
        <textarea
          v-model="input"
          rows="2"
          placeholder="Send a message to Mastra"
          :disabled="isBusy"
          @keydown.enter.exact.prevent="submitMessage"
        />
        <button type="submit" :disabled="isBusy || !input.trim()">
          {{ isBusy ? 'Streaming' : 'Send' }}
        </button>
      </form>
    </section>
  </main>
</template>
