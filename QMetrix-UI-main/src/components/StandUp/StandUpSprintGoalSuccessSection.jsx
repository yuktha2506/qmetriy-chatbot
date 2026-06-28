import { memo, Suspense } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, XCircle } from 'lucide-react';
import TooltipIcon from '../../utils/TooltipIcon';

function StandUpSprintGoalSuccessSection({
  selectedDeveloper,
  selectedValueDisplay,
  theme,
  isSprintGoalStoryPoints,
  setIsSprintGoalStoryPoints,
  lockToHours,
  lockToPoints,
  pointsSourceType,
  sprintdata,
  isUsingStoryPoints,
  heavyChartsReady,
  chartSuspenseFallback,
  sprintGoalRechartsPayload,
  SprintGoalBarChart,
}) {
  return (
    <div
      className={`flex flex-col gap-[10px] basis-[200px] flex-grow overflow-hidden transition-all duration-300 ease-in-out transform mr-2 ${
        selectedDeveloper
          ? 'opacity-0 scale-50 pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
    >
      <div className="p-[10px] bg-[#FFFFFF] basis-[100px] flex-grow dark:bg-[#182433] dark:text-[#C8C8C8] text-black rounded-[10px] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md border border-[#E5E5E5] dark:border-[#25384F] w-full h-[297px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 group">
            <h2 className="text-md text-[#0A2342] dark:text-white mb-0">
              {`${selectedValueDisplay} Goal Success`}
            </h2>
            <div className="relative group">
              <TooltipIcon
                title={`${selectedValueDisplay} Goal Success`}
                tooltip={`Displays ${selectedValueDisplay} goal completion status <br /> for the last 5 ${selectedValueDisplay}s`}
                theme={theme}
                placement={'top-start'}
              />
            </div>
          </div>
          <div className="inline-flex items-center bg-transparent dark:bg-[#242B34] rounded-full p-0.5 border border-[#E5E5E5] dark:border-[#101010]">
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                isSprintGoalStoryPoints
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-500'
              }`}
              onClick={() => setIsSprintGoalStoryPoints(true)}
              disabled={lockToHours}
            >
              {!isSprintGoalStoryPoints
                ? 'SP'
                : pointsSourceType === 'effort'
                ? ' Effort'
                : 'SP'}
            </button>
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                !isSprintGoalStoryPoints
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-500'
              }`}
              onClick={() => setIsSprintGoalStoryPoints(false)}
              disabled={lockToPoints}
            >
              Hrs
            </button>
          </div>
        </div>
        <div
          className="flex justify-center gap-10 mb-0 mt-0 flex-wrap relative"
          style={{ height: '20px' }}
        >
          {sprintdata.map((item, index) => {
            const isStoryPointMode = isUsingStoryPoints && isSprintGoalStoryPoints;
            const isHourMode = !isUsingStoryPoints && !isSprintGoalStoryPoints;
            const isEmpty = isStoryPointMode
              ? item.committed === 0 && item.completed === 0
              : isHourMode
              ? item.committedHours === 0 && item.completedHours === 0
              : true;
            const isSuccess = isStoryPointMode
              ? item.committed === item.completed
              : isHourMode
              ? item.committedHours === item.completedHours
              : false;

            const getIconPosition = (length, idx) => {
              const positions = {
                1: ['47%'],
                3: ['10%', '45%', '80%'],
                4: ['5%', '32%', '58%', '84%'],
                5: ['3%', '24%', '45%', '66%', '87%'],
              };
              return (
                positions[length]?.[idx] || `calc(${(idx + 0.2) * (100 / length)}% - 1px)`
              );
            };

            const leftPosition = getIconPosition(sprintdata.length, index);
            const needsTransform = sprintdata.length === 1;

            return (
              <div
                key={index}
                className="flex flex-col items-center absolute"
                style={{
                  left: leftPosition,
                  transform: needsTransform ? 'translateX(-50%)' : 'none',
                }}
              >
                {!isEmpty ? (
                  isSuccess ? (
                    <CheckCircle className="text-green-500 w-3 h-3" />
                  ) : (
                    <XCircle className="text-red-500 w-3 h-3" />
                  )
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="w-full flex-1 ml-0 min-h-0 relative">
          {heavyChartsReady ? (
            <Suspense fallback={chartSuspenseFallback}>
              <SprintGoalBarChart
                chartData={sprintGoalRechartsPayload.chartData}
                maxValue={sprintGoalRechartsPayload.maxValue}
                barCategoryGap={sprintGoalRechartsPayload.barCategoryGap}
                theme={theme}
                sprintdata={sprintdata}
                isSprintGoalStoryPoints={isSprintGoalStoryPoints}
              />
            </Suspense>
          ) : (
            chartSuspenseFallback
          )}
        </div>
        <div
          className={`flex justify-center items-center space-x-4 px-2 text-xs mt-2 ${
            theme === 'light' ? 'text-[#626262]' : 'text-[#A3B1C9]'
          }`}
        >
          <div className="flex items-center">
            <span
              className="w-3 h-3 rounded-full inline-block mr-2"
              style={{ backgroundColor: theme === 'light' ? '#0077E6' : '#066FD1' }}
            />
            Committed
          </div>
          <div className="flex items-center">
            <span
              className="w-3 h-3 rounded-full inline-block mr-2"
              style={{ backgroundColor: '#2FB344' }}
            />
            Completed
          </div>
        </div>
      </div>
    </div>
  );
}

StandUpSprintGoalSuccessSection.propTypes = {
  selectedDeveloper: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.object]),
  selectedValueDisplay: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  isSprintGoalStoryPoints: PropTypes.bool.isRequired,
  setIsSprintGoalStoryPoints: PropTypes.func.isRequired,
  lockToHours: PropTypes.bool.isRequired,
  lockToPoints: PropTypes.bool.isRequired,
  pointsSourceType: PropTypes.string,
  sprintdata: PropTypes.array.isRequired,
  isUsingStoryPoints: PropTypes.bool.isRequired,
  heavyChartsReady: PropTypes.bool.isRequired,
  chartSuspenseFallback: PropTypes.node.isRequired,
  sprintGoalRechartsPayload: PropTypes.shape({
    chartData: PropTypes.array,
    maxValue: PropTypes.number,
    barCategoryGap: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  SprintGoalBarChart: PropTypes.elementType.isRequired,
};

export default memo(StandUpSprintGoalSuccessSection);
