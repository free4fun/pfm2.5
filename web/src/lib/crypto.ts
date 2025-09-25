import 'server-only';
import { createHash } from 'crypto';

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
