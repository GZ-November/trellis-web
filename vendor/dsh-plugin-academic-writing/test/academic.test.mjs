import { test } from "node:test";
import assert from "node:assert/strict";
import {
  academicCheck,
  buildAbstract,
  buildOutline,
  formatCitation,
  submissionChecklist,
  suggestTitles,
} from "../lib/academic.js";

test("buildOutline renders a research skeleton with numbered sections", () => {
  const out = buildOutline({ topic: "LLM Agents", type: "research" });
  assert.ok(out.startsWith("# Outline: LLM Agents"));
  assert.ok(out.includes("## 1. Introduction"));
  assert.ok(out.includes("## 6. Conclusion"));
  assert.ok(!out.includes("## 7."));
});

test("buildOutline caps section count", () => {
  const out = buildOutline({ type: "research", sections: 3 });
  assert.ok(out.includes("## 3. Methods"));
  assert.ok(!out.includes("## 4."));
});

test("suggestTitles respects variants and substitutes placeholders", () => {
  const titles = suggestTitles({ topic: "Sleep", outcome: "memory", subtitle: "a meta-analysis", variants: 4 });
  assert.equal(titles.length, 4);
  assert.ok(titles.some((t) => t.title.includes("Sleep")));
  assert.ok(titles.some((t) => t.title.includes("memory")));
  assert.ok(titles.some((t) => t.title.includes("meta-analysis")));
});

test("buildAbstract builds the four standard moves", () => {
  const out = buildAbstract({ background: "ctx", methods: "design", results: "effect", conclusion: "imply" });
  assert.ok(out.includes("**Background.** ctx"));
  assert.ok(out.includes("**Methods.** design"));
  assert.ok(out.includes("**Results.** effect"));
  assert.ok(out.includes("**Conclusion.** imply"));
});

test("formatCitation gb7714 journal", () => {
  const c = formatCitation({
    style: "gb7714", authors: ["Zhang San", "Li Si"], year: "2024",
    title: "A Study", kind: "journal", journal: "J. AI", volume: "12", issue: "3", pages: "1-9",
  });
  assert.ok(c.includes("Zhang San, Li Si A Study[J]. J. AI, 2024, 12(3): 1-9."));
});

test("formatCitation apa book", () => {
  const c = formatCitation({
    style: "apa", authors: ["Jane Doe"], year: "2023", title: "The Book",
    kind: "book", publisher: "Press", city: "New York",
  });
  assert.ok(c.includes("Doe, J. (2023). The Book. New York: Press."));
});

test("formatCitation mla journal", () => {
  const c = formatCitation({
    style: "mla", authors: ["Alice Smith"], year: "2022", title: "Title",
    kind: "journal", journal: "J. Lit", volume: "5", issue: "2", pages: "10-20",
  });
  assert.ok(c.includes('Alice Smith. "Title." J. Lit, vol. 5, no. 2, 2022, pp. 10-20.'));
});

test("academicCheck flags passive voice and missing punctuation", () => {
  const res = academicCheck("The experiment was conducted by the team");
  assert.ok(res.issues.length > 0);
  assert.ok(res.issues.some((i) => /passive/i.test(i)));
  assert.ok(res.issues.some((i) => /punctuation/i.test(i)));
  assert.equal(res.passed, false);
});

test("academicCheck passes a clean sentence", () => {
  const res = academicCheck("The model outperformed all baselines.");
  assert.equal(res.passed, true);
  assert.equal(res.issues.length, 0);
});

test("submissionChecklist marks done items", () => {
  const out = submissionChecklist({ ethics: true, funding: true });
  assert.ok(out.includes("- [x] Ethics approval"));
  assert.ok(out.includes("- [ ] Conflict-of-interest"));
  assert.ok(out.includes("- [x] Funding sources"));
});
