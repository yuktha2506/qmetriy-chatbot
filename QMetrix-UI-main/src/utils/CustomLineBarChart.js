import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import ChartTooltip from '../components/Common/ChartTooltip';
import { CustomTick } from '../components/Common/ToolTip';

let KEYS = [];
const labelMappings = {
  fifteenDayTrend: {
    automation: 'Automation Test Result',
    manual: 'Manual Test Result',
    bugs: 'Open Bugs',
    dla: 'DLA',
    traceability: 'Traceability',
  },
  burndown: {
    ideal: 'Ideal Progress',
    actual: 'Actual Progress',
  },
  dayRRTrend: {
    releaseReadiness: "Release Readiness"
  },
  deployment: {
    deployment: 'Deployment Frequency'
  },
  changefailure: {
    changefailure: 'Change Failure Rate (%)'
  },
  recovery: {
    recovery: 'Mean Time to Recovery'
  },
  operationScoreTrend: {
    deploymentfrequency: 'Deployment Frequency',
    changefailurerate: 'Change Failure Rate',
    meantimeTorecovery: 'Mean Time to Recovery',
    leadtimeforchanges: 'Lead Time for Changes',
  },
  dayOperationTrend: {
    operationScore: 'Operation Score',
  },
  storyPointsTrend: {
    committed: 'Total Story Points Committed (%)',
    completed: 'Total Story Points Completed (%)',
  },
  blockedStoriesTrend: {
    value: 'Blocked',
  },
  gapAnalysis: {
    committed: 'Committed',
    completed: 'Completed',
    gap: 'Gap',
  },
  velocityDetails: {
    initiallyCommitted: 'Initially Committed',
    finallyCommitted: 'Finally Committed',
    done: 'Done',
    velocity: 'Velocity',
  },
  burndownDistribution: {
    value: 'Burndown Value',
  },
  defectDensity: {
    defectdensityvalue: 'Defect Density',
  },
  codeCoverage: {
    codecoveragevalue: 'Code Coverage',
  },

  cycleTime: {
    cycletimevalue: 'Cycle Time',
  },
  developerScoreTrend: {
    defectdensity: 'Defect Density',
    timetofixbug: 'Time To Fix Bug',
    releasecycletime: 'Release Cycle Time',
  },
  dayDeveloperScoreTrend: {
    developerscore: 'Developer Score',
  },


  testCoverage: {
    testCoverage: 'Test Coverage',
  },
  testAutomation: {
    testAutomation: 'Test Automation',
  },
  traceability: {
    traceability: 'Traceability',
  },
  testingQuality: {
    testingQuality: 'Testing Quality',
  },
  testingProductivity: {
    testingProductivity: 'Testing Productivity',
  },
  automationTestingProductivity: {
    automationTestingProductivity: 'Automation Testing Productivity',
  },
  dla: {
    dla: 'Defect Leakage Analysis',
  },
  testCycleTime: {
    testCycleTime: 'Test Cycle Time',
  },
  testScoreTrend: {
    testScore: 'Test Score',
  },
  testScoreMetrics: {

    dla: 'DLA',
    automationTestResult: 'Automation Test Result',
    manualTestResult: 'Manual Test Result',
    openBugs: 'Open Bugs',
    traceability: 'Traceability',
  },
  cycleTimeDistribution: {
    value: 'Cycle Time',
  },
  issueTypeDistribution: {
    value: 'Issue Count',
  },
  dreDistribution: {
    value: 'DRE',
  },
  dlaDistribution: {
    value: 'DLA',
  },
  defectDensityDistribution: {
    value: 'Defect Density',
  },
  drrDistribution: {
    value: 'DRR',
  },
  ttfDistribution: {
    value: 'Time to Fix',
  },
  costOfFixingDefectsDistribution: {
    value: 'Defect',
  },
  velocityDistribution: {
    value: 'Velocity',
  },
  averageVelocityDistribution: {
    planned: 'Planned',
    incomplete: 'Incomplete',
    completed: 'Completed',
    completedLate: 'Completed Late',
  },
  bugClassificationDistribution: {
    value: 'Bug Count',
  },
  committedVsCompletedDistribution: {
    value: 'Value',
  },
  gitData: {
    value: 'Pull Requests',
  },
  gitCycleTime: {
    value: 'Cycle Time',
  },
};


