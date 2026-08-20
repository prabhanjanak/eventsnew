import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function inspect() {
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List.xlsx");
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const trackSheet = wb.Sheets["Track"];
  const trackRows = xlsx.utils.sheet_to_json<Record<string, any>>(trackSheet, { defval: "" });

  const candidates: any[] = [];
  for (const [idx, row] of trackRows.entries()) {
    const name = String(row.Name || "").trim();
    if (!name) continue;
    const track = String(row.Track).trim();
    if (track.includes("Track 5")) continue;

    // Check if name is Roche or IAPB Team to ignore them
    if (name === "Roche" || name === "IAPB Team") continue;

    const topic = String(row.Topic || "").trim().toLowerCase();
    const session = String(row["Session Toppic"] || row.Session || "").trim().toLowerCase();
    const cleanName = name.toLowerCase();

    // Check if the row could be a discussion
    let possible = false;
    let matchType = "";

    if (topic.includes("discussion") || topic.includes("panel")) {
      possible = true;
      matchType = "discussion/panel";
    } else if (topic.includes("q&a") || topic.includes("q & a") || topic.includes("q and a")) {
      possible = true;
      matchType = "q&a";
    } else if (topic.includes("remarks") || topic.includes("welcome")) {
      possible = true;
      matchType = "remarks/welcome";
    } else if (topic.includes("wrap up") || topic.includes("wrap-up")) {
      possible = true;
      matchType = "wrap-up";
    } else if (topic === "key note" || topic === "keynote") {
      possible = true;
      matchType = "keynote-exact";
    } else if (topic.includes("keynote address") || topic.includes("key note address")) {
      possible = true;
      matchType = "keynote-address";
    } else if (cleanName.includes("moderator") || cleanName.includes("panelist")) {
      possible = true;
      matchType = "name-role";
    }

    if (possible) {
      candidates.push({
        row: idx + 2,
        track,
        name,
        topic: row.Topic,
        session: row["Session Toppic"] || row.Session,
        matchType
      });
    }
  }

  // Group candidates by track
  const tracks = ["Track 1", "Track 2", "Track 3", "Track 4"];
  for (const t of tracks) {
    console.log(`\n=== Candidates for ${t} ===`);
    const list = candidates.filter(c => c.track === t);
    for (const c of list) {
      console.log(`Row ${c.row}: Name="${c.name}" Topic="${c.topic}" MatchType="${c.matchType}"`);
    }
    console.log(`Total candidates: ${list.length}`);
  }
}

inspect();
