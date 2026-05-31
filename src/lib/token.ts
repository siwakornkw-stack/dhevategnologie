import { createHash } from 'crypto';

// Verification/reset tokens are stored hashed at rest so a DB read leak
// (backup, logs, SQL injection) cannot expose live, usable tokens.
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
