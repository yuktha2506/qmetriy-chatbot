import PropTypes from 'prop-types';

const ChartTooltip = ({ active, payload, label, theme = 'dark', dataType, showAssignee = false }) => {
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
            fontSize: '11px',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        {payload.map((entry, index) => {
          const fallbackColor = entry.color || '#C8C8C8';
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
                }}
              />
              <span>{showAssignee ? 'Defect' : entry.name}:</span>
              <span>{dataType === 'percentage' ? `${entry.value}%` : entry.value}</span>
              {showAssignee && entry.payload?.assignee && (
                <span style={{ marginLeft: '8px', fontSize: '10px', opacity: 0.8 }}>
                  | Assignee: {entry.payload.assignee}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

ChartTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  theme: PropTypes.string,
  dataType: PropTypes.string,
  showAssignee: PropTypes.bool,
};

export default ChartTooltip;
