import PropTypes from 'prop-types';
import { useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { CustomTick } from '../Common/ToolTip';
import { JiraGraphTooltip } from '../Common/ToolTip';
import { getStatusColor } from '../Common/standUpCommonFunctions';

function getChurnLineColor(issueTypes, type) {
  const index = issueTypes.indexOf(type);
  const hue = (index * 137.508) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function CustomChurnTooltip({ active, payload, label, theme }) {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
          border: theme === 'light' ? 'none' : '1px solid #224F78',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '12px',
          color: theme === 'light' ? '#FFFFFF' : '#ffffff',
        }}
      >
        <p
          style={{
            color: theme === 'light' ? '#FFFFFF' : 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '5px',
          }}
        >
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <div
              style={{
                width: 8,
                height: 8,
                backgroundColor: entry.color,
                borderRadius: '50%',
                marginRight: 6,
              }}
            />
            <span style={{ color: theme === 'light' ? '#FFFFFF' : '#C8C8C8' }}>{entry.name}:</span>
            &nbsp;
            <span style={{ color: theme === 'light' ? '#FFFFFF' : 'white' }}>{entry.value} %</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

CustomChurnTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      color: PropTypes.string,
    }),
  ),
  label: PropTypes.string,
  theme: PropTypes.string.isRequired,
};

