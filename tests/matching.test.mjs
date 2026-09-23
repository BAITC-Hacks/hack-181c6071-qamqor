import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadContractors } from "../src/lib/csv.ts";
import { matchContractors, suggestAlternatives } from "../src/lib/matcher.ts";

// Exercise the production loader and matcher against the unchanged official CSV.
const contractors = await loadContractors();
const scenarios = JSON.parse(await readFile(
  new URL("../data/fixtures/matching-scenarios.json", import.meta.url), "utf8",
));
const ids = (result) => result.matches.map(({ contractor }) => contractor.id);

test("empty search suggests the nearest working date without changing other constraints", () => {
  const request = scenarios.empty.request;
  const options = suggestAlternatives(contractors, request);
  assert.equal(options[0].kind, "date");
  assert.equal(options[0].request.date, "2026-11-15");
  assert.deepEqual({ ...options[0].request, date: request.date }, request);
  assert.deepEqual(options[0].candidateNames, ["Тони Тони Чоппер"]);
});

test("all suggestions change just one condition and really return eligible contractors", () => {
  for (const request of [scenarios.empty.request, { ...scenarios.dense.request, budgetKzt: 1000 }, { ...scenarios.dense.request, city: "Караганда" }]) {
    const options = suggestAlternatives(contractors, request);
    assert.ok(options.length > 0 && options.length <= 3);
    assert.deepEqual(suggestAlternatives([...contractors].reverse(), request), options);
    for (const option of options) {
      const changes = Object.keys(request).filter((key) => request[key] !== option.request[key]);
      assert.equal(changes.length, 1);
      const result = matchContractors(contractors, option.request);
      assert.equal(result.outcome, "MATCHED");
      assert.deepEqual(option.candidateNames, result.matches.map(({ contractor }) => contractor.name));
    }
  }
  assert.ok(suggestAlternatives(contractors, { ...scenarios.dense.request, budgetKzt: 1000 }).some((option) => option.kind === "budget"));
});

test("date suggestions never extrapolate beyond the dataset calendar", () => {
  const options = suggestAlternatives(contractors, { ...scenarios.empty.request, date: "2027-01-01" });
  assert.ok(options.every((option) => option.kind !== "date"));
});

function verifyScenario(scenario) {
  const { request, expected } = scenario;
  const result = matchContractors(contractors, request);
  const category = contractors.filter((contractor) =>
    contractor.city === request.city && contractor.categories.includes(request.category));

  assert.equal(category.length, expected.categoryCount);
  assert.equal(result.outcome, expected.outcome);
  assert.deepEqual(ids(result), expected.ids);
  assert.deepEqual(result.rejectionSummary, expected.rejectionSummary);
  assert.ok(result.matches.length <= 3);
  for (const { contractor, facts, explanation } of result.matches) {
    assert.ok(!contractor.busyDates.includes(request.date), `${contractor.id} is busy`);
    assert.ok(contractor.priceFromKzt <= request.budgetKzt);
    assert.ok(contractor.eventFormats.includes(request.eventFormat));
    assert.equal(facts.withinBudgetByKzt, request.budgetKzt - contractor.priceFromKzt);
    assert.equal(facts.eventFormat, request.eventFormat);
    assert.ok(explanation.includes(request.eventFormat));
    assert.ok(explanation.includes(contractor.priceFromKzt.toLocaleString("ru-RU")));
  }
  return result;
}

test("official CSV loads 66 distinct profiles and valid busy dates", () => {
  assert.equal(contractors.length, 66);
  assert.equal(new Set(contractors.map(({ id }) => id)).size, 66);
  for (const contractor of contractors) {
    assert.ok(contractor.id && contractor.city && contractor.categories.length);
    assert.ok(Number.isFinite(contractor.priceFromKzt) && contractor.priceFromKzt > 0);
    for (const date of contractor.busyDates) {
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Date(date).toISOString().slice(0, 10), date);
    }
  }
});

test("dense category returns exactly three contractors in the expected order", () => {
  const result = verifyScenario(scenarios.dense);
  assert.equal(result.matches.length, 3);
  const details = result.matches.map(({ facts, explanation }) => {
    assert.ok(facts.profileDetail);
    assert.ok(explanation.includes(facts.profileDetail));
    return facts.profileDetail;
  });
  assert.equal(new Set(details).size, 3);
});

test("rare category returns one contractor and a truthful count/rejection message", () => {
  const result = verifyScenario(scenarios.rare);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].facts.profileDetail, "в анкете описано авторское цветочное оформление");
  assert.match(result.message, /Нашлось только 1/);
  assert.match(result.message, /остальные кандидаты не прошли условия/);
  assert.equal(result.matches.length + result.rejectionSummary.busy, 2);
});

test("existing category with all candidates rejected returns NO_ELIGIBLE", () => {
  const result = verifyScenario(scenarios.empty);
  assert.equal(result.matches.length, 0);
  assert.equal(Object.values(result.rejectionSummary).reduce((sum, count) => sum + count, 0), 2);
  assert.match(result.message, /Кандидаты.*есть.*все исключены/);
});

test("changing only the date changes the selection because of CSV busy dates", () => {
  const first = scenarios.dense.request;
  const second = scenarios.otherDate.request;
  assert.notEqual(first.date, second.date);
  assert.deepEqual({ ...first, date: second.date }, second);
  const firstResult = verifyScenario(scenarios.dense);
  const secondResult = verifyScenario(scenarios.otherDate);
  assert.notDeepEqual(ids(firstResult), ids(secondResult));

  // Fixed witnesses from the official CSV, not fabricated contractor records.
  const leaves = contractors.find(({ id }) => id === "HK-80581");
  const enters = contractors.find(({ id }) => id === "HK-58385");
  assert.ok(leaves && enters);
  assert.ok(!leaves.busyDates.includes(first.date) && leaves.busyDates.includes(second.date));
  assert.ok(enters.busyDates.includes(first.date) && !enters.busyDates.includes(second.date));
  assert.ok(ids(firstResult).includes(leaves.id) && !ids(secondResult).includes(leaves.id));
  assert.ok(!ids(firstResult).includes(enters.id) && ids(secondResult).includes(enters.id));
});

test("every demo request is deterministic, including reversed CSV input order", () => {
  for (const { request } of Object.values(scenarios)) {
    const first = matchContractors(contractors, request);
    assert.deepEqual(matchContractors(contractors, request), first);
    assert.deepEqual(matchContractors([...contractors].reverse(), request), first);
  }
});
