---
name: project-agent
description: Use this skill when working inside this Mastra project or explaining how the configured agent stack is wired.
---

# Project Agent

This project exposes a Mastra agent stack with:

- `webAgent`: general web automation, custom tools, memory, workspace, and skills.
- `weatherAgent`: weather-specific assistant and weather eval scorers.
- `weatherWorkflow`: fetches forecast data and asks the weather agent to plan activities.

## Local Conventions

- Mastra source lives under `src/mastra`.
- Custom tools live under `src/mastra/tools`.
- Agents live under `src/mastra/agents`.
- Workspace skills live under `skills/*/SKILL.md`.
- The Mastra Studio/dev server is started with `npm run dev`.

## Integration Notes

- Memory is shared through `sharedAgentMemory`.
- Workspace access is configured in `webAgentWorkspace`.
- Browser automation is provided by `@mastra/agent-browser`.
