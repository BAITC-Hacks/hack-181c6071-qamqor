"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import ContractorCard from "./ContractorCard";
import type { ContractorMatch, MatchRequest, MatchResponse } from "@/lib/types";
import styles from "./SearchForm.module.css";

type MatchResponseWithMode = MatchResponse & {
  explanationMode?: "ai" | "fallback";
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: MatchResponseWithMode }
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

const CITIES = ["Алматы", "Астана", "Зарубежье"];
const EVENT_FORMATS = ["день рождения", "конференция", "корпоратив", "свадьба", "той", "юбилей"];
const CATEGORIES = [
  "Банкетный зал", "Ведущий", "Ведущий церемонии", "Видеограф", "Декоратор",
  "Загородная площадка", "Инструменталист", "Лайв-бэнд", "Национальный ансамбль",
  "Отель", "Подарки и сувениры", "Ресторан", "Танцевальный коллектив", "Флорист",
  "Фото и видеобудки", "Фотограф", "Шоу-программа",
];
const LANGUAGES = ["английский", "казахский", "русский"];

type FeaturedProfile = {
  id: string;
  name: string;
  category: string;
  city: string;
  priceFromKzt: number;
  priceImputed: boolean;
};

type PlanItem = {
  id: string;
  name: string;
  category: string;
  city: string;
  date: string;
  eventFormat: string;
  priceFromKzt: number;
  priceImputed: boolean;
};

const money = (amount: number) => `${new Intl.NumberFormat("ru-KZ").format(amount)} ₸`;

