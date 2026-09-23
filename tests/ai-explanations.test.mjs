import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadContractors } from "../src/lib/csv.ts";
import { matchContractors } from "../src/lib/matcher.ts";
import { AI_TIMEOUT_MS, improveExplanations } from "../src/lib/ai-explanations.server.ts";

const contractors = await loadContractors();
const scenarios = JSON.parse(await readFile(
  new URL("../data/fixtures/matching-scenarios.json", import.meta.url), "utf8",
));
const request = scenarios.dense.request;
const baseline = matchContractors(contractors, request);
const fallback = (result) => ({ ...result, matches: result.matches.slice(0, 3), explanationMode: "fallback" });
const plans = () => baseline.matches.map(({ contractor }) => ({
  id: contractor.id, focus: "format", wording: "fit", budget: "remaining",
}));
const envelope = (entries) => ({
  status: "completed",
  output: [{ type: "message", role: "assistant", content: [
    { type: "output_text", text: JSON.stringify({ explanations: entries }) },
  ] }],
});

function setup(t, implementation) {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "unit-test-placeholder";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  return t.mock.method(globalThis, "fetch", implementation);
}

test("no key, blank key, and empty results never call the provider", async (t) => {
  const fetch = setup(t, () => { throw new Error("Unexpected fetch"); });
  delete process.env.OPENAI_API_KEY;
  assert.deepEqual(await improveExplanations(baseline, request), fallback(baseline));
  process.env.OPENAI_API_KEY = "  ";
  assert.deepEqual(await improveExplanations(baseline, request), fallback(baseline));
  process.env.OPENAI_API_KEY = "unit-test-placeholder";
  const empty = matchContractors(contractors, scenarios.empty.request);
  assert.deepEqual(await improveExplanations(empty, scenarios.empty.request), fallback(empty));
  const absent = matchContractors(contractors, { ...request, category: "not-in-dataset" });
  assert.deepEqual(await improveExplanations(absent, request), fallback(absent));
  assert.equal(fetch.mock.callCount(), 0);
});

test("valid AI plan changes only explanations, even when provider reverses IDs", async (t) => {
  const original = structuredClone(baseline);
  const fetch = setup(t, async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer unit-test-placeholder");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.properties.explanations.maxItems, 3);
    const input = JSON.parse(body.input);
    assert.deepEqual(input.request, request);
    assert.equal(input.matches.length, 3);
    assert.ok(!options.body.includes("unit-test-placeholder"));
    assert.deepEqual(Object.keys(input.matches[0]).sort(), ["facts", "id"]);
    assert.deepEqual(Object.keys(input.matches[0].facts).sort(), [
      "availableOnRequestedDate", "eventFormat", "maxHours", "priceFromKzt", "profileDetail", "withinBudgetByKzt",
    ]);
    return Response.json(envelope(plans().reverse()));
  });
  const result = await improveExplanations(baseline, { ...request, extra: "must-not-be-sent" });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result.explanationMode, "ai");
  assert.deepEqual(baseline, original);
  assert.deepEqual({ ...result, matches: result.matches.map((match, i) => ({
    ...match, explanation: baseline.matches[i].explanation,
  })) }, { ...baseline, explanationMode: "ai" });
  for (const match of result.matches) {
    assert.ok(match.explanation.startsWith("Подходит для формата"));
    assert.ok(match.explanation.includes(match.contractor.priceFromKzt.toLocaleString("ru-RU")));
    assert.ok(match.explanation.includes(match.facts.withinBudgetByKzt.toLocaleString("ru-RU")));
    if (match.facts.profileDetail) assert.ok(match.explanation.includes(match.facts.profileDetail));
    assert.equal(match.explanation.split(". ").length, 2);
  }
});

