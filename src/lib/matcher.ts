import type {
  Contractor,
  ContractorMatch,
  MatchFacts,
  MatchRequest,
  MatchResponse,
  SearchAlternative,
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

function profileDetail(description: string): string | undefined {
  const experience = description.match(/(более\s+)?(\d{1,2})\s+лет(?!\p{L})/iu);
  if (experience) {
    return `в анкете указан опыт ${experience[1] ? "более " : ""}${experience[2]} лет`;
  }
  if (/авторск\p{L}*\s+цветочн\p{L}*\s+оформлен/iu.test(description)) {
    return "в анкете описано авторское цветочное оформление";
  }
  if (/импровизац/iu.test(description)) {
    return "в анкете упомянута импровизация";
  }
  if (/интерактив/iu.test(description)) {
    return "в анкете упомянуты интерактивы";
  }
  if (/вокал/iu.test(description)) {
    return "в анкете указан вокал";
  }
  return undefined;
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
  let fit = `Свободен на выбранную дату и берёт формат «${facts.eventFormat}»`;
  if (facts.language) fit += `, работает на языке: ${facts.language}`;
  if (facts.maxHours) fit += `, может работать до ${facts.maxHours} ч`;
  if (facts.profileDetail) fit += `; ${facts.profileDetail}`;
  const price = `Цена от ${contractor.priceFromKzt.toLocaleString("ru-RU")} ₸ — на ${facts.withinBudgetByKzt.toLocaleString("ru-RU")} ₸ ниже бюджета`;
  return `${fit}. ${price}.`;
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
      profileDetail: profileDetail(contractor.description),
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

// Alternatives are separate requests. Every suggestion changes just one field and
// passes the same strict matcher; unavailable contractors never enter the result.
export function suggestAlternatives(contractors: Contractor[], request: MatchRequest): SearchAlternative[] {
  const alternatives: SearchAlternative[] = [];
  const base: MatchRequest = {
    city: request.city, date: request.date, eventFormat: request.eventFormat,
    category: request.category, budgetKzt: request.budgetKzt,
    ...(request.language ? { language: request.language } : {}),
    ...(request.durationHours ? { durationHours: request.durationHours } : {}),
  };
  const add = (kind: SearchAlternative["kind"], label: string, changes: Partial<MatchRequest>) => {
    if (alternatives.length >= 3) return false;
    const next = { ...base, ...changes };
    const result = matchContractors(contractors, next);
    if (!result.matches.length) return false;
    alternatives.push({ kind, label, request: next, candidateNames: result.matches.map(({ contractor }) => contractor.name) });
    return true;
  };
  const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "ru"));
  const inCategory = contractors.filter((item) => normalize(item.city) === normalize(base.city) && includes(item.categories, base.category));

  if (inCategory.length) {
    // Do not extrapolate date suggestions beyond the last calendar entry in CSV.
    const calendarEnd = contractors.flatMap((item) => item.busyDates).sort().at(-1);
    if (calendarEnd && base.date < calendarEnd) {
      const day = new Date(`${base.date}T00:00:00Z`);
      for (let offset = 1; offset <= 30 && alternatives.length < 2; offset += 1) {
        day.setUTCDate(day.getUTCDate() + 1);
        const date = day.toISOString().slice(0, 10);
        if (date > calendarEnd) break;
        const display = date.split("-").reverse().join(".");
        add("date", `Другая дата: ${display}`, { date });
      }
    }
    const prices = [...new Set(inCategory.map((item) => item.priceFromKzt))]
      .filter((price) => price > base.budgetKzt).sort((a, b) => a - b);
    for (const price of prices) {
      if (add("budget", `Лимит на подрядчика: ${price.toLocaleString("ru-RU")} ₸`, { budgetKzt: price })) break;
    }
    if (base.language) add("language", "Без ограничения по языку", { language: undefined });
    if (base.durationHours) add("duration", "Без ограничения по длительности", { durationHours: undefined });
    for (const format of sorted(inCategory.flatMap((item) => item.eventFormats))) {
      if (normalize(format) !== normalize(base.eventFormat)) add("format", `Другой формат: ${format}`, { eventFormat: format });
      if (alternatives.length >= 3) break;
    }
  } else {
    for (const city of sorted(contractors.filter((item) => includes(item.categories, base.category)).map((item) => item.city))) {
      add("city", `Другой город: ${city}`, { city });
      if (alternatives.length >= 3) break;
    }
    for (const category of sorted(contractors.filter((item) => normalize(item.city) === normalize(base.city)).flatMap((item) => item.categories))) {
      add("category", `Другая категория: ${category}`, { category });
      if (alternatives.length >= 3) break;
    }
  }
  return alternatives;
}
