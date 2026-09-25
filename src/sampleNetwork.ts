import type { Network } from './types';

export const sampleNetwork: Network = {
  stations: [
    { id: 'A', name: '东岗', minTransferMinutes: 0 },
    { id: 'B', name: '西桥', minTransferMinutes: 0 },
    { id: 'C', name: '大学城', minTransferMinutes: 3 },
    { id: 'D', name: '体育馆', minTransferMinutes: 0 },
    { id: 'E', name: '机场', minTransferMinutes: 0 },
    { id: 'F', name: '南苑', minTransferMinutes: 0 },
    { id: 'G', name: '北站', minTransferMinutes: 0 }
  ],
  trips: [
    {
      id: 'L1-01',
      lineName: '1路',
      stops: [
        { stationId: 'A', arrival: 480, departure: 480 },
        { stationId: 'C', arrival: 500, departure: 502 },
        { stationId: 'D', arrival: 530, departure: 530 },
        { stationId: 'G', arrival: 560, departure: 560 }
      ]
    },
    {
      id: 'L1-02',
      lineName: '1路',
      stops: [
        { stationId: 'A', arrival: 600, departure: 600 },
        { stationId: 'C', arrival: 625, departure: 627 },
        { stationId: 'D', arrival: 660, departure: 660 },
        { stationId: 'G', arrival: 690, departure: 690 }
      ]
    },
    {
      id: 'L2-01',
      lineName: '2路',
      stops: [
        { stationId: 'F', arrival: 470, departure: 470 },
        { stationId: 'C', arrival: 510, departure: 515 },
        { stationId: 'E', arrival: 545, departure: 545 }
      ]
    },
    {
      id: 'N3-01',
      lineName: '夜间3路（跨午夜）',
      stops: [
        { stationId: 'F', arrival: 1380, departure: 1380 },
        { stationId: 'C', arrival: 1420, departure: 1430 },
        { stationId: 'E', arrival: 1470, departure: 1480 },
        { stationId: 'D', arrival: 1500, departure: 1500 }
      ]
    }
  ]
};
