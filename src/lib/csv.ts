import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Contractor } from "./types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const splitList = (value: string) =>
  value.split("|").map((item) => item.trim()).filter(Boolean);

const asBoolean = (value: string) => value.trim().toLowerCase() === "true";

export async function loadContractors(): Promise<Contractor[]> {
  const filename = path.join(process.cwd(), "data", "hackathon-dataset-anonymized.csv");
  const text = await readFile(filename, "utf8");
  const [header, ...data] = parseCsv(text.replace(/^\uFEFF/, ""));
  const columns = new Map(header.map((name, index) => [name.trim(), index]));
  const value = (row: string[], name: string) => row[columns.get(name) ?? -1] ?? "";

  return data.map((row) => ({
    id: value(row, "id"),
    name: value(row, "anon_name"),
    categories: splitList(value(row, "categories")),
    city: value(row, "city"),
    cityImputed: asBoolean(value(row, "city_imputed")),
    synthetic: asBoolean(value(row, "synthetic")),
    priceFromKzt: Number(value(row, "price_from_kzt")),
    priceImputed: asBoolean(value(row, "price_imputed")),
    eventFormats: splitList(value(row, "event_formats")),
    languages: splitList(value(row, "languages")),
    maxHours: value(row, "max_hours") ? Number(value(row, "max_hours")) : null,
    busyDates: splitList(value(row, "busy_dates")),
    description: value(row, "description"),
  }));
}
