import { memo, Suspense } from 'react';
import PropTypes from 'prop-types';
import { getPlatformName } from '../../constants';
import TooltipIcon from '../../utils/TooltipIcon';

function StandUpJiraGraphSection({
  isGitLab,
  isAzure,
  sortOrder,
  setSortOrder,
  heavyChartsReady,
  chartSuspenseFallback,
  sortedBarChartData,
  theme,
  statusColorMap,
  statusBarLeftMargin,
  JiraDeveloperStatusBarChart,
}) {
  return (
    <div className="p-[10px] bg-[#FFFFFF] basis-[280px] flex-grow mr-2 dark:bg-[#182433] dark:text-[#C8C8C8] text-[#24527A] rounded-[10px] shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md border border-[#D1E2F0] dark:border-[#25384F] min-w-[300px] min-h-[260px] max-h-[260px] flex flex-col overflow-hidden">
      <div className="relative mb-4 flex-shrink-0">
        <div className="flex items-center gap-1 self-start mb-4">
          <h3 className="text-lg text-[#0A2342] dark:text-white mb-0">
            {getPlatformName(isGitLab, isAzure)}
          </h3>
          <div className="relative group">
            <TooltipIcon
              title="StandupJiraStatus"
              tooltip="Jira work items grouped by workflow status for the </br> selected SPRINT / RELEASE"
              theme={theme}
              placement="top-start"
            />
          </div>
        </div>
        <div className="absolute top-0 right-0">
          <div className="inline-flex items-center bg-transparent dark:bg-[#242B34] rounded-full p-0.5 border border-[#E5E5E5] dark:border-[#101010]">
            <button
              onClick={() => setSortOrder('default')}
              className={`px-4 py-1 text-xs font-medium rounded-full transition-colors ${
                sortOrder === 'default'
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-300'
              }`}
            >
              Default
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`px-4 py-1 text-xs font-medium rounded-full transition-colors ${
                sortOrder === 'asc'
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-300'
              }`}
            >
              ASC
            </button>
            <button
              onClick={() => setSortOrder('desc')}
              className={`px-4 py-1 text-xs font-medium rounded-full transition-colors ${
                sortOrder === 'desc'
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-300'
              }`}
            >
              DSC
            </button>
          </div>
        </div>
      </div>
      {(sortOrder === 'default' || sortOrder === 'desc' || sortOrder === 'asc') &&
        (heavyChartsReady ? (
          <Suspense fallback={chartSuspenseFallback}>
            <JiraDeveloperStatusBarChart
              sortedBarChartData={sortedBarChartData}
              theme={theme}
              statusColorMap={statusColorMap}
              sortOrder={sortOrder}
              barLeftMargin={statusBarLeftMargin}
            />
          </Suspense>
        ) : (
          chartSuspenseFallback
        ))}
    </div>
  );
}

StandUpJiraGraphSection.propTypes = {
  isGitLab: PropTypes.bool.isRequired,
  isAzure: PropTypes.bool.isRequired,
  sortOrder: PropTypes.string.isRequired,
  setSortOrder: PropTypes.func.isRequired,
  heavyChartsReady: PropTypes.bool.isRequired,
  chartSuspenseFallback: PropTypes.node.isRequired,
  sortedBarChartData: PropTypes.array,
  theme: PropTypes.string.isRequired,
  statusColorMap: PropTypes.object,
  statusBarLeftMargin: PropTypes.number,
  JiraDeveloperStatusBarChart: PropTypes.elementType.isRequired,
};

export default memo(StandUpJiraGraphSection);
