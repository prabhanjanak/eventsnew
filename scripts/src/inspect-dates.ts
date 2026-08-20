import { db, assignmentsTable } from "@workspace/db";

async function run() {
  const rows = await db.select().from(assignmentsTable);
  console.log("Total assignment rows:", rows.length);
  const dates = [...new Set(rows.map(r => r.date))];
  console.log("Distinct dates in DB:", dates);

  // Print first few assignments for each date
  for (const date of dates) {
    const matching = rows.filter(r => r.date === date);
    console.log(`\nDate: "${date}" has ${matching.length} rows. Samples:`);
    console.log(matching.slice(0, 3).map(m => ({
      id: m.id,
      track: m.track,
      sessionName: m.sessionName,
      time: m.time,
      role: m.role
    })));
  }
}

run()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
