<script setup lang="ts">
import type { UIMessage } from 'ai';
import { computed, ref } from 'vue';
import MessagePart from './components/MessagePart.vue';

const input = ref('上海天气怎么样？');
const agentId = ref<'web-agent' | 'weather-agent'>('web-agent');
const threadId = ref(`thread-${crypto.randomUUID()}`);
const resourceId = ref('local-user');
const messages = ref<UIMessage[]>([]);
const status = ref<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
const error = ref<Error | undefined>();

const isBusy = computed(() => status.value === 'submitted' || status.value === 'streaming');

let queuedText = '';
let textDrainTimer: ReturnType<typeof setTimeout> | undefined;
let resolveTextDrain: (() => void) | undefined;

const appendAssistantPart = (part: UIMessage['parts'][number]) => {
  const assistant = messages.value[messages.value.length - 1];

  if (!assistant || assistant.role !== 'assistant') {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [part],
    });
    return;
  }

  assistant.parts = [...assistant.parts, part];
};

const appendTextDelta = (delta: string) => {
  const assistant = messages.value[messages.value.length - 1];
  const lastPart = assistant?.parts[assistant.parts.length - 1];

  if (assistant?.role === 'assistant' && lastPart?.type === 'text') {
    lastPart.text += delta;
    messages.value = [...messages.value];
    return;
  }

  appendAssistantPart({ type: 'text', text: delta });
};

const drainQueuedText = () => {
  if (!queuedText) {
    textDrainTimer = undefined;
    resolveTextDrain?.();
    resolveTextDrain = undefined;
    return;
  }

  const characters = Array.from(queuedText);
  appendTextDelta(characters.slice(0, 2).join(''));
  queuedText = characters.slice(2).join('');
  textDrainTimer = setTimeout(drainQueuedText, 16);
};

const enqueueTextDelta = (delta: string) => {
  queuedText += delta;

  if (!textDrainTimer) {
    drainQueuedText();
  }
};

const waitForTextDrain = async () => {
  if (!queuedText && !textDrainTimer) {
    return;
  }

  await new Promise<void>((resolve) => {
    resolveTextDrain = resolve;
  });
};

const resetTextDrain = () => {
  queuedText = '';
  resolveTextDrain?.();
  resolveTextDrain = undefined;

  if (textDrainTimer) {
    clearTimeout(textDrainTimer);
    textDrainTimer = undefined;
  }
};

const handleStreamChunk = (chunk: Record<string, unknown>) => {
  if (chunk.type === 'start') {
    resetTextDrain();
    status.value = 'streaming';
    messages.value.push({
      id: typeof chunk.messageId === 'string' ? chunk.messageId : crypto.randomUUID(),
      role: 'assistant',
      parts: [],
    });
    return;
  }

  if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
    enqueueTextDelta(chunk.delta);
    return;
  }

  if (typeof chunk.type === 'string' && chunk.type.startsWith('data-')) {
    appendAssistantPart(chunk as UIMessage['parts'][number]);
    return;
  }

  if (chunk.type === 'error') {
    throw new Error(typeof chunk.errorText === 'string' ? chunk.errorText : 'Chat stream failed');
  }
};

const readChatStream = async (response: Response) => {
  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const line = event
        .split('\n')
        .find((entry) => entry.startsWith('data: '));

      if (!line) {
        continue;
      }

      const payload = line.slice(6);
      if (payload === '[DONE]') {
        return;
      }

      handleStreamChunk(JSON.parse(payload) as Record<string, unknown>);
    }
  }
};

const submitMessage = async () => {
  const text = input.value.trim();
  if (!text || isBusy.value) {
    return;
  }

  input.value = '';
  error.value = undefined;
  status.value = 'submitted';
  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text }],
  });

  try {
    await readChatStream(
      await fetch(`/chat/${agentId.value}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [messages.value[messages.value.length - 1]],
          memory: {
            thread: threadId.value,
            resource: resourceId.value,
          },
        }),
      }),
    );
    await waitForTextDrain();
    status.value = 'ready';
  } catch (caught) {
    resetTextDrain();
    error.value = caught instanceof Error ? caught : new Error('Chat request failed');
    status.value = 'error';
  }
};

const usePrompt = (text: string) => {
  input.value = text;
};

const startNewThread = () => {
  resetTextDrain();
  threadId.value = `thread-${crypto.randomUUID()}`;
  messages.value = [];
  error.value = undefined;
  status.value = 'ready';
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
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="`message-${message.role}`"
        >
          <div class="message-role">{{ message.role }}</div>
          <div class="parts">
            <MessagePart
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${index}`"
              :part="part"
              :role="message.role"
            />
          </div>
        </article>

        <div v-if="messages.length === 0" class="empty-state">
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
