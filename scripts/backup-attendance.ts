/**
 * Step 1: Backup existing attendance data BEFORE schema change
 * Saves to a JSON file we can restore from after migration
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const db = new PrismaClient();

async function main() {
  console.log('📦 Backing up attendance data...');
  
  const records = await db.$queryRaw<Array<any>>`SELECT * FROM Attendance`;
  console.log(`→ Backed up ${records.length} records`);
  
  const backupPath = '/home/z/my-project/scripts/attendance-backup.json';
  fs.writeFileSync(backupPath, JSON.stringify(records, null, 2));
  console.log(`✅ Saved to ${backupPath}`);
  
  // Print sample
  if (records.length > 0) {
    console.log('\nSample record:');
    console.log(JSON.stringify(records[0], null, 2));
  }
  
  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ Backup failed:', e);
  process.exit(1);
});
