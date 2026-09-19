/**
 * Charge .env AVANT l'évaluation des décorateurs de modules
 * (les arguments de @Module sont évalués à l'import, avant ConfigModule).
 * Doit être importé en premier dans main.ts et les modules sensibles.
 */
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').trim();
    }
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || 'shield-dev-secret';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
