import { useState, useMemo, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { InfoIcon } from '../../utils/commonIcons';
import getTooltipContent from '../../utils/Tooltip';
import ReactDOMServer from 'react-dom/server';

const DEFAULT_CHART_WIDTH = 400; 
const CHART_LEFT_MARGIN = 5;
const CHART_RIGHT_MARGIN = 20;
const MIN_BAR_WIDTH_THRESHOLD = 1; 
const ESTIMATED_SCALE_PER_UNIT = 12; 
const EXTENSION_WIDTH_SAFETY_MULTIPLIER = 1.1; 
const SCALE_FACTOR_TOLERANCE = 0.1; 

/**
 * Calculates the scale factor from bar dimensions
 * @param {number} barWidth - Width of the bar in pixels
 * @param {number} barValue - Value represented by the bar
 * @returns {number|null} Scale factor (pixels per unit) or null if invalid
 */
const calculateScaleFactorFromBar = (barWidth, barValue) => {
  if (barValue > 0 && barWidth > 0) {
    return barWidth / barValue;
  }
  return null;
};

/**
 * Gets plot dimensions from layout or uses defaults
 * @param {Object} layout - Chart layout object
 * @returns {{totalWidth: number, plotWidth: number}} Chart dimensions
 */
const getPlotDimensions = (layout) => {
  const totalWidth = layout?.width || DEFAULT_CHART_WIDTH;
  const plotWidth = totalWidth - CHART_LEFT_MARGIN - CHART_RIGHT_MARGIN;
  return { totalWidth, plotWidth };
};

/**
 * Calculates the pixel position of maxAxisValue using scale function
 * @param {Function} scale - xAxis scale function
 * @param {number} maxAxisValue - Maximum value on the axis
 * @returns {number|null} Pixel position or null if calculation fails
 */
const calculateMaxAxisPositionFromScale = (scale, maxAxisValue) => {
  if (!scale || typeof scale !== 'function') {
    return null;
  }
  try {
    return scale(maxAxisValue);
  } catch (e) {
    return null;
  }
};

/**
 * Calculates extension line for zero-value bars
 * @param {Object} params - Calculation parameters
 * @returns {{lineStartX: number, extensionWidth: number}} Extension line coordinates
 */
const calculateZeroValueExtension = ({
  scale,
  maxAxisValue,
  layout,
  sharedScaleFactorRef,
}) => {
  // Try to use scale function first (most accurate)
  const maxAxisX = calculateMaxAxisPositionFromScale(scale, maxAxisValue);
  const zeroValueX = scale && typeof scale === 'function' ? calculateMaxAxisPositionFromScale(scale, 0) : null;

  if (maxAxisX !== null && zeroValueX !== null) {
    return {
      lineStartX: zeroValueX,
      extensionWidth: maxAxisX - zeroValueX,
    };
  }

  // Fallback: Use shared scale factor from non-zero bars
  const currentScaleFactor = sharedScaleFactorRef?.current;
  if (currentScaleFactor != null && currentScaleFactor > 0) {
    const calculatedMaxAxisX = CHART_LEFT_MARGIN + (maxAxisValue * currentScaleFactor);
    return {
      lineStartX: CHART_LEFT_MARGIN,
      extensionWidth: calculatedMaxAxisX - CHART_LEFT_MARGIN,
    };
  }

  // Last resort: Use estimated scale
  const { plotWidth } = getPlotDimensions(layout);
  const estimatedMaxAxisX = CHART_LEFT_MARGIN + (maxAxisValue * ESTIMATED_SCALE_PER_UNIT);
  return {
    lineStartX: CHART_LEFT_MARGIN,
    extensionWidth: Math.min(estimatedMaxAxisX - CHART_LEFT_MARGIN, plotWidth),
  };
};

/**
 * Calculates extension line for non-zero value bars
 * @param {Object} params - Calculation parameters
 * @returns {{lineStartX: number, extensionWidth: number}} Extension line coordinates
 */
const calculateNonZeroValueExtension = ({
  scale,
  maxAxisValue,
  originalValue,
  barX,
  barWidth,
  layout,
  sharedScaleFactorRef,
}) => {
  const scaleFactor = calculateScaleFactorFromBar(barWidth, originalValue);
  if (scaleFactor != null && sharedScaleFactorRef) {
    const currentScaleFactor = sharedScaleFactorRef.current;
    if (currentScaleFactor == null || Math.abs(currentScaleFactor - scaleFactor) > SCALE_FACTOR_TOLERANCE) {
      sharedScaleFactorRef.current = scaleFactor;
    }
  }

  if (maxAxisValue <= originalValue) {
    return { lineStartX: barX + barWidth, extensionWidth: 0 };
  }

  const maxAxisX = calculateMaxAxisPositionFromScale(scale, maxAxisValue);
  if (maxAxisX !== null) {
    const lineStartX = barX + barWidth;
    return {
      lineStartX,
      extensionWidth: Math.max(0, maxAxisX - lineStartX),
    };
  }

  if (scaleFactor != null) {
    const calculatedMaxAxisX = barX + (maxAxisValue * scaleFactor);
    const lineStartX = barX + barWidth;
    return {
      lineStartX,
      extensionWidth: Math.max(0, calculatedMaxAxisX - lineStartX),
    };
  }

  const { plotWidth } = getPlotDimensions(layout);
  const plotEndPosition = CHART_LEFT_MARGIN + plotWidth;
  const lineStartX = barX + barWidth;
  return {
    lineStartX,
    extensionWidth: Math.max(0, plotEndPosition - lineStartX),
  };
};


const CustomBarShape = ({ x, y, width, height, payload, xAxis, layout, theme, axisConfig, sharedScaleFactorRef }) => {
  const maxAxisValue = axisConfig.domain[1];
  const originalValue = payload.originalValue !== undefined ? payload.originalValue : 0;
  const scale = xAxis?.scale;

  const extension = originalValue === 0
    ? calculateZeroValueExtension({ scale, maxAxisValue, layout, sharedScaleFactorRef })
    : calculateNonZeroValueExtension({
        scale,
        maxAxisValue,
        originalValue,
        barX: x,
        barWidth: width,
        layout,
        sharedScaleFactorRef,
      });

  const { plotWidth } = getPlotDimensions(layout);
  const maxPlotWidth = plotWidth;

  const shouldShowExtension = originalValue === 0
    ? (extension.extensionWidth > 0 && extension.lineStartX >= 0)
    : (maxAxisValue > originalValue && 
       extension.extensionWidth > 0 && 
       extension.extensionWidth <= maxPlotWidth * EXTENSION_WIDTH_SAFETY_MULTIPLIER);
  
  const lineY = y + height / 2;

  return (
    <g>
      {width > MIN_BAR_WIDTH_THRESHOLD && originalValue > 0 && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color}
          rx={4}
          ry={4}
        />
      )}
      {shouldShowExtension && (
        <line
          x1={extension.lineStartX}
          y1={lineY}
          x2={extension.lineStartX + extension.extensionWidth}
          y2={lineY}
          stroke={theme === 'light' ? '#D1D5DB' : '#4B5563'}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
    </g>
  );
};

CustomBarShape.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  payload: PropTypes.shape({
    value: PropTypes.number,
    originalValue: PropTypes.number,
    color: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  xAxis: PropTypes.shape({
    scale: PropTypes.func,
  }),
  layout: PropTypes.shape({
    width: PropTypes.number,
  }),
  theme: PropTypes.string.isRequired,
  axisConfig: PropTypes.shape({
    domain: PropTypes.arrayOf(PropTypes.number).isRequired,
  }).isRequired,
  sharedScaleFactorRef: PropTypes.shape({
    current: PropTypes.number,
  }),
};

const createBarShape = (theme, axisConfig, sharedScaleFactorRef) => {
  const BarShapeWrapper = (props) => (
    <CustomBarShape
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      payload={props.payload}
      xAxis={props.xAxis}
      layout={props.layout}
      theme={theme}
      axisConfig={axisConfig}
      sharedScaleFactorRef={sharedScaleFactorRef}
    />
  );
  
  BarShapeWrapper.propTypes = {
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    payload: PropTypes.shape({
      value: PropTypes.number,
      originalValue: PropTypes.number,
      color: PropTypes.string,
      name: PropTypes.string,
    }).isRequired,
    xAxis: PropTypes.shape({
      scale: PropTypes.func,
    }),
    layout: PropTypes.shape({
      width: PropTypes.number,
    }),
  };
  
  BarShapeWrapper.displayName = 'BarShapeWrapper';
  
  return BarShapeWrapper;
};

/**
 * Reusable tooltip component for info icons
 * @param {string} id - Unique identifier for the tooltip
 * @param {string} theme - Current theme ('light' or 'dark')
 * @param {Object} tooltipStyles - Memoized tooltip styles object
 */
const InfoTooltip = ({ id, theme, tooltipStyles }) => (
  <ReactTooltip
    id={id}
    place="top"
    effect="solid"
    float={false}
    allowHTML={true}
    arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
    opacity={1}
    style={tooltipStyles}
  />
);

InfoTooltip.propTypes = {
  id: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  tooltipStyles: PropTypes.object.isRequired,
};

const QAInsights = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const jiraData = useSelector((state) => state.jira || {});
  const qaReferenceData = jiraData?.qaReferenceData || null;
  const theme = useSelector((state) => state.theme.theme);
  const qaInsightsBugsData = jiraData?.qaInsightsBugsData;
  const qaInsightsTestsData = jiraData?.qaInsightsTestsData;

  const manualTooltipHtml = useMemo(
    () => ReactDOMServer.renderToStaticMarkup(getTooltipContent('Manual', [])),
    []
  );
  const automationTooltipHtml = useMemo(
    () => ReactDOMServer.renderToStaticMarkup(getTooltipContent('Automation', [])),
    []
  );
  const coverageTooltipHtml = useMemo(
    () => ReactDOMServer.renderToStaticMarkup(getTooltipContent('Coverage', [])),
    []
  );

  const tooltipStyles = useMemo(() => ({
    backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: theme === 'dark' ? '#224F78' : '#224F78',
    color: 'white',
    zIndex: 99999,
    padding: '8px',
    borderRadius: '5px',
    maxWidth: '500px',
    whiteSpace: 'normal',
  }), [theme]);

  const bugData = qaInsightsBugsData
    ? {
        totalIssues: qaInsightsBugsData.issueCount?.total || 0,
        open: qaInsightsBugsData.issueCount?.open || 0,
        closed: qaInsightsBugsData.issueCount?.closed || 0,
        segregation: {
          manual: {
            total: qaInsightsBugsData.segregationBy?.manual?.total || 0,
            critical: qaInsightsBugsData.segregationBy?.manual?.critical || 0,
            major: qaInsightsBugsData.segregationBy?.manual?.major || 0,
            medium: qaInsightsBugsData.segregationBy?.manual?.medium || 0,
            minor: qaInsightsBugsData.segregationBy?.manual?.minor || 0,
            invalid: qaInsightsBugsData.segregationBy?.manual?.invalid || 0,
          },
          automation: {
            total: qaInsightsBugsData.segregationBy?.automation?.total || 0,
            critical: qaInsightsBugsData.segregationBy?.automation?.critical || 0,
            major: qaInsightsBugsData.segregationBy?.automation?.major || 0,
            medium: qaInsightsBugsData.segregationBy?.automation?.medium || 0,
            minor: qaInsightsBugsData.segregationBy?.automation?.minor || 0,
            invalid: qaInsightsBugsData.segregationBy?.automation?.invalid || 0,
          },
          production: {
            total: qaInsightsBugsData.segregationBy?.production?.total || 0,
            critical: qaInsightsBugsData.segregationBy?.production?.critical || 0,
            major: qaInsightsBugsData.segregationBy?.production?.major || 0,
            medium: qaInsightsBugsData.segregationBy?.production?.medium || 0,
            minor: qaInsightsBugsData.segregationBy?.production?.minor || 0,
            invalid: qaInsightsBugsData.segregationBy?.production?.invalid || 0,
          },
        },
      }
    : {
        totalIssues: 0,
        open: 0,
        closed: 0,
        segregation: {
          manual: { total: 0, critical: 0, major: 0, medium: 0, minor: 0, invalid: 0 },
          automation: { total: 0, critical: 0, major: 0, medium: 0, minor: 0, invalid: 0 },
          production: { total: 0, critical: 0, major: 0, medium: 0, minor: 0, invalid: 0 },
        },
      };

  const processCoverageData = () => {
    if (!qaReferenceData) {
      return [
        { name: 'Covered', value: 0, color: '#1BC735' },
        { name: 'Not Covered', value: 0, color: '#FDBA33' },
      ];
    }

    let covered = qaReferenceData?.covered;
    let notCovered = qaReferenceData?.notCovered;
    
    if ((covered === undefined || covered === null) && (notCovered === undefined || notCovered === null)) {
      covered = qaReferenceData?.referenceCoverage?.covered;
      notCovered = qaReferenceData?.referenceCoverage?.notCovered;
    }
    
    if ((covered === undefined || covered === null) && (notCovered === undefined || notCovered === null)) {
      if (qaReferenceData?.data) {
        covered = qaReferenceData.data?.covered || qaReferenceData.data?.referenceCoverage?.covered;
        notCovered = qaReferenceData.data?.notCovered || qaReferenceData.data?.referenceCoverage?.notCovered;
      }
    }

    if ((covered === undefined || covered === null || covered === 0) && 
        (notCovered === undefined || notCovered === null || notCovered === 0)) {
      let coveragePercent = qaReferenceData?.coveragePercent 
        || qaReferenceData?.referenceCoverage?.coveragePercent
        || qaReferenceData?.data?.coveragePercent
        || qaReferenceData?.data?.referenceCoverage?.coveragePercent;
      
      
      if (coveragePercent !== undefined && coveragePercent !== null) {
        const notCoveragePercent = 100 - coveragePercent;
        return [
          { name: 'Covered', value: coveragePercent, color: '#1BC735' },
          { name: 'Not Covered', value: notCoveragePercent, color: '#FDBA33' },
        ];
      }
    }

    covered = Number(covered) || 0;
    notCovered = Number(notCovered) || 0;


    const total = covered + notCovered;
    if (total === 0) {
      return [
        { name: 'Covered', value: 0, color: '#1BC735' },
        { name: 'Not Covered', value: 0, color: '#FDBA33' },
      ];
    }

    const coveredPercent = Math.round((covered / total) * 100);
    const notCoveredPercent = 100 - coveredPercent;


    return [
      { name: 'Covered', value: coveredPercent, color: '#1BC735' },
      { name: 'Not Covered', value: notCoveredPercent, color: '#FDBA33' },
    ];
  };

  const coverageData = processCoverageData();

  const processTestMetricsData = () => {
    if (!qaReferenceData) {
      return [
        { name: 'References', value: 0, color: '#4EF6FF' },
        { name: 'Cases W/ References', value: 0, color: '#FFDD00' },
        { name: 'Cases W/O References', value: 0, color: '#FF4044' },
        { name: 'Test To Be Automated', value: 0, color: '#00FF29' },
        { name: 'Automated', value: 0, color: '#B650FF' },
      ];
    }


    let references, casesWithReferences, casesWithoutReferences, testToBeAutomated, automated;

    if (qaReferenceData?.referenceAndTestCases) {
      const refData = qaReferenceData.referenceAndTestCases;
      references = refData.references;
      casesWithReferences = refData.casesWithReferences;
      casesWithoutReferences = refData.casesWithoutReferences;
      testToBeAutomated = refData.testToBeAutomated;
      automated = refData.automated;
    }
    else if (qaReferenceData?.data?.referenceAndTestCases) {
      const refData = qaReferenceData.data.referenceAndTestCases;
      references = refData.references;
      casesWithReferences = refData.casesWithReferences;
      casesWithoutReferences = refData.casesWithoutReferences;
      testToBeAutomated = refData.testToBeAutomated;
      automated = refData.automated;
    }
    else {
      references = qaReferenceData?.references || qaReferenceData?.testMetrics?.references;
      casesWithReferences = qaReferenceData?.casesWithReferences || qaReferenceData?.testMetrics?.casesWithReferences;
      casesWithoutReferences = qaReferenceData?.casesWithoutReferences || qaReferenceData?.testMetrics?.casesWithoutReferences;
      testToBeAutomated = qaReferenceData?.testToBeAutomated || qaReferenceData?.testMetrics?.testToBeAutomated;
      automated = qaReferenceData?.automated || qaReferenceData?.testMetrics?.automated;
    }

    references = Number(references) || 0;
    casesWithReferences = Number(casesWithReferences) || 0;
    casesWithoutReferences = Number(casesWithoutReferences) || 0;
    testToBeAutomated = Number(testToBeAutomated) || 0;
    automated = Number(automated) || 0;

    const result = [
      { name: 'References', value: references, color: '#4EF6FF', originalValue: references },
      { name: 'Cases W/ References', value: casesWithReferences, color: '#FFDD00', originalValue: casesWithReferences },
      { name: 'Cases W/O References', value: casesWithoutReferences, color: '#FF4044', originalValue: casesWithoutReferences },
      { name: 'Test To Be Automated', value: testToBeAutomated, color: '#00FF29', originalValue: testToBeAutomated },
      { name: 'Automated', value: automated, color: '#B650FF', originalValue: automated },
    ];

    const processedResult = result.map((entry) => ({
      ...entry,
      value: entry.value === 0 ? 0.01 : entry.value,
    }));

    return processedResult;
  };

  const testMetricsData = processTestMetricsData();
  const sharedScaleFactorRef = useRef(null);
  
  useEffect(() => {
    sharedScaleFactorRef.current = null;
  }, [testMetricsData]);
  
  const coverageHasValues = coverageData && coverageData.length > 0 && coverageData.some(item => item.value > 0);
  
  const testMetricsHasValues = testMetricsData && testMetricsData.length > 0 && testMetricsData.some(item => {
    const originalValue = item.originalValue !== undefined ? item.originalValue : item.value;
    return originalValue > 0;
  });

  // Memoize axis config to ensure stable reference when data hasn't changed
  const axisConfig = useMemo(() => {
    if (!testMetricsData || testMetricsData.length === 0) {
      return { domain: [0, 100], ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] };
    }

    const maxValue = Math.max(...testMetricsData.map((item) => (item.originalValue !== undefined ? item.originalValue : item.value) || 0));
    
    if (maxValue === 0) {
      return { domain: [0, 100], ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] };
    }
    
    let step;
    if (maxValue <= 50) {
      step = 5;
    } else if (maxValue <= 100) {
      step = 10;
    } else if (maxValue <= 200) {
      step = 20;
    } else if (maxValue <= 500) {
      step = 50;
    } else if (maxValue <= 1000) {
      step = 100;
    } else if (maxValue <= 5000) {
      step = 500;
    } else if (maxValue <= 10000) {
      step = 1000;
    } else {
      step = Math.ceil(maxValue / 10);
    }
    
    const maxAxisValue = Math.ceil(maxValue / step) * step;
    const domain = [0, maxAxisValue];

    let ticks = [];
    
    for (let i = 0; i <= maxAxisValue; i += step) {
      ticks.push(i);
    }
    
    const lastTick = ticks[ticks.length - 1];
    if (lastTick < maxAxisValue) {
      ticks.push(maxAxisValue);
    }
    ticks = [...new Set([0, ...ticks, maxAxisValue])].sort((a, b) => a - b);
    return { domain, ticks };
  }, [testMetricsData]);
  
  const BarShapeComponent = useMemo(
    () => createBarShape(theme, axisConfig, sharedScaleFactorRef),
    [theme, axisConfig]
  );
  
  const manualMetrics = qaInsightsTestsData?.manualMetrics
    ? {
        new: qaInsightsTestsData.manualMetrics.new || 0,
        executed: qaInsightsTestsData.manualMetrics.executed || 0,
        passPercent: qaInsightsTestsData.manualMetrics.passPercent || 0,
        totalTestCases: qaInsightsTestsData.manualMetrics.totalTestCases ?? 0,
      }
    : {
        new: 0,
        executed: 0,
        passPercent: 0,
        totalTestCases: 0,
      };

  const automationMetrics = qaInsightsTestsData?.automationMetrics
    ? {
        new: qaInsightsTestsData.automationMetrics.new || 0,
        executed: qaInsightsTestsData.automationMetrics.executed || 0,
        passPercent: qaInsightsTestsData.automationMetrics.passPercent || 0,
        totalTestCases: qaInsightsTestsData.automationMetrics.totalTestCases ?? 0,
      }
    : {
        new: 0,
        executed: 0,
        passPercent: 0,
        totalTestCases: 0,
      };

  const coverageMetrics = qaInsightsTestsData?.coverage
    ? {
        automatedCases: qaInsightsTestsData.coverage.automatedCases || 0,
        regression: qaInsightsTestsData.coverage.regression || 0,
      }
    : {
        automatedCases: 0,
        regression: 0,
      };


  return (
    <div className="qaInsights-wrapper">
    <div className="qa-insights-container w-full bg-[#FFFFFF] dark:bg-[#182433] dark:text-[#C8C8C8] text-black rounded-[10px] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md border border-[#E5E5E5] dark:border-[#25384F] ">
      {/* QA Insights Header */}
      <div
        className="px-4 py-2 pb-2 rounded-t-[10px] flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-normal text-[#0A2342] dark:text-white">QA Insights</h2>
        <svg
          className={`w-5 h-5 text-[#0A2342] dark:text-[#E0E7FF] transition-transform ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="p-3">
          <div className="space-y-4">
            {/* Bug Section */}
            <div className="space-y-2 bg-[#F6F8FC] dark:bg-[#1A2738] border border-[#D1E2F0] dark:border-gray-700 p-3 rounded-lg w-full min-h-[256px]">
                <h3 className="text-lg font-normal text-[#0A2342] dark:text-white">Bug</h3>
                <div className="border-b border-[#D1E2F0] dark:border-gray-700"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8">
                  <div className="col-span-1 space-y-2 pr-0 md:pr-8 border-r-0 md:border-r border-[#D1E2F0] dark:border-gray-700 pb-4 md:pb-0">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-sm text-[#47DC33]">Total</span>
                      <span className="text-sm  text-[#47DC33]">{bugData.totalIssues}</span>
                    </div>
                    <div className="flex justify-between items-center gap-1">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Open</span>
                      <span className="text-[#5B9BF3] text-sm font-normal">{bugData.open}</span>
                    </div>
                    <div className="flex justify-between items-center gap-1">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Closed</span>
                      <span className="text-[#5B9BF3] text-sm font-normal">{bugData.closed}</span>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-3 space-y-4">


                    {/* Manual, Automation, Production - Grid within Segregation By area */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-normal text-[#0A2342] dark:text-white">Manual</span>
                          <span className="text-sm  text-[#0A2342] dark:text-white">
                            {bugData.segregation.manual.total}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Critical</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.manual.critical}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Major</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.manual.major}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Medium</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.manual.medium}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Minor</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.manual.minor}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Invalid</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.manual.invalid}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Automation */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-normal text-[#0A2342] dark:text-white">Automation</span>
                          <span className="text-sm  text-[#0A2342] dark:text-white">
                            {bugData.segregation.automation.total}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Critical</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.automation.critical}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Major</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.automation.major}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Medium</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.automation.medium}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Minor</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.automation.minor}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Invalid</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.automation.invalid}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Production */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-normal text-[#0A2342] dark:text-white">Production</span>
                          <span className="text-sm text-[#0A2342] dark:text-white">
                            {bugData.segregation.production.total}
                          </span>
                        </div>
                        <div className="space-y-2 ">
                          <div className="flex justify-between items-center ">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Critical</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.production.critical}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Major</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.production.major}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Medium</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.production.medium}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Minor</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.production.minor}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Invalid</span>
                            <span className="text-[#5B9BF3] text-sm font-normal">
                              {bugData.segregation.production.invalid}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Reference Coverage Section */}
            <div className="space-y-4 bg-[#F6F8FC] dark:bg-[#1A2738] border border-[#D1E2F0] dark:border-gray-700 p-3 rounded-lg">
              <div className="grid grid-cols-10 gap-4">
                <div className="col-span-3 flex flex-col pr-2 border-r border-[#D1E2F0] dark:border-gray-700">
                  <h4 className="text-lg font-normal text-[#0A2342] dark:text-white mb-4">Reference Coverage</h4>
                  <div className="flex items-center justify-center space-x-3 flex-1">
                    {!coverageHasValues ? (
                      <div className="h-40 w-full flex items-center justify-center">
                        <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>No Data</span>
                      </div>
                    ) : (
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 0, right: 0, bottom: 10, left: 0 }}>
                            <Pie
                              data={coverageData}
                              cx="50%"
                              cy="45%"
                              outerRadius={55}
                              dataKey="value"
                              label={false}
                              labelLine={false}
                              stroke="none"
                              startAngle={0}
                              endAngle={360}
                            >
                              {coverageData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Legend
                              verticalAlign="bottom"
                              align="center"
                              iconType="circle"
                              wrapperStyle={{ 
                                color: theme === 'light' ? '#626262' : '#A3B1C9', 
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                lineHeight: '1',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                              iconSize={12}
                              formatter={(value, entry) => {
                                const percentage = entry.payload?.value || 0;
                                return (
                                  <span className="text-sm" style={{ color: theme === 'light' ? '#626262' : '#A3B1C9', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                    {percentage}% {value}
                                  </span>
                                );
                              }}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0];
                                  return (
                                    <div className={`${theme === 'light' ? 'bg-[#0D1621] border-[#224F78]' : 'bg-[#173A5A] border-[#224F78]'} border rounded px-2 py-1.5 text-xs`}>
                                      <div className="flex items-center gap-1.5">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: data.payload.color }}
                                        />
                                        <span className="text-white">
                                          {data.payload.name}: {data.value}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reference & Test Cases Bar Chart - 7/10 */}
                <div className="col-span-7 space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-normal text-[#0A2342] dark:text-white">Reference & Test Cases</h4>
                  </div>
                  <div className="h-40">
                    {!testMetricsHasValues ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>No Data</span>
                      </div>
                    ) : (          
                      <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={testMetricsData}
                        layout="vertical"
                        margin={{
                          top: 0,
                          right: 20,
                          left: 5,
                          bottom: 5,
                        }}
                      >
                        <XAxis
                          type="number"
                          domain={axisConfig.domain}
                          stroke={theme === 'light' ? '#6B7280' : '#E8E9EA'}
                          ticks={axisConfig.ticks}
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          tick={{ fill: theme === 'light' ? '#6B7280' : '#E8E9EA' }}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={0}
                          stroke="#9CA3AF"
                          axisLine={false}
                          tickLine={false}
                          tick={false}
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="left"
                          iconType="circle"
                          wrapperStyle={{ 
                            color: theme === 'light' ? '#626262' : '#A3B1C9', 
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            lineHeight: '1'
                          }}
                          iconSize={12}
                          payload={testMetricsData.map((entry) => ({
                            value: entry.name,
                            type: 'circle',
                            color: entry.color,
                          }))}
                          formatter={(value) => (
                            <span style={{ color: theme === 'light' ? '#626262' : '#A3B1C9', fontSize: '14px', display: 'inline-flex', alignItems: 'center' }}>{value}</span>
                          )}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0];
                              const displayValue = data.payload.originalValue !== undefined ? data.payload.originalValue : data.value;
                              return (
                                <div className={`${theme === 'light' ? 'bg-[#0D1621] border-[#224F78]' : 'bg-[#173A5A] border-[#224F78]'} border rounded px-2 py-1.5 text-xs`}>
                                  <div className="flex items-center gap-1.5">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: data.payload.color }}
                                    />
                                    <span className="text-white">
                                      {data.payload.name}: {displayValue}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                          cursor={{ fill: 'transparent' }}
                        />
                        <Bar 
                          dataKey="value" 
                          barSize={8} 
                          radius={[4, 4, 4, 4]}
                          minPointSize={0}
                          shape={BarShapeComponent}
                        >
                          {testMetricsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Test Section */}
            <div className="h-[200px] bg-[#F6F8FC] dark:bg-[#1A2738] border border-[#D1E2F0] dark:border-gray-700 p-3 rounded-lg flex flex-col">
              <h3 className="text-lg font-normal text-[#0A2342] dark:text-white mb-1">Test</h3>
              <div className="border-b border-[#D1E2F0] dark:border-gray-700 mb-1"></div>
              <div className="flex-1 flex gap-2">
                {/* Manual Metrics */}
                <div className="flex-1 flex flex-col pr-2 border-r border-[#D1E2F0] dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-sm font-normal text-[#D64EFF]">Manual</h4>
                    <div className="relative group w-4 h-4 flex-shrink-0">
                      <span
                        data-tooltip-id="tooltip-manual"
                        data-tooltip-html={manualTooltipHtml}
                        data-tooltip-place="top"
                        className="cursor-pointer"
                      >
                        <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                      </span>
                      <InfoTooltip id="tooltip-manual" theme={theme} tooltipStyles={tooltipStyles} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>
                        Total test cases
                      </span>
                      <span className="text-sm font-normal text-blue-500">{manualMetrics.totalTestCases}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>New</span>
                      <span className="text-sm font-normal text-blue-500 ">
                        {manualMetrics.new}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Executed</span>
                      <span className="text-sm font-normal text-blue-500">
                        {manualMetrics.executed}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Pass (%)</span>
                      <span className="text-sm font-normal text-blue-500 ">
                        {manualMetrics.passPercent}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Automation Metrics */}
                <div className="flex-1 flex flex-col px-2 border-r border-[#D1E2F0] dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-sm font-normal text-[#D64EFF]">Automation</h4>
                    <div className="relative group w-4 h-4 flex-shrink-0">
                      <span
                        data-tooltip-id="tooltip-automation"
                        data-tooltip-html={automationTooltipHtml}
                        data-tooltip-place="top"
                        className="cursor-pointer"
                      >
                        <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                      </span>
                      <InfoTooltip id="tooltip-automation" theme={theme} tooltipStyles={tooltipStyles} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>
                        Total test cases
                      </span>
                      <span className="text-sm font-normal text-blue-500">{automationMetrics.totalTestCases}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>New</span>
                      <span className="text-sm font-normal text-blue-500">
                        {automationMetrics.new}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Executed</span>
                      <span className="text-sm font-normal text-blue-500 ">
                        {automationMetrics.executed}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Pass (%)</span>
                      <span className="text-sm font-normal text-blue-500 ">
                        {automationMetrics.passPercent}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coverage */}
                <div className="flex-1 flex flex-col pl-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-sm font-normal text-[#D64EFF]">Coverage</h4>
                    <div className="relative group w-4 h-4 flex-shrink-0">
                      <span
                        data-tooltip-id="tooltip-coverage"
                        data-tooltip-html={coverageTooltipHtml}
                        data-tooltip-place="top"
                        className="cursor-pointer"
                      >
                        <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                      </span>
                      <InfoTooltip id="tooltip-coverage" theme={theme} tooltipStyles={tooltipStyles} />
                    </div>
                  </div>
                
                
                
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal`}>Automated Cases</span>
                      <span className="text-sm font-normal text-blue-500 ">
                        {coverageMetrics.automatedCases}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm font-normal flex items-center`}>
                        Regression
                       
                      </span>
                      <span className="text-sm font-normal text-blue-500 ">
                        {coverageMetrics.regression}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default QAInsights;
