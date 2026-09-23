export type Contractor = {
  id: string;
  name: string;
  categories: string[];
  city: string;
  cityImputed: boolean;
  synthetic: boolean;
  priceFromKzt: number;
  priceImputed: boolean;
  eventFormats: string[];
  languages: string[];
  maxHours: number | null;
  busyDates: string[];
  description: string;
};

export type MatchRequest = {
  city: string;
  date: string;
  eventFormat: string;
  category: string;
  budgetKzt: number;
  durationHours?: number;
  language?: string;
};

export type MatchFacts = {
  withinBudgetByKzt: number;
  eventFormat: string;
  language?: string;
  maxHours?: number;
  evidence?: string;
};

export type ContractorMatch = {
  contractor: Contractor;
  score: number;
  facts: MatchFacts;
  explanation: string;
};

export type MatchOutcome = "MATCHED" | "NO_CATEGORY_IN_CITY" | "NO_ELIGIBLE";

export type MatchResponse = {
  outcome: MatchOutcome;
  matches: ContractorMatch[];
  rejectionSummary: Record<string, number>;
  message: string;
  algorithmVersion: "v1";
  explanationMode?: "ai" | "fallback";
  elapsedMs: number;
};
