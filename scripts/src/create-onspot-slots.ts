import { db, participantsTable } from "@workspace/db";
import { like } from "drizzle-orm";

async function run() {
  console.log("Generating 1000 blank on-spot slots...");

  try {
    const existing = await db
      .select({ registrationNumber: participantsTable.registrationNumber })
      .from(participantsTable)
      .where(like(participantsTable.registrationNumber, "V2020-OS%"));

    let maxIndex = 0;
    for (const r of existing) {
      const parts = r.registrationNumber.split("-OS");
      if (parts.length === 2) {
        const idx = parseInt(parts[1], 10);
        if (!isNaN(idx) && idx > maxIndex) {
          maxIndex = idx;
        }
      }
    }

    console.log(`Current max index is ${maxIndex}. Generating slots from ${maxIndex + 1} to ${maxIndex + 1000}...`);

    const count = 1000;
    const batchSize = 100;
    
    for (let batchStart = 1; batchStart <= count; batchStart += batchSize) {
      const rowsToInsert = [];
      const batchEnd = Math.min(batchStart + batchSize - 1, count);
      
      for (let i = batchStart; i <= batchEnd; i++) {
        const index = maxIndex + i;
        const regNumber = `V2020-OS${String(index).padStart(5, "0")}`;
        rowsToInsert.push({
          registrationNumber: regNumber,
          name: "On Spot Slot",
          email: `onspot${index}@vision2020india.org`,
          mobile: `OS${String(index).padStart(5, "0")}`,
          institution: "On Spot Slot Assigned",
          isOnSpot: true,
          isOnSpotLinked: false,
          isOnSpotOnboarded: false,
        });
      }

      await db.insert(participantsTable).values(rowsToInsert);
      console.log(`Inserted batch V2020-OS${String(maxIndex + batchStart).padStart(5, "0")} to V2020-OS${String(maxIndex + batchEnd).padStart(5, "0")}`);
    }

    console.log("Successfully created 1000 slots!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create slots:", err);
    process.exit(1);
  }
}

run();
