import { Agent } from '@mastra/core/agent';
import { browser } from '../browsers/agent-browser';
import { sharedAgentMemory } from '../memory/shared-memory';
import { weatherTool } from '../tools/weather-tool';
import { fetchUrlMetadataTool } from '../tools/web-tools';
import { webAgentWorkspace } from '../workspaces/web-workspace';

export const webAgent = new Agent({
  id: 'web-agent',
  name: 'Web Agent',
  description: 'A general-purpose web automation agent with browser control, project skills, tools, and memory.',
  instructions: `You are a practical web automation assistant.

You can:
- Call structured tools for weather and URL metadata.
- Use browser tools to navigate pages, inspect snapshots, click, type, scroll, and extract page information.
- Use workspace tools to read project files, search indexed content, and load reusable skills.
- Remember user preferences and project context through memory when resource and thread identifiers are provided.

When browser automation is needed, navigate first, inspect the page snapshot, then act on stable element references.
When a task can be answered by a structured tool without opening a browser, prefer the tool.
When skills are available, load the relevant skill before doing specialized project or browser work.
Ask for confirmation before destructive workspace or external actions.`,
  model: 'openai/gpt-5',
  tools: {
    weatherTool,
    fetchUrlMetadataTool,
  },
  memory: sharedAgentMemory,
  workspace: webAgentWorkspace,
  browser,
});
