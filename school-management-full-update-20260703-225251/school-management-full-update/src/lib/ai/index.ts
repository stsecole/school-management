// ===== Barrel file for AI module =====

export * from './types';
export * from './provider';
export * from './context';
export * from './router';
export { QUERY_TOOLS, getQueryTool, runQuery } from './tools/queries';
export {
  ACTIONS,
  getAction,
  canExecute,
  executeAction,
  logAudit,
  actionToBlock,
} from './tools/actions';

export type { ActionDef } from './tools/actions';
export type { QueryTool } from './tools/queries';
