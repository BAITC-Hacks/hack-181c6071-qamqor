import type {
  Contractor,
  ContractorMatch,
  MatchFacts,
  MatchRequest,
  MatchResponse,
} from "./types";

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU");
const includes = (items: string[], requested: string) =>
  items.some((item) => normalize(item) === normalize(requested));

function descriptionEvidence(contractor: Contractor, request: MatchRequest) {
  const words = contractor.description
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 5);
  const requested = [request.eventFormat, request.category, request.language ?? ""]
    .flatMap((part) => part.split(/\s+/))
    .map(normalize);
  return words.find((word) => requested.includes(normalize(word)));
}

function score(contractor: Contractor, request: MatchRequest, facts: MatchFacts) {
  const budgetRatio = Math.max(0, facts.withinBudgetByKzt / request.budgetKzt);
  const budgetScore = Math.min(30, Math.round(budgetRatio * 30));
  const languageScore = request.language ? 20 : 0;
  const durationScore = request.durationHours && contractor.maxHours
    ? Math.min(10, contractor.maxHours - request.durationHours + 5)
    : 0;
  const evidenceScore = facts.evidence ? 20 : 0;
  const completenessScore = contractor.cityImputed || contractor.priceImputed ? 5 : 10;
  return budgetScore + languageScore + durationScore + evidenceScore + completenessScore;
}

function explain(match: Omit<ContractorMatch, "explanation">) {
  const { contractor, facts } = match;
  const parts = [
    `Свободен на выбранную дату и берёт формат «${facts.eventFormat}».`,
    `Цена от ${contractor.priceFromKzt.toLocaleString("ru-RU")} ₸ — на ${facts.withinBudgetByKzt.toLocaleString("ru-RU")} ₸ ниже бюджета.`,
  ];
  if (facts.language) parts.push(`Работает на языке: ${facts.language}.`);
  if (facts.maxHours) parts.push(`Может работать до ${facts.maxHours} ч.`);
  if (facts.evidence) parts.push(`В описании найден релевантный признак: «${facts.evidence}».`);
  return parts.slice(0, 3).join(" ");
}

export function matchContractors(
  contractors: Contractor[],
  request: MatchRequest,
): Omit<MatchResponse, "elapsedMs"> {
  const inCity = contractors.filter((item) => normalize(item.city) === normalize(request.city));
  const inCategory = inCity.filter((item) => includes(item.categories, request.category));

  if (inCategory.length === 0) {
    return {
      outcome: "NO_CATEGORY_IN_CITY",
      matches: [],
      rejectionSummary: {},
      message: `В городе ${request.city} нет подрядчиков категории «${request.category}».`,
      algorithmVersion: "v1",
    };
  }

  const rejected: Record<string, number> = { busy: 0, budget: 0, format: 0, language: 0, duration: 0 };
  const accepted: ContractorMatch[] = [];

  for (const contractor of inCategory) {
    let reason: keyof typeof rejected | undefined;
    if (contractor.busyDates.includes(request.date)) reason = "busy";
    else if (contractor.priceFromKzt > request.budgetKzt) reason = "budget";
    else if (!includes(contractor.eventFormats, request.eventFormat)) reason = "format";
    else if (request.language && !includes(contractor.languages, request.language)) reason = "language";
    else if (
      request.durationHours &&
      contractor.maxHours !== null &&
      contractor.maxHours < request.durationHours
    ) reason = "duration";

    if (reason) {
      rejected[reason] += 1;
      continue;
    }

    const facts: MatchFacts = {
      withinBudgetByKzt: request.budgetKzt - contractor.priceFromKzt,
      eventFormat: request.eventFormat,
      language: request.language,
      maxHours: contractor.maxHours ?? undefined,
      evidence: descriptionEvidence(contractor, request),
    };
    const base = { contractor, facts, score: score(contractor, request, facts) };
    accepted.push({ ...base, explanation: explain(base) });
  }

  accepted.sort((left, right) => right.score - left.score || left.contractor.id.localeCompare(right.contractor.id));
  const matches = accepted.slice(0, 3);

  if (matches.length === 0) {
    return {
      outcome: "NO_ELIGIBLE",
      matches: [],
      rejectionSummary: rejected,
      message: "Кандидаты в этой категории есть, но все исключены условиями запроса.",
      algorithmVersion: "v1",
    };
  }

  return {
    outcome: "MATCHED",
    matches,
    rejectionSummary: rejected,
    message: matches.length < 3
      ? `Нашлось только ${matches.length}: остальные кандидаты не прошли условия.`
      : "Подобраны три наиболее подходящих подрядчика.",
    algorithmVersion: "v1",
  };
}
