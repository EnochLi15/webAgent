<script setup lang="ts">
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Chat } from '@ai-sdk/vue';
import { computed, nextTick, ref, watch } from 'vue';
import MessagePart from './components/MessagePart.vue';

const input = ref('上海天气怎么样？');
const agentId = ref<'web-agent' | 'weather-agent'>('web-agent');
const threadId = ref(`thread-${crypto.randomUUID()}`);
const resourceId = ref('local-user');
const messagesEnd = ref<HTMLElement | null>(null);

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
const statusLabel = computed(() => {
  if (chat.status === 'submitted') {
    return 'Waiting for model';
  }

  if (chat.status === 'streaming') {
    return 'Streaming response';
  }

  if (chat.status === 'error') {
    return 'Needs attention';
  }

  return 'Ready';
});
const hasMessages = computed(() => chat.messages.length > 0);
const canRetry = computed(() => Boolean(error.value && hasMessages.value));

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

const stopResponse = async () => {
  await chat.stop();
};

const retryLastMessage = async () => {
  chat.clearError();
  await chat.regenerate();
};

const isPendingAssistantMessage = (message: UIMessage, index: number) =>
  isBusy.value &&
  index === chat.messages.length - 1 &&
  message.role === 'assistant' &&
  (message.parts.length === 0 ||
    message.parts.every(part => part.type === 'text' && !part.text.trim()));

const hasVisibleMessageContent = (message: UIMessage, index: number) =>
  isPendingAssistantMessage(message, index) ||
  message.parts.some(part => part.type !== 'text' || part.text.trim().length > 0);

const usePrompt = (text: string) => {
  input.value = text;
};

const startNewThread = () => {
  threadId.value = `thread-${crypto.randomUUID()}`;
  chat.messages = [];
  chat.clearError();
};

watch(
  () => [chat.messages, chat.status],
  async () => {
    await nextTick();
    messagesEnd.value?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  },
  { deep: true },
);
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
          <span class="status-pill" :class="`status-${status}`" role="status" aria-live="polite">
            <span class="status-dot" aria-hidden="true"></span>
            {{ statusLabel }}
          </span>
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
          v-for="(message, messageIndex) in chat.messages"
          :key="message.id"
          v-show="hasVisibleMessageContent(message, messageIndex)"
          class="message"
          :class="`message-${message.role}`"
        >
          <div class="message-role">{{ message.role }}</div>
          <div class="parts">
            <template
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${index}`"
            >
              <p v-if="part.type === 'text' && part.text" class="text-part">{{ part.text }}</p>
              <MessagePart v-else :part="part" :role="message.role" />
            </template>
            <div v-if="isPendingAssistantMessage(message, messageIndex)" class="thinking-card" role="status">
              <span class="typing-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>Model is getting ready...</span>
            </div>
          </div>
        </article>

        <div v-if="chat.messages.length === 0" class="empty-state">
          <p>Ask for weather, URL metadata, or browser-backed web work.</p>
        </div>

        <article v-if="status === 'submitted'" class="message message-assistant">
          <div class="message-role">assistant</div>
          <div class="parts">
            <div class="thinking-card" role="status">
              <span class="typing-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>Model is getting ready...</span>
            </div>
          </div>
        </article>

        <div ref="messagesEnd" class="messages-end" aria-hidden="true"></div>
      </div>

      <div v-if="error" class="error" role="alert">
        <span>{{ error.message }}</span>
        <button v-if="canRetry" class="inline-button" type="button" @click="retryLastMessage">
          Retry
        </button>
      </div>

      <form class="composer" @submit.prevent="submitMessage">
        <label class="sr-only" for="chat-input">Message</label>
        <textarea
          id="chat-input"
          v-model="input"
          rows="2"
          placeholder="Send a message to Mastra"
          :disabled="isBusy"
          @keydown.enter.exact.prevent="submitMessage"
        />
        <button v-if="isBusy" class="stop-button" type="button" @click="stopResponse">
          Stop
        </button>
        <button v-else type="submit" :disabled="!input.trim()">
          Send
        </button>
      </form>
    </section>
  </main>
</template>
