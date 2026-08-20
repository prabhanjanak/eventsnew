import { db, submissionSettingsTable } from "@workspace/db";
import { google } from "googleapis";

export async function getGoogleAuthClient() {
  const [settings] = await db.select().from(submissionSettingsTable).limit(1);
  if (!settings || !settings.googleServiceAccountEmail || !settings.googleServiceAccountKey) {
    return null;
  }
  const email = settings.googleServiceAccountEmail.trim();
  let key = settings.googleServiceAccountKey.trim();
  // Ensure the private key has correct newline characters
  key = key.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
  });
}

export async function getSpreadsheetSheets(spreadsheetId: string): Promise<string[]> {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    throw new Error("Google Service Account credentials not configured.");
  }
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  return (response.data.sheets || []).map(s => s.properties?.title || "").filter(Boolean);
}

export async function getSpreadsheetRows(spreadsheetId: string, sheetName: string): Promise<Record<string, any>[]> {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    throw new Error("Google Service Account credentials not configured.");
  }
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z5000`,
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  // Find the header row (first row that contains "name", "full name", etc.)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (row && Array.isArray(row)) {
      const hasName = row.some(cell => {
        const val = String(cell || "").toLowerCase().trim();
        return val === "name" || val === "full name" || val === "presenter" || val === "poster no." || val === "poster no";
      });
      if (hasName) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headers = rows[headerRowIndex].map(h => String(h || "").trim());
  const parsedRows: Record<string, any>[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => cell === null || cell === undefined || cell === "")) {
      continue;
    }
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        obj[header] = row[j] !== undefined ? row[j] : "";
      }
    }
    parsedRows.push(obj);
  }
  return parsedRows;
}

export async function updateSpreadsheetParticipant(
  spreadsheetId: string,
  sheetName: string,
  participantName: string,
  updatedFields: { mobile?: string; email?: string }
): Promise<boolean> {
  try {
    const auth = await getGoogleAuthClient();
    if (!auth) return false;

    const sheets = google.sheets({ version: "v4", auth });
    
    // 1. Fetch the entire sheet values to find the matching row and columns
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z5000`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return false;

    // Find header row and index of "Name", "Mobile"/"Phone", and "Email" columns
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (row && Array.isArray(row)) {
        const hasName = row.some(cell => {
          const val = String(cell || "").toLowerCase().trim();
          return val === "name" || val === "full name" || val === "presenter";
        });
        if (hasName) {
          headerRowIndex = i;
          break;
        }
      }
    }

    const headers = rows[headerRowIndex].map(h => String(h || "").trim().toLowerCase().replace(/[\s\r\n\t_]/g, ""));
    
    // Helper to find the clean matched column index
    const findColIndex = (aliases: string[]) => {
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[\s\r\n\t_]/g, "");
        const idx = headers.indexOf(cleanAlias);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const nameColIdx = findColIndex(["name", "fullname", "delegatename"]);
    const emailColIdx = findColIndex(["email", "mail", "emailid"]);
    const mobileColIdx = findColIndex(["mobile", "phone", "phonenumber", "mobilenumber", "phoneno"]);

    if (nameColIdx === -1) return false;

    // Clean matched function for names
    const getCleanMatchName = (n: string) => {
      return n.trim()
        .toLowerCase()
        .replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const searchClean = getCleanMatchName(participantName);

    // 2. Search for the row index
    let matchedRowIndex = -1;
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row[nameColIdx] === undefined) continue;
      
      const rowNameClean = getCleanMatchName(String(row[nameColIdx]));
      if (rowNameClean === searchClean) {
        matchedRowIndex = i;
        break;
      }
    }

    if (matchedRowIndex === -1) {
      console.log(`[Google Sheets Write-back] Could not find row for participant "${participantName}"`);
      return false;
    }

    // Helper to get Excel column letter (supports single letters like A-Z, handles AA, AB, etc. if needed)
    const getColLetter = (index: number): string => {
      let temp = index;
      let letter = "";
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    // 3. Update the specific cells
    const promises: Promise<any>[] = [];

    const updateCell = async (colIdx: number, val: string) => {
      const colLetter = getColLetter(colIdx);
      const cellRange = `${sheetName}!${colLetter}${matchedRowIndex + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRange,
        valueInputOption: "RAW",
        requestBody: {
          values: [[val]],
        },
      });
    };

    if (updatedFields.mobile && mobileColIdx !== -1) {
      promises.push(updateCell(mobileColIdx, updatedFields.mobile));
    }
    if (updatedFields.email && emailColIdx !== -1) {
      promises.push(updateCell(emailColIdx, updatedFields.email));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log(`[Google Sheets Write-back] Successfully updated "${participantName}" in Sheet:`, updatedFields);
      return true;
    }
  } catch (err: any) {
    console.error("[Google Sheets Write-back] Failed to update cell values:", err.message);
  }
  return false;
}
