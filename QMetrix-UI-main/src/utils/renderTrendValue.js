export function renderTrendValue(trendValue, unit = '') {
  let value = 0;
  let suffix = '';

  if (typeof trendValue === 'string') {
    const match = trendValue.match(/^([0-9.-]+)(.*)$/);
    if (match) {
      value = parseFloat(match[1]) || 0;
      suffix = match[2].trim();
    }
  } else if (typeof trendValue === 'number') {
    value = trendValue;
  }

  if (!suffix && unit) {
    suffix = unit;
  }

  return (
    <>
      <span className="text-2xl font-bold text-[#0072BB] dark:text-blue-400">{value}</span>
      {suffix && <span className="text-sm dark:text-gray-300 text-[#626262] ml-1">{suffix}</span>}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="3.5"
        stroke="currentColor"
        className="w-4 h-4 ml-2 text-green-400"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
        />
      </svg>
    </>
  );
}

export function parseTrendValue(trendValue) {
  let value = 0;

  if (typeof trendValue === 'string') {
    const match = trendValue.match(/^([0-9.-]+)/);
    if (match) {
      value = parseFloat(match[1]) || 0;
    }
  } else if (typeof trendValue === 'number') {
    value = trendValue;
  }
  return value;
}
