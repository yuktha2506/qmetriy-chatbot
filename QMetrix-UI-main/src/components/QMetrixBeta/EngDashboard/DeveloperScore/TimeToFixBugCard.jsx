import PropTypes from "prop-types";
import { useDrag } from "react-dnd";
import { useNavigate } from "react-router-dom";
import { useSelector } from 'react-redux';
import ReactDOMServer from "react-dom/server";
import getTooltipContent from '../../../../utils/Tooltip';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InfoIcon } from '../../../../utils/commonIcons';
import { renderTrendValue } from "../../../../utils/renderTrendValue";

const ItemType = {
    CARD: "card",
};

const TimeToFixBugCard = ({
    title,
    value, 
    trendValue, 
    toolTip,
    index,
    onSelectCard,
    metrics,
    className = "",
}) => {
    const theme = useSelector((state) => state.theme.theme);
    const navigate = useNavigate();
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

    const getTooltipPlacement = (index) => {
        if ((index % 3) === 0) return "bottom-end";
        if ((index % 3) === 1) return "bottom-start";
        return "bottom";
    };

    const getClassName = () => {
        if (title === "Time To Fix Bug") {
            const value = getNumericValue(trendValue);
            if (value >= 91) {
                return 'data-card open-bugs';
            } else if (value > 50 && value <= 90) {
                return 'data-card open-task';
            } else if (value <= 50) {
                return 'data-card open-story';
            }
        }

        if (index % 3 === 0) return "data-card open-bugs";
        if (index % 3 === 1) return "data-card open-task";
        return "data-card open-story";
    };

    return (
        <div
            className={`${getClassName()} data-card ${isDragging ? "dragging" : ""} ${theme === "dark" ? "bg-[#182433] border border-[#25384F]" : "bg-white border border-[#D1E2F0]"}
             rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col transition-all duration-300 ease-in-out
         ${className} w-full h-[262px]`}
            onClick={() => onSelectCard(index)}
            data-tooltip-id={`tooltip-${index}`}
            data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, toolTip))}
        >
            <div className={`text-lg flex justify-between items-center mb-2 ${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-custom-white'}`}>
                <div className="flex items-center">
                    {title}
                    <span className="relative group ml-2 w-5 h-5">
                        <span
                            data-tooltip-id={`tooltip-title-${title}`}
                            data-tooltip-html={toolTip}
                            data-tooltip-place={getTooltipPlacement(0)}
                            className="cursor-pointer"
                        >
                            <InfoIcon style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
                        </span>
                        <ReactTooltip
                            id={`tooltip-title-${title}`}
                            place="top"
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
                            }}
                        />
                    </span>
                </div>
                <div className="flex items-center gap-2 ">
                    <span className="dark:text-white text-[#202020] font-semibold text-xl">{value}</span>
                    <span className={`text-sm font-medium ${String(trendValue).startsWith('+') ? 'text-red-500' : 'text-green-500'} flex items-center`}>
                        {renderTrendValue(trendValue)}
                    </span>
                </div>
            </div>

            <hr className={`mt-2 mb-4 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />

          <div className="flex-grow flex flex-col">
                <div className={`flex flex-col gap-y-2 text-sm flex-grow ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                    {metrics && metrics.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                            <span className="font-medium flex items-center gap-2">
                                {item.label}
                                <div className="relative group w-4 h-4 flex-shrink-0">
                                    <span
                                        data-tooltip-id={`tooltip-secondary-${title}-${idx}`}
                                        data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], item.label))}
                                        data-tooltip-place={getTooltipPlacement(index + 1)}
                                        className="cursor-pointer"
                                    >
                                        <InfoIcon className={`${theme === 'light' ? 'text-[#5580A6]' : 'text-gray-500'} w-4 h-4`} />
                                    </span>
                                    <ReactTooltip
                                        id={`tooltip-secondary-${title}-${idx}`}
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
                                            borderColor: "#224F78",
                                            color: "white",
                                            zIndex: 9999,
                                            padding: "8px",
                                            borderRadius: "5px",
                                            maxWidth: "500px",
                                            whiteSpace: "normal",
                                        }}
                                    />
                                </div>
                                <ReactTooltip
                                    id={`tooltip-metric-${title}-${idx}`}
                                    place="top"
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
                                    }}
                                />
                            </span>
                            <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-white'} font-semibold`}>{item.value}</span>
                        </div>
                    ))}
                </div>
                <div className="absolute bottom-4 right-4">
                    <button
                        className={`text-white text-xs px-3 py-1 rounded-full transition-colors duration-200 ${theme === 'light' ? 'bg-[#24527A] hover:bg-[#5580A6]' : 'bg-blue-500 hover:bg-blue-600'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                      navigate('/jiraDashboard', { state: { autoExpand: true, expand: 'Time To Fix Bug' } });
                        }}
                    >
                        View
                    </button>
                </div>
            </div>
        </div>
    );
};

TimeToFixBugCard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    trendValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    toolTip: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
    onSelectCard: PropTypes.func.isRequired,
    metrics: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            toolTip: PropTypes.string,
        })
    ),
    className: PropTypes.string,
};

export default TimeToFixBugCard;
