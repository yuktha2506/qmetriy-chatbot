/* eslint-disable react-refresh/only-export-components */
import PropTypes from 'prop-types';

export const generateDateRange = (start, end) => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const range = [];
  while (startDate <= endDate) {
    const day = startDate.getDay();
    if (day !== 0 && day !== 6) {
      range.push(startDate.toISOString().split('T')[0]);
    }
    startDate.setDate(startDate.getDate() + 1);
  }
  return range;
};


export function getCommonPrefix(strings) {
  if (!strings.length) return '';
  const tokenArrays = strings.map((str) => str.split(' '));
  const firstTokens = tokenArrays[0];
  let commonTokens = [];
  for (let i = 0; i < firstTokens.length; i++) {
    const token = firstTokens[i];
    if (tokenArrays.every((tokens) => tokens[i] === token)) {
      commonTokens.push(token);
    } else {
      break;
    }
  }
  return commonTokens.length > 0 ? commonTokens.join(' ') + ' ' : '';
}


export const getWorkingDaysBetweenDates = (startDate, endDate) => {
  let count = 0;
  const curDate = new Date(startDate);
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

export const normalizeName = (name) =>
  name
    ?.toLowerCase()
    .replace(/[^a-z]/gi, '')
    .trim() || '';

export const isNearbyMatch = (jiraName, gitName) => {
  if (!jiraName || !gitName) return false;
  const normJira = normalizeName(jiraName);
  const normGit = normalizeName(gitName);
  if (!normJira || !normGit) return false;
  if (normJira.includes(normGit) || normGit.includes(normJira)) return true;
  return normJira.slice(0, 3) === normGit.slice(0, 3);
};

export const CustomChurnTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: '#173A5A',
          border: '1px solid #224F78',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '11px',
          color: '#ffffff',
        }}
      >
        <p
          style={{
            color: 'white',
            fontWeight: 'bold',
            fontSize: '11px',
            marginBottom: '5px',
          }}
        >
          {label}
        </p>
        {payload.map((entry, index) => (
          <div
            key={`item-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 2,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                backgroundColor: entry.color,
                marginRight: 6,
              }}
            />
            <span style={{ color: '#C8C8C8' }}>{entry.name}:</span>&nbsp;
            <span>{entry.value} %</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

CustomChurnTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      color: PropTypes.string,
    })
  ),
  label: PropTypes.string,
};



export const sharedColors = [
  { hex: '#20B15E', tailwind: 'bg-green-500' },
  { hex: '#E26A96', tailwind: 'bg-pink-500' },
  { hex: '#f97316', tailwind: 'bg-orange-500' },
  { hex: '#2A9D8F', tailwind: 'bg-teal-500' },
  { hex: '#066FD1', tailwind: 'bg-blue-500' },
  { hex: '#E3B900', tailwind: 'bg-yellow-500' },
  { hex: '#06C3D1', tailwind: 'bg-indigo-500' },
];

export const barColors = sharedColors.map(c => c.hex);
export const tailwindColors = sharedColors.map(c => c.tailwind);

export const createColorMapping = (statusData) => {
  const colorMap = new Map();
  statusData.forEach((item, index) => {
    if (sharedColors[item.status]) {
      colorMap.set(item.status, sharedColors[item.status]);
    } else {
      colorMap.set(item.status, {
        hex: barColors[index % barColors.length],
        tailwind: tailwindColors[index % tailwindColors.length]
      });
    }
  });
  return colorMap;
};

export const getStatusColor = (status, colorMap) => {
  if (status === 'Overdue') {
    return {
      hex: '#ef4444',
      tailwind: 'bg-red-500'
    };
  }
  
  if (sharedColors[status]) {
    return sharedColors[status];
  }
  return colorMap.get(status) || {
    hex: barColors[0],
    tailwind: tailwindColors[0]
  };
};
