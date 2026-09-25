import type { Network, PlannedJourney, RideSegment, Trip } from './types';

interface TripAt {
  trip: Trip;
  stopIndex: number;
}

interface WaitLabel {
  kind: 'wait';
  stationId: string;
  time: number;
  path: string[];
  segments: RideSegment[];
}

interface RideLabel {
  kind: 'ride';
  trip: Trip;
  boardStopIndex: number;
  stopIndex: number;
  path: string[];
  segments: RideSegment[];
}

type Label = WaitLabel | RideLabel;

function lexLess(a: string[], b: string[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return a.length < b.length;
}

class LabelHeap {
  private items: Label[] = [];

  get size(): number {
    return this.items.length;
  }

  push(label: Label): void {
    const i = this.items.findIndex((other) => this.compare(label, other) < 0);
    if (i === -1) this.items.push(label);
    else this.items.splice(i, 0, label);
  }

  pop(): Label {
    return this.items.shift()!;
  }

  private timeOf(label: Label): number {
    return label.kind === 'wait'
      ? label.time
      : label.trip.stops[label.stopIndex].arrival;
  }

  private compare(a: Label, b: Label): number {
    const ta = this.timeOf(a);
    const tb = this.timeOf(b);
    if (ta !== tb) return ta - tb;
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    if (lexLess(a.path, b.path)) return -1;
    if (lexLess(b.path, a.path)) return 1;
    return 0;
  }
}

export function planJourney(
  network: Network,
  originId: string,
  destinationId: string,
  departureTime: number,
  maxTransfers: number
): PlannedJourney {
  const base = { originId, destinationId, departureTime };

  if (originId === destinationId) {
    return {
      ...base,
      feasible: true,
      arrivalTime: departureTime,
      transfers: 0,
      segments: [],
      waits: []
    };
  }

  const minTransfer = new Map(
    network.stations.map((station) => [station.id, station.minTransferMinutes])
  );
  const tripsAt = new Map<string, TripAt[]>();
  network.trips.forEach((trip) => {
    trip.stops.forEach((stop, stopIndex) => {
      const list = tripsAt.get(stop.stationId) ?? [];
      list.push({ trip, stopIndex });
      tripsAt.set(stop.stationId, list);
    });
  });

  const settledWaits = new Map<string, { time: number; pathLen: number }[]>();
  const settledRides = new Map<string, string[] | undefined>();
  const heap = new LabelHeap();
  heap.push({
    kind: 'wait',
    stationId: originId,
    time: departureTime,
    path: [],
    segments: []
  });

  let bestArrival = Number.POSITIVE_INFINITY;
  let bestPath: string[] | null = null;
  let bestSegments: RideSegment[] = [];

  const rideKey = (label: RideLabel): string =>
    `${label.trip.id}#${label.boardStopIndex}#${label.stopIndex}#${label.path.length}`;

  while (heap.size > 0) {
    const label = heap.pop();
    const labelTime =
      label.kind === 'wait'
        ? label.time
        : label.trip.stops[label.stopIndex].arrival;
    if (labelTime > bestArrival) break;

    if (label.kind === 'wait') {
      const stationSettled = settledWaits.get(label.stationId) ?? [];
      if (stationSettled.some((s) => s.time <= label.time && s.pathLen <= label.path.length)) {
        continue;
      }
      stationSettled.push({ time: label.time, pathLen: label.path.length });
      settledWaits.set(label.stationId, stationSettled);

      const boards = tripsAt.get(label.stationId) ?? [];
      for (const { trip, stopIndex } of boards) {
        if (trip.stops[stopIndex].departure < label.time) continue;
        if (label.path.includes(trip.id)) continue;
        if (label.path.length > maxTransfers) continue;
        heap.push({
          kind: 'ride',
          trip,
          boardStopIndex: stopIndex,
          stopIndex,
          path: [...label.path, trip.id],
          segments: label.segments
        });
      }
      continue;
    }

    const key = rideKey(label);
    const settledPath = settledRides.get(key);
    if (settledPath !== undefined && !lexLess(label.path, settledPath)) continue;
    settledRides.set(key, label.path);

    const { trip } = label;
    const currentStop = trip.stops[label.stopIndex];

    if (label.stopIndex > label.boardStopIndex) {
      const segment: RideSegment = {
        tripId: trip.id,
        lineName: trip.lineName,
        boardStationId: trip.stops[label.boardStopIndex].stationId,
        alightStationId: currentStop.stationId,
        boardTime: trip.stops[label.boardStopIndex].departure,
        alightTime: currentStop.arrival
      };
      const segments = [...label.segments, segment];
      const transfersUsed = label.path.length - 1;

      if (currentStop.stationId === destinationId) {
        if (
          currentStop.arrival < bestArrival ||
          (currentStop.arrival === bestArrival &&
            bestPath !== null &&
            (transfersUsed < bestPath.length - 1 ||
              (transfersUsed === bestPath.length - 1 && lexLess(label.path, bestPath))))
        ) {
          bestArrival = currentStop.arrival;
          bestPath = label.path;
          bestSegments = segments;
        }
      } else if (label.path.length <= maxTransfers) {
        const readyAt = currentStop.arrival + (minTransfer.get(currentStop.stationId) ?? 0);
        heap.push({
          kind: 'wait',
          stationId: currentStop.stationId,
          time: readyAt,
          path: label.path,
          segments
        });
      }
    }

    if (label.stopIndex + 1 < trip.stops.length) {
      heap.push({ ...label, stopIndex: label.stopIndex + 1 });
    }
  }

  if (!bestPath) {
    return { ...base, feasible: false, arrivalTime: -1, transfers: 0, segments: [], waits: [] };
  }

  const waits: PlannedJourney['waits'] = [];
  if (bestSegments[0].boardTime > departureTime) {
    waits.push({
      stationId: originId,
      start: departureTime,
      end: bestSegments[0].boardTime,
      kind: 'initial'
    });
  }
  for (let i = 0; i + 1 < bestSegments.length; i++) {
    waits.push({
      stationId: bestSegments[i].alightStationId,
      start: bestSegments[i].alightTime,
      end: bestSegments[i + 1].boardTime,
      kind: 'transfer'
    });
  }

  return {
    ...base,
    feasible: true,
    arrivalTime: bestArrival,
    transfers: bestPath.length - 1,
    segments: bestSegments,
    waits
  };
}
