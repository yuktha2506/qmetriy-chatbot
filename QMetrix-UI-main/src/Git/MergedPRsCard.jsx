import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import { InfoIcon } from '../../utils/commonIcons';
import { renderTrendValue } from '../../utils/renderTrendValue';
import getTooltipContent from '../../utils/Tooltip';
import ReactDOMServer from 'react-dom/server';
import '../../assets/css/datacard.css';
import '../../assets/css/level2.scss';

const MergedPRsCard = ({
  title,
  trendValue,
  trendText,
  toolTip,
  index,
  isSelected = false,
  mainContentData,
  warningMessage = null,
  repoConnector = 'GitHub',
  className = '',
  prShortLabel = 'PR',
  prPluralShortLabel = 'PRs',
  prLabel = 'Pull Request',
}) => {
  const theme = useSelector((state) => state.theme.theme);

  const gitData = useSelector((state) => state.git || {});
  const mergedPRsData = gitData.mergedWithoutReviewPRs || [];

  const averageMergeTimeWithReview =
    mergedPRsData.length > 0
      ? mergedPRsData.find((item) => item.getAverageMergeTimeWithReview)
          ?.getAverageMergeTimeWithReview?.AverageTimeToMerge || '0 hrs'
      : '0 hrs';

  const getTooltipPlacement = (index) => {
    if (index % 3 === 0) return 'bottom-end';
    if (index % 3 === 1) return 'bottom-start';
    return 'bottom';
  };

  const getClassName = () => {
    if (index % 3 === 0) return 'data-card open-bugs';
    if (index % 3 === 1) return 'data-card open-task';
    return 'data-card open-story';
  };

  return (
    <div
      className={`
        col-span-2
        ${getClassName()}
        ${
          isSelected
            ? 'selected hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
            : 'hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
        } 
        flex flex-col transition-all duration-300 ease-in-out
        w-full
        min-h-[280px]
        ${className}
      `}
      style={{
        borderBottom: `0.4vh solid ${
          index % 3 === 0
            ? 'rgb(52, 211, 153)'
            : index % 3 === 1
            ? 'rgb(255, 159, 67)'
            : 'rgb(239, 68, 68)'
        }`,
      }}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'} leading-tight break-words flex-1`}>
            {title}
          </h3>
          <div className="relative group w-5 h-5">
            <span
              data-tooltip-id={`tooltip-${title}-grid`}
              data-tooltip-html={toolTip}
              data-tooltip-place={getTooltipPlacement(index + 1)}
              className="cursor-pointer"
            >
              <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
            </span>
            <ReactTooltip
              id={`tooltip-${title}-grid`}
              place={getTooltipPlacement(index + 1)}
              effect="solid"
              float={false}
              allowHTML={true}
              arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
              opacity={1}
              style={{
                backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                borderStyle: 'solid',
                borderWidth: '1px',
                borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                color: 'white',
                zIndex: 9999,
                padding: '8px',
                borderRadius: '5px',
                maxWidth: '500px',
                whiteSpace: 'normal',
                position: 'absolute',
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center flex-shrink-0">{renderTrendValue(trendValue)}</div>
        </div>
      </div>

      <div>
        <hr className="mt-2 mb-3 border-[#D1E2F0] dark:border-[#25384F]" />
      </div>

      {/* Metrics Section */}
      <div className="space-y-3 flex-1">
        {/* Total PRs Merged Without Review */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate flex-shrink-0`}>
              Total {prPluralShortLabel} Merged Without Review
            </span>
            <div className="relative group w-4 h-4">
              <span
                data-tooltip-id="tooltip-total-prs-merged-grid"
                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                  getTooltipContent(title, [], `Total ${prPluralShortLabel} Merged Without Review`)
                )}
                data-tooltip-place="top"
                className="cursor-pointer"
              >
                <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
              </span>
              <ReactTooltip
                id="tooltip-total-prs-merged-grid"
                place="top"
                effect="solid"
                float={false}
                allowHTML={true}
                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                opacity={1}
                style={{
                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                  color: 'white',
                  zIndex: 9999,
                  padding: '8px',
                  borderRadius: '5px',
                  maxWidth: '500px',
                  whiteSpace: 'normal',
                  position: 'absolute',
                }}
              />
            </div>
            <span className={`text-xs ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-500'} whitespace-nowrap`}>
              {trendText}
            </span>
          </div>
          <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-[#066FD1]'} text-sm flex-shrink-0 text-left min-w-[50px]`}>
            {mainContentData?.secondaryMetrics?.[0]?.value || 0}
          </span>
        </div>

        {/* Percentage Of PRs Merged Without Review */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate flex-shrink-0`}>
              Percentage Of {prPluralShortLabel} Merged Without Review
            </span>
            <div className="relative group w-4 h-4">
              <span
                data-tooltip-id="tooltip-percentage-prs-merged-grid"
                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                  getTooltipContent(title, [], `Percentage Of ${prPluralShortLabel} Merged Without Review`),
                )}
                data-tooltip-place="top"
                className="cursor-pointer"
              >
                <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
              </span>
              <ReactTooltip
                id="tooltip-percentage-prs-merged-grid"
                place="top"
                effect="solid"
                float={false}
                allowHTML={true}
                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                opacity={1}
                style={{
                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                  color: 'white',
                  zIndex: 9999,
                  padding: '8px',
                  borderRadius: '5px',
                  maxWidth: '500px',
                  whiteSpace: 'normal',
                  position: 'absolute',
                }}
              />
            </div>
            <span className={`text-xs ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-500'} whitespace-nowrap`}>
              Reviewed {prShortLabel}: {mainContentData?.mergedPRsWithReview || 0}
            </span>
          </div>
          <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-[#066FD1]'} text-sm flex-shrink-0 text-left min-w-[50px]`}>
            {mainContentData?.secondaryMetrics?.[1]?.value || '0%'}
          </span>
        </div>

        {/* Average Time To Merge Without Review */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate flex-shrink-0`}>
              Average Time To Merge Without Review
            </span>
            <div className="relative group w-4 h-4">
              <span
                data-tooltip-id="tooltip-avg-time-merge-grid"
                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                  getTooltipContent(title, [], `Average Time To Merge Without Review`),
                )}
                data-tooltip-place="top"
                className="cursor-pointer"
              >
                <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
              </span>
              <ReactTooltip
                id="tooltip-avg-time-merge-grid"
                place="top"
                effect="solid"
                float={false}
                allowHTML={true}
                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                opacity={1}
                style={{
                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                  color: 'white',
                  zIndex: 9999,
                  padding: '8px',
                  borderRadius: '5px',
                  maxWidth: '500px',
                  whiteSpace: 'normal',
                  position: 'absolute',
                }}
              />
            </div>
            <span className={`text-xs ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-500'} whitespace-nowrap`}>
              Reviewed {prPluralShortLabel}: {mainContentData?.averageTimeWithReview || averageMergeTimeWithReview}
            </span>
          </div>
          <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-[#066FD1]'} text-sm flex-shrink-0 text-left min-w-[50px]`}>
            {mainContentData?.secondaryMetrics?.[2]?.value || '0m'}
          </span>
        </div>

        {/* High-Risk Pull Requests */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate flex-shrink-0`}>
              High-Risk {prLabel}
            </span>
            <div className="relative group w-4 h-4">
              <span
                data-tooltip-id="tooltip-high-risk-prs-grid"
                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                  getTooltipContent(title, [], `High-Risk ${prLabel} `),
                )}
                data-tooltip-place="top"
                className="cursor-pointer"
              >
                <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
              </span>
              <ReactTooltip
                id="tooltip-high-risk-prs-grid"
                place="top"
                effect="solid"
                float={false}
                allowHTML={true}
                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                opacity={1}
                style={{
                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                  color: 'white',
                  zIndex: 9999,
                  padding: '8px',
                  borderRadius: '5px',
                  maxWidth: '500px',
                  whiteSpace: 'normal',
                  position: 'absolute',
                }}
              />
            </div>
            <span className={`text-xs ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-500'} whitespace-nowrap`}>
              Modules Affected: {mainContentData?.affectedModules}
            </span>
          </div>
          <span className="text-[#FF0000] dark:text-[#FF0000] text-sm flex-shrink-0">
            {mainContentData?.highRiskCount || 0}
          </span>
        </div>

        {/* Recent Unreviewed PRs */}
        <div className="mt-6">
          <h4 className={`${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-[#A3B1C9]'} text-sm font-medium mb-2`}>
            Recent Unreviewed {prPluralShortLabel}
          </h4>
          <div className="space-y-2">
            {mainContentData?.recentPRs?.slice(0, 2).map((pr, idx) => {
              const prUrl =
                pr.prNumber && pr.repo
                  ? repoConnector === 'GitHub'
                    ? `https://github.com/${pr.host || 'Trigent-Software-Pvt-Ltd'}/${
                        pr.repo
                      }/pull/${pr.prNumber}`
                    : `https://gitlab.com/${pr.host || 'Trigent-Software-Pvt-Ltd'}/${
                        pr.repo
                      }/-/merge_requests/${pr.prNumber}`
                  : null;

              return (
                <div key={idx} className="text-xs">
                  <div className="text-[#066FD1] truncate">
                    {prUrl ? (
                      <a
                        href={prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#066FD1] hover:text-blue-300 hover:underline transition-colors"
                      >
                        {prShortLabel} #{pr.prNumber}: {pr.title} (Merged: {pr.details} | Affected:{' '}
                        {pr.affectedModule || 'Auth'})
                      </a>
                    ) : (
                      <span className="text-[#066FD1]">
                        PR #{pr.prNumber}: {pr.title} (Merged: {pr.details} | Affected:{' '}
                        {pr.affectedModule || 'Auth'})
                      </span>
                    )}
                  </div>
                </div>
              );
            }) || (
              <div className="text-xs text-[#626262] dark:text-gray-500 p-2 dark:bg-gray-800/30 bg-gray-100 rounded">
                No recent unreviewed {prPluralShortLabel}
              </div>
            )}
            {/* Warning Message */}
            {warningMessage && (
              <div className="mb-4 p-2 bg-[#F6F8FC] dark:bg-[#293345] border border-dotted border-[#26395B] dark:border-[#26395B] rounded-md">
                <p className="text-sm text-[#626262] dark:text-[#FFFFFF]">{warningMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

MergedPRsCard.propTypes = {
  title: PropTypes.string.isRequired,
  trendValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  trendText: PropTypes.string,
  toolTip: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  isSelected: PropTypes.bool,
  mainContentData: PropTypes.shape({
    secondaryMetrics: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      }),
    ),
    mergedPRsWithReview: PropTypes.number,
    totalMergedPRs: PropTypes.number,
    averageTimeWithReview: PropTypes.string,
    highRiskFactors: PropTypes.shape({
      large_size: PropTypes.number,
      many_files: PropTypes.number,
      no_reviews: PropTypes.number,
      self_merged: PropTypes.number,
      missing_tests: PropTypes.number,
      sensitive_changes: PropTypes.number,
    }),
    highRiskCount: PropTypes.number,
    affectedModules: PropTypes.string,
    recentPRs: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string,
        details: PropTypes.string,
        prNumber: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        repo: PropTypes.string,
        host: PropTypes.string,
        affectedModule: PropTypes.string,
      }),
    ),
  }),
  warningMessage: PropTypes.string,
  repoConnector: PropTypes.string,
  className: PropTypes.string,
  prShortLabel: PropTypes.string,
  prPluralShortLabel: PropTypes.string,
  prLabel: PropTypes.string,
};

export default MergedPRsCard;
