export function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}
