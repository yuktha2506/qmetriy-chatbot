import PropTypes from 'prop-types';
import { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import '../../assets/css/datacard.css';
import '../../assets/css/level2.scss';
import { useNavigate } from 'react-router-dom';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import { InfoIcon } from '../../utils/commonIcons';
import ReactDOMServer from "react-dom/server";
import getTooltipContent from '../../utils/Tooltip';
import { useEffect } from 'react';
import { renderTrendValue } from "../../utils/renderTrendValue";
import { parseTrendValue } from "../../utils/renderTrendValue";

const ItemType = {
  CARD: 'card',
};

const BetaDataCard = ({
  title,
  trendValue,
  toolTip,
  showDetails = false,
  index,
  isSelected = false,
  onSelectCard,
  moveCard,
  isBurndown = false,
  isStoryPoints = true,
  onToggleMetric,
  unit,
  burndownValue,
  releaseReadinessScore = false,
  mainContentData,
}) => {
  const [getStatusCount, setGetStatusCount] = useState([]);
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const navigate = useNavigate();
  const [{ isDragging }, dragRef] = useDrag({
    type: ItemType.CARD,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, dropRef] = useDrop(() => ({
    accept: ItemType.CARD,
    hover: (draggedItem) => {
      if (draggedItem.index !== index) {
        moveCard(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  }));


  useEffect(() => {
    if (jiraData) {
      setGetStatusCount(jiraData.statusCountData || []);
    }
  }, [jiraData]);

  const percentages = (getStatusCount || [])
    .filter(item => item && typeof item === "object")
    .map(item => {
      const open = Number(item.open) || 0;
      const close = Number(item.close) || 0;
      const total = open + close;

      return {
        name: item.name || "Unknown",
        closedPercentage: total > 0 ? ((close / total) * 100).toFixed(2) + "%" : "0%"
      };
    });

  const toggleDetails = () => {
    onSelectCard(index, showDetails);
  };

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
    const value = parseTrendValue(trendValue)
    if (title === 'Time To Fix Bug') {
      if (trendValue >= 0 && trendValue <= 1) {
        return 'data-card time-to-fix-tertiary';
      } else if (trendValue >= 2 && trendValue <= 4) {
        return 'data-card time-to-fix-secondary';
      } else if (trendValue > 4) {
        return 'data-card time-to-fix-primary';
      }
    }
    else if (title === 'Test Coverage') {
      if (value >= 0 && value < 70) {
        return 'data-card open-story';
      } else if (value >= 70 && value <= 85) {
        return 'data-card open-task';
      } else if (value > 85) {
        return 'data-card open-bugs';
      }
    }
    else if (title === 'Burndown') {
      if (value >= 81) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 80) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "Manual Test Result") {
      if (value >= 85) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 84) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    } else if (title === "Automation Test Result") {
      if (value >= 85) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 84) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "Open Bugs") {
      const bugOpenPercentage = Math.round(parseFloat(percentages.find(item => item.name === "Bug")?.closedPercentage || "0"));
      if (bugOpenPercentage > 50) {
        return 'data-card open-story';
      } else if (bugOpenPercentage > 20 && bugOpenPercentage <= 50) {
        return 'data-card open-task';
      } else if (bugOpenPercentage <= 20) {
        return 'data-card open-bugs';

      }
    }
    else if (title === "Open Task") {
      const taskOpenPercentage = Math.round(parseFloat(percentages.find(item => item.name === "Task")?.closedPercentage || "0"));
      if (taskOpenPercentage > 50) {
        return 'data-card open-story';
      } else if (taskOpenPercentage > 20 && taskOpenPercentage <= 50) {
        return 'data-card open-task';
      } else if (taskOpenPercentage <= 20) {
        return 'data-card open-bugs';

      }
    }
    else if (title === "Open Story") {
      const storyOpenPercentage = Math.round(parseFloat(percentages.find(item => item.name === "Story")?.closedPercentage || "0"));
      if (storyOpenPercentage > 50) {
        return 'data-card open-story';
      } else if (storyOpenPercentage > 20 && storyOpenPercentage <= 50) {
        return 'data-card open-task';
      } else if (storyOpenPercentage <= 20) {
        return 'data-card open-bugs';

      }
    }
    else if (title === "Total Bugs") {
      if (!Array.isArray(getStatusCount) || getStatusCount.length === 0) {
        return 'data-card open-story';
      }
      const bugData = getStatusCount.find(item => item?.name === "Bug") || { open: 0, close: 0 };
      const totalBugs = (bugData?.open ?? 0) + (bugData?.close ?? 0);
      const totalIssues = getStatusCount.reduce((sum, item) => {
        const open = item?.open ?? 0;
        const close = item?.close ?? 0;
        return sum + open + close;
      }, 0);
      const bugPercentage = totalIssues > 0 ? Math.round((totalBugs / totalIssues) * 100) : 0;
      if (bugPercentage === 0) {
        return 'data-card open-bugs';
      } else if (bugPercentage > 0 && bugPercentage <= 2) {
        return 'data-card open-task';
      } else if (bugPercentage > 2) {
        return 'data-card open-story';
      }

    }
    else if (title === "Total Task") {
      if (trendValue > 50) {
        return 'data-card open-bugs';
      } else if (trendValue > 20 && trendValue <= 50) {
        return 'data-card open-task';
      } else if (trendValue <= 20) {
        return 'data-card open-story';
      }
    }
    else if (title === "Total Story") {
      if (trendValue > 50) {
        return 'data-card open-bugs';
      } else if (trendValue > 20 && trendValue <= 50) {
        return 'data-card open-task';
      } else if (trendValue <= 20) {
        return 'data-card open-story';
      }
    }
    else if (title === "Developer Score") {
      if (trendValue >= 0 && trendValue <= 40) {
        return 'data-card open-story';
      } else if (trendValue >= 41 && trendValue <= 70) {
        return 'data-card open-task';
      } else if (trendValue >= 71) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Test Score") {
      if (trendValue >= 0 && trendValue <= 40) {
        return 'data-card open-story';
      } else if (trendValue >= 41 && trendValue <= 70) {
        return 'data-card open-task';
      } else if (trendValue >= 71) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Operation Score") {
      if (trendValue >= 0 && trendValue <= 40) {
        return 'data-card open-story';
      } else if (trendValue >= 41 && trendValue <= 70) {
        return 'data-card open-task';
      } else if (trendValue >= 71) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Cycle Time") {
      const value = getNumericValue(trendValue);
      if (value > 43) {
        return 'data-card open-story';
      } else if (value >= 14 && value <= 42) {
        return 'data-card open-task';
      } else if (value <= 14) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Defect Density") {
      const value = getNumericValue(trendValue);
      if (value > 10) {
        return 'data-card open-story';
      } else if (value >= 6 && value <= 10) {
        return 'data-card open-task';
      } else if (value <= 5) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Rework Ratio") {
      const value = getNumericValue(trendValue);
      if (value > 20) {
        return 'data-card open-story';
      } else if (value >= 15 && value <= 20) {
        return 'data-card open-task';
      } else if (value <= 5) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Change Failure Rate") {
      const value = getNumericValue(trendValue);
      if (value > 6) {
        return 'data-card open-story';
      } else if (value > 2 && value <= 6) {
        return 'data-card open-task';
      } else if (value <= 2) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Code Coverage") {
      const value = getNumericValue(trendValue);
      if (value <= 70) {
        return 'data-card open-story';
      } else if (value >= 71 && value <= 85) {
        return 'data-card open-task';
      } else if (value > 85) {
        return 'data-card open-bugs';
      }
    }
    else if (title === "Automation Done") {
      const value = getNumericValue(trendValue);
      if (value >= 85) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 84) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "Static Code Analysis") {
      const value = getNumericValue(trendValue);
      if (value >= 91) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 90) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "Test Automation") {
      const value = getNumericValue(trendValue);
      if (value > 75) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 75) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "Test Cycle Time") {
      const value = getNumericValue(trendValue);
      if (value <= 2) {
        return 'data-card open-bugs';
      } else if (value >= 3 && value <= 4) {
        return 'data-card open-task';
      } else if (value > 5) {
        return 'data-card open-story';
      }
    }
    else if (title === "Traceability") {
      const value = getNumericValue(trendValue);
      if (value > 90) {
        return 'data-card open-bugs';
      } else if (value > 75 && value <= 90) {
        return 'data-card open-task';
      } else if (value <= 75) {
        return 'data-card open-story';
      }
    }
    else if (title === "Testing Quality") {
      const value = getNumericValue(trendValue);
      if (value <= 10) {
        return 'data-card open-bugs';
      } else if (value > 10 && value <= 15) {
        return 'data-card open-task';
      } else if (value > 15) {
        return 'data-card open-story';
      }
    }
    else if (title === "Testing Productivity") {
      const value = getNumericValue(trendValue);
      if (value > 100) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 100) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "Automation Testing Productivity") {
      const value = getNumericValue(trendValue);
      if (value > 75) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 75) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    }
    else if (title === "DLA") {
      const value = getNumericValue(trendValue);
      if (value <= 10) {
        return 'data-card open-bugs';
      } else if (value > 10 && value <= 20) {
        return 'data-card open-task';
      } else if (value > 20) {
        return 'data-card open-story';
      }
    }
    else if (title === "Deployment Frequency") {
      const value = getNumericValue(trendValue);
      if (value <= 28) {
        return 'data-card open-bugs';
      } else if (value > 28 && value <= 84) {
        return 'data-card open-task';
      } else if (value > 84) {
        return 'data-card open-story';
      }
    }
    else if (title === "Lead Time For Changes") {
      const value = getNumericValue(trendValue);
      if (value <= 7) {
        return 'data-card open-bugs';
      } else if (value > 7 && value <= 28) {
        return 'data-card open-task';
      } else if (value > 28) {
        return 'data-card open-story';
      }
    }
    else if (title === "Mean Time To Recovery") {
      const value = getNumericValue(trendValue);
      if (value <= 4) {
        return 'data-card open-bugs';
      } else if (value > 4 && value <= 8) {
        return 'data-card open-task';
      } else if (value > 8) {
        return 'data-card open-story';
      }
    }
  }
  const baseClass = `${getClassName()} ${isDragging ? 'dragging' : ''} ${isSelected
    ? 'selected dark:bg-[#182433] bg-[#FFFFFF] dark:border-[#25384F] border-[#D1E2F0]'
    : 'dark:bg-[#182433] bg-[#FFFFFF] dark:border-[#25384F] border-[#D1E2F0]'
    } rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-wrap flex-col transition-all duration-300 ease-in-out`;


  const isDoraMetricsCard = ["Deployment Frequency", "Change Failure Rate", "Lead Time For Changes", "Mean Time To Recovery","Cycle Time", "Defect Density", "Code Coverage", "Test Coverage", "Test Automation", "Traceability", "Testing Quality", "Testing Productivity", "Automation Testing Productivity", "DLA", "Test Cycle Time"].includes(title);

  const isNewDesignCard = [ "Time To Fix Bug", "Static Code Analysis",].includes(title);
  const heightClass =
    title === 'Automation Test Result' || title === 'Manual Test Result'
      ? 'h-[144px]'
      : isBurndown ||
        isDoraMetricsCard ||
        (title === 'Test Coverage' && releaseReadinessScore)
        ? 'h-[262px]'
        : isNewDesignCard

          ? 'h-[180px]'

          : 'h-32';


  const justifyClass = (releaseReadinessScore || isDoraMetricsCard) ? '' : 'justify-between';

  const metricLabel = (title) => {
    switch (title) {
      case "Deployment Frequency":
        return "Avg Deployment Per Day";
      case "Change Failure Rate":
        return "Change Failure Rate";
      case "Lead Time For Changes":
        return "Avg Lead Time";
      case "Mean Time To Recovery":
        return "Mean Recovery Time";
      default:
        return "";
    }
  };

  return (
    <div
      ref={(node) => dragRef(dropRef(node))}
      className={`${baseClass} ${heightClass} ${justifyClass} relative`}
      style={{
        boxShadow: theme === 'light' && isSelected ? '4px 4px 0 rgba(0,0,0,0.1)' : undefined,
        borderWidth: '1px',
        borderColor: theme === 'light' ? '#D1E2F0' : '#25384F',
      }}
    >
      <div className={`${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-black dark:text-custom-white'} text-lg flex justify-between items-center ${isDoraMetricsCard ? 'mb-2' : 'mb-3'}`}> {/* Reduced margin-bottom for DORA cards */}
        <div className="flex items-center">
          {title === "Automation Test Result" || title === "Manual Test Result" ? title : title}
          {(releaseReadinessScore || isDoraMetricsCard || isNewDesignCard) && (
            <span>
                <div
                className={`relative group w-5 h-5 ml-2`}
              >
                <span
                  data-tooltip-id={`tooltip-${title}`}
                  data-tooltip-html={toolTip}
                  data-tooltip-place={getTooltipPlacement(index + 1)}
                  className="cursor-pointer"
                  >
                  <InfoIcon className={theme === 'light' ? 'text-[#5580A6]' : 'text-gray-500'} />
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
            </span>
          )}

          {(isDoraMetricsCard || isNewDesignCard) && (
            <div className={`absolute top-4 right-4 font-semibold text-xl ${theme === 'light' ? 'text-[#202020]' : 'text-[#ffffff]'} flex items-center gap-1`}>
              {title === "Change Failure Rate"
                ? renderTrendValue(String(trendValue).replace(/%/g, ''), theme)
                : renderTrendValue(trendValue)
              }
            </div>
          )}

        </div>

        {isBurndown && (
          <div className="flex items-center gap-1">
            {renderTrendValue(trendValue)}
          </div>
        )}
        {isNewDesignCard && (

          <div className="absolute bottom-4 left-4 right-4 flex flex-col justify-end">

            {title === 'Time To Fix Bug' && mainContentData && (

              <div className={`space-y-1 text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} mb-4`}>

                {mainContentData.secondaryMetrics?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4 ">
                    <div className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} max-w-[70%] leading-tight break-words`}>
                      <div className="inline-flex flex-wrap items-center gap-1">
                        <span>{item.label}</span>
                        <div className="relative group w-4 h-4 flex-shrink-0">
                          <span
                            data-tooltip-id={`tooltip-secondary-${title}-${idx}`}
                            data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], item.label))}
                            data-tooltip-place={getTooltipPlacement(index + 1)}
                            className="cursor-pointer"
                          >
                          <InfoIcon className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'} w-4 h-4`} />
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
                      </div>
                    </div>
                    <span className={`${theme === 'light' ? 'text-[#3F3F3F]' : 'text-white'} font-semibold whitespace-nowrap`}>{item.value}</span>
                  </div>

                ))}
              </div>
            )}
            {(title === 'Static Code Analysis' || title === 'Time To Fix Bug') && (
              <div className="flex justify-end">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-4 rounded-full text-sm transition-colors duration-200"
                  onClick={() => {
                    if (title === 'Static Code Analysis') {
                      navigate('/gitDashboard', { state: { autoExpand: true, expand: 'Static Code Analysis' } });
                    } else if (title === 'Time To Fix Bug') {
                      navigate('/jiraDashboard', { state: { autoExpand: true, expand: 'Time To Fix Bug' } });
                    }
                  }}
                >
                  View
                </button>
              </div>
            )}
          </div>
        )}
        {(!isBurndown && releaseReadinessScore && !isDoraMetricsCard && !isNewDesignCard) && (
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className={`mt-1 flex text-3xl ${theme === 'light' ? 'text-[#0072BB]' : 'text-[#ffffff]'} items-center`}>
                {renderTrendValue(trendValue)}
              </span>
            </div>

            {title !== 'Static Code Analysis' && showDetails && (
              <span
                className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
                onClick={toggleDetails}
                style={{
                  color: 'var(--link-color-primary)',
                }}
              >
                {isSelected ? 'Hide Details' : 'View Details'}
                {isSelected ? <FiChevronUp /> : <FiChevronDown />}
              </span>
            )}
            {title === 'Static Code Analysis' && (
              <span
                className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
                onClick={() => navigate('/gitDashboard')}
                style={{
                  color: 'var(--link-color-primary)',
                }}
              >
                View Details
              </span>
            )}
            {title === 'Time To Fix Bug' && (
              <span
                className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
                onClick={() => navigate('/jiraDashboard')}
                style={{
                  color: 'var(--link-color-primary)',
                }}
              >
                View Details
              </span>
            )}
          </div>
        )}
      </div>

      {isDoraMetricsCard && <hr className={`mt-2 mb-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />}


      {isBurndown && (
        <div>
          <hr className={`mt-5 mb-10 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
          <div className="space-y-2">
            <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center`}>
              <div className="flex items-center gap-1">
                <span>Original Estimated</span>
                <div className="relative group w-5 h-5">
                  <span
                    data-tooltip-id={`tooltip-${title}-original-estimate`}
                    data-tooltip-html={isStoryPoints ? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Original Estimate Story Points`)) : ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Original Estimate Hours`))}
                    data-tooltip-place={getTooltipPlacement(index + 1)}
                    className="cursor-pointer"
                  >
                    <InfoIcon className={theme === 'light' ? 'text-[#5580A6]' : 'text-gray-500'} />
                  </span>
                  <ReactTooltip
                    id={`tooltip-${title}-original-estimate`}
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
              <span className={`font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-white'}`}>
                {isStoryPoints ? burndownValue?.originalEstimate ?? 0 : burndownValue?.originalEstimateHrs ?? 0}
              </span>
            </div>
            <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center`}>
              <div className="flex items-center gap-1">
                <span>Effort Spent</span>
                <div className="relative group w-5 h-5">
                  <span
                    data-tooltip-id={`tooltip-${title}-effort-spent`}
                    data-tooltip-html={isStoryPoints ? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Effort Spent Story Points`)) : ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Effort Spent Hours`))}
                    data-tooltip-place={getTooltipPlacement(index + 1)}
                    className="cursor-pointer"
                  >
                    <InfoIcon className={theme === 'light' ? 'text-[#5580A6]' : 'text-gray-500'} />
                  </span>
                  <ReactTooltip
                    id={`tooltip-${title}-effort-spent`}
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
              <span className={`font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-white'}`}>
                {isStoryPoints ? burndownValue?.totalSpent ?? 0 : burndownValue?.timeSpentHrs ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}
      {(!isBurndown && !releaseReadinessScore && !isDoraMetricsCard && !isNewDesignCard) && (
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
              <span className={`mt-1 flex text-3xl ${theme === 'light' ? 'text-[#202020]' : 'text-[#ffffff]'} items-baseline`}>
              {(() => {
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
                } else {
                  value = 0;
                }
                return (
                  <>
                    {value}
                    {suffix && (
                      <span className={`ml-1 text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'}`}>
                        {suffix}
                      </span>
                    )}
                  </>
                );
              })()}

              {unit && (
                <span className="text-lg ml-2 font-semibold text-gray-500">
                  {unit}
                </span>
              )}
            </span>
          </div>

          {title !== 'Static Code Analysis' && showDetails && (
            <span
              className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
              onClick={toggleDetails}
              style={{
                color: 'var(--link-color-primary)',
              }}
            >
              {isSelected ? 'Hide Details' : 'View Details'}
              {isSelected ? <FiChevronUp /> : <FiChevronDown />}
            </span>
          )}
          {title === 'Static Code Analysis' && (
            <span
              className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
              onClick={() => navigate('/gitDashboard')}
              style={{
                color: 'var(--link-color-primary)',
              }}
            >
              View Details
            </span>
          )}
          {title === 'Time To Fix Bug' && (
            <span
              className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
              onClick={() => navigate('/jiraDashboard')}
              style={{
                color: 'var(--link-color-primary)',
              }}
            >
              View Details
            </span>
          )}
        </div>
      )}
      {isBurndown && (
        <div className="ml-8 mt-10 flex justify-end">
          <div className={`inline-flex items-center ${theme === 'light' ? 'bg-[#FFFFFF] border border-[#CFCFCF]' : 'bg-transparent dark:bg-[#242B34] border border-[#E5E5E5] dark:border-[#101010]'} rounded-full p-0.5`}>
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${isStoryPoints
                ? (theme === 'light' ? 'bg-[#24527A] text-white' : 'dark:bg-[#066FD1] text-white')
                : (theme === 'light' ? 'text-[#4b5563] bg-[#FFFFFF]' : 'text-[#4b5563] dark:text-[#d1d5db]')
                }`}
              onClick={() => onToggleMetric(true)}
            >
              SP
            </button>
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${!isStoryPoints
                ? (theme === 'light' ? 'bg-[#24527A] text-white' : 'dark:bg-[#066FD1] text-white')
                : (theme === 'light' ? 'text-[#4b5563] bg-[#FFFFFF]' : 'text-[#4b5563] dark:text-[#d1d5db]')
                }`}
              onClick={() => onToggleMetric(false)}
            >
              Hrs
            </button>
          </div>
        </div>
      )}


      {(mainContentData && (isDoraMetricsCard || (!isBurndown && !releaseReadinessScore && !isDoraMetricsCard) && !isNewDesignCard)) && (
        <div className="flex flex-col h-auto w-auto px-4 py-3 space-y-12">
          <div className={`space-y-2 text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'}`}>
            {mainContentData.secondaryMetrics?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-1">
                  <span className="break-words leading-relaxed max-w-[200px]">{item.label}</span>
                  <div className="relative group w-4 h-4 flex-shrink-0 mt-0.5">
                    <span
                      data-tooltip-id={`tooltip-secondary-${title}-${idx}`}
                      data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], item.label))}
                      data-tooltip-place={getTooltipPlacement(index + 1)}
                      className="cursor-pointer"
                    >
                      <InfoIcon className="w-4 h-4" style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
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
                        position: "absolute",
                      }}
                    />
                  </div>
                </div>
                <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-white'} font-semibold flex-shrink-0`}>{item.value}</span>
              </div>

            ))}
          </div>

          {mainContentData && (mainContentData.primaryMetricValue !== undefined && mainContentData.primaryMetricValue !== null) && (

            <div className="text-center bg-[#1F2937] dark:bg-gray-800 py-1.5 px-2 rounded text-white font-semibold text-sm">

              {metricLabel(title)}<span className="px-1">:</span>


              {title === "Change Failure Rate"

                ? String(mainContentData.primaryMetricValue).replace(/%/g, '')

                : mainContentData.primaryMetricValue

              }

              {mainContentData.primaryMetricUnit ? ` ${mainContentData.primaryMetricUnit}` : ''}

            </div>

          )}
        </div>
      )}
    </div>
  );
};

BetaDataCard.propTypes = {
  title: PropTypes.string.isRequired,
  trendValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  toolTip: PropTypes.node.isRequired,
  showDetails: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
  isSelected: PropTypes.bool,
  onSelectCard: PropTypes.func.isRequired,
  moveCard: PropTypes.func.isRequired,
  isBurndown: PropTypes.bool,
  isStoryPoints: PropTypes.bool,
  onToggleMetric: PropTypes.func,
  unit: PropTypes.string,
  burndownValue: PropTypes.isRequired,
  releaseReadinessScore: PropTypes.isRequired,
  mainContentData: PropTypes.shape({
    primaryMetricValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    primaryMetricUnit: PropTypes.string,
    secondaryMetrics: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      })
    ),
  }),
};

export default BetaDataCard;
