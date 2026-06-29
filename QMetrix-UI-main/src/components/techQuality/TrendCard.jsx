import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import PropTypes from 'prop-types';

const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', value: 'Value' };

const CustomTrendTooltip = ({ active, payload, label, lines = [], theme = 'light' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
        border: theme === 'light' ? 'none' : '1px solid #224F78',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '11px',
        color: '#FFFFFF',
      }}
    >
      <div style={{ color: '#FFFFFF', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((entry, index) => {
        const lineConfig = lines.find((l) => l.key === entry.dataKey);
        const color = entry.color || lineConfig?.color || '#C8C8C8';
        const displayLabel = lineConfig?.label || SEVERITY_LABELS[entry.dataKey] || (entry.dataKey ? String(entry.dataKey).charAt(0).toUpperCase() + String(entry.dataKey).slice(1) : 'Value');
        return (
          <div
            key={`tooltip-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: index < payload.length - 1 ? 4 : 0,
              color: '#FFFFFF',
              fontSize: '11px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: color,
                borderRadius: '50%',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span>{displayLabel}:</span>
            <span>{entry.value != null && typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
          </div>
        );
      })}
    </div>
  );
};

CustomTrendTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
  lines: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, color: PropTypes.string, label: PropTypes.string })),
  theme: PropTypes.oneOf(['light', 'dark']),
};

const CustomLegend = ({ payload, theme }) => {
  if (!payload || !payload.length) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
      {payload.map((entry, index) => (
        <div
          key={`legend-${index}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: theme === 'light' ? '#0A2342' : '#A3B1C9',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: entry.color,
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

CustomLegend.propTypes = {
  payload: PropTypes.arrayOf(PropTypes.object),
  theme: PropTypes.oneOf(['light', 'dark']),
};

const TrendCard = ({ title, data, lines, rightControl, theme }) => {
  const chartKey = data?.length ? `${data.length}-${data[0]?.label}` : 'empty';
  const safeData = Array.isArray(data) && data.length > 0 ? data : [];
  const xAxisInterval = safeData.length <= 6 ? 0 : 'preserveStartEnd';

  return (
    <div
      className={`tq-card rounded-[10px] border shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md h-[180px] flex flex-col ${
        theme === 'light' ? 'bg-[#FFFFFF] border-[#D1E2F0]' : 'bg-[#182433] border-[#25384F]'
      }`}
    >
      <div className="px-4 pt-3 flex items-center justify-between">
        <div className={`text-base ${theme === 'light' ? 'text-[#0A2342]' : 'text-white'}`}>{title}</div>
        {rightControl}
      </div>
      <div className="px-2 pb-2 pt-2 flex-1 min-h-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart key={chartKey} data={safeData} margin={{ top: 8, right: 16, left: 2, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={theme === 'light' ? '#BBCFE6' : '#2d3e52'}
              vertical
            />
            <XAxis
              dataKey="label"
              stroke={theme === 'light' ? '#24527A' : '#A3B1C9'}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={xAxisInterval}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              stroke={theme === 'light' ? '#24527A' : '#A3B1C9'}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              domain={['auto', 'auto']}
            />
            <RechartsTooltip
              cursor={{ fill: 'transparent' }}
              content={<CustomTrendTooltip lines={lines} theme={theme} />}
            />
            <Legend
              content={<CustomLegend theme={theme} />}
              payload={lines.map((l) => ({
                value: l.label || SEVERITY_LABELS[l.key] || (l.key ? String(l.key).charAt(0).toUpperCase() + String(l.key).slice(1) : 'Value'),
                color: l.color,
              }))}
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ bottom: 0, left: 0, paddingTop: '4px' }}
            />
            {lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

TrendCard.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  lines: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      label: PropTypes.string,
    }),
  ).isRequired,
  rightControl: PropTypes.node,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

TrendCard.defaultProps = {
  rightControl: null,
};

export default TrendCard;
