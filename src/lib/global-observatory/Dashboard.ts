import type { GlobalDashboardMetrics, GlobalObservedEvent } from "../types";

export class Dashboard {
  static build(events: GlobalObservedEvent[]): GlobalDashboardMetrics {
    return {
      analyzedEvents: events.filter((event) => event.analysis).length,
      activeEvents: events.filter((event) => event.status === "active").length,
      createdStudies: events.reduce((sum, event) => sum + event.createdStudyIds.length, 0),
      frequentCategories: count(events.flatMap((event) => event.categories)).slice(0, 6),
      representedCountries: count(events.map((event) => event.country ?? "Monde")).slice(0, 6),
      emergingThemes: count(events.flatMap((event) => event.themes)).slice(0, 8),
      studiedPhenomena: count(events.filter((event) => event.createdStudyIds.length).map((event) => event.title)).slice(0, 5),
      topStudyEvents: events
        .filter((event) => event.createdStudyIds.length)
        .sort((left, right) => right.createdStudyIds.length - left.createdStudyIds.length)
        .slice(0, 5)
        .map((event) => ({ eventId: event.id, title: event.title, studies: event.createdStudyIds.length })),
      trends: this.trends(events)
    };
  }

  private static trends(events: GlobalObservedEvent[]) {
    return count(events.flatMap((event) => event.themes))
      .filter((item) => item.value >= 2)
      .slice(0, 5)
      .map((item) => `Theme emergent: ${item.label} (${item.value} occurrences).`);
  }
}

function count<T extends string>(items: T[]) {
  const totals = new Map<T, number>();
  items.filter(Boolean).forEach((item) => totals.set(item, (totals.get(item) ?? 0) + 1));
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}
