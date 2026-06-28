import { memo, Suspense } from 'react';
import PropTypes from 'prop-types';
import DropdownButton from '../Common/DropDown';
import { APP_STRINGS } from '../../constants';
import ChurnMetricTooltipIcon from './ChurnMetricTooltipIcon';

function StandUpChurnSection({
  getChurnData,
  churnTableData,
  selectedValue,
  selectedOption,
  selectedSprint,
  selectedRelease,
  releaseLabel,
  sprintLabel,
  excludeBugsInChurn,
  handleExcludeBugsInChurnToggle,
  issueTypes,
  createShortName,
  setSelectedOption,
  storyChurnData,
  handleViewChurnDetails,
  heavyChartsReady,
  chartSuspenseFallback,
  chartLineData,
  theme,
  ChurnStoryLineChart,
}) {
  return (
    <div className="ml-5 p-[10px] bg-[#FFFFFF] basis-[415px] flex-grow dark:bg-[#182433] dark:text-[#C8C8C8] text-[#24527A] rounded-[10px] shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md border border-[#D1E2F0] dark:border-[#25384F] min-w-[415px] min-h-[260px] flex flex-col">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h4 className="text-md leading-tight text-[#0A2342] dark:text-white flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              Churn
              <ChurnMetricTooltipIcon theme={theme} placement="top-start" />
            </span>
            <span className="text-md font-semibold text-[#0A2342] dark:text-white">
              {(() => {
                const churnInfo = getChurnData(
                  churnTableData,
                  selectedValue,
                  selectedOption,
                  selectedSprint,
                  selectedRelease,
                );

                if (!churnInfo) {
                  return 'N/A';
                }

                const { churnRate, planned, added, removed } = churnInfo;
                if (Number(planned) === 0) {
                  return 'N/A';
                }
                if (Number(added) === 0 && Number(removed) === 0) {
                  return 'N/A';
                }

                if (
                  churnRate === null ||
                  churnRate === undefined ||
                  isNaN(churnRate)
                ) {
                  return 'N/A';
                }

                return churnRate > 0 ? `${churnRate}%` : '0%';
              })()}
            </span>
          </h4>
          <div className="text-sm text-blue-400 mt-1">
            {selectedOption === 'All'
              ? selectedValue?.value === APP_STRINGS.VALUE_RELEASE
                ? releaseLabel
                : sprintLabel
              : selectedOption}
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <label className="flex items-center gap-1 text-[12px] leading-none whitespace-nowrap select-none">
            <input
              type="checkbox"
              checked={!excludeBugsInChurn}
              onChange={handleExcludeBugsInChurnToggle}
              className="h-3 w-3 accent-[#066FD1]"
            />
            <span>Include Bugs</span>
          </label>
          <DropdownButton
            placeholder="Select Issue Type"
            options={issueTypes.map((type) => ({
              label: type, // Full name in dropdown options
              value: type,
            }))}
            selectedOption={createShortName(selectedOption)} // Short name in selected display
            onSelect={(option) => setSelectedOption(option.value ?? option)}
            width="xs"
            type="default"
            showSearch={false}
          />
          <button
            className={`px-2 py-1 text-sm rounded-full transition-all ${
              storyChurnData?.storyChurn === 'NA'
                ? 'bg-gray-400 text-white opacity-50 cursor-not-allowed blur-0'
                : 'dark:bg-[#066FD1] bg-[#24527A] text-white'
            }`}
            onClick={handleViewChurnDetails}
            disabled={storyChurnData?.storyChurn === 'NA'}
          >
            Details
          </button>
        </div>
      </div>
      <div className="mt-2 flex-1 min-h-0 flex flex-col">
        {storyChurnData?.storyChurn === 'NA' ? (
          <div className="text-center text-[#24527A] dark:text-gray-500 mt-14">
            No records to display
          </div>
        ) : heavyChartsReady ? (
          <Suspense fallback={chartSuspenseFallback}>
            <ChurnStoryLineChart
              chartLineData={chartLineData}
              theme={theme}
              issueTypes={issueTypes}
              selectedOption={selectedOption}
              releaseAxisTick={selectedValue?.value === 'Release'}
            />
          </Suspense>
        ) : (
          chartSuspenseFallback
        )}
      </div>
    </div>
  );
}

StandUpChurnSection.propTypes = {
  getChurnData: PropTypes.func.isRequired,
  churnTableData: PropTypes.array,
  selectedValue: PropTypes.object,
  selectedOption: PropTypes.string.isRequired,
  selectedSprint: PropTypes.object,
  selectedRelease: PropTypes.object,
  releaseLabel: PropTypes.string.isRequired,
  sprintLabel: PropTypes.string.isRequired,
  excludeBugsInChurn: PropTypes.bool.isRequired,
  handleExcludeBugsInChurnToggle: PropTypes.func.isRequired,
  issueTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  createShortName: PropTypes.func.isRequired,
  setSelectedOption: PropTypes.func.isRequired,
  storyChurnData: PropTypes.object,
  handleViewChurnDetails: PropTypes.func.isRequired,
  heavyChartsReady: PropTypes.bool.isRequired,
  chartSuspenseFallback: PropTypes.node.isRequired,
  chartLineData: PropTypes.array,
  theme: PropTypes.string.isRequired,
  ChurnStoryLineChart: PropTypes.elementType.isRequired,
};

export default memo(StandUpChurnSection);
