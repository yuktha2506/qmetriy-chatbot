import PropTypes from "prop-types";
import { useDrag } from "react-dnd";
import { useSelector } from 'react-redux';
import ReactDOMServer from "react-dom/server";
import { Tooltip as ReactTooltip } from 'react-tooltip';
import getTooltipContent from '../../../../utils/Tooltip';
import { InfoIcon } from '../../../../utils/commonIcons';
import { renderTrendValue } from "../../../../utils/renderTrendValue";

const ItemType = {
  CARD: "card",
};

const TestCycleTimeCard = ({
  title,
  value,
  trendValue,
  toolTip,
  index,
  onSelectCard,
  metricsLeft,
  metricsRight,
  className = ""
}) => {
  const theme = useSelector((state) => state.theme.theme);

  const [{ isDragging }] = useDrag({
    type: ItemType.CARD,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getNumericValue = (trendValue) => {
    if (typeof trendValue === "string") {
      const match = trendValue.match(/^([0-9.-]+)/);
      return match ? parseFloat(match[1]) || 0 : 0;
    }
    return typeof trendValue === "number" ? trendValue : 0;
  };

  const getClassName = () => {
    const value = getNumericValue(trendValue);
    if (value >= 91) return 'data-card open-bugs';
    if (value > 50 && value <= 90) return 'data-card open-task';
    return 'data-card open-story';
  };

  const getTooltipPlacement = (index) => {
    if ((index % 3) === 0) return "bottom-end";
    if ((index % 3) === 1) return "bottom-start";
    return "bottom";
  };

  return (
    <div
      className={`${getClassName()} ${isDragging ? "dragging" : ""} ${theme === "dark"
          ? "bg-[#182433] border border-[#25384F]"
          : "bg-white border border-[#D1E2F0]"
        } rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col transition-all duration-300 ease-in-out ${className} w-full h-[312px] col-span-2`}
      onClick={() => onSelectCard(index)}
    >
      {/* Title & Score Row */}
      <div className={`text-md flex justify-between items-center mb-2 ${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-white'}`}>
        <div className="flex items-center">
          {title}
          <span className="relative group ml-2 w-5 h-5">
            <span
              data-tooltip-id={`tooltip-title-${title}`}
              data-tooltip-html={toolTip}
              data-tooltip-place={getTooltipPlacement(index)}
              className="cursor-pointer"
            >
              <InfoIcon className="w-5 h-5" style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
            </span>
            <ReactTooltip
              id={`tooltip-title-${title}`}
              place="top"
              effect="solid"
              float={false}
              allowHTML={true}
              arrowColor={theme === "dark" ? "#173A5A" : "#0D1621"}
              style={{
                backgroundColor: theme === "dark" ? "#173A5A" : "#0D1621",
                border: "1px solid #224F78",
                color: "white",
                padding: "8px",
                borderRadius: "5px",
                maxWidth: "500px",
                whiteSpace: "normal",
                zIndex: 9999,
              }}
            />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-xl ${theme === 'light' ? 'text-[#0072BB]' : 'text-white'}`}>{value}</span>
          <span className={`text-sm font-medium ${String(trendValue).startsWith('+') ? 'text-red-500' : 'text-green-500'} flex items-center`}>
            {renderTrendValue(trendValue)}
          </span>
        </div>
      </div>

      <hr className={`mt-2 mb-4 ${theme === 'light' ? 'border-[#D1E2F0]' : 'dark:border-gray-700'}`} />
      <div className="flex flex-1 gap-8">
        <div className="flex-1 space-y-3">
          {metricsLeft?.map((metric, idx) => (
            <div key={idx}> 
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} font-medium flex items-center gap-2`}>
                  {metric.label}
                  <div className="relative group w-4 h-4 flex-shrink-0">
                    <span
                      data-tooltip-id={`tooltip-left-${title}-${idx}`}
                      data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], metric.label))}
                      data-tooltip-place={getTooltipPlacement(index)}
                      className="cursor-pointer"
                    >
                      <InfoIcon className="w-4 h-4" style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
                    </span>
                    <ReactTooltip
                      id={`tooltip-left-${title}-${idx}`}
                      place={getTooltipPlacement(index)}
                      effect="solid"
                      float={false}
                      allowHTML={true}
                      arrowColor={theme === "dark" ? "#173A5A" : "#0D1621"}
                      style={{
                        backgroundColor: theme === "dark" ? "#173A5A" : "#0D1621",
                        border: "1px solid #224F78",
                        color: "white",
                        padding: "8px",
                        borderRadius: "5px",
                        maxWidth: "500px",
                        whiteSpace: "normal",
                        zIndex: 9999,
                      }}
                    />
                  </div>
                </span>
                <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-white'} font-semibold text-sm`}>{metric.value}</span>
              </div>
              {idx === 1 && <hr className={`mt-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'dark:border-gray-700'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 space-y-3">
          <div className="text-left mb-3">
            <span className={`text-sm font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-[#FFFFFF]'}`}>By Test Type</span>
          </div>

          {metricsRight?.map((metric, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} font-medium flex items-center gap-2`}>
                {metric.label}
                <div className="relative group w-4 h-4 flex-shrink-0">
                  <span
                    data-tooltip-id={`tooltip-right-${title}-${idx}`}
                    data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], metric.label))}
                    data-tooltip-place={getTooltipPlacement(index)}
                    className="cursor-pointer"
                  >
                    <InfoIcon className="w-4 h-4" style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
                  </span>
                  <ReactTooltip
                    id={`tooltip-right-${title}-${idx}`}
                    place={getTooltipPlacement(index)}
                    effect="solid"
                    float={false}
                    allowHTML={true}
                    arrowColor={theme === "dark" ? "#173A5A" : "#0D1621"}
                    style={{
                      backgroundColor: theme === "dark" ? "#173A5A" : "#0D1621",
                      border: "1px solid #224F78",
                      color: "white",
                      padding: "8px",
                      borderRadius: "5px",
                      maxWidth: "500px",
                      whiteSpace: "normal",
                      zIndex: 9999,
                    }}
                  />
                </div>
              </span>
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-white'} font-semibold text-sm`}>{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

TestCycleTimeCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  trendValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  toolTip: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  onSelectCard: PropTypes.func.isRequired,
  metricsLeft: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
  metricsRight: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
  className: PropTypes.string,
};

export default TestCycleTimeCard;
