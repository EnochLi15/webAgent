import type { OpenAICompatibleConfig } from '@mastra/core/llm';

type OpenAICompatibleModelOptions = {
  defaultModelId?: string;
  modelIdEnvVar?: string;
};

const env = (name: string) => process.env[name]?.trim();

export const createOpenAICompatibleModel = (
  options: OpenAICompatibleModelOptions = {},
): OpenAICompatibleConfig => {
  const providerId = env('CUSTOM_OPENAI_PROVIDER_ID') ?? 'custom-openai';
  const modelId =
    env(options.modelIdEnvVar ?? 'CUSTOM_OPENAI_MODEL') ??
    options.defaultModelId ??
    'gpt-5';
  const url = env('CUSTOM_OPENAI_BASE_URL');
  const apiKey = env('CUSTOM_OPENAI_API_KEY') ?? env('OPENAI_API_KEY');

  if (!url) {
    throw new Error('CUSTOM_OPENAI_BASE_URL is required for the OpenAI-compatible provider.');
  }

  return {
    providerId,
    modelId,
    url,
    apiKey,
  };
};

export const defaultModel = createOpenAICompatibleModel();

export const judgeModel = createOpenAICompatibleModel({
  modelIdEnvVar: 'CUSTOM_OPENAI_JUDGE_MODEL',
  defaultModelId: 'gpt-5-mini',
});
