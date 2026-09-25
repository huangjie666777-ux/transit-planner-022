export interface Station {
  id: string;
  name: string;
  minTransferMinutes: number;
}

export interface TripStop {
  stationId: string;
  arrival: number;
  departure: number;
}

export interface Trip {
  id: string;
  lineName: string;
  stops: TripStop[];
}

export interface Network {
  stations: Station[];
  trips: Trip[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  network?: Network;
}

export interface RideSegment {
  tripId: string;
  lineName: string;
  boardStationId: string;
  alightStationId: string;
  boardTime: number;
  alightTime: number;
}

export interface PlannedJourney {
  feasible: boolean;
  originId: string;
  destinationId: string;
  departureTime: number;
  arrivalTime: number;
  transfers: number;
  segments: RideSegment[];
  waits: { stationId: string; start: number; end: number; kind: 'initial' | 'transfer' }[];
}
