import {
  MastraModelGateway,
  type GatewayLanguageModel,
  type ProviderConfig,
} from '@mastra/core/llm';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';

type OpenAICompatibleModelOptions = {
  defaultModelId?: string;
  modelIdEnvVar?: string;
};

const gatewayId = 'openclaw';

const env = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value || value.startsWith('your-')) {
    return undefined;
  }

  return value;
};

const getProviderId = () => env('CUSTOM_OPENAI_PROVIDER_ID') ?? 'local';

const getModelId = (options: OpenAICompatibleModelOptions = {}) =>
  env(options.modelIdEnvVar ?? 'CUSTOM_OPENAI_MODEL') ??
  options.defaultModelId ??
  'gpt-5';

const getBaseUrl = () => env('CUSTOM_OPENAI_BASE_URL') ?? env('OPENAI_BASE_URL');

const getApiKey = () => env('CUSTOM_OPENAI_API_KEY') ?? env('OPENAI_API_KEY') ?? '';

export const createOpenAICompatibleModel = (
  options: OpenAICompatibleModelOptions = {},
): string => {
  const providerId = getProviderId();
  const modelId = getModelId(options);
  const url = getBaseUrl();

  if (!url) {
    throw new Error('CUSTOM_OPENAI_BASE_URL or OPENAI_BASE_URL is required for the OpenAI-compatible provider.');
  }

  return `${gatewayId}/${providerId}/${modelId}`;
};

export const defaultModel = createOpenAICompatibleModel();

export const judgeModel = createOpenAICompatibleModel({
  modelIdEnvVar: 'CUSTOM_OPENAI_JUDGE_MODEL',
  defaultModelId: 'gpt-5-mini',
});

export class OpenClawGateway extends MastraModelGateway {
  readonly id = gatewayId;
  readonly name = 'OpenClaw Local Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const providerId = getProviderId();
    const models = Array.from(
      new Set([
        getModelId(),
        getModelId({
          modelIdEnvVar: 'CUSTOM_OPENAI_JUDGE_MODEL',
          defaultModelId: getModelId(),
        }),
      ]),
    );

    return {
      [providerId]: {
        name: 'OpenClaw Local',
        models,
        apiKeyEnvVar: ['CUSTOM_OPENAI_API_KEY', 'OPENAI_API_KEY'],
        gateway: this.id,
        url: getBaseUrl(),
      },
    };
  }

  buildUrl(): string | undefined {
    return getBaseUrl();
  }

  async getApiKey(): Promise<string> {
    return getApiKey();
  }

  resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): GatewayLanguageModel {
    const baseURL = this.buildUrl();

    if (!baseURL) {
      throw new Error('CUSTOM_OPENAI_BASE_URL or OPENAI_BASE_URL is required for the OpenAI-compatible provider.');
    }

    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
      headers,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}

export const openClawGateway = new OpenClawGateway();