export default function SearchForm({
  featured,
  catalogStats,
}: {
  featured: FeaturedProfile[];
  catalogStats: { profiles: number; categories: number; cities: number };
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [lastRequest, setLastRequest] = useState<MatchRequest | null>(null);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [eventBudget, setEventBudget] = useState("");
  const planTotal = plan.reduce((sum, item) => sum + item.priceFromKzt, 0);

  const addToPlan = (match: ContractorMatch, request: MatchRequest) => {
    const { contractor } = match;
    if (plan.length > 0 && (
      plan[0].city.toLocaleLowerCase("ru") !== request.city.trim().toLocaleLowerCase("ru") ||
      plan[0].date !== request.date ||
      plan[0].eventFormat.toLocaleLowerCase("ru") !== request.eventFormat.trim().toLocaleLowerCase("ru")
    )) setEventBudget("");
    setPlan((current) => {
      const sameEvent = current.length === 0 || (
        current[0].city.toLocaleLowerCase("ru") === request.city.trim().toLocaleLowerCase("ru") &&
        current[0].date === request.date &&
        current[0].eventFormat.toLocaleLowerCase("ru") === request.eventFormat.trim().toLocaleLowerCase("ru")
      );
      const preserved = sameEvent ? current.filter((item) => item.category !== request.category) : [];
      return [...preserved, {
        id: contractor.id, name: contractor.name, category: request.category,
        city: contractor.city, date: request.date, eventFormat: request.eventFormat,
        priceFromKzt: contractor.priceFromKzt, priceImputed: contractor.priceImputed,
      }];
    });
  };

  const setField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const chooseProfile = (profile: FeaturedProfile) => {
    setForm((current) => ({ ...current, city: profile.city, category: profile.category }));
    document.getElementById("search-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chooseExample = (city: string, category: string, date: string) => {
    setForm({ ...INITIAL_FORM, city, category, date, eventFormat: "корпоратив", budgetKzt: "1500000" });
    setState({ status: "idle" });
    document.getElementById("search-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      const data = (await response.json()) as MatchResponseWithMode;
      setState({ status: "success", data });
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
      <nav className={styles.navigation} aria-label="Главная навигация">
        <a className={styles.wordmark} href="#top"><span aria-hidden="true">✳</span> Qamqor<span>Match</span></a>
        <div className={styles.navLinks}>
          <a href="#catalog">Каталог</a>
          <a href="#event-plan">Смета{plan.length > 0 ? ` · ${plan.length}` : ""}</a>
          <a className={styles.navAction} href="#search-form">Подобрать подрядчика <span aria-hidden="true">↗</span></a>
        </div>
      </nav>

      <section className={styles.hero} aria-labelledby="search-title">
        <div className={styles.heroCopy} id="top">
        <p className={styles.eyebrow}>Подбор для событий · Казахстан</p>
        <h1 id="search-title">Нужные люди<br /><em>для вашего события.</em></h1>
        <p className={styles.lead}>
          Найдите подрядчика по городу, дате и бюджету. Покажем до трёх подходящих вариантов,
          объясним выбор и поможем оценить расходы.
        </p>
        <a className={styles.heroAction} href="#search-form">Начать подбор <span aria-hidden="true">↗</span></a>
        </div>
        <div className={styles.heroAside} aria-label="О каталоге">
          <p className={styles.asideEyebrow}>Официальный набор данных кейса</p>
          <strong>{catalogStats.profiles}</strong><span>профилей подрядчиков</span>
          <div className={styles.asideDivider} />
          <p>{catalogStats.categories} категорий · {catalogStats.cities} локации</p>
          <small>Занятость и соответствие условиям проверяем при поиске</small>
        </div>
      </section>

      <section className={styles.catalog} id="catalog" aria-labelledby="catalog-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>Знакомство с каталогом</p><h2 id="catalog-title">Исполнители для вашего плана</h2></div>
          <p>Реальные записи из датасета. Выберите направление — мы подставим город и категорию в поиск.</p>
        </div>
        <div className={styles.featuredGrid}>
          {featured.map((profile, index) => (
            <article className={styles.featuredCard} key={profile.id}>
              <div className={styles.featuredArt} data-tone={index} aria-hidden="true">
                <span>{profile.category.slice(0, 1)}</span><span className={styles.artIndex}>0{index + 1}</span>
              </div>
              <div className={styles.featuredContent}>
                <div className={styles.featuredMeta}><span>{profile.category}</span><span>{profile.city}</span></div>
                <h3>{profile.name}</h3>
                <p>от {new Intl.NumberFormat("ru-KZ").format(profile.priceFromKzt)} ₸{profile.priceImputed ? " · ориентир" : ""}</p>
                <button type="button" onClick={() => chooseProfile(profile)}>Проверить на мою дату <span aria-hidden="true">↗</span></button>
              </div>
            </article>
          ))}
        </div>
        <p className={styles.catalogNote}>Примеры профилей не означают свободную дату. Итоговая стоимость согласуется с исполнителем.</p>
      </section>

      <section className={styles.searchSection} aria-labelledby="form-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Точный подбор</p><h2 id="form-title">Расскажите о событии</h2></div><p>Пять основных параметров. Язык и длительность помогут уточнить выбор.</p></div>
      <div className={styles.examples} aria-label="Готовые примеры поиска">
        <span>Попробовать пример</span>
        <button type="button" onClick={() => chooseExample("Астана", "Ведущий", "2026-11-14")}>Ведущий · Астана <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => chooseExample("Алматы", "Флорист", "2026-11-15")}>Флорист · Алматы <span aria-hidden="true">↗</span></button>
      </div>
      <form className={styles.form} id="search-form" onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>
            Город
            <input
              autoComplete="address-level2"
              list="city-options"
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
              list="format-options"
              onChange={(event) => setField("eventFormat", event.target.value)}
              placeholder="Например, корпоратив"
              required
              value={form.eventFormat}
            />
          </label>

          <label>
            Категория подрядчика
            <input
              list="category-options"
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
              list="language-options"
              onChange={(event) => setField("language", event.target.value)}
              placeholder="Например, русский"
              value={form.language}
            />
          </label>

          <datalist id="city-options">{CITIES.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="format-options">{EVENT_FORMATS.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="category-options">{CATEGORIES.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="language-options">{LANGUAGES.map((value) => <option key={value} value={value} />)}</datalist>
        </div>

        <button className={styles.submit} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Ищем подходящих…" : "Найти подрядчиков"}
        </button>
      </form>
      </section>

      <section className={styles.results} id="results" aria-live="polite" aria-busy={state.status === "loading"}>
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

        {state.status === "success" && <SearchResults
          response={state.data}
          request={lastRequest}
          plan={plan}
          onAdd={addToPlan}
        />}
      </section>

      <section className={styles.planSection} id="event-plan" aria-labelledby="plan-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>План расходов</p><h2 id="plan-title">Смета события</h2></div>
          <p>Соберите по одному подрядчику на категорию и сравните сумму стартовых цен с общим бюджетом.</p>
        </div>
        <div className={styles.planPanel}>
          {plan.length === 0 ? (
            <div className={styles.planEmpty}><strong>Пока ничего не выбрано</strong><p>Начните с поиска и добавьте подходящего подрядчика из результатов.</p><a href="#search-form">Перейти к подбору ↗</a></div>
          ) : (
            <>
              <p className={styles.planContext}>Событие: {plan[0].city} · {plan[0].date} · {plan[0].eventFormat}</p>
              <div className={styles.planList}>
                {plan.map((item) => (
                  <div className={styles.planRow} key={item.category}>
                    <div><span>{item.category} · {item.city}</span><strong>{item.name}</strong>{item.priceImputed && <small>Цена восстановлена из данных</small>}</div>
                    <strong>от {money(item.priceFromKzt)}</strong>
                    <button type="button" aria-label={`Убрать ${item.name} из сметы`} onClick={() => setPlan((current) => current.filter((entry) => entry.category !== item.category))}>×</button>
                  </div>
                ))}
              </div>
              <div className={styles.planTotal}><span>Сумма стартовых цен</span><strong>от {money(planTotal)}</strong></div>
              <label className={styles.eventBudget}>Общий бюджет события, ₸ <span>необязательно</span>
                <input type="number" inputMode="numeric" min="1" step="1000" value={eventBudget} onChange={(event) => setEventBudget(event.target.value)} placeholder="Например, 3 000 000" />
              </label>
              {Number(eventBudget) > 0 && (
                <p className={styles.planBalance} role="status">
                  {Number(eventBudget) >= planTotal
                    ? `Ориентировочный остаток: ${money(Number(eventBudget) - planTotal)}`
                    : `Стартовые цены выше общего бюджета на ${money(planTotal - Number(eventBudget))}`}
                </p>
              )}
            </>
          )}
          <p className={styles.planCaveat}>В смете одно событие: при смене города, даты или формата новая запись начинает новую смету. Расчёт действует только в открытой вкладке. Цены указаны «от», не являются офертой и не учитывают дополнительные услуги.</p>
        </div>
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

function SearchResults({
  response, request, plan, onAdd,
}: {
  response: MatchResponseWithMode;
  request: MatchRequest | null;
  plan: PlanItem[];
  onAdd: (match: ContractorMatch, request: MatchRequest) => void;
}) {
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
  const rejected = Object.entries(response.rejectionSummary ?? {}).filter(
    ([, count]) => count > 0,
  );

  return (
    <div>
      <div className={styles.resultsHeading}>
        <div>
          <p className={styles.statusLabel}>Найдено</p>
          <h2>Подходящие подрядчики</h2>
        </div>
        {response.elapsedMs !== undefined && <span>{response.elapsedMs} мс</span>}
      </div>
      <p className={styles.resultsNote}>{response.message}</p>
      <p className={styles.explanationMode}>
        {response.explanationMode === "ai"
          ? "Объяснение подготовлено AI-агентом"
          : "Использовано базовое объяснение"}
      </p>

      {matches.length < 3 && rejected.length > 0 && (
        <div className={styles.filterSummary}>
          <strong>Почему вариантов меньше трёх</strong>
          <ul className={styles.reasons}>
            {rejected.map(([reason, count]) => (
              <li key={reason}>
                <strong>{count}</strong> {REJECTION_LABELS[reason] ?? reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.cards}>
        {matches.map((match) => (
          <ContractorCard
            key={match.contractor.id}
            match={match}
            inPlan={plan.some((item) => item.category === request?.category && item.id === match.contractor.id && item.date === request?.date && item.city === request?.city && item.eventFormat === request?.eventFormat)}
            newEvent={plan.length > 0 && (plan[0].date !== request?.date || plan[0].city.toLocaleLowerCase("ru") !== request?.city.trim().toLocaleLowerCase("ru") || plan[0].eventFormat.toLocaleLowerCase("ru") !== request?.eventFormat.trim().toLocaleLowerCase("ru"))}
            onAdd={() => { if (request) onAdd(match, request); }}
          />
        ))}
      </div>
    </div>
  );
}
