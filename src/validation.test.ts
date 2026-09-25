import { describe, expect, it } from 'vitest';
import { parseNetworkJson, validateNetwork } from './validation';
import type { Network } from './types';

const valid: Network = {
  stations: [
    { id: 'A', name: '甲', minTransferMinutes: 3 },
    { id: 'B', name: '乙', minTransferMinutes: 0 }
  ],
  trips: [
    {
      id: 'T1',
      lineName: '1路',
      stops: [
        { stationId: 'A', arrival: 10, departure: 12 },
        { stationId: 'B', arrival: 20, departure: 20 }
      ]
    }
  ]
};

describe('validateNetwork', () => {
  it('接受合法路网', () => {
    const result = validateNetwork(valid);
    expect(result.ok).toBe(true);
  });

  it('定位重复站点ID', () => {
    const bad = structuredClone(valid);
    bad.stations.push({ id: 'A', name: '重复', minTransferMinutes: 0 });
    const result = validateNetwork(bad);
    expect(result.ok).toBe(false);
    expect(result.errors[0].path).toBe('$.stations[2].id');
  });

  it('定位重复班次ID', () => {
    const bad = structuredClone(valid);
    bad.trips.push(bad.trips[0]);
    const result = validateNetwork(bad);
    expect(result.errors.some((e) => e.path === '$.trips[1].id' && e.message.includes('重复'))).toBe(true);
  });

  it('拒绝未知站点引用', () => {
    const bad = structuredClone(valid);
    bad.trips[0].stops[1].stationId = 'X';
    const result = validateNetwork(bad);
    expect(result.errors.some((e) => e.path === '$.trips[0].stops[1].stationId' && e.message.includes('未知站点'))).toBe(true);
  });

  it('拒绝负数与非整数', () => {
    const bad = structuredClone(valid);
    bad.stations[0].minTransferMinutes = -1;
    bad.trips[0].stops[0].arrival = -2;
    const result = validateNetwork(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.path)).toContain('$.stations[0].minTransferMinutes');
    expect(result.errors.map((e) => e.path)).toContain('$.trips[0].stops[0].arrival');
  });

  it('拒绝站内发车早于到达', () => {
    const bad = structuredClone(valid);
    bad.trips[0].stops[0].departure = 5;
    const result = validateNetwork(bad);
    expect(result.errors.some((e) => e.path === '$.trips[0].stops[0]')).toBe(true);
  });

  it('拒绝相邻停站非正行驶时间（零与倒退）', () => {
    const zero = structuredClone(valid);
    zero.trips[0].stops[1].arrival = 12;
    expect(validateNetwork(zero).errors.some((e) => e.path === '$.trips[0].stops[1]')).toBe(true);

    const back = structuredClone(valid);
    back.trips[0].stops[1].arrival = 11;
    expect(validateNetwork(back).errors.some((e) => e.path === '$.trips[0].stops[1]')).toBe(true);
  });

  it('JSON 解析失败返回明确错误且不抛出', () => {
    const result = parseNetworkJson('{ not json');
    expect(result.ok).toBe(false);
    expect(result.errors[0].path).toBe('$');
    expect(result.errors[0].message).toContain('JSON解析失败');
  });
});
