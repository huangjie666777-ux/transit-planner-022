import type { Network, ValidationError, ValidationResult } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function validateNetwork(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const push = (path: string, message: string) => errors.push({ path, message });

  if (!isObject(input)) {
    return { ok: false, errors: [{ path: '$', message: '根节点必须是对象，包含 stations 与 trips 数组' }] };
  }
  if (!Array.isArray(input.stations)) {
    push('$.stations', '必须是站点数组');
  }
  if (!Array.isArray(input.trips)) {
    push('$.trips', '必须是班次数组');
  }
  if (errors.length > 0) return { ok: false, errors };

  const stations = input.stations as unknown[];
  const trips = input.trips as unknown[];
  const stationIds = new Set<string>();

  stations.forEach((raw, i) => {
    const base = `$.stations[${i}]`;
    if (!isObject(raw)) {
      push(base, '站点必须是对象');
      return;
    }
    if (!isNonEmptyString(raw.id)) push(`${base}.id`, '必须是非空字符串');
    else if (stationIds.has(raw.id)) push(`${base}.id`, `站点ID重复: ${raw.id}`);
    else stationIds.add(raw.id);
    if (!isNonEmptyString(raw.name)) push(`${base}.name`, '必须是非空字符串');
    if (!isFiniteNonNegativeInt(raw.minTransferMinutes)) {
      push(`${base}.minTransferMinutes`, '必须是非负整数（分钟）');
    }
  });

  const tripIds = new Set<string>();

  trips.forEach((raw, i) => {
    const base = `$.trips[${i}]`;
    if (!isObject(raw)) {
      push(base, '班次必须是对象');
      return;
    }
    if (!isNonEmptyString(raw.id)) push(`${base}.id`, '必须是非空字符串');
    else if (tripIds.has(raw.id)) push(`${base}.id`, `班次ID重复: ${raw.id}`);
    else tripIds.add(raw.id);
    if (!isNonEmptyString(raw.lineName)) push(`${base}.lineName`, '必须是非空字符串');
    if (!Array.isArray(raw.stops)) {
      push(`${base}.stops`, '必须是停站数组');
      return;
    }
    const stops = raw.stops as unknown[];
    if (stops.length < 2) push(`${base}.stops`, '每个班次至少包含2个停站');
    const seenStation = new Set<string>();
    stops.forEach((rawStop, j) => {
      const sbase = `${base}.stops[${j}]`;
      if (!isObject(rawStop)) {
        push(sbase, '停站必须是对象');
        return;
      }
      if (!isNonEmptyString(rawStop.stationId)) {
        push(`${sbase}.stationId`, '必须是非空字符串');
      } else {
        if (!stationIds.has(rawStop.stationId)) {
          push(`${sbase}.stationId`, `引用了未知站点: ${rawStop.stationId}`);
        }
        if (seenStation.has(rawStop.stationId)) {
          push(`${sbase}.stationId`, `同一班次中站点重复停靠: ${rawStop.stationId}`);
        }
        seenStation.add(rawStop.stationId);
      }
      if (!isFiniteNonNegativeInt(rawStop.arrival)) push(`${sbase}.arrival`, '必须是非负整数（分钟）');
      if (!isFiniteNonNegativeInt(rawStop.departure)) push(`${sbase}.departure`, '必须是非负整数（分钟）');
      if (isFiniteNonNegativeInt(rawStop.arrival) && isFiniteNonNegativeInt(rawStop.departure)) {
        if (rawStop.departure < rawStop.arrival) {
          push(sbase, '发车时刻不得早于到达时刻（倒退时刻）');
        }
        if (j > 0) {
          const prev = stops[j - 1];
          if (isObject(prev) && isFiniteNonNegativeInt(prev.departure) && isFiniteNonNegativeInt(rawStop.arrival)) {
            if (!(rawStop.arrival > prev.departure)) {
              push(sbase, `到达时刻必须晚于上一站发车时刻（相邻停站行驶时间须为正）`);
            }
          }
        }
      }
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], network: input as unknown as Network };
}

export function parseNetworkJson(text: string): ValidationResult {
  try {
    return validateNetwork(JSON.parse(text));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [{ path: '$', message: `JSON解析失败: ${message}` }] };
  }
}
