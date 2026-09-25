import { describe, expect, it } from 'vitest';
import { planJourney } from './planner';
import { sampleNetwork } from './sampleNetwork';
import type { Network } from './types';

describe('planJourney', () => {
  it('起终点相同返回零乘车行程', () => {
    const j = planJourney(sampleNetwork, 'A', 'A', 480, 2);
    expect(j.feasible).toBe(true);
    expect(j.segments).toHaveLength(0);
    expect(j.transfers).toBe(0);
    expect(j.arrivalTime).toBe(480);
  });

  it('选择最早到达的直达班次', () => {
    const j = planJourney(sampleNetwork, 'A', 'G', 470, 0);
    expect(j.feasible).toBe(true);
    expect(j.segments).toHaveLength(1);
    expect(j.segments[0].tripId).toBe('L1-01');
    expect(j.arrivalTime).toBe(560);
    expect(j.waits[0]).toMatchObject({ kind: 'initial', start: 470, end: 480 });
  });

  it('需要换乘时留足最短换乘时间，恰好赶上允许登车', () => {
    // L1-01 到大学城 C：500 到，502 发；C 最短换乘 3 分钟 => 503 可换乘
    // L2-01 在 C 510 到 / 515 发，可赶上 -> 机场 E 545
    const j = planJourney(sampleNetwork, 'A', 'E', 470, 1);
    expect(j.feasible).toBe(true);
    expect(j.segments.map((s) => s.tripId)).toEqual(['L1-01', 'L2-01']);
    expect(j.transfers).toBe(1);
    expect(j.arrivalTime).toBe(545);
    expect(j.waits.find((w) => w.kind === 'transfer')).toMatchObject({
      stationId: 'C',
      start: 500,
      end: 515
    });
  });

  it('换乘时间不足时该方案不可行', () => {
    // 构造：到 C 510，C 最短换乘 10 分钟，接续车 515 发 -> 赶不上
    const network: Network = {
      stations: [
        { id: 'A', name: 'A', minTransferMinutes: 0 },
        { id: 'C', name: 'C', minTransferMinutes: 10 },
        { id: 'E', name: 'E', minTransferMinutes: 0 }
      ],
      trips: [
        {
          id: 'T1',
          lineName: '一',
          stops: [
            { stationId: 'A', arrival: 500, departure: 500 },
            { stationId: 'C', arrival: 510, departure: 512 }
          ]
        },
        {
          id: 'T2',
          lineName: '二',
          stops: [
            { stationId: 'C', arrival: 513, departure: 515 },
            { stationId: 'E', arrival: 530, departure: 530 }
          ]
        }
      ]
    };
    expect(planJourney(network, 'A', 'E', 490, 1).feasible).toBe(false);
  });

  it('同一班次继续乘坐不计换乘', () => {
    const j = planJourney(sampleNetwork, 'A', 'G', 590, 1);
    expect(j.segments).toHaveLength(1);
    expect(j.transfers).toBe(0);
    expect(j.segments[0].tripId).toBe('L1-02');
  });

  it('支持跨午夜班次并正确显示到达时刻', () => {
    // N3-01: F 23:00 -> C 23:40/23:50 -> E 次日00:30 -> D 次日01:00
    const j = planJourney(sampleNetwork, 'F', 'D', 1370, 0);
    expect(j.feasible).toBe(true);
    expect(j.segments[0].tripId).toBe('N3-01');
    expect(j.arrivalTime).toBe(1500);
  });

  it('超过换乘上限或无可达班次时明确不可行', () => {
    expect(planJourney(sampleNetwork, 'A', 'E', 470, 0).feasible).toBe(false);
    const isolated: Network = {
      stations: [{ id: 'Z', name: '孤岛', minTransferMinutes: 0 }],
      trips: []
    };
    expect(planJourney(isolated, 'Z', 'A', 0, 3).feasible).toBe(false);
  });

  it('到达相同时优先换乘少，再按班次ID序列字典序', () => {
    // T1 A->X 100->110; T2/T3 X->B 均 120发 130到（换乘1次）
    // D0 A->B 105发 130到（直达，到达相同但换乘0）
    const network: Network = {
      stations: [
        { id: 'A', name: 'A', minTransferMinutes: 0 },
        { id: 'X', name: 'X', minTransferMinutes: 0 },
        { id: 'B', name: 'B', minTransferMinutes: 0 }
      ],
      trips: [
        { id: 'T1', lineName: '一', stops: [
          { stationId: 'A', arrival: 100, departure: 100 },
          { stationId: 'X', arrival: 110, departure: 110 }
        ] },
        { id: 'T3', lineName: '三', stops: [
          { stationId: 'X', arrival: 120, departure: 120 },
          { stationId: 'B', arrival: 130, departure: 130 }
        ] },
        { id: 'T2', lineName: '二', stops: [
          { stationId: 'X', arrival: 120, departure: 120 },
          { stationId: 'B', arrival: 130, departure: 130 }
        ] },
        { id: 'D0', lineName: '直达', stops: [
          { stationId: 'A', arrival: 105, departure: 105 },
          { stationId: 'B', arrival: 130, departure: 130 }
        ] }
      ]
    };
    const j = planJourney(network, 'A', 'B', 90, 2);
    expect(j.segments).toHaveLength(1);
    expect(j.segments[0].tripId).toBe('D0');
    expect(j.transfers).toBe(0);

    // 去掉直达后，T2 与 T3 字典序 T2 优先
    const noDirect: Network = { ...network, trips: network.trips.filter((t) => t.id !== 'D0') };
    const j2 = planJourney(noDirect, 'A', 'B', 90, 2);
    expect(j2.segments.map((s) => s.tripId)).toEqual(['T1', 'T2']);
  });

  it('不会因较早到达的车站状态丢弃仍可得到更优结果的在乘状态', () => {
    // 在 X 站：慢车先到 X（200）但其后续不到 B；快车后到 X（210）继续到 B。
    // 若只保留“最早到达 X”的状态会错误判定不可行。
    const network: Network = {
      stations: [
        { id: 'A', name: 'A', minTransferMinutes: 0 },
        { id: 'X', name: 'X', minTransferMinutes: 0 },
        { id: 'B', name: 'B', minTransferMinutes: 0 }
      ],
      trips: [
        { id: 'SLOW', lineName: '慢', stops: [
          { stationId: 'A', arrival: 100, departure: 100 },
          { stationId: 'X', arrival: 200, departure: 210 }
        ] },
        { id: 'FAST', lineName: '快', stops: [
          { stationId: 'A', arrival: 110, departure: 110 },
          { stationId: 'X', arrival: 210, departure: 220 },
          { stationId: 'B', arrival: 300, departure: 300 }
        ] }
      ]
    };
    const j = planJourney(network, 'A', 'B', 90, 1);
    expect(j.feasible).toBe(true);
    expect(j.segments.map((s) => s.tripId)).toEqual(['FAST']);
    expect(j.arrivalTime).toBe(300);
  });
});