export function ChurnStoryLineChart({
  chartLineData,
  theme,
  issueTypes,
  selectedOption,
  releaseAxisTick = false,
  chartHeight = 188,
}) {
  const typesToRender = selectedOption === 'All' ? issueTypes : [selectedOption];
  const renderChurnXAxisTick = useCallback(
    (props) =>
      releaseAxisTick ? (
        <CustomTick
          {...props}
          releaseAxis
          fill={theme === 'light' ? '#24527A' : '#e1def5e6'}
        />
      ) : (
        <CustomTick {...props} />
      ),
    [releaseAxisTick, theme],
  );
  return (
    <ResponsiveContainer width="98%" height={chartHeight}>
      <LineChart data={chartLineData} margin={{ top: 5, right: 30, left: -10, bottom: 30 }}>
        <CartesianGrid
          vertical
          horizontal={false}
          stroke={theme === 'light' ? '#BBCFE6' : '#2d3e52'}
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="label"
          stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
          axisLine={false}
          tickMargin={20}
          fontSize={12}
          interval={0}
          tickLine={false}
          tick={renderChurnXAxisTick}
        />
        <YAxis
          stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
          axisLine={false}
          domain={[0, 'dataMax']}
          tickMargin={5}
          fontSize={12}
          tickLine={false}
        />
        <Tooltip content={(props) => <CustomChurnTooltip {...props} theme={theme} />} />
        {typesToRender.map((type) => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            stroke={getChurnLineColor(issueTypes, type)}
            strokeWidth={2}
            dot={{ r: 2, fill: 'white', stroke: '#066FD1', strokeWidth: 1.5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

ChurnStoryLineChart.propTypes = {
  chartLineData: PropTypes.array,
  theme: PropTypes.string.isRequired,
  issueTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedOption: PropTypes.string.isRequired,
  releaseAxisTick: PropTypes.bool,
  chartHeight: PropTypes.number,
};

export function JiraDeveloperStatusBarChart({
  sortedBarChartData,
  theme,
  statusColorMap,
  sortOrder,
  barLeftMargin,
}) {
  if (!(sortOrder === 'default' || sortOrder === 'desc' || sortOrder === 'asc')) return null;
  return (
    <div
      className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-track-transparent ${
        theme === 'light' ? 'scrollbar-super-thin-lightMode' : 'scrollbar-super-thin'
      }`}
    >
      <ResponsiveContainer width="100%" height={sortedBarChartData.length * 25 + 40}>
        <BarChart
          data={sortedBarChartData.map((item) => ({
            ...item,
            color: getStatusColor(item.status, statusColorMap).hex,
          }))}
          layout="vertical"
          barCategoryGap="100%"
          margin={{
            top: 0,
            right: 8,
            left: barLeftMargin,
            bottom: 0,
          }}
          maxBarSize={200}
        >
          <XAxis
            type="number"
            stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
            axisLine={false}
            tickLine={false}
            fontSize={10}
          />
          <YAxis
            dataKey="status"
            type="category"
            stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            interval={0}
            tick={({ x, y, payload }) => {
              const text = payload.value;
              const maxLength = 15;
              const displayText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

              return (
                <g>
                  <title>{text}</title>
                  <text
                    x={x}
                    y={y}
                    textAnchor="end"
                    fill={theme === 'light' ? '#24527A' : '#C8C8C8'}
                    fontSize={11}
                    dy={4}
                  >
                    {displayText}
                  </text>
                </g>
              );
            }}
          />
          <Tooltip content={<JiraGraphTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar
            dataKey="count"
            radius={[10, 10, 10, 10]}
            barSize={5}
            background={{
              fill: theme === 'light' ? '#DBE1EA' : '#25384F',
              radius: [10, 10, 10, 10],
            }}
          >
            {sortedBarChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getStatusColor(entry.status, statusColorMap).hex} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

JiraDeveloperStatusBarChart.propTypes = {
  sortedBarChartData: PropTypes.array.isRequired,
  theme: PropTypes.string.isRequired,
  statusColorMap: PropTypes.instanceOf(Map).isRequired,
  sortOrder: PropTypes.string.isRequired,
  barLeftMargin: PropTypes.number.isRequired,
};

function CustomBarTooltip({ active, payload, label, theme }) {
  if (active && payload?.length) {
    return (
      <div
        style={{
          backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
          border: theme === 'light' ? 'none' : '1px solid #224F78',
          borderRadius: '6px',
          padding: '6px',
          fontSize: '12px',
          color: theme === 'light' ? '#FFFFFF' : '#ffffff',
        }}
      >
        <div
          style={{
            color: theme === 'light' ? '#FFFFFF' : '#ffffff',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        {payload.map((entry, index) => {
          const fallbackColor =
            entry.name === 'Committed' ? '#066FD1' : entry.name === 'Completed' ? '#2FB344' : '#C8C8C8';

          const color = entry.color || fallbackColor;

          return (
            <div
              key={`tooltip-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
                color: theme === 'light' ? '#FFFFFF' : '#ffffff',
                fontSize: '12px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: color,
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
              <span>{entry.name}:</span>
              <span>{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

CustomBarTooltip.propTypes = {
  active: PropTypes.bool,
  label: PropTypes.string,
  payload: PropTypes.array,
  theme: PropTypes.string.isRequired,
};

export function BurndownSprintLineChart({ burndownChartData, theme }) {
  return (
    <div
      className={`w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden ${
        theme === 'light' ? 'scrollbar-super-thin-lightMode' : 'scrollbar-super-thin'
      }`}
      style={{ paddingBottom: '2px' }}
    >
      <div className="min-w-[600px] h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={burndownChartData} margin={{ top: 5, right: 30, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="5 5"
              stroke={theme === 'light' ? '#BBCFE6' : '#2d3e52'}
              horizontal
              vertical
            />
            <XAxis
              dataKey="day"
              stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
              tick={{ fontSize: '11px' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(value, index) => (index === 0 ? '' : value)}
            />
            <YAxis
              stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
              tick={{ fontSize: '11px' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
                border: theme === 'light' ? 'none' : '1px solid #224F78',
                borderRadius: '6px',
                padding: '6px 8px',
                fontSize: '12px',
                color: theme === 'light' ? '#FFFFFF' : '#fff',
              }}
              itemStyle={{ display: 'none' }}
              formatter={() => ''}
              labelFormatter={(label, payload) => {
                const ideal = payload.find((p) => p.dataKey === 'ideal');
                const actual = payload.find((p) => p.dataKey === 'actual');
                const capacity = payload.find((p) => p.dataKey === 'capacity');

                return (
                  <div style={{ lineHeight: 1.5 }}>
                    <div style={{ marginBottom: '4px' }}>{label}</div>
                    {capacity && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#4CAF50',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: theme === 'light' ? '#FFFFFF' : '#fff' }}>
                          Capacity: {capacity.value}
                        </span>
                      </div>
                    )}
                    {ideal && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '2px',
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#F59F12',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: theme === 'light' ? '#FFFFFF' : '#fff' }}>
                          Ideal: {ideal.value}
                        </span>
                      </div>
                    )}
                    {actual && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#066FD1',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: theme === 'light' ? '#FFFFFF' : '#fff' }}>
                          Actual: {actual.value}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="ideal" stroke="#F59F12" dot={false} strokeWidth={2} />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={theme === 'light' ? '#0077E6' : '#066FD1'}
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="capacity"
              stroke="#4CAF50"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

BurndownSprintLineChart.propTypes = {
  burndownChartData: PropTypes.array.isRequired,
  theme: PropTypes.string.isRequired,
};

export function SprintGoalBarChart({
  chartData,
  maxValue,
  barCategoryGap,
  theme,
  sprintdata,
  isSprintGoalStoryPoints,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 0, left: -75, bottom: 0 }}
        barCategoryGap={barCategoryGap}
        barGap={4}
      >
        <XAxis dataKey="sprint" axisLine={false} tickLine={false} tick={false} height={0} />

        <YAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={false}
          domain={[0, maxValue > 0 ? maxValue : 1]}
          allowDataOverflow={false}
        />
        <Tooltip
          content={(props) => <CustomBarTooltip {...props} theme={theme} />}
          cursor={{ fill: 'transparent' }}
        />
        <Bar dataKey="committedDynamic" name="Committed" barSize={6} minPointSize={1}>
          {sprintdata.map((entry, index) => {
            const value = isSprintGoalStoryPoints ? entry.committed : entry.committedHours;
            return (
              <Cell
                key={`committed-${index}`}
                fill={value === 0 ? '#A0A0A0' : theme === 'light' ? '#0077E6' : '#066FD1'}
              />
            );
          })}
        </Bar>

        <Bar dataKey="completedDynamic" name="Completed" barSize={6} minPointSize={1}>
          {sprintdata.map((entry, index) => {
            const value = isSprintGoalStoryPoints ? entry.completed : entry.completedHours;
            return (
              <Cell key={`completed-${index}`} fill={value === 0 ? '#A0A0A0' : '#2FB344'} />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

SprintGoalBarChart.propTypes = {
  chartData: PropTypes.array.isRequired,
  maxValue: PropTypes.number.isRequired,
  barCategoryGap: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  sprintdata: PropTypes.array.isRequired,
  isSprintGoalStoryPoints: PropTypes.bool.isRequired,
};