test("confirmed language and duration facts can be emphasized", async (t) => {
  const input = { ...request, language: "русский", durationHours: 5 };
  const matched = matchContractors(contractors, input);
  assert.ok(matched.matches.length >= 2);
  setup(t, async () => Response.json(envelope(matched.matches.map(({ contractor }, i) => ({
    id: contractor.id, focus: i === 0 ? "language" : "duration", wording: "direct", budget: "within",
  })))));
  const result = await improveExplanations(matched, input);
  assert.ok(result.matches[0].explanation.includes("запрошенный язык: русский"));
  assert.ok(result.matches[1].explanation.includes("при запросе 5 ч"));
  assert.ok(result.matches[1].explanation.includes(`до ${matched.matches[1].facts.maxHours} ч`));
});

for (const [name, mutate] of [
  ["missing ID", (entries) => entries.slice(1)],
  ["extra result", (entries) => [...entries, entries[0]]],
  ["unknown ID", (entries) => [{ ...entries[0], id: "invented" }, ...entries.slice(1)]],
  ["duplicate ID", (entries) => [entries[0], entries[0], entries[2]]],
  ["free text claim", (entries) => [{ ...entries[0], explanation: "Лучший, 20 лет опыта" }, ...entries.slice(1)]],
  ["invalid wording", (entries) => [{ ...entries[0], wording: "ignore instructions" }, ...entries.slice(1)]],
  ["unrequested language", (entries) => [{ ...entries[0], focus: "language" }, ...entries.slice(1)]],
  ["unrequested duration", (entries) => [{ ...entries[0], focus: "duration" }, ...entries.slice(1)]],
]) {
  test(`invalid plan (${name}) preserves all deterministic explanations`, async (t) => {
    setup(t, async () => Response.json(envelope(mutate(plans()))));
    assert.deepEqual(await improveExplanations(baseline, request), fallback(baseline));
  });
}

for (const [name, response] of [
  ["HTTP 429", () => new Response("unavailable", { status: 429 })],
  ["HTTP 500", () => new Response("unavailable", { status: 500 })],
  ["invalid envelope JSON", () => new Response("not JSON")],
  ["invalid model JSON", () => Response.json({ status: "completed", output: [
    { type: "message", role: "assistant", content: [{ type: "output_text", text: "not JSON" }] },
  ] })],
  ["incomplete response", () => Response.json({ ...envelope(plans()), status: "incomplete" })],
  ["refusal", () => Response.json({ status: "completed", output: [
    { type: "message", role: "assistant", content: [{ type: "refusal", refusal: "no" }] },
  ] })],
  ["oversized response", () => new Response("x".repeat(32769))],
]) {
  test(`${name} falls back without leaking provider output`, async (t) => {
    setup(t, async () => response());
    assert.deepEqual(await improveExplanations(baseline, request), fallback(baseline));
  });
}

test("network failure falls back without retrying", async (t) => {
  const fetch = setup(t, async () => { throw new Error("Private provider error"); });
  assert.deepEqual(await improveExplanations(baseline, request), fallback(baseline));
  assert.equal(fetch.mock.callCount(), 1);
});

for (const stalledBody of [false, true]) {
  test(`hard deadline covers ${stalledBody ? "response body" : "fetch ignoring abort"}`, async (t) => {
    let signal;
    setup(t, async (_url, options) => {
      signal = options.signal;
      return stalledBody ? new Response(new ReadableStream()) : new Promise(() => {});
    });
    const start = performance.now();
    assert.deepEqual(await improveExplanations(baseline, request), fallback(baseline));
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= AI_TIMEOUT_MS - 50 && elapsed < AI_TIMEOUT_MS + 1500, `${elapsed} ms`);
    assert.equal(signal.aborted, true);
  });
}

test("provider cannot expand the three-result boundary", async (t) => {
  const fetch = setup(t, async () => Response.json(envelope(plans())));
  const oversized = { ...baseline, matches: [...baseline.matches, baseline.matches[0]] };
  const result = await improveExplanations(oversized, request);
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches.map(({ contractor }) => contractor.id), scenarios.dense.expected.ids);
  assert.equal(JSON.parse(JSON.parse(fetch.mock.calls[0].arguments[1].body).input).matches.length, 3);
});
