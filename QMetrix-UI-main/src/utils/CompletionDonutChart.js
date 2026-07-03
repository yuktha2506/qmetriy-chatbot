import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

const SPACER_ANGLE = 4;

const CompletionDonutChart = ({ data, size = 170, innerRadius = 50, outerRadius = 75 }) => {
  const theme = useSelector((state) => state.theme.theme);

  const chartData = useMemo(() => {
    const totalValue = data.reduce((sum, d) => sum + (d.committed || 0), 0);
    if (totalValue === 0) return [];

    const segments = [];
    const validEntries = data.filter((d) => d.committed > 0);
    const spacerValue = (totalValue * SPACER_ANGLE) / 360;

    validEntries.forEach((entry, i) => {
      const completed = entry.completed ?? 0;
      const committed = entry.committed ?? 0;
      const remaining = committed - completed;

      if (completed > 0) {
        segments.push({
          name: entry.label,
          value: completed,
          fill: entry.color,
          type: 'completed',
          completed,
          committed,
          remaining,
        });
      }

      if (remaining > 0) {
        segments.push({
          name: entry.label,
          value: remaining,
          fill: `${entry.color}1A`,
          type: 'remaining',
          completed,
          committed,
          remaining,
        });
      }

      if (i < validEntries.length - 1 || validEntries.length > 1) {
        segments.push({
          name: `${entry.label}_spacer`,
          value: spacerValue,
          fill: 'transparent',
          type: 'spacer',
        });
      }
    });

    return segments;
  }, [data]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const seg = payload[0].payload;
      if (seg.type === 'spacer') return null;
      return (
        <div
          style={{
            backgroundColor: theme === 'light' ? '#202020' : '#173A5A',
            border: theme === 'light' ? 'none' : '1px solid #224F78',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#ffffff',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            lineHeight: '1.6',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{seg.name}</p>
          <p style={{ margin: 0 }}>Total: {seg.committed}</p>
          <p style={{ margin: 0 }}>Completed: {seg.completed}</p>
          <p style={{ margin: 0 }}>Remaining: {seg.remaining}</p>
        </div>
      );
    }
    return null;
  };

  CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.array,
  };

  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <PieChart width={size} height={size}>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          stroke="none"
          paddingAngle={0}
          isAnimationActive={false}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.fill}
              stroke={entry.type === 'spacer' ? 'none' : `${data.find((d) => d.label === entry.name)?.color || entry.fill}60`}
              strokeWidth={entry.type === 'spacer' ? 0 : 1}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </div>
  );
};

CompletionDonutChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      completed: PropTypes.number.isRequired,
      committed: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
    })
  ).isRequired,
  size: PropTypes.number,
  innerRadius: PropTypes.number,
  outerRadius: PropTypes.number,
};

export default CompletionDonutChart;
