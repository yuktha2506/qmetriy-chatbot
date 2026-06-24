import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

const Tooltip = ({ content, position = 'top', children, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    if (isHovered && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;
      
      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.right + 8;
          break;
        default:
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
      }
      
      // Ensure tooltip stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      if (left < 8) left = 8;
      if (left + tooltipRect.width > viewportWidth - 8) {
        left = viewportWidth - tooltipRect.width - 8;
      }
      if (top < 8) top = 8;
      if (top + tooltipRect.height > viewportHeight - 8) {
        top = viewportHeight - tooltipRect.height - 8;
      }
      
      setTooltipStyle({ top: `${top}px`, left: `${left}px` });
    }
  }, [isHovered, position]);

  if (disabled) {
    return children;
  }

  const getArrowStyle = () => {
    if (!isHovered || !tooltipRef.current) return {};
    
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const arrowSize = 6;
    
    let arrowStyle = {};
    
    switch (position) {
      case 'top':
        arrowStyle = {
          bottom: `-${arrowSize}px`,
          left: `${tooltipRect.width / 2 - arrowSize}px`,
          borderTop: `${arrowSize}px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
        };
        break;
      case 'bottom':
        arrowStyle = {
          top: `-${arrowSize}px`,
          left: `${tooltipRect.width / 2 - arrowSize}px`,
          borderBottom: `${arrowSize}px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
        };
        break;
      case 'left':
        arrowStyle = {
          right: `-${arrowSize}px`,
          top: `${tooltipRect.height / 2 - arrowSize}px`,
          borderLeft: `${arrowSize}px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
        };
        break;
      case 'right':
        arrowStyle = {
          left: `-${arrowSize}px`,
          top: `${tooltipRect.height / 2 - arrowSize}px`,
          borderRight: `${arrowSize}px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
        };
        break;
    }
    
    return arrowStyle;
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </div>
      {isHovered && (
        <div
          ref={tooltipRef}
          className={`fixed z-[99999] px-2 py-[6px] text-[12px] font-medium rounded-[6px] shadow-sm ${
            theme === 'light'
              ? 'bg-[#0D1621] text-[#FFFFFF]'
              : 'bg-[#173A5A] border-[#224F78] text-[#ffffff]'
          } ${theme === 'light' ? '' : 'border'}`}
          style={{ 
            whiteSpace: 'nowrap', 
            zIndex: 99999,
            ...tooltipStyle
          }}
        >
          {content}
          <div 
            className="absolute w-0 h-0"
            style={getArrowStyle()}
          ></div>
        </div>
      )}
    </>
  );
};

Tooltip.propTypes = {
  content: PropTypes.string.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
};

export default Tooltip;

