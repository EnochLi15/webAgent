import { Memory } from '@mastra/memory';

export const sharedAgentMemory = new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      scope: 'resource',
    },
    observationalMemory: true,
  },
});
