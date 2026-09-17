/** Initialise (ou réinitialise avec --reset) la base de données Shield. */
import { getConnection, resetDatabase } from '../src/database/connection';

if (process.argv.includes('--reset')) {
  getConnection();
  resetDatabase();
  console.log('🔄 Base de données réinitialisée.');
} else {
  getConnection();
  console.log('✅ Base de données initialisée (schéma vérifié).');
}
