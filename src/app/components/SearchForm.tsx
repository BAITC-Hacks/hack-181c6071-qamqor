"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import ContractorCard from "./ContractorCard";
import type { MatchRequest, MatchResponse } from "@/lib/types";
import styles from "./SearchForm.module.css";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: MatchResponse }
  | { status: "error"; message: string };

const INITIAL_FORM = {
  city: "",
  date: "",
  eventFormat: "",
  category: "",
  budgetKzt: "",
  durationHours: "",
  language: "",
};

const REJECTION_LABELS: Record<string, string> = {
  busy: "заняты на выбранную дату",
  budget: "выше указанного бюджета",
  format: "не работают с таким форматом",
  language: "не поддерживают выбранный язык",
  duration: "не подходят по длительности",
};

export default function SearchForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [lastRequest, setLastRequest] = useState<MatchRequest | null>(null);

  const setField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const search = async (request: MatchRequest) => {
    setLastRequest(request);
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Запрос завершился с кодом ${response.status}`);
      }

      const data = (await response.json()) as MatchResponse;
      setState({ status: "success", data });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось получить результаты.",
      });
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const request: MatchRequest = {
      city: form.city.trim(),
      date: form.date,
      eventFormat: form.eventFormat.trim(),
      category: form.category.trim(),
      budgetKzt: Number(form.budgetKzt),
    };

    if (form.durationHours) request.durationHours = Number(form.durationHours);
    if (form.language.trim()) request.language = form.language.trim();

    void search(request);
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="search-title">
        <p className={styles.eyebrow}>Qamqor Match</p>
        <h1 id="search-title">Найдём подрядчика для вашего события</h1>
        <p className={styles.lead}>
          Укажите основные параметры — мы покажем до трёх доступных вариантов и
          объясним каждый выбор.
        </p>
      </section>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>
            Город
            <input
              autoComplete="address-level2"
              onChange={(event) => setField("city", event.target.value)}
              placeholder="Например, Астана"
              required
              value={form.city}
            />
          </label>

          <label>
            Дата события
            <input
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setField("date", event.target.value)}
              required
              type="date"
              value={form.date}
            />
          </label>

          <label>
            Тип мероприятия
            <input
              onChange={(event) => setField("eventFormat", event.target.value)}
              placeholder="Например, корпоратив"
              required
              value={form.eventFormat}
            />
          </label>

          <label>
            Категория подрядчика
            <input
              onChange={(event) => setField("category", event.target.value)}
              placeholder="Например, Ведущий"
              required
              value={form.category}
            />
          </label>

          <label>
            Бюджет, ₸
            <input
              inputMode="numeric"
              min="1000"
              onChange={(event) => setField("budgetKzt", event.target.value)}
              placeholder="1 200 000"
              required
              step="1000"
              type="number"
              value={form.budgetKzt}
            />
          </label>

          <label>
            Длительность, часов <span>необязательно</span>
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) => setField("durationHours", event.target.value)}
              placeholder="5"
              type="number"
              value={form.durationHours}
            />
          </label>

          <label className={styles.fullWidth}>
            Язык <span>необязательно</span>
            <input
              onChange={(event) => setField("language", event.target.value)}
              placeholder="Например, русский"
              value={form.language}
            />
          </label>
        </div>

        <button className={styles.submit} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Ищем подходящих…" : "Найти подрядчиков"}
        </button>
      </form>

      <section className={styles.results} aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "idle" && (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <h2>Здесь появятся результаты</h2>
            <p>Заполните форму — поиск обычно занимает несколько секунд.</p>
          </div>
        )}

        {state.status === "loading" && <LoadingState />}

        {state.status === "error" && (
          <div className={styles.messageState} role="alert">
            <p className={styles.statusLabel}>Ошибка поиска</p>
            <h2>Не удалось получить результаты</h2>
            <p>{state.message} Проверьте соединение и попробуйте ещё раз.</p>
            <button
              className={styles.secondaryButton}
              onClick={() => lastRequest && void search(lastRequest)}
              type="button"
            >
              Повторить запрос
            </button>
          </div>
        )}

        {state.status === "success" && <SearchResults response={state.data} />}
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState} role="status">
      <div className={styles.spinner} aria-hidden="true" />
      <div>
        <h2>Проверяем доступность</h2>
        <p>Сверяем дату, бюджет и параметры события.</p>
      </div>
    </div>
  );
}

function SearchResults({ response }: { response: MatchResponse }) {
  if (response.outcome === "NO_CATEGORY_IN_CITY") {
    return (
      <div className={styles.messageState}>
        <p className={styles.statusLabel}>Категория не найдена</p>
        <h2>В этом городе пока нет таких подрядчиков</h2>
        <p>Попробуйте выбрать другой город или категорию.</p>
      </div>
    );
  }

  if (response.outcome === "NO_ELIGIBLE") {
    const reasons = Object.entries(response.rejectionSummary ?? {}).filter(
      ([, count]) => count > 0,
    );

    return (
      <div className={styles.messageState}>
        <p className={styles.statusLabel}>Подходящих вариантов нет</p>
        <h2>Подрядчики есть, но сейчас не проходят фильтры</h2>
        <p>Измените дату, бюджет или необязательные параметры.</p>
        {reasons.length > 0 && (
          <ul className={styles.reasons}>
            {reasons.map(([reason, count]) => (
              <li key={reason}>
                <strong>{count}</strong> {REJECTION_LABELS[reason] ?? reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const matches = response.matches.slice(0, 3);

  return (
    <div>
      <div className={styles.resultsHeading}>
        <div>
          <p className={styles.statusLabel}>Найдено</p>
          <h2>Подходящие подрядчики</h2>
        </div>
        {response.elapsedMs !== undefined && <span>{response.elapsedMs} мс</span>}
      </div>

      <div className={styles.cards}>
        {matches.map((match) => (
          <ContractorCard key={match.contractor.id} match={match} />
        ))}
      </div>
    </div>
  );
}
