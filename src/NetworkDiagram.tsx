import type { Network, PlannedJourney } from './types';

interface Props {
  network: Network;
  journey: PlannedJourney | null;
}

export function NetworkDiagram({ network, journey }: Props) {
  const width = Math.max(720, network.stations.length * 150 + 80);
  const height = 180;
  const positions = new Map(network.stations.map((station, i) => [station.id, { x: 60 + i * 150, y: 90 }]));

  const usedStations = new Set<string>();
  const usedEdges = new Set<string>();
  if (journey?.feasible) {
    journey.segments.forEach((segment) => {
      usedStations.add(segment.boardStationId);
      usedStations.add(segment.alightStationId);
      const trip = network.trips.find((t) => t.id === segment.tripId);
      if (!trip) return;
      let active = false;
      for (let i = 0; i + 1 < trip.stops.length; i++) {
        const a = trip.stops[i].stationId;
        const b = trip.stops[i + 1].stationId;
        if (a === segment.boardStationId) active = true;
        if (active) usedEdges.add(`${a}->${b}`);
        if (b === segment.alightStationId) active = false;
      }
    });
  }

  return (
    <svg className="diagram" role="img" aria-label="站点示意图" viewBox={`0 0 ${width} ${height}`}>
      {network.trips.map((trip, ti) =>
        trip.stops.slice(1).map((stop, si) => {
          const from = trip.stops[si].stationId;
          const to = stop.stationId;
          const pa = positions.get(from);
          const pb = positions.get(to);
          if (!pa || !pb) return null;
          const highlighted = usedEdges.has(`${from}->${to}`);
          const midX = (pa.x + pb.x) / 2;
          const y = pa.y + (ti % 2 === 0 ? -26 : 26) + (highlighted ? 0 : 0);
          return (
            <g key={`${trip.id}-${si}`}>
              <path
                d={`M ${pa.x} ${pa.y} Q ${midX} ${y} ${pb.x} ${pb.y}`}
                className={highlighted ? 'edge edge-active' : 'edge'}
              />
              {highlighted && (
                <text x={midX} y={y - 6} textAnchor="middle" className="edge-label">
                  {trip.lineName} {trip.id}
                </text>
              )}
            </g>
          );
        })
      )}
      {network.stations.map((station) => {
        const p = positions.get(station.id)!;
        const active = usedStations.has(station.id);
        return (
          <g key={station.id}>
            <circle cx={p.x} cy={p.y} r={active ? 9 : 6} className={active ? 'node node-active' : 'node'} />
            <text x={p.x} y={p.y - 16} textAnchor="middle" className="node-label">
              {station.name}
            </text>
            <text x={p.x} y={p.y + 26} textAnchor="middle" className="node-id">
              {station.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
