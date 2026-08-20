import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const excelPath = path.resolve(__dirname, "../../Vision 2020 Session List.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.log("Vision 2020 Session List.xlsx does not exist");
    return;
  }
  const buf = fs.readFileSync(excelPath);
  const wb = xlsx.read(buf, { type: "buffer" });
  console.log("Sheets in Vision 2020 Session List.xlsx:", wb.SheetNames);
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Sheet "${name}" has ${rows.length} rows`);
  }
}

main();
