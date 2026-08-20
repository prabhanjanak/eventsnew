import { db, submissionSettingsTable } from '@workspace/db'; async function run() { const s = await db.select().from(submissionSettingsTable).limit(1); console.log(s); process.exit(0); } run();
