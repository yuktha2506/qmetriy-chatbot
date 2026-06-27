import { useState } from 'react';
import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import { InfoIcon } from '../../utils/commonIcons';

const DataCard = ({ total, open, closed, title, toolTip, index, openQuery, closedQuery, allQuery }) => {
  const [openState, setOpenState] = useState(open);
  const [closedState, setClosedState] = useState(closed);
  const [totalState, setTotalState] = useState(total);
  const theme = useSelector((state) => state.theme.theme);
  useEffect(() => {
      setOpenState(open);
      setClosedState(closed);
      setTotalState(total);
  }, [open, closed, total]);
  const getTooltipPlacement = (index) => {
    if ((index % 3) === 0) return "bottom-end";
    if ((index % 3) === 1) return "bottom-start";
    return "bottom";
  };
  function calculateOpenPercentage(openCount, closedCount) {
      const total = openCount + closedCount;
      if (total === 0) return 0;
  
      const percentage = (openCount / total) * 100;
      return parseFloat(percentage.toFixed(2));
  }
  const getClassName = () => {
      const percentage = calculateOpenPercentage(open, closed);
      if (percentage <= 20) {
        return 'data-card open-bugs';
      } else if (percentage <= 50) {
        return 'data-card open-task';
      } else {
        return 'data-card open-story';
      }
  };

  return (
    <div
      className={`${getClassName()} text-white p-4 rounded-lg h-32 w-70 relative dark:bg-[#182433] bg-[#FFFFFF] border dark:border-[#25384F] border-[#D1E2F0] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]`}
    >
      {/* Header */}
      <div className={`flex justify-between items-center ${theme === 'light' ? 'text-[#0A2342]' : 'text-black dark:text-custom-white'}`}>
        <div className="flex items-center gap-2">
          <span className={`flex items-center ${theme === 'light' ? 'text-[#0A2342]' : ''} text-lg font-semibold`}>{title}</span>
          <div className="relative group ml-0 h-5 w-5">
            <span
                data-tooltip-id={`tooltip-${title}`}
                data-tooltip-html={toolTip}
                data-tooltip-place={getTooltipPlacement(index + 1)}
                className="cursor-pointer"
            >
                <InfoIcon className={theme === 'light' ? 'text-[#7A7A7A]' : 'text-gray-500'} />
            </span>
            <ReactTooltip
                id={`tooltip-${title}`}
                place={getTooltipPlacement(index + 1)}
                effect="solid"
                float={false}
                allowHTML={true}
                arrowColor={theme === "dark" ? "#173A5A" : "#0D1621"}
                opacity={1}
                style={{
                    backgroundColor: theme === "dark" ? "#173A5A" : "#0D1621",
                    borderStyle: "solid",
                    borderWidth: "1px",
                    borderColor: theme === "dark" ? "#224F78" : "#224F78",
                    color: "white",
                    zIndex: 9999,
                    padding: "8px",
                    borderRadius: "5px",
                    maxWidth: "500px",
                    whiteSpace: "normal",
                    position: "absolute",
                }}
            />
          </div>
        </div>
        <div
          className={`flex items-center gap-1 ${totalState > 0 ? "cursor-pointer" : "cursor-default"}`}
          onClick={() => {
            if (totalState > 0) {
              window.open(allQuery?.url, "_blank");
            }
          }}
        >
          <span className={`text-2xl font-bold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} underline`}>{totalState}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="3.5"
            stroke="currentColor"
            className="w-4 h-4 ml-2 text-green-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
            />
          </svg>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className={`flex justify-between mt-4 text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`}>
        <div className="flex-1 ml-2 text-start">
          <p className={`text-xs ${theme === 'light' ? 'text-[#24527A] opacity-70' : 'opacity-70'}`}>Open</p>
          <p className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} underline text-base ${openState > 0 ? "cursor-pointer" : "cursor-default"}`}
             onClick = {() => {
              if (openState > 0) {
                  window.open(openQuery?.url, "_blank");
              }
             }}
            >{openState}</p>
        </div>
        <div className="flex-1 mr-3 text-end">
          <p className={`text-xs ${theme === 'light' ? 'text-[#24527A] opacity-70' : 'opacity-70'}`}>Closed</p>
          <p className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} underline text-base ${closedState > 0 ? "cursor-pointer" : "cursor-default"}`} 
          onClick = {() => {
              if (closedState > 0) {
                  window.open(closedQuery?.url, "_blank");
              }
          }}
          >{closedState}</p>
        </div>
      </div>
    </div>
  );
};

DataCard.propTypes = {
    total: PropTypes.number.isRequired,
    open: PropTypes.number.isRequired,
    closed: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    toolTip: PropTypes.node.isRequired,
    index: PropTypes.number.isRequired,
    openQuery: PropTypes.string.isRequired,
    closedQuery: PropTypes.string.isRequired,
    allQuery: PropTypes.string.isRequired,
};

export default DataCard;
