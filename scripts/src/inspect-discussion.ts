import * as xlsx from "xlsx";
import fs from "fs";

async function inspect() {
  const excelPath = "C:\\Users\\HP\\OneDrive - Sri Kanchi Kamakoti Medical Trust\\vision2020v1\\v1\\vision2020-project\\Vision 2020 Session List.xlsx";
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });

  const chairSheet = wb.Sheets["Chair-Co-Chair"];
  const chairRows = xlsx.utils.sheet_to_json<Record<string, any>>(chairSheet, { defval: "" });

  const roles = new Set<string>();
  for (const row of chairRows) {
    roles.add(String(row["Role"] || "").trim());
  }
  console.log("Unique roles in Chair-Co-Chair sheet:", [...roles]);
}

inspect();
