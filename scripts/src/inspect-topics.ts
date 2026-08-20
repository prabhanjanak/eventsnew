import * as xlsx from "xlsx";
import fs from "fs";

async function inspect() {
  const excelPath = "C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\Vision 2020 Session List.xlsx";
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  console.log("Total track rows:", trackRows.length);
  
  let matches = 0;
  for (const [i, row] of trackRows.entries()) {
    const name = String(row["Name"] || "").trim();
    if (!name) continue;
    
    const topic = String(row["Topic"] || "").trim().toLowerCase();
    const timing = String(row["Timing"] || "").trim().toLowerCase();
    const session = String(row["Session Toppic"] || row["Session"] || "").trim().toLowerCase();
    
    // Check if the topic contains "discussion", "q/a", "q & a", "remarks", etc.
    const isDiscussion = topic.includes("discussion") || topic.includes("q&a") || topic.includes("q & a") || topic.includes("remarks") || topic.includes("welcome");
    
    if (isDiscussion) {
      matches++;
      console.log(`[Row ${i + 2}] Track: "${row.Track}" Name: "${row.Name}" Topic: "${row.Topic}" Session: "${row["Session Toppic"] || row.Session}"`);
    }
  }
  console.log("Total discussion-like rows found in Track sheet:", matches);
}

inspect();
