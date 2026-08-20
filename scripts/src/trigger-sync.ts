import { db } from "@workspace/db";
import { syncSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getGoogleAuthClient, getSpreadsheetRows } from "../../artifacts/api-server/src/lib/googleSheets";

// Recreate the route's helper functions locally for testing
import * as fs from "fs";
import * as path from "path";

// Copy date/role/track mapping helpers from participants.ts
function mapRole(raw: string): string {
  const r = (raw || "").trim().toLowerCase();
  if (r.includes("poster")) return "Poster";
  if (r.includes("co-chair") || r.includes("cochair") || r.includes("co chair")) return "CoChair";
  if (r.includes("panelist") || r.includes("panellist")) return "Panelist";
  if (r.includes("discussion")) return "Discussion";
  if (r.includes("moderator")) return "Moderator";
  if (r.includes("chair")) return "Chair";
  if (r.includes("warp-up") || r.includes("wrap-up")) return "Moderator";
  return "Speaker";
}

function mapDay(day: string | number): string {
  let str = String(day || "").trim();
  if (str === "46214" || str.includes("46214")) return "11-07-2026";
  if (str === "46215" || str.includes("46215")) return "12-07-2026";
  if (!str) return "11-07-2026";
  
  const lower = str.toLowerCase();
  if (lower.includes("day 0") || lower.includes("10th") || lower === "0") return "10-07-2026";
  if (lower.includes("day 1") || lower.includes("11th") || lower === "1") return "11-07-2026";
  if (lower.includes("day 2") || lower.includes("12th") || lower === "2") return "12-07-2026";
  if (lower.includes("day 3")) return "12-07-2026";

  const dmYMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmYMatch) {
    const val1 = parseInt(dmYMatch[1], 10);
    const val2 = parseInt(dmYMatch[2], 10);
    const yyyy = dmYMatch[3];
    let dd = 11;
    if (val2 === 7) dd = val1;
    else if (val1 === 7) dd = val2;
    return `${String(dd).padStart(2, "0")}-07-${yyyy}`;
  }

  const YmdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (YmdMatch) {
    const yyyy = YmdMatch[1];
    const val1 = parseInt(YmdMatch[2], 10);
    const val2 = parseInt(YmdMatch[3], 10);
    let dd = 11;
    if (val1 === 7) dd = val2;
    else if (val2 === 7) dd = val1;
    return `${String(dd).padStart(2, "0")}-07-${yyyy}`;
  }

  const d = new Date(day);
  if (!isNaN(d.getTime())) {
    let dd = d.getDate();
    if (d.getMonth() === 6) dd = d.getDate();
    else if (d.getDate() === 7) dd = d.getMonth() + 1;
    return `${String(dd).padStart(2, "0")}-07-${d.getFullYear()}`;
  }
  return "11-07-2026";
}

function findRowValue(row: Record<string, any>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[\s\r\n\t_]/g, "");
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[\s\r\n\t_]/g, "");
      if (cleanKey === cleanAlias) {
        return String(row[key] ?? "").trim();
      }
    }
  }
  return "";
}

async function run() {
  const [session] = await db.select().from(syncSessionsTable).where(eq(syncSessionsTable.id, 1)).limit(1);
  if (!session) {
    console.error("Session not found");
    return;
  }

  const spreadsheetId = session.googleSheetId.trim();
  const rows = await getSpreadsheetRows(spreadsheetId, "Summary");
  console.log(`Fetched ${rows.length} rows from Google Sheet Summary tab.`);

  const track5Rows = rows.filter(r => {
    const tVal = findRowValue(r, ["track/screen no.", "track/screen", "track", "screen"]);
    return tVal.toLowerCase().includes("track 5");
  });
  console.log("Track 5 sample rows:", track5Rows.slice(0, 5));
}

run().catch(console.error);
