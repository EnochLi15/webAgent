import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const textFromMatch = (html: string, pattern: RegExp) => html.match(pattern)?.[1]?.trim() ?? '';

export const fetchUrlMetadata = async (url: string) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'MastraWebAgent/1.0',
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const html = contentType.includes('text/html') ? await response.text() : '';

  return {
    url,
    finalUrl: response.url,
    status: response.status,
    contentType,
    title: textFromMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description:
      textFromMatch(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i) ||
      textFromMatch(html, /<meta\s+content=["']([^"']*)["']\s+name=["']description["'][^>]*>/i),
  };
};

export const fetchUrlMetadataTool = createTool({
  id: 'fetch-url-metadata',
  description: 'Fetch a URL and return basic metadata such as status, title, description, and content type.',
  inputSchema: z.object({
    url: z.string().url().describe('The HTTP or HTTPS URL to inspect'),
  }),
  outputSchema: z.object({
    url: z.string(),
    finalUrl: z.string(),
    status: z.number(),
    contentType: z.string(),
    title: z.string(),
    description: z.string(),
  }),
  execute: async ({ url }) => fetchUrlMetadata(url),
});
