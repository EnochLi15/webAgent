import { LocalFilesystem, LocalSandbox, LocalSkillSource, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';

const projectRoot = process.env.INIT_CWD ?? process.cwd();

export const webAgentWorkspace = new Workspace({
  id: 'web-agent-workspace',
  name: 'Web Agent Workspace',
  filesystem: new LocalFilesystem({
    basePath: projectRoot,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: projectRoot,
  }),
  skills: ['skills'],
  skillSource: new LocalSkillSource({
    basePath: projectRoot,
  }),
  bm25: true,
  autoIndexPaths: ['skills', 'README.md'],
  checkSkillFileMtime: true,
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      requireApproval: true,
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      requireApproval: true,
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
      requireApproval: true,
    },
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      requireApproval: true,
    },
  },
});
