export type CiComparison =
  | { initialPush: false; baseRevision: string; diffArguments: [string] }
  | { initialPush: true; baseRevision: null; diffArguments: [string, string] };

export function ciComparison(
  baseRevision: string | undefined,
  options?: { cwd?: string | URL; env?: NodeJS.ProcessEnv },
): CiComparison;
