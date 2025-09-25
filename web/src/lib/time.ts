import 'server-only';

// Small helper to time HTTP handlers
export function timeHttp(path: string, method: string) {
  const t0 = process.hrtime.bigint();
  return (status?: number) => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    // eslint-disable-next-line no-console
    console.log(`[http] ${method} ${path}${status ? ' ' + status : ''} ${ms.toFixed(1)}ms`);
  };
}