// === Standup Page Custum BurnUp Tooltip  ===
const CustomBurnupTooltip = ({ active, payload, label, showAddedWork }) => {
  const theme = useSelector((state) => state.theme.theme);

  if (!active || !payload || !payload.length) return null;

  const actual = payload.find((p) => p.name === 'actual');
  const ideal = payload.find((p) => p.name === 'ideal');
  const dataPoint = payload[0]?.payload ?? ideal?.payload ?? {};
  const workAddedNewTickets = dataPoint.workAddedNewTickets;
  const estimationUpdated = dataPoint.estimationUpdated;
  const estimationIncreased = dataPoint.estimationIncreased;
  const estimationDecreased = dataPoint.estimationDecreased;
  const workRemovedFromSprint = dataPoint.workRemovedFromSprint;
  const issueReaddedToSprint = dataPoint.issueReaddedToSprint;
  const workAdded = dataPoint.workAdded;
  const workRemoved = dataPoint.workRemoved;
  const issueReopened = dataPoint.issueReopened;

  const hasBreakdown = (workAddedNewTickets != null && workAddedNewTickets !== undefined) ||
    (estimationUpdated != null && estimationUpdated !== undefined) ||
    (workRemovedFromSprint != null && workRemovedFromSprint !== undefined);

  return (
    <div
      style={{
        backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
        border: theme === 'light' ? 'none' : '1px solid #224F78',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '12px',
        color: theme === 'light' ? '#FFFFFF' : '#fff',
        maxWidth: '280px',
      }}
    >
      <div style={{ marginBottom: '4px' }}>{label}</div>
      {ideal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#F59F12',
              flexShrink: 0,
            }}
          />
          <span>Ideal: {Number(ideal.value).toFixed(2)}</span>
        </div>
      )}
      {actual && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#066FD1',
              flexShrink: 0,
            }}
          />
          <span>Actual: {actual.value}</span>
        </div>
      )}
      {(() => {
        const extraItems = [];
        if (!showAddedWork && issueReopened > 0) {
          extraItems.push(
            <div key="reopened" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f87171', flexShrink: 0 }} />
              <span>Issue Reopened: {issueReopened}</span>
            </div>
          );
        }
        if (showAddedWork) {
          if (workRemovedFromSprint > 0) {
            extraItems.push(
              <div key="removed-sprint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f87171', flexShrink: 0 }} />
                <span>Removed from Sprint: {workRemovedFromSprint}</span>
              </div>
            );
          }
          if (issueReaddedToSprint > 0) {
            extraItems.push(
              <div key="readded-sprint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399', flexShrink: 0 }} />
                <span>Added to Sprint: {issueReaddedToSprint}</span>
              </div>
            );
          }
          if (hasBreakdown) {
            if (workAddedNewTickets != null && workAddedNewTickets > 0) {
              extraItems.push(
                <div key="added-new" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399', flexShrink: 0 }} />
                  <span>Added to Sprint: {workAddedNewTickets}</span>
                </div>
              );
            }
            if (estimationIncreased > 0 || estimationDecreased > 0) {
              extraItems.push(
                <div key="est-changed" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FBBF24', flexShrink: 0 }} />
                  <span>
                    Estimation Updated:{' '}
                    {estimationIncreased > 0 && estimationDecreased > 0
                      ? `+${estimationIncreased} and -${estimationDecreased}`
                      : estimationIncreased > 0
                        ? `+${estimationIncreased}`
                        : `-${estimationDecreased}`}
                  </span>
                </div>
              );
            }
            if (estimationUpdated != null && estimationUpdated !== 0 && !estimationIncreased && !estimationDecreased) {
              extraItems.push(
                <div key="est-updated" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FBBF24', flexShrink: 0 }} />
                  <span>Estimation Updated: {estimationUpdated > 0 ? `+${estimationUpdated}` : estimationUpdated}</span>
                </div>
              );
            }
          } else {
            if (workAdded != null && workAdded > 0) {
              extraItems.push(
                <div key="added-fallback" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399', flexShrink: 0 }} />
                  <span>Added to Sprint: {workAdded}</span>
                </div>
              );
            }
            if (workRemoved != null && workRemoved > 0) {
              extraItems.push(
                <div key="removed-fallback" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f87171', flexShrink: 0 }} />
                  <span>Removed from Sprint: {workRemoved}</span>
                </div>
              );
            }
          }
        }
        if (extraItems.length === 0) return null;
        return (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '4px', paddingTop: '4px' }}>
            {extraItems}
          </div>
        );
      })()}
    </div>
  );
};

CustomBurnupTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  showAddedWork: PropTypes.bool,
};

export { CustomBurnupTooltip };

// === Standup Page Jira Graph Tooltip  ===

export const JiraGraphTooltip = ({ active, payload }) => {
  const theme = useSelector((state) => state.theme.theme);

  if (active && payload && payload.length) {
    const data = payload[0];
    const { status, count } = data.payload;
    return (
      <div
        style={{
          backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
          border: theme === 'light' ? 'none' : '1px solid #224F78',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '12px',
          color: theme === 'light' ? '#FFFFFF' : '#ffffff',
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: data.payload.color,
              flexShrink: 0,
            }}
          />
          <p style={{ margin: 0, fontSize: '12px' }}>
            {status}: <strong>{count}</strong>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

JiraGraphTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      payload: PropTypes.shape({
        status: PropTypes.string,
        count: PropTypes.number,
        color: PropTypes.string,
      }),
    }),
  ),
};

// === Standup Page Story Churn Dotted Grid Lines  ===
export const CustomTick = ({ x, y, payload, fill, releaseAxis = false }) => {
  const maxLineLength = 9;
  const raw = String(payload?.value ?? '');
  let words = releaseAxis
    ? raw.split(/[\s_]+/).filter(Boolean)
    : raw.split(/\s+/);

  words = words.flatMap((w) =>
    w.length <= maxLineLength
      ? [w]
      : Array.from({ length: Math.ceil(w.length / maxLineLength) }, (_, i) =>
          w.slice(i * maxLineLength, (i + 1) * maxLineLength),
        ),
  );

  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxLineLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  const maxShownLines = releaseAxis ? 3 : 2;
  const shown = lines.slice(0, maxShownLines);
  const lineStep = releaseAxis && shown.length > 2 ? 11 : 12;
  const firstDy = releaseAxis && shown.length > 2 ? 7 : 8;
  const fontSize = releaseAxis && shown.length > 2 ? 11 : 12;

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.length > maxShownLines ? <title>{raw}</title> : null}
      {shown.map((line, index) => (
        <text
          key={index}
          x={0}
          y={index * lineStep}
          dy={firstDy}
          textAnchor="middle"
          fill={fill || 'currentColor'}
          fontSize={fontSize}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

CustomTick.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  payload: PropTypes.shape({
    value: PropTypes.string.isRequired,
  }).isRequired,
  fill: PropTypes.string,
  releaseAxis: PropTypes.bool,
};