const CustomLineBarChart = ({ data, showLine, showBar, type, dataType, showAssignee = false, legendLabel,legendLabel2 }) => {
  const theme = useSelector((state) => state.theme.theme);
  if (type === "fifteenDayTrend") {
    KEYS = ['automation', 'manual', 'bugs', 'dla', 'traceability'];
  } else if (type === "burndown") {
    KEYS = ['ideal', 'actual'];
  } else if (type === "dayRRTrend") {
    KEYS = ['releaseReadiness'];
  } else if (type === "deployment") {
    KEYS = ['deployment'];
  }
  else if (type === "changefailure") {
    KEYS = ['changefailure'];
  }
  else if (type === "recovery") {
    KEYS = ['recovery'];
  } else if (type === "operationScoreTrend") {
    KEYS = ['deploymentFrequency', 'changeFailureRate', 'meanTimeToRecovery', 'leadTimeForChanges'];
  } else if (type === "dayOperationTrend") {
    KEYS = ['operationScore'];
  } else if (type === "storyPointsTrend") {
    KEYS = ['committed', 'completed'];
  } else if (type === "blockedStoriesTrend") {
    KEYS = ['value'];
  } else if (type === "gapAnalysis") {
    KEYS = ['committed', 'completed', 'gap'];
  } else if (type === "velocityDetails") {
    KEYS = ['initiallyCommitted', 'finallyCommitted', 'done', 'velocity'];
  } else if (type === "burndownDistribution") {
    KEYS = ['value'];
  } else if (type === "defectDensity") {
    KEYS = ['defectdensityvalue'];
  }
  else if (type === "codeCoverage") {
    KEYS = ['codecoveragevalue'];
  } else if (type === "cycleTime") {
    KEYS = ['cycletimevalue'];
  } else if (type === "developerScoreTrend") {
    KEYS = ['defectDensity', 'timeToFixBug', 'releaseCycleTime'];
  } else if (type === "dayDeveloperScoreTrend") {
    KEYS = ['developerScore'];
  } else if (type === "testCoverage") {
    KEYS = ['testCoverage'];
  } else if (type === "testAutomation") {
    KEYS = ['testAutomation'];
  } else if (type === "traceability") {
    KEYS = ['traceability'];
  } else if (type === "testingQuality") {
    KEYS = ['testingQuality'];
  } else if (type === "testingProductivity") {
    KEYS = ['testingProductivity'];
  } else if (type === "automationTestingProductivity") {
    KEYS = ['automationTestingProductivity'];
  } else if (type === "dla") {
    KEYS = ['dla'];
  } else if (type === "testCycleTime") {
    KEYS = ['testCycleTime'];

  }
  else if (type === "testScoreTrend") {
    KEYS = ['testScore'];
  } else if (type === "testScoreMetrics") {
    KEYS = [
      'automationTestResult',
      'manualTestResult',
      'openBugs',
      'dla',
      'traceability',
    ];
  } else if (type === "cycleTimeDistribution") {
    KEYS = ['value'];
  } else if (type === "issueTypeDistribution") {
    KEYS = ['value'];
  } else if (type === "dreDistribution") {
    KEYS = ['value'];
  } else if (type === "dlaDistribution") {
    KEYS = ['value'];
  } else if (type === "defectDensityDistribution") {
    KEYS = ['value'];
  } else if (type === "drrDistribution") {
    KEYS = ['value'];
  } else if (type === "ttfDistribution") {
    KEYS = ['value'];
  } else if (type === "costOfFixingDefectsDistribution") {
    KEYS = ['value'];
  } else if (type === "velocityDistribution") {
    KEYS = ['value'];
  } else if (type === "averageVelocityDistribution") {
    KEYS = ['planned', 'incomplete', 'completed', 'completedLate'];
  } else if (type === "bugClassificationDistribution") {
    KEYS = ['value'];
  } else if (type === "committedVsCompletedDistribution") {
    KEYS = ['value'];
  } else if (type === "gitData") {
    KEYS = ['value'];
  } else if (type === "gitCycleTime") {
    // Check if data has multiple keys for sprint trend (Cycle Time, PRs Merged, PRs in Progress)
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      if (firstItem && typeof firstItem === 'object') {
        const keys = Object.keys(firstItem).filter(key => key !== 'day');
        if (keys.includes('Cycle Time') && keys.includes('PRs Merged') && keys.includes('PRs in Progress')) {
          KEYS = ['Cycle Time', 'PRs Merged', 'PRs in Progress'];
        } else {
          KEYS = ['value'];
        }
      } else {
        KEYS = ['value'];
      }
    } else {
      KEYS = ['value'];
    }
  } else {
    KEYS = [];
  }
  const renderDynamicCharts = () => {
    return KEYS.map((key) => {
      // For distribution types, use the color from the data items directly
      const isDistributionType = type === 'cycleTimeDistribution' || type === 'issueTypeDistribution' || type === 'dreDistribution' || type === 'dlaDistribution' || type === 'defectDensityDistribution' || type === 'drrDistribution' || type === 'ttfDistribution' || type === 'bugClassificationDistribution' || type === 'costOfFixingDefectsDistribution' || type === 'velocityDistribution' || type === 'averageVelocityDistribution' || type === 'committedVsCompletedDistribution' || type === 'blockedStoriesTrend' || type === 'burndownDistribution' || type === 'gitData' || type === 'gitCycleTime';

      let color;
      if (type === 'gitCycleTime' && KEYS.length > 1) {
        if (key === 'Cycle Time') {
          color = '#FF6B35';
        } else if (key === 'PRs Merged') {
          color = '#8B5CF6';
        } else if (key === 'PRs in Progress') {
          color = '#10B981';
        } else {
          color = '#066FD1';
        }
      } else {
        if (isDistributionType) {
          if (type === 'averageVelocityDistribution') {
            color = Array.isArray(data)
              ? data.find((item) => item[`${key}Color`])?.[`${key}Color`]
              : undefined;
            if (!color) {
              color = theme === 'light' ? '#5580A6' : '#6699FF';
            }
          } else {
            const first = Array.isArray(data) && data.length > 0 ? data.find((d) => d && d.color) || data[0] : undefined;
            color = (first && first.color) || (theme === 'light' ? '#5580A6' : '#6699FF');
          }
        } else {
          const fromKeyColor = Array.isArray(data) ? data.find((item) => item && item[`${key}Color`])?.[`${key}Color`] : undefined;
          const fromGeneric = Array.isArray(data) && data.length > 0 ? (data.find((d) => d && d.color)?.color || data[0].color) : undefined;
          color = fromKeyColor || fromGeneric || (theme === 'light' ? '#5580A6' : '#6699FF');
        }
      }

      // For velocityDetails, show bars for first 3 keys and line for velocity
      if (type === 'velocityDetails') {
        if (key === 'velocity') {
          // Always show velocity as a line
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              dot={false}
              strokeWidth={2}
            />
          );
        } else {
          // Show bars for initiallyCommitted, finallyCommitted, done
          return (
            <Bar
              key={key}
              dataKey={key}
              radius={[2, 2, 0, 0]}
              fill={color}
              background={false}
              isAnimationActive={false}
            />
          );
        }
      }

      // For gitCycleTime with multiple keys, show Cycle Time as line and others as bars
      if (type === 'gitCycleTime' && KEYS.length > 1) {
        if (key === 'Cycle Time') {
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              dot={true}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          );
        } else {
          // Show PRs Merged and PRs in Progress as bars
          return (
            <Bar
              key={key}
              dataKey={key}
              radius={[2, 2, 0, 0]}
              fill={color}
              background={false}
              isAnimationActive={false}
            />
          );
        }
      }

      if (showLine) {
        return (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            dot={false}
            strokeWidth={2}
          />
        );
      }
      if (showBar) {
        return (
          <Bar
            key={key}
            dataKey={key}
            radius={[2, 2, 0, 0]}
            fill={color}
            background={false}
            isAnimationActive={false}
          />
        );
      }
      return null;
    });
  };

  return (
    <div
      className={
        (type === "fifteenDayTrend" || type === "dayRRTrend")
          ? "h-[250px]"
          : "w-full h-[240px] overflow-x-auto scrollbar-super-thin scrollbar-track-transparent"
      }
    >
      <div className={((type === "fifteenDayTrend" || type === "dayRRTrend") ? "w-full h-full" : "min-w-[600px] h-full")}>
        <ResponsiveContainer width="100%"
          height={
            type === "fifteenDayTrend"
              ? "75%"
              : type === "dayRRTrend"
                ? "80%"
                : "100%"
          }
        >
          {type === 'velocityDetails' ? (
            <ComposedChart
              data={data}
              barSize={15}
              barGap={1}
              barCategoryGap={0}
              margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke={theme === 'light' ? '#BBCFE6' : '#2A3F4F'} vertical={true} horizontal={true} />
              <XAxis
                dataKey='name'
                stroke={theme === 'light' ? '#5580A6' : '#e1def5e6'}
                tick={<CustomTick fill={theme === 'light' ? '#5580A6' : '#e1def5e6'} />}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickMargin={10}
              />
              <YAxis
                width={30}
                stroke={theme === 'light' ? '#5580A6' : '#e1def5e6'}
                tick={{ fontSize: '11px' }}
                axisLine={false}
                tickLine={false}
                tickCount={6}
                domain={[0, 'auto']}
                allowDecimals={false}
              />
              <Legend
                iconType="circle"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  fontSize: '13px',
                  color: theme === 'light' ? '#5580A6' : undefined,
                  paddingTop: '20px'
                }}
                formatter={(value) => {
                if (type === 'gitCycleTime' && KEYS.length > 1) {
                    const short = legendLabel2 || 'PR'; // PR / MR

                    if (value === 'PRs Merged') {
                      return (
                        <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                          {short}s Merged
                        </span>
                      );
                    }

                    if (value === 'PRs in Progress') {
                      return (
                        <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                          {short}s in Progress
                        </span>
                      );
                    }

                    if (value === 'Cycle Time') {
                      return (
                        <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                          Cycle Time
                        </span>
                      );
                    }
                  }
                const key = value.toLowerCase();
                  const label =
                    legendLabel ||
                    labelMappings[type]?.[key] ||
                    value;

                  return (
                    <span style={{ color: theme === 'light' ? '#5580A6' : '#ffffff' }}>
                      {label}
                    </span>
                  );
                }}

              />
              <Tooltip
                content={<ChartTooltip theme={theme} dataType={dataType} showAssignee={showAssignee} />}
                cursor={{ fill: 'transparent' }}
              />
              {renderDynamicCharts()}
            </ComposedChart>
          ) : showBar ? (
            <BarChart
              data={data}
              barSize={type === 'fifteenDayTrend' ? 4 : type === 'burndown' ? 16 : type === 'averageVelocityDistribution' ? 15 : type === 'gapAnalysis' ? 15 : type === 'gitData' || type === 'gitCycleTime' ? 15 : 25}
              barGap={type === 'fifteenDayTrend' ? 1 : 1}
              barCategoryGap={0}
              margin={{
                top: 5,
                right: 20,
                left: 5,
                bottom: (type === 'gitData' || type === 'gitCycleTime') ? 60 : 40
              }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke={theme === 'light' ? '#BBCFE6' : '#2A3F4F'} vertical={true} horizontal={true} />
              <XAxis
                dataKey={type === 'cycleTimeDistribution' || type === 'issueTypeDistribution' || type === 'dreDistribution' || type === 'dlaDistribution' || type === 'defectDensityDistribution' || type === 'drrDistribution' || type === 'ttfDistribution' || type === 'bugClassificationDistribution' || type === 'costOfFixingDefectsDistribution' || type === 'velocityDistribution' || type === 'averageVelocityDistribution' || type === 'committedVsCompletedDistribution' || type === 'blockedStoriesTrend' || type === 'storyPointsTrend' || type === 'gapAnalysis' || type === 'velocityDetails' || type === 'burndownDistribution' ? 'name' : 'day'}
                stroke={theme === 'light' ? '#5580A6' : '#e1def5e6'}
                tick={<CustomTick fill={theme === 'light' ? '#5580A6' : '#e1def5e6'} />}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickMargin={10}
              />
              <YAxis
                width={30}
                stroke={theme === 'light' ? '#5580A6' : '#e1def5e6'}
                tick={{ fontSize: '11px' }}
                axisLine={false}
                tickLine={false}
                tickCount={6}
                domain={[0, 'auto']}
                allowDecimals={false}
              />
              {
                type !== 'dayRRTrend' && (
                  <Legend
                    iconType="circle"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{
                      fontSize: '13px',
                      color: theme === 'light' ? '#5580A6' : undefined,
                      paddingTop: (type === 'gitData' || type === 'gitCycleTime') ? '15px' : '10px'
                    }}
                    formatter={(value) => {
                      if (type === 'gitCycleTime' && KEYS.length > 1) {
                        const short = legendLabel2 || 'PR'; // PR / MR

                        if (value === 'PRs Merged') {
                          return (
                            <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                              {short}s Merged
                            </span>
                          );
                        }

                        if (value === 'PRs in Progress') {
                          return (
                            <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                              {short}s in Progress
                            </span>
                          );
                        }

                        if (value === 'Cycle Time') {
                          return (
                            <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                              Cycle Time
                            </span>
                          );
                        }
                      }
                    const key = value.toLowerCase();
                      const label =
                        legendLabel ||
                        labelMappings[type]?.[key] ||
                        value;

                      return (
                        <span style={{ color: theme === 'light' ? '#5580A6' : '#ffffff' }}>
                          {label}
                        </span>
                      );
                    }}

                  />
                )
              }
              <Tooltip
                content={<ChartTooltip theme={theme} dataType={dataType} showAssignee={showAssignee} />}
                cursor={showBar ? { fill: 'transparent' } : { stroke: (theme === 'light' ? '#5580A6' : '#066FD1'), strokeWidth: 1 }}
              />

              {renderDynamicCharts()}
            </BarChart>
          ) : (
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 40,
                left: 5,
                bottom: (type === 'gitData' || type === 'gitCycleTime') ? 60 : 40
              }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke={theme === 'light' ? '#BBCFE6' : '#2A3F4F'} vertical={true} horizontal={true} />
              <XAxis
                dataKey={type === 'cycleTimeDistribution' || type === 'issueTypeDistribution' || type === 'dreDistribution' || type === 'dlaDistribution' || type === 'defectDensityDistribution' || type === 'drrDistribution' || type === 'ttfDistribution' || type === 'bugClassificationDistribution' || type === 'costOfFixingDefectsDistribution' || type === 'velocityDistribution' || type === 'averageVelocityDistribution' || type === 'committedVsCompletedDistribution' || type === 'blockedStoriesTrend' || type === 'storyPointsTrend' || type === 'gapAnalysis' || type === 'velocityDetails' || type === 'burndownDistribution' ? 'name' : 'day'}
                stroke={theme === 'light' ? '#5580A6' : '#e1def5e6'}
                tick={<CustomTick fill={theme === 'light' ? '#5580A6' : '#e1def5e6'} />}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickMargin={10}
              />
              <YAxis
                width={30}
                stroke={theme === 'light' ? '#5580A6' : '#e1def5e6'}
                tick={{ fontSize: '11px' }}
                axisLine={false}
                tickLine={false}
                tickCount={6}
                domain={[0, 'auto']}
                allowDecimals={false}
              />
              {
                type !== 'dayRRTrend' && (
                  <Legend
                    iconType="circle"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{
                      fontSize: '13px',
                      color: theme === 'light' ? '#5580A6' : undefined,
                      paddingTop: (type === 'gitData' || type === 'gitCycleTime') ? '15px' : '10px'
                    }}
                    formatter={(value) => {
                      if (type === 'gitCycleTime' && KEYS.length > 1) {
                        const short = legendLabel2 || 'PR'; // PR / MR

                        if (value === 'PRs Merged') {
                          return (
                            <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                              {short}s Merged
                            </span>
                          );
                        }

                        if (value === 'PRs in Progress') {
                          return (
                            <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                              {short}s in Progress
                            </span>
                          );
                        }

                        if (value === 'Cycle Time') {
                          return (
                            <span style={{ color: theme === 'light' ? '#5580A6' : '#fff' }}>
                              Cycle Time
                            </span>
                          );
                        }
                      }

                      const key = value.toLowerCase();
                      const label =
                        legendLabel ||
                        labelMappings[type]?.[key] ||
                        value;

                      return (
                        <span style={{ color: theme === 'light' ? '#5580A6' : '#ffffff' }}>
                          {label}
                        </span>
                      );
                    }}

                  />
                )
              }
              <Tooltip
                content={<ChartTooltip theme={theme} dataType={dataType} showAssignee={showAssignee} />}
                cursor={showBar ? { fill: 'transparent' } : { stroke: (theme === 'light' ? '#5580A6' : '#066FD1'), strokeWidth: 1 }}
              />
              {renderDynamicCharts()}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div >
  );
};

CustomLineBarChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  showLine: PropTypes.bool,
  showBar: PropTypes.bool,
  type: PropTypes.string,
  dataType: PropTypes.string,
  showAssignee: PropTypes.bool,
  legendLabel: PropTypes.string,
  legendLabel2: PropTypes.string,
};

CustomLineBarChart.defaultProps = {
  showLine: true,
  showBar: false,
};

export default CustomLineBarChart;

