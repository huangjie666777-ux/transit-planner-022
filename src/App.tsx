import { useMemo, useState } from 'react';
import { sampleNetwork } from './sampleNetwork';
import { parseNetworkJson } from './validation';
import { planJourney } from './planner';
import { formatClock, formatDuration, timeInputToMinutes } from './time';
import type { Network, PlannedJourney, ValidationError } from './types';
import { NetworkDiagram } from './NetworkDiagram';

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const DEFAULT_TIME = '08:00';

export default function App() {
  const [network, setNetwork] = useState<Network>(sampleNetwork);
  const [networkName, setNetworkName] = useState('内置示例路网');
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [origin, setOrigin] = useState('A');
  const [destination, setDestination] = useState('E');
  const [departureInput, setDepartureInput] = useState(DEFAULT_TIME);
  const [maxTransfers, setMaxTransfers] = useState(2);
  const [journey, setJourney] = useState<PlannedJourney | null>(null);
  const [queryError, setQueryError] = useState('');

  const stationName = useMemo(() => {
    const map = new Map(network.stations.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? id;
  }, [network]);

  const invalidateResults = () => {
    setJourney(null);
    setQueryError('');
  };

  const loadSample = () => {
    setNetwork(sampleNetwork);
    setNetworkName('内置示例路网');
    setImportErrors([]);
    invalidateResults();
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await readFileText(file);
    const result = parseNetworkJson(text);
    if (result.ok && result.network) {
      setNetwork(result.network);
      setNetworkName(`已导入: ${file.name}`);
      setImportErrors([]);
      invalidateResults();
    } else {
      setImportErrors(result.errors);
    }
  };

  const runQuery = () => {
    const departure = timeInputToMinutes(departureInput);
    if (Number.isNaN(departure)) {
      setQueryError('出发时刻格式应为 HH:MM，例如 08:30');
      setJourney(null);
      return;
    }
    if (!network.stations.some((s) => s.id === origin)) {
      setQueryError('起点不存在于当前路网');
      setJourney(null);
      return;
    }
    if (!network.stations.some((s) => s.id === destination)) {
      setQueryError('终点不存在于当前路网');
      setJourney(null);
      return;
    }
    setQueryError('');
    setJourney(planJourney(network, origin, destination, departure, Math.max(0, Math.floor(maxTransfers))));
  };

  return (
    <main className="app">
      <header>
        <h1>离线公交换乘规划器</h1>
        <p className="subtitle">仅依据班次时刻规划，全程在浏览器本地计算，不使用地图或在线交通服务。</p>
      </header>

      <section className="card">
        <h2>1. 路网数据</h2>
        <div className="row">
          <button type="button" onClick={loadSample}>载入示例路网</button>
          <label className="file-label">
            导入 JSON 路网
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => void handleImportFile(e.target.files?.[0])}
            />
          </label>
          <span className="muted">当前：{networkName}（{network.stations.length} 站 / {network.trips.length} 班次）</span>
        </div>
        {importErrors.length > 0 && (
          <div className="error-box" role="alert">
            <strong>导入失败，已保留原有路网。共 {importErrors.length} 处错误：</strong>
            <ul>
              {importErrors.map((err, i) => (
                <li key={i}><code>{err.path}</code>：{err.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. 查询条件</h2>
        <div className="form-grid">
          <label>
            起点
            <select value={origin} onChange={(e) => { setOrigin(e.target.value); invalidateResults(); }}>
              {network.stations.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.id}）</option>)}
            </select>
          </label>
          <label>
            终点
            <select value={destination} onChange={(e) => { setDestination(e.target.value); invalidateResults(); }}>
              {network.stations.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.id}）</option>)}
            </select>
          </label>
          <label>
            出发时刻
            <input type="time" value={departureInput} onChange={(e) => { setDepartureInput(e.target.value); invalidateResults(); }} />
          </label>
          <label>
            最多换乘次数
            <input type="number" min={0} max={10} value={maxTransfers} onChange={(e) => { setMaxTransfers(Number(e.target.value)); invalidateResults(); }} />
          </label>
        </div>
        <div className="row">
          <button type="button" className="primary" onClick={runQuery}>规划行程</button>
          <span className="muted">支持跨午夜时刻（如 23:40 之后的班次）；时刻均为运营日零点起分钟数。</span>
        </div>
        {queryError && <div className="error-box" role="alert">{queryError}</div>}
      </section>

      <section className="card">
        <h2>3. 站点示意图</h2>
        <div className="diagram-wrap">
          <NetworkDiagram network={network} journey={journey} />
        </div>
      </section>

      <section className="card">
        <h2>4. 规划结果</h2>
        {!journey && <p className="muted">修改查询条件或路网后请重新点击“规划行程”；此处不会展示过期结果。</p>}
        {journey && !journey.feasible && (
          <div className="error-box" role="status">
            无可行班次：在最多 {maxTransfers} 次换乘的限制下，无法从
            「{stationName(journey.originId)}」到达「{stationName(journey.destinationId)}」。
          </div>
        )}
        {journey?.feasible && journey.segments.length === 0 && (
          <div className="result-box" role="status">
            起点与终点相同（{stationName(journey.originId)}），为零乘车行程：
            出发 {formatClock(journey.departureTime)}，即时刻到达，总耗时 0 分钟，换乘 0 次。
          </div>
        )}
        {journey?.feasible && journey.segments.length > 0 && (
          <div className="result-box" role="status">
            <ol className="segments">
              {journey.segments.map((seg, i) => (
                <li key={i}>
                  <div className="seg-head">
                    <strong>第 {i + 1} 段：{seg.lineName}（班次 {seg.tripId}）</strong>
                  </div>
                  <div className="seg-body">
                    <span>上车：{stationName(seg.boardStationId)}（{seg.boardStationId}） {formatClock(seg.boardTime)} 发车</span>
                    <span>下车：{stationName(seg.alightStationId)}（{seg.alightStationId}） {formatClock(seg.alightTime)} 到达</span>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="waits">
              {journey.waits.map((wait, i) => (
                <li key={i}>
                  {wait.kind === 'initial'
                    ? `在 ${stationName(wait.stationId)} 候车 ${wait.end - wait.start} 分钟（${formatClock(wait.start)} → ${formatClock(wait.end)}）`
                    : `在 ${stationName(wait.stationId)} 换乘等待 ${wait.end - wait.start} 分钟（${formatClock(wait.start)} → ${formatClock(wait.end)}，含最短换乘时间）`}
                </li>
              ))}
            </ul>
            <div className="summary">
              <span>最早到达：<strong>{formatClock(journey.arrivalTime)}</strong></span>
              <span>总耗时：<strong>{formatDuration(journey.arrivalTime - journey.departureTime)}</strong></span>
              <span>换乘次数：<strong>{journey.transfers}</strong></span>
              <span>乘坐班次：{journey.segments.map((s) => s.tripId).join(' → ')}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
