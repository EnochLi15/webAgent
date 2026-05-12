import { AgentBrowser } from '@mastra/agent-browser';

export const browser = new AgentBrowser({
  headless: process.env.BROWSER_HEADLESS === 'true',
});
