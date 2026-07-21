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

  it("persists global parents before relation tables", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const repository = new SupabaseObservatoryRepository(upsertClient(calls));
    const globalObservatory = GlobalObservatory.collect(SourceManager.createInitialState("2026-07-21T10:00:00.000Z"), undefined, "2026-07-21T10:00:00.000Z");

    await repository.saveGlobalObservatory({ version: 1, studies: [], globalObservatory }, "owner-1");

    expect(calls.map((call) => call.table)).toEqual([
      "global_sources",
      "global_articles",
      "global_events",
      "global_event_articles",
      "global_excerpts",
      "global_claims",
      "global_analyses",
      "global_claim_sources",
      "global_study_suggestions",
      "global_collection_logs"
    ]);
  });

  it("uses the merged event identifier when repairing event article relations", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const repository = new SupabaseObservatoryRepository(upsertClient(calls));
    const collected = GlobalObservatory.collect(SourceManager.createInitialState("2026-07-21T10:00:00.000Z"), undefined, "2026-07-21T10:00:00.000Z");
    const globalObservatory = {
      ...collected,
      events: collected.events.map((event, index) => index === 0
        ? {
            ...event,
            id: "event-final",
            mergeCandidates: [{ eventId: "event-old", confidence: 0.91, reason: "Fusion test", status: "auto-fusion" as const }]
          }
        : event)
    };

    await repository.saveGlobalObservatory({ version: 1, studies: [], globalObservatory }, "owner-1");

    const relations = calls.find((call) => call.table === "global_event_articles")?.rows as Array<{ event_id: string }>;
    expect(relations.some((row) => row.event_id === "owner-1:event-final")).toBe(true);
    expect(relations.some((row) => row.event_id === "owner-1:event-old")).toBe(false);
  });
});

function upsertClient(calls: Array<{ table: string; rows: unknown[] }>) {
  return {
    from(table: string) {
      return {
        upsert(rows: unknown) {
          calls.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
          return Promise.resolve({ error: null });
        }
      };
    }
  } as unknown as SupabaseClient;
}
