import PropTypes from "prop-types";
import React, { useState } from "react";
import { useDrag } from "react-dnd";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import "../../assets/css/datacard.css";
import "../../assets/css/level2.scss";
import { useNavigate } from "react-router-dom";
import DropdownButton from "../Common/DropDown";
import { renderTrendValue } from "../../utils/renderTrendValue";
import { parseTrendValue } from "../../utils/renderTrendValue";
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import ReactDOMServer from "react-dom/server";
import getTooltipContent from '../../utils/Tooltip';
import { InfoIcon } from '../../utils/commonIcons';

import { InformationCircleIcon } from '@heroicons/react/solid';

const ItemType = {
  CARD: "card",
};

const GridDataCard = ({
  title,
  trendValue,
  toolTip,
  showDetails = false,
  index,
  isSelected = false,
  onSelectCard,
  isBurndown = false,
  isStoryPoints = true,
  onToggleMetric,
  burndownValue,
  automationData,
  manualData,
  automationTestResult,
  manualTestResult,
  openBugs,
  isGridViewCard,
  mainContentData,
  metrics = [],
  isTestScoreTrendCard = false,
}) => {
  const [burndownGridChartMode, setBurndownGridChartMode] = useState("Days");
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();
  const [{ isDragging }] = useDrag({
    type: ItemType.CARD,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  const toggleDetails = () => {
    onSelectCard(index, showDetails);
  };
  const chartOptions = [
    { label: "7", value: "7" },
    { label: "15", value: "15" },
    { label: "30", value: "30" },
  ];
  const getTooltipPlacement = (index) => {
    if ((index % 3) === 0) return "bottom-end";
    if ((index % 3) === 1) return "bottom-start";
    return "bottom";
  };

  const getClassName = () => {
    const value = parseTrendValue(trendValue)
    if (title === 'Burndown') {
      if (value >= 81) {
        return 'data-card open-bugs';
      } else if (value > 50 && value <= 80) {
        return 'data-card open-task';
      } else if (value <= 50) {
        return 'data-card open-story';
      }
    } else if (title === "Manual Test Result") {
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
    } else {
      if (index % 3 === 0) return "data-card open-bugs";
      if (index % 3 === 1) return "data-card open-task";
      return "data-card open-story";
    }
  };
  const TestResultCard = ({ title }) => {
    const data =
      title === "Automation Test Result"
        ? Array.isArray(automationData)
          ? automationData[0]
          : null
        : title === "Manual Test Result"
          ? Array.isArray(manualData)
            ? manualData[0]
            : null
          : null;

    return (
      <div>
        <div className="text-[#202020] dark:text-[#ffffff] text-sm flex justify-between items-center mb-3">
          <div className="flex items-center">Feb</div>
        </div>

        <div className="flex justify-between text-sm text-gray-400 items-center mt-6">
          <div className="flex items-center gap-1">
            <span>Blocked</span>
          </div>
          <span className="font-semibold text-white">
            {!data ? 0 : data.blocked_count}
          </span>
        </div>

        <div className="flex justify-between text-sm text-gray-400 items-center mt-3">
          <div className="flex items-center gap-1">
            <span>Failed</span>
          </div>
          <span className="font-semibold text-white">
            {!data ? 0 : data.failed_count}
          </span>
        </div>

        <div className="flex justify-between text-sm text-gray-400 items-center mt-3">
          <div className="flex items-center gap-1">
            <span>Passed</span>
          </div>
          <span className="font-semibold text-white">
            {!data ? 0 : data.passed_count}
          </span>
        </div>

        <div className="flex justify-between text-sm text-gray-400 items-center mt-3">
          <div className="flex items-center gap-1">
            <span>Untested</span>
          </div>
          <span className="font-semibold text-white">
            {!data ? 0 : data.untested_count}
          </span>
        </div>
      </div>
    );
  };
  const isSummaryTrendCard = title === "Trend" && isGridViewCard && metrics?.length > 0;
  let totalMetricsCount = 0;
  if (isGridViewCard) {
    if (isSummaryTrendCard) {
      totalMetricsCount = metrics.length;
      if (metrics.length > 0) {
        totalMetricsCount += 1;
      }
    } else if (mainContentData) {
      if (mainContentData.primaryMetricValue !== undefined && mainContentData.primaryMetricValue !== null) {
        totalMetricsCount += 1;
      }
      totalMetricsCount += mainContentData.secondaryMetrics?.length || 0;
    }
  }

  const shouldBeTallGridViewCard = isGridViewCard && totalMetricsCount > 3;

  const getCardHeightClass = () => {

    const operationScoreMetrics = ['Deployment Frequency', 'Change Failure Rate', 'Mean Time To Recovery', 'Lead Time For Changes'];

    const testScoreMetrics = ['Test Coverage', 'Test Automation', 'Traceability', 'Testing Quality', 'Testing Productivity', 'Automation Testing Productivity', 'DLA'];


    if (testScoreMetrics.includes(title)) {
      return "h-[312px]";
    }

    if (operationScoreMetrics.includes(title)) {
      return "h-[292px]";
    }

    if (title === "Automation Test Result" || title === "Manual Test Result") {
      return "h-[292px]";
    }

    if (isBurndown) {
      return "h-[292px]";
    }

    if (title === "Trend" && isGridViewCard) {
      if (isTestScoreTrendCard) {
        return "h-[312px]";
      } else if (metrics.length === 5) {
        return "h-[292px]";
      } else if (metrics.length === 4) {
        return "h-[262px]";
      }
    }

    if (isGridViewCard) {
      return shouldBeTallGridViewCard ? "h-[292px]" : "h-[262px]";
    }
    return "h-32";
  };

  const operationScoreMetrics = ['Deployment Frequency', 'Change Failure Rate', 'Mean Time To Recovery', 'Lead Time For Changes'];
  const testScoreMetrics = ['Test Coverage', 'Test Automation', 'Traceability', 'Testing Quality', 'Testing Productivity', 'Automation Testing Productivity'];
  return (
    <div
      className={`${getClassName()} 
      ${isDragging ? "dragging" : ""} 
      ${isSelected
          ? "selected bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F]"
          : "bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F]"
        } rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-wrap flex-col transition-all duration-300 ease-in-out 
         ${getCardHeightClass()}
          ${title === "Test Cycle Time" ? "w-[600px]" : ""}
        `}
      style={{ boxShadow: theme === 'light' && isSelected ? '4px 4px 0 rgba(0,0,0,0.1)' : undefined }}
    >
      <div className={`${theme === 'light' ? 'text-[#0A2342]' : 'text-[#ffffff]'} text-lg font-semibold flex justify-between items-center`}>
        <div className="flex items-center">
          {title === "Automation Test Result" ? (
            <>
              Automation
              <br />
              Test Result
            </>
          ) : title === "Manual Test Result" ? (
            <>
              Manual
              <br />
              Test Result
            </>
          ) : isSummaryTrendCard ? (
            <span className="flex items-center">
              Trend
              <span>
                <div className="relative group ml-2 w-5 h-5">
                  <span
                    data-tooltip-id="tooltip-summary-trend"
                    data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent("Trend"))}
                    data-tooltip-place={getTooltipPlacement(index + 1)}
                    className="cursor-pointer"
                  >
                    <InfoIcon style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
                  </span>
                  <ReactTooltip
                    id="tooltip-summary-trend"
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
            </span>
          ) : (
            title
          )}
          {!isSummaryTrendCard && (
            <span>
              <div
                className={`relative group ml-2 w-5 h-5`}
              >
                <span
                  data-tooltip-id={`tooltip-${title}`}
                  data-tooltip-html={toolTip}
                  data-tooltip-place={getTooltipPlacement(index + 1)}
                  className="cursor-pointer"
                >
                  <InfoIcon style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
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
            </span>)}
        </div>
        {isBurndown && (
          <div className="flex items-center gap-1">
            {renderTrendValue(trendValue)}
          </div>
        )}
        {!isBurndown && !metrics?.length > 0 && (
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-1">
              {renderTrendValue(trendValue)}
            </div>

            {title !== "Static Code Analysis" && showDetails && (
              <span
                className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
                onClick={toggleDetails}
                style={{
                  color: "var(--link-color-primary)",
                }}
              >
                {isSelected ? "Hide Details" : "View Details"}
                {isSelected ? <FiChevronUp /> : <FiChevronDown />}
              </span>
            )}
            {title === "Static Code Analysis" && (
              <span
                className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
                onClick={() => navigate("/gitDashboard")}
                style={{
                  color: "var(--link-color-primary)",
                }}
              >
                View Details
              </span>
            )}
            {title === "Time To Fix Bug" && (
              <span
                className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
                onClick={() => navigate("/jiraDashboard")}
                style={{
                  color: "var(--link-color-primary)",
                }}
              >
                View Details
              </span>
            )}
          </div>
        )}
      </div>
      {isBurndown && (
        <div>
          <hr className={`border-t my-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
          <div className="space-y-2">
            <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center`}>
              <div className="flex items-center gap-1">
                <span>Original Estimated</span>
                <div className="relative group h-5 w-5 ml-2">
                  <span
                    data-tooltip-id={`tooltip-${title}-original-estimate`}
                    data-tooltip-html={isStoryPoints ? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Original Estimate Story Points`)) : ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Original Estimate Hours`))}
                    data-tooltip-place={getTooltipPlacement(index + 1)}
                    className="cursor-pointer"
                  >
                    <InfoIcon style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
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
              <span className="font-semibold text-white">
                {isStoryPoints
                  ? (burndownValue?.originalEstimate ?? 0)
                  : (burndownValue?.originalEstimateHrs ?? 0)}
              </span>
            </div>
            <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center`}>
              <div className="flex items-center gap-1">
                <span>Effort Spent</span>
                <div className="relative group h-5 w-5 ml-2">
                  <span
                    data-tooltip-id={`tooltip-${title}-effort-spent`}
                    data-tooltip-html={isStoryPoints ? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Effort Spent Story Points`)) : ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Effort Spent Hours`))}
                    data-tooltip-place={getTooltipPlacement(index + 1)}
                    className="cursor-pointer"
                  >
                    <InfoIcon style={{ color: theme === 'light' ? '#5580A6' : '#A3B1C9' }} />
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
              <span className="font-semibold text-white">
                {isStoryPoints
                  ? (burndownValue?.totalSpent ?? 0)
                  : (burndownValue?.timeSpentHrs ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}
      {isBurndown && (
        <div className="mt-2 flex justify-start">
          <div className="inline-flex items-center bg-gray-200 dark:bg-[#0D131A] rounded-full p-0.5">
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${isStoryPoints
                ? "bg-primary-400 dark:bg-primary-500 text-black dark:text-white"
                : "text-[#4b5563] dark:text-[#d1d5db]"
                }`}
              onClick={() => onToggleMetric(true)}
            >
              SP
            </button>
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${!isStoryPoints
                ? "bg-primary-400 dark:bg-primary-500 text-black dark:text-white"
                : "text-[#4b5563] dark:text-[#d1d5db]"
                }`}
              onClick={() => onToggleMetric(false)}
            >
              Hrs
            </button>
          </div>
        </div>
      )}
      <div>
      <hr className={`border-t my-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
      </div>
      {isBurndown && (
        <div>
          <div className={`${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-[#ffffff]'} text-sm flex justify-between items-center mb-3`}>
            <div className="flex items-center">Feb</div>
            <div className="flex items-center gap-1">
              <DropdownButton
                buttonLabel={burndownGridChartMode === "Days" ? "Days" : "Week"}
                options={chartOptions}
                selectedOption={
                  chartOptions.find(
                    (option) => option.value === burndownGridChartMode,
                  )?.label
                }
                placeholder="Days"
                onSelect={(option) => setBurndownGridChartMode(option.value)}
                width="sm"
              />
            </div>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center`}>
            <div className="flex items-center gap-1">
              <span>Ideal progress</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>-</span>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center`}>
            <div className="flex items-center gap-1">
              <span>Actual progress</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>-</span>
          </div>
        </div>
      )}
      {(title === "Automation Test Result" ||
        title === "Manual Test Result") && <TestResultCard title={title} />}
      {title === "Trend" && !metrics?.length && (
        <div>
          <div className={`${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-[#ffffff]'} text-sm flex justify-between items-center mb-3`}>
            <div className="flex items-center">Feb</div>
            <div className="flex items-center gap-1">
              <DropdownButton
                buttonLabel={burndownGridChartMode === "Days" ? "Days" : "Week"}
                options={chartOptions}
                selectedOption={
                  chartOptions.find(
                    (option) => option.value === burndownGridChartMode,
                  )?.label
                }
                placeholder="Days"
                onSelect={(option) => setBurndownGridChartMode(option.value)}
                width="sm"
              />
            </div>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center mt-5`}>
            <div className="flex items-center gap-1">
              <span>Automation Test Result</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>
              {parseTrendValue(automationTestResult)}
            </span>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center mt-2`}>
            <div className="flex items-center gap-1">
              <span>Manual Test Result</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>
              {parseTrendValue(manualTestResult)}
            </span>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} items-center mt-2`}>
            <div className="flex items-center gap-1">
              <span>Open Bugs</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>
              {parseTrendValue(openBugs)}
            </span>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#626262]' : 'text-gray-400'} items-center mt-2`}>
            <div className="flex items-center gap-1">
              <span>DLA</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>-</span>
          </div>
          <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-[#626262]' : 'text-gray-400'} items-center mt-2`}>
            <div className="flex items-center gap-1">
              <span>Traceability</span>
            </div>
            <span className={`font-semibold ${theme === 'light' ? 'text-[#202020]' : 'text-white'}`}>-</span>
          </div>
        </div>
      )}

      {isGridViewCard && (title !== "Test Cycle Time") && (
        <div className={`flex flex-col flex-grow ${operationScoreMetrics.includes(title) || testScoreMetrics.includes(title) ? 'justify-start' : 'justify-between'}`}>
          {mainContentData?.secondaryMetrics?.length > 0 && (
            <div className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} ${operationScoreMetrics.includes(title) ? 'space-y-4' : testScoreMetrics.includes(title) ? 'space-y-5' : 'flex-grow'}`}>
              {mainContentData.secondaryMetrics.map((item, idx) => (
                <React.Fragment key={idx}>
                  {title === "DLA" && item.label === "Average Defect Leakage Analysis" && (
                    <hr className={`border-t my-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
                  )}

                  <div className={`flex justify-between items-start gap-4 ${operationScoreMetrics.includes(title) ? 'mb-4' : testScoreMetrics.includes(title) ? 'mb-5' : 'mb-2'}`}>
                    <div
                      className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} w-[70%] leading-tight 
      ${title === "Traceability" ? "break-words whitespace-normal" : "truncate"}`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span
                          className={`${title === "Traceability" ? "break-words whitespace-normal" : "max-w-full truncate"}`}
                        >
                          {item.label}
                        </span>
                        <div className="relative group w-4 h-4 flex-shrink-0">
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
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <span
                      className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-white'} font-semibold text-right max-w-[30%] ${operationScoreMetrics.includes(title) || testScoreMetrics.includes(title) ? 'text-base' : ''} 
      ${title === "Traceability" ? "break-words whitespace-normal" : "truncate"}`}
                    >
                      {item.value}
                    </span>
                  </div>


                  {idx === 1 &&
                    ['Cycle Time', 'Defect Density', 'Code Coverage', 'Deployment Frequency', 'Change Failure Rate', 'Mean Time To Recovery', 'Test Coverage', 'Test Automation', 'Traceability', 'Testing Quality', 'Testing Productivity', 'Automation Testing Productivity'].includes(title) && mainContentData?.secondaryMetrics?.length > 2 && (
                      <hr className={`border-t my-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
                    )}
                </React.Fragment>
              ))}
            </div>
          )}
          {mainContentData && mainContentData.primaryMetricValue !== undefined && mainContentData.primaryMetricValue !== null && (
            <div className={`text-center bg-[#1F2937] dark:bg-gray-800 ${operationScoreMetrics.includes(title) ? 'py-3 px-3 mt-6' : testScoreMetrics.includes(title) ? 'py-4 px-3 mt-8' : 'py-1.5 px-2'} rounded text-white font-semibold ${operationScoreMetrics.includes(title) || testScoreMetrics.includes(title) ? 'text-base' : 'text-sm'} mb-3`}>
              {(() => {
                switch (title) {
                  case "Deployment Frequency":
                    return <>Avg Deployment Per Day<span className="px-1">:</span></>;
                  case "Change Failure Rate":
                    return <>Change Failure Rate<span className="px-1">:</span></>;
                  case "Lead Time For Changes":
                    return <>Avg Lead Time<span className="px-1">:</span></>;
                  case "Mean Time To Recovery":
                    return <>Mean Recovery Time<span className="px-1">:</span></>;
                  case "Test Coverage":
                    return <>Average Test Coverage<span className="px-1">:</span></>;
                  case "Test Automation":
                    return <>Average Test Automation<span className="px-1">:</span></>;
                  case "Traceability":
                    return <>Average Traceability<span className="px-1">:</span></>;
                  case "Testing Quality":
                    return <>Average Testing Quality<span className="px-1">:</span></>;
                  case "Testing Productivity":
                    return <>Average Testing Productivity<span className="px-1">:</span></>;
                  case "Automation Testing Productivity":
                    return <>Auto Testing Productivity<span className="px-1">:</span></>;
                  case "DLA":
                    return <>Average Defect Leakage Analysis<span className="px-1">:</span></>;
                  default:
                    return null;
                }
              })()}
              {title === "Change Failure Rate"
                ? String(mainContentData.primaryMetricValue).replace(/%/g, '')
                : mainContentData.primaryMetricValue}
              {mainContentData.primaryMetricUnit ? ` ${mainContentData.primaryMetricUnit}` : ''}
            </div>
          )}
        </div>
      )}
      {title === "Test Cycle Time" && isGridViewCard && mainContentData && (
        <div className="flex flex-col h-full -mt-2">
          <div className="mb-4">
            {mainContentData.secondaryMetrics && mainContentData.secondaryMetrics.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#626262]' : 'text-gray-400'}`}>
                    {mainContentData.secondaryMetrics[0]?.label}
                    <span
                      data-tooltip-id={`tooltip-secondary-${title}-0`}
                      data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], mainContentData.secondaryMetrics[0]?.label))}
                      data-tooltip-place={getTooltipPlacement(index + 1)}
                      className="cursor-pointer ml-1"
                    >
                      <InformationCircleIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#7A7A7A]' : 'text-gray-500'} inline-block`} />
                    </span>
                    <ReactTooltip
                      id={`tooltip-secondary-${title}-0`}
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
                  </span>
                  <span className={`${theme === 'light' ? 'text-[#202020]' : 'text-white'} font-semibold text-lg`}>{mainContentData.secondaryMetrics[0]?.value}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#626262]' : 'text-gray-400'}`}>
                    {mainContentData.secondaryMetrics[1]?.label}
                    <span
                      data-tooltip-id={`tooltip-secondary-${title}-1`}
                      data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], mainContentData.secondaryMetrics[1]?.label))}
                      data-tooltip-place={getTooltipPlacement(index + 1)}
                      className="cursor-pointer ml-1"
                    >
                      <InformationCircleIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#7A7A7A]' : 'text-gray-500'} inline-block`} />
                    </span>
                    <ReactTooltip
                      id={`tooltip-secondary-${title}-1`}
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
                  </span>
                  <span className={`${theme === 'light' ? 'text-[#202020]' : 'text-white'} font-semibold text-lg ${String(mainContentData.secondaryMetrics[1]?.value).startsWith('+') ? 'text-red-500' : 'text-green-500'}`}>
                    {renderTrendValue(mainContentData.secondaryMetrics[1]?.value)}
                  </span>
                </div>
                <hr className={`border-t my-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
              </>
            )}

          </div>
          <div className="flex-grow">
            <h4 className={`text-md font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-[#0B1E37] dark:text-gray-300'} mb-2`}>By Test Type</h4>
            <div className={`grid grid-cols-2 gap-y-2 gap-x-4 text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'}`}>
              {mainContentData.secondaryMetrics && mainContentData.secondaryMetrics.slice(2).map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="font-medium">
                    {item.label}
                    <span
                      data-tooltip-id={`tooltip-secondary-${title}-${i + 2}`}
                      data-tooltip-html={ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], item.label))}
                      data-tooltip-place={getTooltipPlacement(index + 1)}
                      className="cursor-pointer ml-1"
                    >
                      <InformationCircleIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#7A7A7A]' : 'text-gray-500'} inline-block`} />
                    </span>
                    <ReactTooltip
                      id={`tooltip-secondary-${title}-${i + 2}`}
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
                  </span>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-white'} font-semibold`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {title === 'Trend' && isGridViewCard && metrics?.length > 0 && (
        <div className="space-y-3 text-sm -mt-2">
          {metrics.map((item, index) => (
            <React.Fragment key={index}>
              <div className="flex justify-between">
                <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'}`}>{item.label}</span>
                <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-white'} font-semibold`}>{item.value}</span>
              </div>
              {index === 0 && metrics.length > 1 && (
                <>
                  <hr className={`border-t my-3 ${theme === 'light' ? 'border-[#D1E2F0]' : 'border-gray-700'}`} />
                  <div className={`${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-white'} -mb-1`}>
                    15 Days Trend
                  </div>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

GridDataCard.propTypes = {
  title: PropTypes.string.isRequired,
  trendValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  toolTip: PropTypes.string.isRequired,
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
  automationData: PropTypes.isRequired,
  manualData: PropTypes.isRequired,
  automationTestResult: PropTypes.isRequired,
  manualTestResult: PropTypes.isRequired,
  openBugs: PropTypes.isRequired,
  isGridViewCard: PropTypes.bool,
  mainContentData: PropTypes.shape({
    primaryMetricValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    primaryMetricUnit: PropTypes.string,
    secondaryMetrics: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      })
    ),
  }),
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
  isTestScoreTrendCard: PropTypes.bool,
};

export default GridDataCard;
