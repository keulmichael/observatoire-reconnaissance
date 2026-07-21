import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GlobalObservatory } from "../global-observatory";
import { SourceManager } from "../global-observatory/SourceManager";
import { SupabaseObservatoryRepository } from "./SupabaseObservatoryRepository";

describe("SupabaseObservatoryRepository global observatory persistence", () => {
  it("upserts dedicated global observatory tables", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const client = {
      from(table: string) {
        return {
          upsert(rows: unknown) {
            calls.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
            return Promise.resolve({ error: null });
          }
        };
      }
    } as unknown as SupabaseClient;
    const repository = new SupabaseObservatoryRepository(client);
    const globalObservatory = GlobalObservatory.collect(SourceManager.createInitialState("2026-07-21T10:00:00.000Z"), undefined, "2026-07-21T10:00:00.000Z");

    await repository.save({ version: 1, studies: [], globalObservatory }, "00000000-0000-0000-0000-000000000001");

    expect(calls.map((call) => call.table)).toContain("global_sources");
    expect(calls.map((call) => call.table)).toContain("global_articles");
    expect(calls.map((call) => call.table)).toContain("global_events");
    expect(calls.map((call) => call.table)).toContain("global_collection_logs");
  });
});
