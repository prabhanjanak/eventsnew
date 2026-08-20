import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const excelPath = path.resolve(__dirname, "../../v2020finalcleaned.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.log("v2020finalcleaned.xlsx does not exist");
    return;
  }
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });
  console.log("Sheets in v2020finalcleaned.xlsx:", wb.SheetNames);
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Sheet "${name}" has ${rows.length} rows`);
  }
}

main();
