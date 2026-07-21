import type { GlobalMapPoint, GlobalObservedEvent } from "../types";

const approximateCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Monde: { latitude: 20, longitude: 0 },
  France: { latitude: 46.2, longitude: 2.2 },
  Ukraine: { latitude: 49, longitude: 32 },
  "États-Unis": { latitude: 39, longitude: -98 },
  Chine: { latitude: 35, longitude: 103 },
  Inde: { latitude: 22, longitude: 79 },
  Brésil: { latitude: -10, longitude: -55 }
};

export class MapEngine {
  static build(events: GlobalObservedEvent[]): GlobalMapPoint[] {
    return events
      .filter((event) => event.status !== "archived")
      .map((event) => {
        const country = event.country ?? "Monde";
        const coordinates = approximateCoordinates[country] ?? approximateCoordinates.Monde;
        return {
          id: `map-${event.id}`,
          eventId: event.id,
          title: event.title,
          country,
          latitude: event.latitude ?? coordinates.latitude,
          longitude: event.longitude ?? coordinates.longitude,
          status: event.status,
          interestStars: event.interest?.stars ?? 1,
          studyCount: event.createdStudyIds.length
        };
      });
  }
}
