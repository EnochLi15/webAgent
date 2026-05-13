
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/di';
import { registerApiRoute } from '@mastra/core/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { UIMessage } from 'ai';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { webAgent } from './agents/web-agent';
import { getWeather } from './tools/weather-tool';
import { fetchUrlMetadata } from './tools/web-tools';
import { sharedAgentMemory } from './memory/shared-memory';
import { webAgentWorkspace } from './workspaces/web-workspace';
import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer';
import { openClawGateway } from './models/openai-compatible';

type ChatRequestBody = {
  messages?: unknown[];
  memory?: {
    thread?: string;
    resource?: string;
  };
  threadId?: string;
  resourceId?: string;
  requestContext?: Record<string, unknown>;
  [key: string]: unknown;
};

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

const getMessageText = (message: UIMessage) => {
  const partsText = message.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');

  return partsText || '';
};

const toMastraMessages = (messages: UIMessage[]) =>
  messages
    .map((message) => ({
      role: message.role,
      content: getMessageText(message),
    }))
    .filter(
      (message): message is { role: 'system' | 'user' | 'assistant'; content: string } =>
        (message.role === 'system' || message.role === 'user' || message.role === 'assistant') &&
        message.content.length > 0,
    );

const getLatestUserText = (messages: UIMessage[]) => {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  return latestUserMessage ? getMessageText(latestUserMessage) : '';
};

const getWeatherLocation = (text: string) => {
  const beforeWeather = text.match(/([\p{Script=Han}A-Za-z\s,.-]{2,40})(?:的)?天气/u)?.[1]?.trim();
  const location = beforeWeather && !/^(今天|现在|当前|查询|请|帮我)$/u.test(beforeWeather)
    ? beforeWeather.replace(/^(查询|请|帮我看看|帮我查查)/u, '').trim()
    : 'Shanghai';

  const cityTranslations: Record<string, string> = {
    上海: 'Shanghai',
    北京: 'Beijing',
    深圳: 'Shenzhen',
    广州: 'Guangzhou',
    杭州: 'Hangzhou',
    成都: 'Chengdu',
    南京: 'Nanjing',
    苏州: 'Suzhou',
    武汉: 'Wuhan',
    西安: 'Xi An',
    重庆: 'Chongqing',
  };

  for (const [city, translatedCity] of Object.entries(cityTranslations)) {
    if (location.includes(city)) {
      return translatedCity;
    }
  }

  return location;
};

const getManualToolResult = async (text: string) => {
  const url = text.match(/https?:\/\/[^\s"'，。)）]+/u)?.[0];

  if (url) {
    return {
      toolName: 'fetch-url-metadata',
      input: { url },
      output: await fetchUrlMetadata(url),
    };
  }

  if (/天气|weather/i.test(text)) {
    const location = getWeatherLocation(text);

    return {
      toolName: 'get-weather',
      input: { location },
      output: await getWeather(location),
    };
  }

  return undefined;
};

const withManualToolContext = (
  messages: ReturnType<typeof toMastraMessages>,
  toolResult: Awaited<ReturnType<typeof getManualToolResult>>,
) => {
  if (!toolResult || messages.length === 0) {
    return messages;
  }

  const lastMessage = messages[messages.length - 1];

  return [
    ...messages.slice(0, -1),
    {
      ...lastMessage,
      content: `${lastMessage.content}

Structured tool result from ${toolResult.toolName}:
${JSON.stringify(toolResult.output, null, 2)}

Answer the user naturally using the structured tool result. Be concise and do not repeat yourself. Do not call any tools.`,
    },
  ];
};

const removeRepeatedText = (text: string) => {
  const sentences = text
    .split(/(?<=[。！？!?])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueSentences = sentences.filter((sentence) => {
    const normalized = sentence.replace(/\s+/g, '');
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });

  return uniqueSentences.join('');
};

const createChatMemoryContext = (body: ChatRequestBody, baseContext?: RequestContext) => {
  const requestContext = new RequestContext(baseContext?.entries());

  if (body.requestContext && typeof body.requestContext === 'object') {
    for (const [key, value] of Object.entries(body.requestContext)) {
      requestContext.set(key, value);
    }
  }

  const threadId =
    getString(body.threadId) ||
    getString(body.memory?.thread) ||
    getString(body.requestContext?.[MASTRA_THREAD_ID_KEY]);
  const resourceId =
    getString(body.resourceId) ||
    getString(body.memory?.resource) ||
    getString(body.requestContext?.[MASTRA_RESOURCE_ID_KEY]) ||
    'anonymous-user';

  if (threadId) {
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
    requestContext.set('MastraMemory', {
      thread: { id: threadId },
      resourceId,
    });
  }

  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

  return {
    requestContext,
    threadId,
    resourceId,
  };
};

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      registerApiRoute('/chat/:agentId', {
        method: 'POST',
        handler: async (c) => {
          const body = await c.req.json<ChatRequestBody>();
          const messages = (body.messages ?? []) as UIMessage[];
          const manualToolResult = await getManualToolResult(getLatestUserText(messages));
          const memoryContext = createChatMemoryContext(body, c.get('requestContext'));
          const agent = c.get('mastra').getAgentById(c.req.param('agentId'));

          if (!agent) {
            throw new Error(`Agent ${c.req.param('agentId')} not found`);
          }

          const generationMessages = withManualToolContext(toMastraMessages(messages), manualToolResult);
          const generationOptions = {
            maxSteps: 8,
            ...(manualToolResult ? { toolChoice: 'none' as const } : {}),
            abortSignal: c.req.raw.signal,
            requestContext: memoryContext.requestContext,
            ...(memoryContext.threadId
              ? {
                  memory: {
                    thread: memoryContext.threadId,
                    resource: memoryContext.resourceId,
                  },
                }
              : {}),
          };

          const stream = createUIMessageStream({
            originalMessages: messages,
            execute: async ({ writer }) => {
              writer.write({ type: 'start' });

              if (manualToolResult) {
                writer.write({
                  type: manualToolResult.toolName === 'get-weather'
                    ? 'data-weather-card'
                    : 'data-url-metadata-card',
                  id: `manual-${crypto.randomUUID()}`,
                  data: {
                    input: manualToolResult.input,
                    output: manualToolResult.output,
                  },
                });
              }

              const agentResult = await agent.generate(generationMessages, generationOptions);

              const answerText = removeRepeatedText(agentResult.text);

              if (answerText) {
                const textId = `txt-${crypto.randomUUID()}`;
                writer.write({ type: 'start-step' });
                writer.write({ type: 'text-start', id: textId });
                writer.write({ type: 'text-delta', id: textId, delta: answerText });
                writer.write({ type: 'text-end', id: textId });
                writer.write({ type: 'finish-step' });
              }

              writer.write({ type: 'finish', finishReason: 'stop' });
            },
          });

          return createUIMessageStreamResponse({ stream });
        },
      }),
    ],
  },
  workflows: { weatherWorkflow },
  agents: { weatherAgent, webAgent },
  scorers: { toolCallAppropriatenessScorer, completenessScorer, translationScorer },
  memory: { sharedAgentMemory },
  workspace: webAgentWorkspace,
  gateways: {
    openclaw: openClawGateway,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      url: "file:./mastra.db",
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    }
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends observability data to hosted Mastra Studio (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
