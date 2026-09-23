import { NextResponse } from "next/server";
import { loadContractors } from "@/lib/csv";
import { matchContractors } from "@/lib/matcher";
import { improveExplanations } from "@/lib/ai-explanations.server";
import type { MatchRequest } from "@/lib/types";

function validate(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "Нужен объект с параметрами события.";
  }
  const value = input as Record<string, unknown>;
  if (["city", "date", "eventFormat", "category"].some((key) =>
    typeof value[key] !== "string" || !(value[key] as string).trim() || (value[key] as string).length > 120)) {
    return "Заполните город, дату, формат и категорию.";
  }
  const date = value.date as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return "Укажите существующую дату в формате ГГГГ-ММ-ДД.";
  }
  if (typeof value.budgetKzt !== "number" || !Number.isFinite(value.budgetKzt) || value.budgetKzt <= 0) {
    return "Бюджет должен быть положительным числом.";
  }
  if (value.durationHours !== undefined && (typeof value.durationHours !== "number" ||
    !Number.isFinite(value.durationHours) || value.durationHours <= 0)) {
    return "Длительность должна быть положительным числом.";
  }
  if (value.language !== undefined && (typeof value.language !== "string" || value.language.length > 120)) {
    return "Язык должен быть строкой.";
  }
  return null;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const input: unknown = await request.json();
    const validationError = validate(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const validInput = input as MatchRequest;
    const contractors = await loadContractors();
    const matched = matchContractors(contractors, validInput);
    const result = await improveExplanations(matched, validInput);
    return NextResponse.json({ ...result, elapsedMs: Math.round(performance.now() - startedAt) });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось обработать запрос." }, { status: 500 });
  }
}
