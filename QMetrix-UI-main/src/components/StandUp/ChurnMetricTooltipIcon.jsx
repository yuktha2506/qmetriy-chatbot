/* eslint-disable react/prop-types */
import { useMemo } from 'react';
import ReactDOMServer from 'react-dom/server';
import PropTypes from 'prop-types';
import TooltipIcon from '../../utils/TooltipIcon';

const BENCHMARK_ROWS = [
  {
    range: '0 – 5%',
    leftBg: 'rgba(34,197,94,0.16)',
    borderLeft: '#22C55E',
    label: 'Excellent',
    labelColor: '#86EFAC',
    detail: 'Highly stable sprint.',
  },
  {
    range: '5 – 10%',
    leftBg: 'rgba(234,179,8,0.14)',
    borderLeft: '#EAB308',
    label: 'Acceptable',
    labelColor: '#FDE047',
    detail: 'Normal variability for most teams.',
  },
  {
    range: '10 – 20%',
    leftBg: 'rgba(249,115,22,0.14)',
    borderLeft: '#F97316',
    label: 'Concerning',
    labelColor: '#FDBA74',
    detail: 'Worth reviewing scope and planning.',
  },
  {
    range: '> 20%',
    leftBg: 'rgba(239,68,68,0.14)',
    borderLeft: '#EF4444',
    label: 'Poor',
    labelColor: '#FCA5A5',
    detail: 'Often signals planning or process issues.',
  },
];

function ChurnMetricTooltipContent() {
  const thStyle = {
    textAlign: 'left',
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    verticalAlign: 'bottom',
  };

  const cellRight = {
    verticalAlign: 'top',
    padding: '8px 10px',
    borderRadius: '0 6px 6px 0',
    background: 'rgba(148,163,184,0.1)',
    color: '#CBD5E1',
    lineHeight: 1.45,
  };

  return (
    <div style={{ textAlign: 'left', maxWidth: 400 }}>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0 6px',
          margin: '0 0 12px 0',
          fontSize: 12,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, padding: '0 8px 2px 0' }}>Churn %</th>
            <th style={{ ...thStyle, padding: '0 0 2px 0' }}>What it means</th>
          </tr>
        </thead>
        <tbody>
          {BENCHMARK_ROWS.map((row) => (
            <tr key={row.range}>
              <td
                style={{
                  verticalAlign: 'top',
                  padding: '8px 10px',
                  borderRadius: '6px 0 0 6px',
                  background: row.leftBg,
                  borderLeft: `3px solid ${row.borderLeft}`,
                  color: '#F8FAFC',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  width: '1%',
                }}
              >
                {row.range}
              </td>
              <td style={cellRight}>
                <span style={{ color: row.labelColor, fontWeight: 600 }}>{row.label}</span>
                <span style={{ color: '#94A3B8' }}> — </span>
                {row.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 2,
          padding: '8px 10px',
          borderRadius: 4,
          borderLeft: '3px solid #F59E0B',
          background: 'rgba(245,158,11,0.12)',
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: '#FBBF24', margin: '0 0 6px 0' }}>
          How churn is calculated
        </p>
        <p
          style={{
            fontSize: 12,
            color: '#FEF3C7',
            margin: '0 0 8px 0',
            lineHeight: 1.45,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          ((added + removed) / planned) × 100
        </p>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#FBBF24', margin: '0 0 4px 0' }}>
          When planned = 0
        </p>
        <p style={{ fontSize: 12, color: '#FEF3C7', margin: '0 0 4px 0', lineHeight: 1.45 }}>
          Churn is undefined, so we show N/A.
        </p>
        <p style={{ fontSize: 12, color: '#FEF3C7', margin: 0, lineHeight: 1.45 }}>
          No initial commitment.
        </p>
      </div>
    </div>
  );
}

export default function ChurnMetricTooltipIcon({ theme, placement = 'top-start' }) {
  const tooltipHtml = useMemo(
    () => ReactDOMServer.renderToStaticMarkup(<ChurnMetricTooltipContent />),
    [],
  );

  return (
    <TooltipIcon
      title="StandUpSprintChurn"
      tooltip={tooltipHtml}
      theme={theme}
      placement={placement}
    />
  );
}

ChurnMetricTooltipIcon.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  placement: PropTypes.string,
};
