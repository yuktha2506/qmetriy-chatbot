import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Customized, Tooltip, XAxis, YAxis } from 'recharts';
import PropTypes from 'prop-types';

const COLORS = {
  workCompleted: '#22C55E',
  workRemaining: '#38BDF8',
  workAdded: '#0072BB',
  workRemoved: '#F44336',
  workForecast: '#788D9D',
};

const CHART_HEIGHT_PX = 246;
const PX_PER_CATEGORY = 65;
const FIXED_BAR_WIDTH_PX = 130;
const XAXIS_HEIGHT_PX = 44;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ReleaseBurndownStackedBar = ({ data, theme, isHoursBasedProject = false }) => {
  const [alignAtBase, setAlignAtBase] = useState(false);
  const scrollRef = useRef(null);

  const { initialEntry, sprintData } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return { initialEntry: null, sprintData: [] };
    const first = data[0];
    const isInitial = first?.state === 'initial';
    return {
      initialEntry: isInitial ? first : null,
      sprintData: isInitial ? data.slice(1) : data,
    };
  }, [data]);

  const buildPreparedData = (entries, startCumulative = 0) => {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const base = entries.map((entry) => {
      const workCompleted = toNumber(entry?.workCompleted);
      const workAdded = toNumber(entry?.workAdded);
      const workRemoved = toNumber(entry?.workRemoved);
      const rawWorkForecast = toNumber(entry?.workForecast);
      const workForecast = entry?.state === 'forecast' && rawWorkForecast > 0 ? Math.max(rawWorkForecast, 3) : rawWorkForecast;
      const workRemaining = toNumber(
        entry?.workRemaining !== undefined ? entry?.workRemaining : entry?.remaining
      );
      return {
        ...entry,
        name: entry?.sprintName || '',
        workCompleted,
        workRemaining,
        workAdded,
        workRemoved,
        workForecast,
      };
    });

    const firstForecastIdx = base.findIndex((d) => d?.state === 'forecast');
    const withSpacer =
      firstForecastIdx > 0
        ? [
            ...base.slice(0, firstForecastIdx),
            {
              sprintName: '__forecast_gap__',
              name: '__forecast_gap__',
              state: 'spacer',
              isSpacer: true,
              workCompleted: 0, workRemaining: 0, workAdded: 0, workRemoved: 0, workForecast: 0,
            },
            ...base.slice(firstForecastIdx),
          ]
        : base;

    const allEntries = initialEntry
      ? [{ ...initialEntry, workCompleted: toNumber(initialEntry.workCompleted), workRemaining: toNumber(initialEntry.workRemaining), workAdded: toNumber(initialEntry.workAdded), workRemoved: toNumber(initialEntry.workRemoved), workForecast: 0 }, ...withSpacer]
      : withSpacer;

    const maxBarHeight = Math.max(
      ...allEntries.map((e) =>
        toNumber(e.workCompleted) + toNumber(e.workRemaining) + toNumber(e.workAdded) + toNumber(e.workRemoved) + toNumber(e.workForecast)
      ),
      1
    );
    const minBarHeight = Math.max(Math.ceil(maxBarHeight * 0.03), 1);

    let cumulativeCompleted = startCumulative;
    return withSpacer.map((entry) => {
      const rawTotal = entry.workCompleted + entry.workRemaining + entry.workAdded + entry.workRemoved + entry.workForecast;
      const needsMinBar = rawTotal === 0 && !entry.isSpacer && entry.state !== 'spacer';
      const workRemaining = needsMinBar ? minBarHeight : entry.workRemaining;
      const totalBarHeight = needsMinBar ? minBarHeight : rawTotal;
      const waterfallOffset = alignAtBase ? 0 : cumulativeCompleted;

      if (!entry.isSpacer && entry.state !== 'spacer') {
        cumulativeCompleted += entry.workCompleted;
      }

      return { ...entry, workRemaining, waterfallOffset, totalBarHeight, _hasNoData: needsMinBar };
    });
  };

  const preparedInitial = useMemo(() => {
    if (!initialEntry) return [];
    const entry = initialEntry;
    const workCompleted = toNumber(entry.workCompleted);
    const rawWorkRemaining = toNumber(entry.workRemaining);
    const fallbackRemaining = toNumber(entry.remaining);
    const workRemaining = rawWorkRemaining > 0 ? rawWorkRemaining : fallbackRemaining;
    const workAdded = toNumber(entry.workAdded);
    const workRemoved = toNumber(entry.workRemoved);
    const rawTotal = workCompleted + workRemaining + workAdded + workRemoved;
    return [{
      ...entry,
      name: entry.sprintName || '',
      workCompleted,
      workRemaining,
      workAdded,
      workRemoved,
      workForecast: 0,
      waterfallOffset: 0,
      totalBarHeight: rawTotal || 1,
      _hasNoData: rawTotal === 0,
    }];
  }, [initialEntry]);

  const initialCumulative = useMemo(() => {
    return preparedInitial.length > 0 ? toNumber(preparedInitial[0].workCompleted) : 0;
  }, [preparedInitial]);

  const preparedSprints = useMemo(() => {
    return buildPreparedData(sprintData, initialCumulative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignAtBase, sprintData, initialCumulative, initialEntry]);

  const allPrepared = useMemo(() => {
    return [...preparedInitial, ...preparedSprints];
  }, [preparedInitial, preparedSprints]);

  const yAxisMax = useMemo(() => {
    if (allPrepared.length === 0) return 1;
    const maxValue = Math.max(
      ...allPrepared.map((item) => toNumber(item.totalBarHeight) + toNumber(item.waterfallOffset)),
      1
    );
    return Math.ceil(maxValue * 1.05);
  }, [allPrepared]);

  const sprintTrackWidth = useMemo(() => {
    const count = preparedSprints.length;
    if (count === 0) return 400;
    const spacerCount = preparedSprints.filter((d) => d.isSpacer).length;
    const barCount = count - spacerCount;
    return Math.max(400, barCount * PX_PER_CATEGORY + spacerCount * 40);
  }, [preparedSprints]);

  const chartTextColor = theme === 'light' ? '#24527A' : '#e1def5e6';
  const highlightBg = theme === 'light' ? '#F0F4F8' : '#243A57';

  const renderBars = (showWaterfall = true) => (
    <>
      {!alignAtBase && showWaterfall ? (
        <Bar dataKey="waterfallOffset" stackId="a" fill="transparent" barSize={30} isAnimationActive={false} />
      ) : null}
      <Bar dataKey="workCompleted" stackId="a" fill={COLORS.workCompleted} barSize={30} name="Work completed" isAnimationActive={false} />
      <Bar dataKey="workRemaining" stackId="a" fill={COLORS.workRemaining} barSize={30} name="Work remaining" isAnimationActive={false} />
      <Bar dataKey="workAdded" stackId="a" fill={COLORS.workAdded} barSize={30} name="Work added" isAnimationActive={false} />
      <Bar dataKey="workRemoved" stackId="a" fill={COLORS.workRemoved} barSize={30} name="Work removed" isAnimationActive={false} />
      <Bar dataKey="workForecast" stackId="a" fill={COLORS.workForecast} barSize={30} name="Work forecast" isAnimationActive={false} />
    </>
  );

  const chartMargin = { top: 20, right: 10, left: 12, bottom: 6 };
  const plotAreaHeight = CHART_HEIGHT_PX - chartMargin.top - chartMargin.bottom - XAXIS_HEIGHT_PX;

  const getBarBottomY = (entry) => {
    const barValue = toNumber(entry.totalBarHeight) + toNumber(entry.waterfallOffset);
    return chartMargin.top + (barValue / yAxisMax) * plotAreaHeight;
  };

  const SprintXAxisTick = () => null;

  const InitialXAxisTick = ({ x, y }) => {
    const lines = ['Original estimate', 'at start of', 'version'];
    const entry = preparedInitial?.[0];
    const minLabelY = chartMargin.top + plotAreaHeight - 88;
    const labelY = alignAtBase || !entry ? y + 10 : Math.max(getBarBottomY(entry) + 14, minLabelY);

    return (
      <g transform={`translate(${x},${labelY})`}>
        {lines.map((line, idx) => (
          <text key={`init-tick-${idx}`} x={0} y={idx * 12 + 3} textAnchor="middle" fill={chartTextColor} fontSize="11px" style={{ userSelect: 'none' }}>
            {line}
          </text>
        ))}
      </g>
    );
  };

  InitialXAxisTick.propTypes = {
    x: PropTypes.number,
    y: PropTypes.number,
    payload: PropTypes.shape({ index: PropTypes.number, value: PropTypes.string }),
  };

  const ForecastDivider = (props) => {
    const { offset } = props;
    if (!offset || !offset.width) return null;
    const totalCategories = preparedSprints.length;
    if (totalCategories === 0) return null;

    const spacerIdx = preparedSprints.findIndex((d) => d?.isSpacer || d?.state === 'spacer');
    const firstForecastIdx = preparedSprints.findIndex((d) => d?.state === 'forecast');
    if (spacerIdx < 0 && firstForecastIdx <= 0) return null;
    const step = offset.width / totalCategories;
    let xLine;
    if (spacerIdx >= 0) {
      xLine = (spacerIdx + 0.5) * step;
    } else if (firstForecastIdx > 0) {
      xLine = firstForecastIdx * step;
    }
    if (xLine === undefined) return null;

    return (
      <g>
        <line
          x1={offset.left + xLine}
          x2={offset.left + xLine}
          y1={chartMargin.top}
          y2={CHART_HEIGHT_PX}
          stroke={theme === 'light' ? '#69869F' : '#69869F'}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      </g>
    );
  };

  ForecastDivider.propTypes = {
    xAxisMap: PropTypes.object,
    offset: PropTypes.shape({ top: PropTypes.number, left: PropTypes.number, width: PropTypes.number, height: PropTypes.number }),
    data: PropTypes.arrayOf(PropTypes.object),
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row || row.isSpacer || row.state === 'spacer' || row.state === 'forecast') return null;

    const atStart = toNumber(
      row.atStartOfSprint !== undefined ? row.atStartOfSprint : row.workCompleted + row.workRemaining
    );
    const added = toNumber(row.addedToVersion !== undefined ? row.addedToVersion : row.workAdded);
    const removed = toNumber(row.removedFromVersion !== undefined ? row.removedFromVersion : row.workRemoved);
    const completed = toNumber(row.completed !== undefined ? row.completed : row.workCompleted);
    const remaining = toNumber(row.remaining !== undefined ? row.remaining : row.workRemaining);

    const tooltipBg = theme === 'light' ? '#0D1621' : '#173A5A';
    const mutedColor = theme === 'light' ? '#B0BEC5' : '#A3B1C9';
    const tipAddedColor = theme === 'light' ? COLORS.workAdded : '#00B0FF';
    const tipRemovedColor = theme === 'light' ? COLORS.workRemoved : '#E42626';
    const tipCompletedColor = theme === 'light' ? COLORS.workCompleted : '#1AD939';
    return (
      <div style={{
        backgroundColor: tooltipBg,
        border: theme === 'light' ? 'none' : '1px solid #224F78',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '12px',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px' }}>{row.sprintName}</div>
        {row.dateRange && <div style={{ marginBottom: '8px', color: mutedColor }}>{row.dateRange}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>{atStart}</span>
            <span style={{ color: mutedColor }}>at start of sprint</span>
          </div>
          {added > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', color: tipAddedColor }}>+{added}</span>
              <span style={{ color: mutedColor }}>added to version</span>
            </div>
          )}
          {removed > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', color: tipRemovedColor }}>-{removed}</span>
              <span style={{ color: mutedColor }}>removed from version</span>
            </div>
          )}
          {completed > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', color: tipCompletedColor }}>{completed}</span>
              <span style={{ color: mutedColor }}>completed</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>{remaining}</span>
            <span style={{ color: mutedColor }}>remaining</span>
          </div>
        </div>
      </div>
    );
  };

  CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.arrayOf(PropTypes.shape({ payload: PropTypes.object })),
  };

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#24527A] dark:text-gray-500">
        No data available for release burndown
      </div>
    );
  }

  return (
    <div className="w-full h-full min-w-0 max-w-full flex flex-col overflow-hidden">
      <div className="w-full flex-1 min-h-0 min-w-0 max-w-full overflow-hidden flex flex-row gap-5">
        {/* Chart area */}
        <div
          className="flex-1 h-full min-w-0 relative overflow-hidden flex flex-row"
        >
          {/* Y-Axis label */}
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: '28px' }}
          >
            <div
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                color: chartTextColor,
                fontSize: '11px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {isHoursBasedProject ? 'HOURS' : 'STORY POINTS'}
            </div>
          </div>

          {/* Chart area without inner container */}
          <div
            className="flex-1 h-full overflow-hidden flex flex-row"
            style={{ minWidth: 0 }}
          >
            {/* Sticky Original Estimate section */}
            {preparedInitial.length > 0 && (
              <div
                className="flex-shrink-0 relative"
                style={{
                  width: `${FIXED_BAR_WIDTH_PX}px`,
                  height: '100%',
                  backgroundColor: highlightBg,
                  borderRight: `1.5px solid ${theme === 'light' ? '#D1E2F0' : '#45669F'}`,
                }}
              >
                <div style={{ width: `${FIXED_BAR_WIDTH_PX}px`, height: `${CHART_HEIGHT_PX}px` }}>
                  <BarChart
                    width={FIXED_BAR_WIDTH_PX}
                    height={CHART_HEIGHT_PX}
                    data={preparedInitial}
                    margin={chartMargin}
                    barCategoryGap="20%"
                  >
                    <XAxis
                      dataKey="name"
                      tick={<InitialXAxisTick />}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      height={44}
                    />
                    <YAxis
                      domain={[0, yAxisMax]}
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                      width={0}
                      reversed={!alignAtBase}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                      isAnimationActive={false}
                    />
                    {renderBars(false)}
                  </BarChart>
                </div>
              </div>
            )}

            {/* Scrollable sprint bars */}
            <div
              className="flex-1 h-full overflow-hidden"
              style={{ minWidth: 0 }}
            >
            <div
              ref={scrollRef}
              className={`h-full overflow-x-auto overflow-y-hidden release-burndown-scroll ${
                theme === 'light' ? 'scrollbar-super-thin-lightMode' : 'scrollbar-super-thin'
              }`}
              style={{
                width: '100%',
                scrollbarGutter: 'stable both-edges',
                paddingBottom: '4px',
                contain: 'strict',
              }}
            >
              <div
                style={{
                  width: `${sprintTrackWidth}px`,
                  minWidth: `${sprintTrackWidth}px`,
                  height: `${CHART_HEIGHT_PX}px`,
                }}
              >
              <BarChart
                width={sprintTrackWidth}
                height={CHART_HEIGHT_PX}
                data={preparedSprints}
                margin={chartMargin}
                barCategoryGap="10%"
                barGap={2}
              >
                <XAxis
                  dataKey="name"
                  tick={<SprintXAxisTick />}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={44}
                />
                <YAxis
                  domain={[0, yAxisMax]}
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                  width={0}
                  reversed={!alignAtBase}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
                  isAnimationActive={false}
                />
                {renderBars(true)}
                <Customized component={ForecastDivider} />
              </BarChart>
            </div>
          </div>
          </div>
          </div>
        </div>
      </div>

      {/* Legend & checkbox */}
      <div
        className={`flex items-center px-2 py-1 text-xs flex-shrink-0 ${
          theme === 'light' ? 'text-[#626262]' : 'text-[#A3B1C9]'
        }`}
        style={{
          marginTop: '4px',
          marginBottom: '10px',
          paddingLeft: '30px',
        }}
      >
        <label className="flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={alignAtBase}
            onChange={(e) => setAlignAtBase(e.target.checked)}
            className="mr-2 cursor-pointer"
            style={{
              width: '14px',
              height: '14px',
              accentColor: theme === 'light' ? '#5580A6' : '#1976D2',
              outline: theme === 'light' ? '1.5px solid #5580A6' : 'none',
              outlineOffset: '-1px',
              borderRadius: '2px',
            }}
          />
          <span className={`text-xs ${theme === 'light' ? 'text-[#24527A]' : 'text-[#A3B1C9]'}`}>
            Align sprints at the base of the chart
          </span>
        </label>
        <div className={`flex-1 flex items-center justify-center gap-3 ${theme === 'light' ? 'text-[#24527A]' : ''}`}>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full inline-block mr-2" style={{ backgroundColor: COLORS.workCompleted }} />
            Work completed
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full inline-block mr-2" style={{ backgroundColor: COLORS.workRemaining }} />
            Work remaining
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full inline-block mr-2" style={{ backgroundColor: COLORS.workAdded }} />
            Work added
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full inline-block mr-2" style={{ backgroundColor: COLORS.workForecast }} />
            Work forecast
          </div>
        </div>
      </div>
    </div>
  );
};

ReleaseBurndownStackedBar.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      sprintName: PropTypes.string,
      dateRange: PropTypes.string,
      state: PropTypes.string,
      workCompleted: PropTypes.number,
      workRemaining: PropTypes.number,
      workAdded: PropTypes.number,
      workRemoved: PropTypes.number,
      workForecast: PropTypes.number,
      atStartOfSprint: PropTypes.number,
      addedToVersion: PropTypes.number,
      removedFromVersion: PropTypes.number,
      completed: PropTypes.number,
      remaining: PropTypes.number,
    })
  ).isRequired,
  theme: PropTypes.string.isRequired,
  isHoursBasedProject: PropTypes.bool,
};

export default ReleaseBurndownStackedBar;
