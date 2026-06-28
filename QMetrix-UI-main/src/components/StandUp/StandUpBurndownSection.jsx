import { memo, Suspense } from 'react';
import PropTypes from 'prop-types';
import { ThumbsUp, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import CommonTooltip from '../Common/ToolTip';
import { formatNumberWithSuffix } from '../../utils/commonFunctions';
import { APP_STRINGS } from '../../constants';
import TooltipIcon from '../../utils/TooltipIcon';

function StandUpBurndownSection({
  isReleaseSelected,
  selectedDeveloper,
  selectedValue,
  burndownStatus,
  isStoryPoints,
  setIsStoryPoints,
  lockToHours,
  lockToPoints,
  pointsSourceType,
  newBurndownData,
  chartSuspenseFallback,
  burndownChartData,
  theme,
  isHoursBasedProject,
  selectedSprint,
  jiraData,
  todaysVelocity,
  yesterdayVelocity,
  heavyChartsReady,
  LazyReleaseBurndownStackedBar,
  BurndownSprintLineChart,
}) {
  return (
    <div
      className={`p-0 bg-[#FFFFFF] dark:bg-[#182433] dark:text-[#C8C8C8] text-black rounded-[10px] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md border ${isReleaseSelected ? 'border-[#D1E2F0]' : 'border-[#E5E5E5]'} dark:border-[#25384F] ${
        isReleaseSelected ? 'h-[352px]' : 'h-[297px]'
      } flex flex-col overflow-hidden min-w-0 max-w-full ${
        isReleaseSelected
          ? 'w-[calc(100%-1.75rem)] min-w-0 max-w-[calc(100%-1.75rem)] ml-5 mr-2'
          : 'ml-5 basis-[300px] flex-grow min-w-[340px]'
      }`}
    >
      <div className={`flex items-center gap-2 pb-2.5 flex-shrink-0 ${isReleaseSelected ? 'pt-3 pl-[30px] pr-2' : 'px-2 pt-1.5'}`}>
        <div className="flex items-center gap-1 w-1/3 min-w-0">
          <h3 className="text-lg text-[#202020] dark:text-white shrink-0">Burndown</h3>
          <div className="relative group shrink-0">
            <TooltipIcon
              title="StandupBurndown"
              tooltip="Tracks remaining work over time vs. the ideal burndown line <br /> for the selected SPRINT / RELEASE"
              theme={theme}
              placement="top-start"
            />
          </div>
        </div>
        <div className="flex items-center justify-center w-1/3">
          {!selectedDeveloper && selectedValue?.value === APP_STRINGS.VALUE_SPRINT && (
            <>
              {burndownStatus === 'greatGoing' && (
                <div className="flex items-center gap-1.5 text-green-500">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Great Going!</span>
                </div>
              )}
              {burndownStatus === 'moveFaster' && (
                <div className="flex items-center gap-1.5 text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Move Faster</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end w-1/3 relative">
          {selectedValue?.value === APP_STRINGS.VALUE_SPRINT && (
            <div className="inline-flex items-center bg-transparent dark:bg-[#242B34] rounded-full p-0.5 border border-[#E5E5E5] dark:border-[#101010]">
              <button
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  isStoryPoints
                    ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                    : 'text-[#24527A] dark:text-gray-500'
                }`}
                onClick={() => setIsStoryPoints(true)}
                disabled={lockToHours}
              >
                {!isStoryPoints
                  ? 'SP'
                  : pointsSourceType === 'effort'
                  ? 'Effort'
                  : 'SP'}
              </button>
              <button
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  !isStoryPoints
                    ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                    : 'text-[#24527A] dark:text-gray-500'
                }`}
                onClick={() => setIsStoryPoints(false)}
                disabled={lockToPoints}
              >
                Hrs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conditional Rendering: Stacked Bar for Release, Line Chart for Sprint */}
      {selectedValue?.value === APP_STRINGS.VALUE_RELEASE &&
      newBurndownData?.sprintBreakdown &&
      Array.isArray(newBurndownData.sprintBreakdown) &&
      newBurndownData.sprintBreakdown.length > 0 ? (
        // Release Burndown - Stacked Bar Chart
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <Suspense fallback={chartSuspenseFallback}>
            <LazyReleaseBurndownStackedBar
              data={burndownChartData}
              theme={theme}
              isHoursBasedProject={isHoursBasedProject}
            />
          </Suspense>
        </div>
      ) : selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? (
        // Sprint Burndown - Line Chart (existing implementation)
        <>
          {/* Key Metrics Bar */}
          {!selectedDeveloper &&
            selectedValue &&
            selectedValue.value &&
            selectedSprint &&
            selectedSprint.name && (
              <div className="px-2 py-1 mb-0.5 flex-shrink-0 burndown-metrics-container">
                <div className="bg-[#F5F5F5] dark:bg-[#1E2A3A] border border-[#E5E5E5] dark:border-[#3A4A5F] rounded-lg px-1.5 py-1 shadow-sm">
                  <div className="flex items-center gap-0 flex-nowrap burndown-metrics-wrapper">
                    <div className="flex items-center gap-0.5 min-w-0 flex-shrink burndown-metric-item">
                      <span className="text-[11px] text-[#202020] dark:text-white whitespace-nowrap">
                        Today&apos;s
                      </span>
                      {Math.round(jiraData?.burndownVelocity?.today ?? 0) > 999 ? (
                        <CommonTooltip
                          content={Math.round(
                            jiraData?.burndownVelocity?.today ?? 0,
                          ).toLocaleString()}
                          position="top"
                        >
                          <span
                            className="text-[11px] font-semibold ml-1"
                            style={{ color: '#457EFF' }}
                          >
                            {
                              formatNumberWithSuffix(
                                Math.round(jiraData?.burndownVelocity?.today ?? 0),
                              ).formatted
                            }
                          </span>
                        </CommonTooltip>
                      ) : (
                        <span
                          className="text-[11px] font-semibold ml-1"
                          style={{ color: '#457EFF' }}
                        >
                          {
                            formatNumberWithSuffix(
                              Math.round(jiraData?.burndownVelocity?.today ?? 0),
                            ).formatted
                          }
                        </span>
                      )}

                      {todaysVelocity > yesterdayVelocity ? (
                        <ArrowUp
                          className="w-3 h-3 text-green-500"
                          style={{ transform: 'rotate(45deg)' }}
                        />
                      ) : todaysVelocity < yesterdayVelocity ? (
                        <ArrowDown
                          className="w-3 h-3 text-red-500"
                          style={{ transform: 'rotate(-45deg)' }}
                        />
                      ) : null}
                    </div>

                    <div className="flex items-center gap-0.2 min-w-0 flex-shrink burndown-metric-item ml-0.5">
                      <span className="text-[11px] text-[#202020] dark:text-white whitespace-nowrap">
                        Yesterday&apos;s
                      </span>
                      {Math.round(jiraData?.burndownVelocity?.yesterday ?? 0) > 999 ? (
                        <CommonTooltip
                          content={Math.round(
                            jiraData?.burndownVelocity?.yesterday ?? 0,
                          ).toLocaleString()}
                          position="top"
                        >
                          <span
                            className="text-[11px] font-semibold ml-1"
                            style={{ color: '#457EFF' }}
                          >
                            {
                              formatNumberWithSuffix(
                                Math.round(jiraData?.burndownVelocity?.yesterday ?? 0),
                              ).formatted
                            }
                          </span>
                        </CommonTooltip>
                      ) : (
                        <span
                          className="text-[11px] font-semibold ml-1"
                          style={{ color: '#457EFF' }}
                        >
                          {
                            formatNumberWithSuffix(
                              Math.round(jiraData?.burndownVelocity?.yesterday ?? 0),
                            ).formatted
                          }
                        </span>
                      )}
                    </div>

                    <div
                      className="px-1.5 py-1 bg-[#326AEB1A] dark:bg-[#326AEB1A] rounded-md text-[11px] font-medium min-w-fit flex-shrink text-center burndown-metric-item flex items-center justify-center ml-5"
                      style={{ color: '#457EFF' }}
                    >
                      <span className="whitespace-nowrap">
                        Target:{' '}
                        {Math.round(jiraData?.burndownVelocity?.targetVelocity ?? 0) > 999 ? (
                          <CommonTooltip
                            content={Math.round(
                              jiraData?.burndownVelocity?.targetVelocity ?? 0,
                            ).toLocaleString()}
                            position="top"
                          >
                            <span>
                              {
                                formatNumberWithSuffix(
                                  Math.round(jiraData?.burndownVelocity?.targetVelocity ?? 0),
                                ).formatted
                              }
                            </span>
                          </CommonTooltip>
                        ) : (
                          <span>
                            {
                              formatNumberWithSuffix(
                                Math.round(jiraData?.burndownVelocity?.targetVelocity ?? 0),
                              ).formatted
                            }
                          </span>
                        )}
                      </span>
                    </div>

                    <div
                      className="px-0.5 py-1 bg-[#326AEB1A] dark:bg-[#326AEB1A] rounded-md text-[11px] font-medium min-w-fit flex-shrink-0 text-center burndown-metric-item flex items-center justify-center -ml-0.5"
                      style={{ color: '#457EFF' }}
                    >
                      <span className="whitespace-nowrap">
                        {selectedValue?.value === APP_STRINGS.VALUE_SPRINT
                          ? '5 Sprints Avg:'
                          : '5 Releases Avg:'}{' '}
                        {Math.round(jiraData?.burndownVelocity?.averageVelocity ?? 0) > 999 ? (
                          <CommonTooltip
                            content={Math.round(
                              jiraData?.burndownVelocity?.averageVelocity ?? 0,
                            ).toLocaleString()}
                            position="top"
                          >
                            <span>
                              {
                                formatNumberWithSuffix(
                                  Math.round(jiraData?.burndownVelocity?.averageVelocity ?? 0),
                                ).formatted
                              }
                            </span>
                          </CommonTooltip>
                        ) : (
                          <span>
                            {
                              formatNumberWithSuffix(
                                Math.round(jiraData?.burndownVelocity?.averageVelocity ?? 0),
                              ).formatted
                            }
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Scrollable Chart */}
          {heavyChartsReady ? (
            <Suspense fallback={chartSuspenseFallback}>
              <BurndownSprintLineChart burndownChartData={burndownChartData} theme={theme} />
            </Suspense>
          ) : (
            chartSuspenseFallback
          )}
          {/* Sticky-Like Bottom Legend */}
          <div
            className={`flex justify-center items-center space-x-4 px-2 py-1 text-xs flex-shrink-0 ${
              theme === 'light' ? 'text-[#626262]' : 'text-[#A3B1C9]'
            }`}
          >
            <div className="flex items-center">
              <span
                className="w-3 h-3 rounded-full inline-block mr-2"
                style={{ backgroundColor: '#4CAF50' }}
              />
              Capacity
            </div>
            <div className="flex items-center">
              <span
                className="w-3 h-3 rounded-full inline-block mr-2"
                style={{ backgroundColor: '#F59F12' }}
              />
              Ideal
            </div>
            <div className="flex items-center">
              <span
                className="w-3 h-3 rounded-full inline-block mr-2"
                style={{ backgroundColor: theme === 'light' ? '#0077E6' : '#066FD1' }}
              />
              Actual
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-[#24527A] dark:text-gray-500">
          Please select a Sprint or Release
        </div>
      )}
    </div>
  );
}

StandUpBurndownSection.propTypes = {
  isReleaseSelected: PropTypes.bool.isRequired,
  selectedDeveloper: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.object]),
  selectedValue: PropTypes.object,
  burndownStatus: PropTypes.string,
  isStoryPoints: PropTypes.bool.isRequired,
  setIsStoryPoints: PropTypes.func.isRequired,
  lockToHours: PropTypes.bool.isRequired,
  lockToPoints: PropTypes.bool.isRequired,
  pointsSourceType: PropTypes.string,
  newBurndownData: PropTypes.object,
  chartSuspenseFallback: PropTypes.node.isRequired,
  burndownChartData: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  theme: PropTypes.string.isRequired,
  isHoursBasedProject: PropTypes.bool.isRequired,
  selectedSprint: PropTypes.object,
  jiraData: PropTypes.object,
  todaysVelocity: PropTypes.number.isRequired,
  yesterdayVelocity: PropTypes.number.isRequired,
  heavyChartsReady: PropTypes.bool.isRequired,
  LazyReleaseBurndownStackedBar: PropTypes.elementType.isRequired,
  BurndownSprintLineChart: PropTypes.elementType.isRequired,
};

export default memo(StandUpBurndownSection);
