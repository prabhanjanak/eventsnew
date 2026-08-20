import * as xlsx from "xlsx";
import fs from "fs";

async function inspect() {
  const excelPath = "C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\Vision 2020 Session List.xlsx";
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  const trackCounts: Record<string, Record<string, number>> = {};

  for (const row of trackRows) {
    const name = String(row["Name"] || "").trim();
    if (!name) continue;
    
    const track = String(row["Track"] || "").trim();
    const topic = String(row["Topic"] || "").trim().toLowerCase();
    
    let role = "Speaker";
    
    // Check if it's Track 5
    if (track.includes("Track 5")) {
      role = "Presenter";
    } else {
      // Check for discussion
      if (topic.includes("discussion") || topic.includes("q&a") || topic.includes("q & a") || topic.includes("remarks") || topic.includes("welcome")) {
        role = "Discussion";
      } else {
        role = "Speaker";
      }
    }
    
    if (!trackCounts[track]) {
      trackCounts[track] = { Speaker: 0, Presenter: 0, Discussion: 0 };
    }
    trackCounts[track][role]++;
  }

  console.log("Track sheet role counts per Track:");
  console.log(trackCounts);
}

inspect();
