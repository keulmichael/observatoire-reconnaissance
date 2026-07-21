import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202607210001_global_observatory_schema.sql", "utf8");

describe("global observatory Supabase migration", () => {
  it("creates the required persistence tables", () => {
    [
      "global_sources",
      "global_articles",
      "global_events",
      "global_event_articles",
      "global_excerpts",
      "global_claims",
      "global_analyses",
      "global_study_suggestions",
      "global_user_decisions",
      "global_learning_signals",
      "global_collection_logs"
    ].forEach((table) => expect(sql).toContain(`public.${table}`));
  });

  it("enables RLS and owner policies for global tables", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("owner_id = auth.uid()");
  });

  it("adds uniqueness constraints and indexes for deduplication", () => {
    expect(sql).toContain("unique (owner_id, canonical_url)");
    expect(sql).toContain("unique (owner_id, source_id, external_id)");
    expect(sql).toContain("global_articles_normalized_title_idx");
  });
});
