/**
 * JSON column definitions for each table.
 * Used to stringify on write and parse on read.
 */

const JSON_COLUMNS: Record<string, string[]> = {
  users: ["permissions"],
  settings: ["sc_pwd_settings"],
  transactions: ["items", "sc_pwd_metadata"],
  held_orders: ["items", "sc_pwd_draft"],
  sync_queue: ["payload", "resolved_conflict"],
  _meta: ["value"],
};

/**
 * Stringify JSON columns in a row before writing to the database.
 */
export function toJsonRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const columns = JSON_COLUMNS[table];
  if (!columns) return row;

  const result = { ...row };
  for (const col of columns) {
    if (result[col] !== undefined && result[col] !== null) {
      result[col] = JSON.stringify(result[col]);
    }
  }
  return result;
}

/**
 * Parse JSON columns in a row after reading from the database.
 */
export function fromJsonRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const columns = JSON_COLUMNS[table];
  if (!columns) return row;

  const result = { ...row };
  for (const col of columns) {
    if (typeof result[col] === "string" && result[col] !== "") {
      try {
        result[col] = JSON.parse(result[col] as string);
      } catch {
        // leave as-is if not valid JSON
      }
    } else if (result[col] === "" || result[col] === null) {
      // Empty string or null for optional JSON fields should be null/undefined
      if (col !== "permissions" && col !== "items" && col !== "payload") {
        result[col] = undefined;
      }
    }
  }
  return result;
}
