import { NextResponse } from "next/server";
import { loadContractors } from "@/lib/csv";
import { matchContractors } from "@/lib/matcher";
import type { MatchRequest } from "@/lib/types";

function validate(input: Partial<MatchRequest>): string | null {
  if (!input.city || !input.date || !input.eventFormat || !input.category) {
    return "Заполните город, дату, формат и категорию.";
  }
  if (!Number.isFinite(input.budgetKzt) || Number(input.budgetKzt) <= 0) {
    return "Бюджет должен быть положительным числом.";
  }
  if (input.durationHours !== undefined && (!Number.isFinite(input.durationHours) || input.durationHours <= 0)) {
    return "Длительность должна быть положительным числом.";
  }
  return null;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const input = (await request.json()) as Partial<MatchRequest>;
    const validationError = validate(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const contractors = await loadContractors();
    const result = matchContractors(contractors, input as MatchRequest);
    return NextResponse.json({ ...result, elapsedMs: Math.round(performance.now() - startedAt) });
  } catch {
    return NextResponse.json({ error: "Не удалось обработать запрос." }, { status: 500 });
  }
}
