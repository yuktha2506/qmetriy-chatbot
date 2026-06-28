import { useMemo, useRef, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import PropTypes from 'prop-types';

const COLORS = {
  actual: '#2196F3',
  likely: '#48A7FF',
  pessimistic: '#FF4D4F',
  optimistic: '#F7A13B',
  sprintPoints: '#34D399',
};

const splitTickLabel = (label) => {
  const raw = String(label || '');
  if (!raw) return [];

  const cleaned = raw.replace(/\s*\(active\)\s*$/i, '').trim();
  const isActive = raw.length !== cleaned.length;

  if (cleaned.length <= 18) {
    return isActive ? [cleaned, '(active)'] : [cleaned];
  }

  const words = cleaned.split(/\s+/);
  if (words.length < 2) return isActive ? [cleaned, '(active)'] : [cleaned];
  const lastWord = words[words.length - 1];
  return isActive ? [lastWord, '(active)'] : [lastWord];
};

const ReleaseBurnupTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload ?? {};
  const actualEntry = payload.find((p) => p.dataKey === 'actual');
  const likelyEntry = payload.find((p) => p.dataKey === 'likely');
  const pessimisticEntry = payload.find((p) => p.dataKey === 'pessimistic');
  const optimisticEntry = payload.find((p) => p.dataKey === 'optimistic');

  const rows = [];

  if (actualEntry?.value != null) {
    rows.push({ color: COLORS.actual, label: 'Actual', value: actualEntry.value });
  }
  if (dataPoint.sprintPoints != null) {
    rows.push({ color: COLORS.sprintPoints, label: 'Completed in Sprint', value: dataPoint.sprintPoints });
  }
  if (optimisticEntry?.value != null && dataPoint.actual == null) {
    rows.push({ color: COLORS.optimistic, label: 'Optimistic', value: dataPoint._rawOptimistic ?? optimisticEntry.value });
  }
  if (likelyEntry?.value != null && dataPoint.actual == null) {
    rows.push({ color: COLORS.likely, label: 'Likely', value: dataPoint._rawLikely ?? likelyEntry.value });
  }
  if (pessimisticEntry?.value != null && dataPoint.actual == null) {
    rows.push({ color: COLORS.pessimistic, label: 'Pessimistic', value: dataPoint._rawPessimistic ?? pessimisticEntry.value });
  }

  return (
    <div
      style={{
        backgroundColor: isDark ? '#173A5A' : '#0D1621',
        border: isDark ? '1px solid #224F78' : 'none',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        color: '#ffffff',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: row.color,
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <span>{row.label}: <strong>{row.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const ReleaseBurnupLineChart = ({ data, theme = 'dark', insufficientData = false, completedSprintCount = 0 }) => {
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#2d3e52' : '#BBCFE6';
  const axisStroke = isDark ? '#e1def5e6' : '#24527A';

  const firstFutureIndex = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return -1;
    return data.findIndex((d) => d.actual == null);
  }, [data]);
  const hasFutureSprints = firstFutureIndex >= 0;
  const firstFutureSprint = hasFutureSprints ? data[firstFutureIndex]?.sprint : null;
  const lastSprint = data.length > 0 ? data[data.length - 1]?.sprint : null;
  const showGradedArea =
    insufficientData && hasFutureSprints && firstFutureSprint != null && lastSprint != null;

  const additionalSprintsNeeded = useMemo(() => {
    if (!insufficientData) return 0;
    const needed = 3 - completedSprintCount;
    return Math.max(0, needed);
  }, [insufficientData, completedSprintCount]);

  const { yMax, yTicks } = useMemo(() => {
    let max = 0;
    for (const d of data) {
      for (const key of ['actual', 'likely', 'pessimistic', 'optimistic']) {
        if (d[key] != null && d[key] > max) max = d[key];
      }
    }
    if (max === 0) return { yMax: 40, yTicks: [0, 10, 20, 30, 40] };

    const TARGET = 6;
    const padded = max * 1.1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(padded / TARGET)));
    const candidates = [1, 2, 2.5, 5, 10];

    let bestStep = magnitude;
    let bestDiff = Infinity;
    for (const m of candidates) {
      const s = m * magnitude;
      const t = Math.ceil(padded / s) * s;
      const count = Math.round(t / s) + 1;
      const diff = Math.abs(count - TARGET);
      if (diff < bestDiff || (diff === bestDiff && count >= TARGET)) {
        bestStep = s;
        bestDiff = diff;
      }
    }

    const top = Math.ceil(padded / bestStep) * bestStep;
    const ticks = [];
    for (let v = 0; v <= top; v += bestStep) ticks.push(Math.round(v));

    return { yMax: top, yTicks: ticks };
  }, [data]);

  const chartData = useMemo(() => {
    if (!hasFutureSprints) return data;
    const offset = yMax * 0.015;
    return data.map((d) => {
      const opt = d.optimistic;
      const lik = d.likely;
      const pes = d.pessimistic;
      if (d.actual != null || opt == null || lik == null || pes == null) return d;

      const result = { ...d, _rawOptimistic: opt, _rawLikely: lik, _rawPessimistic: pes };

      if (opt === lik && lik === pes) {
        result.optimistic = opt + offset;
        result.pessimistic = Math.max(0, pes - offset);
      } else if (opt === lik) {
        result.optimistic = opt + offset * 0.5;
        result.likely = lik - offset * 0.5;
      } else if (lik === pes) {
        result.likely = lik + offset * 0.5;
        result.pessimistic = Math.max(0, pes - offset * 0.5);
      }

      return result;
    });
  }, [data, hasFutureSprints, yMax]);

  const PX_PER_SPRINT = 100;
  const CHART_HEIGHT = 246;

  const measureRef = useRef(null);
  const scrollRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!measureRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, []);

  const minChartWidth = data.length * PX_PER_SPRINT;
  const chartWidth = Math.max(minChartWidth, containerWidth || 0);

  const BurnupXAxisTick = ({ x, y, payload }) => {
    const isFuture = data[payload?.index]?.actual == null;
    if (isFuture) {
      const futurePosition = payload.index - firstFutureIndex;
      const opacity = Math.max(0.1, 1 - futurePosition * 0.1);
      return (
        <g transform={`translate(${x},${y})`}>
          <rect
            x={-7.5}
            y={6}
            width={15}
            height={2}
            fill="#525F74"
            opacity={opacity}
          />
        </g>
      );
    }
    const lines = splitTickLabel(payload?.value);
    if (lines.length === 0) return null;
    const isFirstTick = payload?.index === 0;
    const isLastTick = !hasFutureSprints && payload?.index === data.length - 1;
    const anchor = isFirstTick ? 'start' : isLastTick ? 'end' : 'middle';
    return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line, idx) => (
          <text
            key={`${payload?.index}-${idx}`}
            x={0}
            y={idx * 12 + 10}
            textAnchor={anchor}
            fill={axisStroke}
            fontSize="11px"
            style={{ userSelect: 'none' }}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  BurnupXAxisTick.propTypes = {
    x: PropTypes.number,
    y: PropTypes.number,
    payload: PropTypes.shape({ index: PropTypes.number, value: PropTypes.string }),
  };

  const BurnupYAxisTick = ({ y, payload }) => (
    <text
      x={4}
      y={y}
      textAnchor="start"
      fill={axisStroke}
      fontSize={11}
      dominantBaseline="middle"
    >
      {Math.round(Number(payload.value))}
    </text>
  );

  BurnupYAxisTick.propTypes = {
    y: PropTypes.number,
    payload: PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) }),
  };

  return (
    <div className="flex-1 min-h-[246px] w-full relative" style={{ minWidth: 0 }}>
      <div ref={measureRef} className="absolute inset-0" style={{ pointerEvents: 'none', visibility: 'hidden' }} />
      <div
        ref={scrollRef}
        className={`overflow-x-auto overflow-y-hidden release-burnup-scroll ${
          isDark ? 'scrollbar-super-thin' : 'scrollbar-super-thin-lightMode'
        }`}
        style={{
          width: '100%',
          height: CHART_HEIGHT + 8,
          scrollbarGutter: 'stable both-edges',
          paddingBottom: '4px',
          contain: 'strict',
        }}
      >
        <div style={{ width: `${chartWidth}px`, minWidth: `${chartWidth}px`, height: `${CHART_HEIGHT}px` }}>
        <LineChart
          width={chartWidth}
          height={CHART_HEIGHT}
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="futureSprintGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4297E0" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#24527A" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStroke} horizontal={true} vertical={false} />
          {data.length > 0 && (
            <ReferenceLine x={data[0].sprint} stroke={gridStroke} />
          )}
          {showGradedArea && (
            <>
              <ReferenceArea
                x1={firstFutureSprint}
                x2={lastSprint}
                fill="url(#futureSprintGradient)"
                fillOpacity={1}
              />
              <ReferenceLine
                x={firstFutureSprint}
                stroke="#4297E0"
                strokeOpacity={0.2}
                strokeWidth={1.5}
              />
            </>
          )}
          <XAxis
            dataKey="sprint"
            stroke={axisStroke}
            tick={<BurnupXAxisTick />}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            stroke={axisStroke}
            width={30}
            tick={<BurnupYAxisTick />}
            axisLine={false}
            tickLine={false}
            domain={[0, yMax]}
            ticks={yTicks}
          />
          <Tooltip content={<ReleaseBurnupTooltip isDark={isDark} />} />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={COLORS.actual}
            strokeWidth={2}
            dot={(!hasFutureSprints && data.filter((d) => d.actual != null).length <= 1) ? { r: 4, fill: COLORS.actual, strokeWidth: 0 } : false}
            connectNulls={false}
            name="Actual"
          />
          {hasFutureSprints && (
            <Line
              type="monotone"
              dataKey="optimistic"
              stroke={COLORS.optimistic}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={true}
              name="Optimistic"
            />
          )}
          {hasFutureSprints && (
            <Line
              type="monotone"
              dataKey="likely"
              stroke={COLORS.likely}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={true}
              name="Likely"
            />
          )}
          {hasFutureSprints && (
            <Line
              type="monotone"
              dataKey="pessimistic"
              stroke={COLORS.pessimistic}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={true}
              name="Pessimistic"
            />
          )}
        </LineChart>
        </div>
      </div>
      {showGradedArea && (
        <span
          className="absolute"
          style={{
            pointerEvents: 'none',
            top: 10,
            left: hasFutureSprints && firstFutureIndex > 0
              ? `calc(${(((firstFutureIndex + 0.6) / data.length) * 100).toFixed(1)}%)`
              : '54%',
            fontSize: '14px',
            fontWeight: 500,
            color: '#7EA6CA',
            letterSpacing: '0.5px',
          }}
        >
          Future Sprints
        </span>
      )}
      {showGradedArea && additionalSprintsNeeded > 0 && (
        <div
          className="absolute flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            pointerEvents: 'none',
            bottom: 58,
            left: hasFutureSprints && firstFutureIndex > 0
              ? `calc(${(((firstFutureIndex + data.length) / (2 * data.length)) * 100).toFixed(1)}%)`
              : '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#142536',
            maxWidth: '280px',
          }}
        >
          <div className="shrink-0 flex items-center justify-center rounded" style={{ width: 24, height: 24, backgroundColor: '#142536' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2L1 21h22L12 2z" fill="#C0880F" stroke="#C0880F" strokeWidth="1" />
              <text x="12" y="16" textAnchor="middle" fill="#000" fontSize="12" fontWeight="bold" fontFamily="sans-serif">!</text>
            </svg>
          </div>
          <span style={{ fontSize: '16px', lineHeight: '1.4', color: '#788D9D' }}>
            {`Need ${additionalSprintsNeeded === 1 ? 'one more additional sprint' : `${additionalSprintsNeeded} more additional sprints`} to gather data`}
          </span>
        </div>
      )}
    </div>
  );
};

ReleaseBurnupLineChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      sprint: PropTypes.string,
      actual: PropTypes.number,
      sprintPoints: PropTypes.number,
      optimistic: PropTypes.number,
      likely: PropTypes.number,
      pessimistic: PropTypes.number,
    })
  ).isRequired,
  theme: PropTypes.oneOf(['light', 'dark']),
  insufficientData: PropTypes.bool,
  completedSprintCount: PropTypes.number,
};

ReleaseBurnupTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  isDark: PropTypes.bool,
};

export default ReleaseBurnupLineChart;
