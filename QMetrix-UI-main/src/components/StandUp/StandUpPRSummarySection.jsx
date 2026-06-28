import { memo, Suspense } from 'react';
import PropTypes from 'prop-types';
import TooltipIcon from '../../utils/TooltipIcon';

function StandUpPRSummarySection({
  theme,
  prLabel,
  prPluralShortLabel,
  prShortLabel,
  openPrData,
  prFilterType,
  setPrFilterType,
  heavyChartsReady,
  chartSuspenseFallback,
  AGrid,
  prRowData,
  filteredPRColumns,
  onPRGridReady,
}) {
  return (
    <div className="pt-5 flex flex-nowrap gap-[17px] justify-center lg:justify-between relative z-10">
      <div
        className="ml-5 p-[10px] bg-[#FFFFFF] dark:bg-[#182433] dark:text-[#C8C8C8] text-[#24527A] rounded-[10px] shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md border border-[#D1E2F0] dark:border-[#25384F] 
                h-[336px] min-w-[230px] flex-[0.75] flex flex-col relative z-10"
      >
        {/* Title */}
        <div
          className={`pt-1 pb-2 border-b-2 ${
            theme === 'light' ? 'border-[#D1E2F0]' : 'border-[#25384F]'
          }`}
        >
          <div className="flex items-center gap-1">
            <h2 className="text-lg text-[#0A2342] dark:text-white mb-0">{prLabel} Summary</h2>
            <div className="relative group">
              <TooltipIcon
                title="StandupPRSummary"
                tooltip={`Summarizes open, merged, and closed ${prPluralShortLabel} <br /> and average time to merge for the linked repository`}
                theme={theme}
                placement="top-start"
              />
            </div>
          </div>
        </div>

        {/* Total PRs - Centered */}
        <div className="flex items-center justify-center py-4 mt-1">
          <h2
            className={`text-lg cursor-pointer ${
              theme === 'light' ? 'text-[#24527A]' : 'text-white'
            }`}
            onClick={() => setPrFilterType('all')}
          >
            Total {prPluralShortLabel}{' '}
            <span
              className={`ml-1 underline font-semibold text-xl ${
                theme === 'light' ? 'text-[#48A7FF]' : 'text-[#48A7FF]'
              }`}
            >
              {openPrData?.totalPrs || 0}
            </span>
          </h2>
        </div>

        {/* Progress Bars - Three Separate Bars */}
        <div className="px-2 mb-4">
          {(() => {
            const openPRs = (openPrData?.openReviewedPRs || 0) + (openPrData?.openUnreviewedPRs || 0);
            const mergedPRs = openPrData?.totalMergedPRs || 0;
            const closedPRs = openPrData?.closedPrs || 0;
            const totalPrs = openPRs + mergedPRs + closedPRs;

            const getBarWidth = (value, total) => {
              if (total === 0) return 33.33;
              const percentage = (value / total) * 100;
              return Math.max(percentage, 8);
            };

            const openWidth = getBarWidth(openPRs, totalPrs);
            const mergedWidth = getBarWidth(mergedPRs, totalPrs);
            const closedWidth = getBarWidth(closedPRs, totalPrs);

            const totalWidth = openWidth + mergedWidth + closedWidth;
            const normalizedOpenWidth = (openWidth / totalWidth) * 100;
            const normalizedMergedWidth = (mergedWidth / totalWidth) * 100;
            const normalizedClosedWidth = (closedWidth / totalWidth) * 100;

            return (
              <div className="w-full flex gap-1">
                {/* Open PRs Bar */}
                <div
                  className="relative group cursor-pointer"
                  style={{ width: `${normalizedOpenWidth}%` }}
                >
                  <div className="w-full h-4 bg-[#8349CF] rounded-l-lg overflow-hidden">
                    <div
                      className="h-full bg-gray-200 dark:bg-gray-700 transition-all"
                      style={{ width: `${openPRs === 0 ? 100 : 0}%`, marginLeft: 'auto' }}
                    ></div>
                  </div>
                  <div
                    className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[12px] whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 ${theme === 'light' ? 'bg-[#0D1621] border-[#224F78]' : 'bg-[#173A5A] border-[#224F78]'} border`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#8349CF]"></div>
                      <span className="text-white">Open {prPluralShortLabel}: {openPRs}</span>
                    </div>
                  </div>
                </div>
                {/* Merged PRs Bar */}
                <div
                  className="relative group cursor-pointer"
                  style={{ width: `${normalizedMergedWidth}%` }}
                >
                  <div className="w-full h-4 bg-[#F59F12] overflow-hidden">
                    <div
                      className="h-full bg-gray-200 dark:bg-gray-700 transition-all"
                      style={{ width: `${mergedPRs === 0 ? 100 : 0}%`, marginLeft: 'auto' }}
                    ></div>
                  </div>
                  <div
                    className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[12px] whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 ${theme === 'light' ? 'bg-[#0D1621] border-[#224F78]' : 'bg-[#173A5A] border-[#224F78]'} border`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#F59F12]"></div>
                      <span className="text-white">Merged  {prPluralShortLabel}: {mergedPRs}</span>
                    </div>
                  </div>
                </div>
                {/* Closed W/O Merge Bar */}
                <div
                  className="relative group cursor-pointer"
                  style={{ width: `${normalizedClosedWidth}%` }}
                >
                  <div className="w-full h-4 bg-[#32A136] rounded-r-lg overflow-hidden">
                    <div
                      className="h-full bg-gray-200 dark:bg-gray-700 transition-all"
                      style={{ width: `${closedPRs === 0 ? 100 : 0}%`, marginLeft: 'auto' }}
                    ></div>
                  </div>
                  <div
                    className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[12px] whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 ${theme === 'light' ? 'bg-[#0D1621] border-[#224F78]' : 'bg-[#173A5A] border-[#224F78]'} border`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#32A136]"></div>
                      <span className="text-white">Closed W/O Merge: {closedPRs}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex-1 px-2 mt-2">
          <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-3 justify-between">
            {/* Open PRs */}
            <div className="flex-shrink-0">
              <div className="flex flex-col items-center -mt-1">
                <span
                  className={`cursor-pointer mb-1 -ml-5 underline font-semibold text-xl ${
                    prFilterType === 'totalOpenPRs' ? 'text-[#48A7FF]' : 'text-[#8349CF]'
                  }`}
                  onClick={() => setPrFilterType(prFilterType === 'totalOpenPRs' ? 'all' : 'totalOpenPRs')}
                >
                  {(openPrData?.openReviewedPRs || 0) + (openPrData?.openUnreviewedPRs || 0)}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span
                  className={`text-base cursor-pointer ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`}
                  onClick={() => setPrFilterType(prFilterType === 'totalOpenPRs' ? 'all' : 'totalOpenPRs')}
                >
                  Open {prPluralShortLabel}
                </span>
              </div>
              <div className="mt-2 space-y-1 pl-2">
                <p
                  className={`text-sm cursor-pointer flex justify-between items-center w-full gap-2 ${prFilterType === 'openReviewed' ? 'text-[#48A7FF]' : theme === 'light' ? 'text-[#24527A]' : 'text-[#A3B1C9]'}`}
                  onClick={() => setPrFilterType(prFilterType === 'openReviewed' ? 'all' : 'openReviewed')}
                >
                  <span>Reviewed</span>
                  <span
                    className={`underline text-base font-semibold ${prFilterType === 'openReviewed' ? 'text-[#48A7FF]' : 'text-[#8349CF]'}`}
                  >
                    {openPrData?.openReviewedPRs || 0}
                  </span>
                </p>
                <p
                  className={`text-sm cursor-pointer flex justify-between items-center w-full gap-2 ${prFilterType === 'openUnreviewed' ? 'text-[#48A7FF]' : theme === 'light' ? 'text-[#24527A]' : 'text-[#A3B1C9]'}`}
                  onClick={() => setPrFilterType(prFilterType === 'openUnreviewed' ? 'all' : 'openUnreviewed')}
                >
                  <span>Unreviewed</span>
                  <span
                    className={`underline text-base font-semibold ${prFilterType === 'openUnreviewed' ? 'text-[#48A7FF]' : 'text-[#8349CF]'}`}
                  >
                    {openPrData?.openUnreviewedPRs || 0}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 flex-1 flex justify-center">
              <div className="flex flex-col items-center -mt-1">
                <span
                  className={`cursor-pointer mb-1 underline font-semibold text-xl ${
                    prFilterType === 'merged' ? 'text-[#48A7FF]' : 'text-[#F59F12]'
                  }`}
                  onClick={() => setPrFilterType(prFilterType === 'merged' ? 'all' : 'merged')}
                >
                  {openPrData?.totalMergedPRs || 0}
                </span>
                <span
                  className={`text-base cursor-pointer text-center ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`}
                  onClick={() => setPrFilterType(prFilterType === 'merged' ? 'all' : 'merged')}
                >
                  Merged {prPluralShortLabel}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0">
              <div className="flex flex-col items-center -mt-1">
                <span
                  className={`cursor-pointer mb-1 underline font-semibold text-xl ${
                    prFilterType === 'closedPrs' ? 'text-[#48A7FF]' : 'text-[#32A136]'
                  }`}
                  onClick={() => setPrFilterType(prFilterType === 'closedPrs' ? 'all' : 'closedPrs')}
                >
                  {openPrData?.closedPrs || 0}
                </span>
                <span
                  className={`text-base cursor-pointer text-center ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`}
                  onClick={() => setPrFilterType(prFilterType === 'closedPrs' ? 'all' : 'closedPrs')}
                >
                  Closed W/O<br />Merge
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Average Time to Merge */}
        <div
          className={`mt-auto flex items-center justify-between py-2 border-t-2 ${
            theme === 'light' ? 'border-[#D1E2F0]' : 'border-[#25384F]'
          }`}
        >
          <p className={`text-base ${theme === 'light' ? 'text-[#24527A]' : 'text-[#A3B1C9]'}`}>
            Average Time To Merge
          </p>
          <span className={`text-base ${theme === 'light' ? 'text-[#0A2342]' : 'text-white'}`}>
            {openPrData?.averageTimeToMergeForReviewedPRs || '0 hrs 0m'}
          </span>
        </div>
      </div>

      {/* PRs Table */}
      <div
        className="p-[10px] bg-[#FFFFFF] dark:bg-[#182433] dark:text-[#C8C8C8] text-[#24527A] rounded-[10px] shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md border border-[#D1E2F0] dark:border-[#25384F] 
                h-[336px] min-w-[500px] flex-[1.8] mr-2"
      >
        <h3 className="text-lg text-[#0A2342] dark:text-white mb-2 text-left">{prShortLabel}s</h3>
        <div className="mt-1 -ml-2 -mr-2">
          {heavyChartsReady ? (
            <Suspense fallback={chartSuspenseFallback}>
              <AGrid
                rowData={prRowData}
                columnDefs={filteredPRColumns}
                height="280px"
                initialPageSize={5}
                theme={theme}
                onApiReady={onPRGridReady}
              />
            </Suspense>
          ) : (
            chartSuspenseFallback
          )}
        </div>
      </div>
    </div>
  );
}

StandUpPRSummarySection.propTypes = {
  theme: PropTypes.string.isRequired,
  prLabel: PropTypes.string.isRequired,
  prPluralShortLabel: PropTypes.string.isRequired,
  prShortLabel: PropTypes.string.isRequired,
  openPrData: PropTypes.object,
  prFilterType: PropTypes.string.isRequired,
  setPrFilterType: PropTypes.func.isRequired,
  heavyChartsReady: PropTypes.bool.isRequired,
  chartSuspenseFallback: PropTypes.node.isRequired,
  AGrid: PropTypes.elementType.isRequired,
  prRowData: PropTypes.array,
  filteredPRColumns: PropTypes.array,
  onPRGridReady: PropTypes.func.isRequired,
};

export default memo(StandUpPRSummarySection);
