import * as xlsx from "xlsx";
import fs from "fs";

const filePath = "c:/Users/HP/OneDrive - Sri Kanchi Kamakoti Medical Trust/vision2020v1/v1/vision2020-project/Vision 2020 Session List 19062026.xlsx";

try {
  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type: "buffer" });
  console.log("Sheet Names:", wb.SheetNames);
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Sheet "${name}" has ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log(`Sample row from "${name}":`, rows[0]);
    }
  }
} catch (err) {
  console.error("Error reading file:", err);
}
