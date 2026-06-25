import PropTypes from 'prop-types';
import { useState } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import { InfoIcon } from '../../utils/commonIcons';
import DropdownButton from '../Common/DropDown';
import { renderTrendValue } from '../../utils/renderTrendValue';
import getTooltipContent from '../../utils/Tooltip';
import ReactDOMServer from 'react-dom/server';
import '../../assets/css/datacard.css';
import '../../assets/css/level2.scss';

const GitDataCard = ({
  title,
  trendValue,
  toolTip,
  index,
  isSelected = false,
  mainContentData,
  metrics = [],
  hasDropdown = false,
  dropdownOptions = [],
  dropdownLabel = '',
  onDropdownChange,
  warningMessage = null,
  isLargeCard = false,
  className = '',
}) => {
  const theme = useSelector((state) => state.theme.theme);
  const [selectedDropdownValue, setSelectedDropdownValue] = useState('sprint');

  const [selectedPRView, setSelectedPRView] = useState('per-sprint');

  const gitData = useSelector((state) => state.git || {});

  const getTooltipPlacement = (index) => {
    if (index % 3 === 0) return 'bottom-end';
    if (index % 3 === 1) return 'bottom-start';
    return 'bottom';
  };

  const handleDropdownChange = (option) => {
    setSelectedDropdownValue(option.value);
    if (onDropdownChange) {
      onDropdownChange(option);
    }
  };

  const getPRViewLabel = (value) => {
    const options = [
      { value: 'per-sprint', label: 'By Sprint' },
      { value: 'by-dev', label: 'By Developer' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getRealPRData = () => {
    if (title !== 'Pull Requests' && title !== 'Total Pull Requests') {
      return mainContentData?.secondaryMetrics || [];
    }

    if (mainContentData?.secondaryMetrics && mainContentData.secondaryMetrics.length > 0) {
      return mainContentData.secondaryMetrics;
    }

    let metrics = [];

    try {

      if (selectedPRView === 'per-sprint') {
        
        let totalOpenPRsSum = 0;
        let totalClosedPRsSum = 0;        
        if (gitData.openPRs?.openPullRequestsCount !== undefined) {
          totalOpenPRsSum = gitData.openPRs.openPullRequestsCount;
        } else if (gitData.openPRs?.data?.openPullRequestsCount !== undefined) {
          totalOpenPRsSum = gitData.openPRs.data.openPullRequestsCount;
        } else if (gitData.openPRs?.openPullRequests && Array.isArray(gitData.openPRs.openPullRequests)) {
          totalOpenPRsSum = gitData.openPRs.openPullRequests.reduce(
            (sum, sprint) => sum + parseInt(sprint.count || 0),
            0,
          );
        } else if (gitData.openPRs?.data?.openPullRequests && Array.isArray(gitData.openPRs.data.openPullRequests)) {
          totalOpenPRsSum = gitData.openPRs.data.openPullRequests.reduce(
            (sum, sprint) => sum + parseInt(sprint.count || 0),
            0,
          );
        }
        
        if (gitData.closedPRs?.closedPullRequestsCount !== undefined) {
          totalClosedPRsSum = gitData.closedPRs.closedPullRequestsCount;
        } else if (gitData.closedPRs?.data?.closedPullRequestsCount !== undefined) {
          totalClosedPRsSum = gitData.closedPRs.data.closedPullRequestsCount;
        } else if (gitData.closedPRs?.closedPullRequests && Array.isArray(gitData.closedPRs.closedPullRequests)) {
          totalClosedPRsSum = gitData.closedPRs.closedPullRequests.reduce(
            (sum, sprint) => sum + parseFloat(sprint.count || 0),
            0,
          );
        } else if (gitData.closedPRs?.data?.closedPullRequests && Array.isArray(gitData.closedPRs.data.closedPullRequests)) {
          totalClosedPRsSum = gitData.closedPRs.data.closedPullRequests.reduce(
            (sum, sprint) => sum + parseFloat(sprint.count || 0),
            0,
          );
        }

        let totalPRsSum = 0;
        if (gitData.totalPRs?.getTotalPullRequests !== undefined) {
          totalPRsSum = gitData.totalPRs.getTotalPullRequests;
        } else if (gitData.totalPRs?.totalPullRequests && Array.isArray(gitData.totalPRs.totalPullRequests)) {
          totalPRsSum = gitData.totalPRs.totalPullRequests.reduce(
            (sum, sprint) => sum + parseInt(sprint.count || 0),
            0,
          );
        }

        metrics = [
          {
            label: 'Total PRs',
            value: totalPRsSum,
          },
          {
            label: 'Total Open PRs',
            value: totalOpenPRsSum,
          },
          {
            label: 'Total Closed PRs',
            value: Math.round(totalClosedPRsSum),
          },
        ];
      } else if (selectedPRView === 'by-dev') {
        const totalPRsByDev = gitData.totalPRs?.getTotalPullRequestsByDev || [];
        
        let totalOpenPRs = 0;
        let totalClosedPRs = 0;
        
        if (gitData.openPRs?.totalOpenPullRequestsByDev && Array.isArray(gitData.openPRs.totalOpenPullRequestsByDev)) {
          totalOpenPRs = gitData.openPRs.totalOpenPullRequestsByDev.reduce((sum, dev) => sum + parseInt(dev.count || 0), 0);
        } else if (gitData.openPRs?.data?.totalOpenPullRequestsByDev && Array.isArray(gitData.openPRs.data.totalOpenPullRequestsByDev)) {
          totalOpenPRs = gitData.openPRs.data.totalOpenPullRequestsByDev.reduce((sum, dev) => sum + parseInt(dev.count || 0), 0);
        }
        
        if (gitData.closedPRs?.totalClosedPullRequestByDev && Array.isArray(gitData.closedPRs.totalClosedPullRequestByDev)) {
          totalClosedPRs = gitData.closedPRs.totalClosedPullRequestByDev.reduce((sum, dev) => sum + parseInt(dev.count || 0), 0);
        } else if (gitData.closedPRs?.data?.totalClosedPullRequestByDev && Array.isArray(gitData.closedPRs.data.totalClosedPullRequestByDev)) {
          totalClosedPRs = gitData.closedPRs.data.totalClosedPullRequestByDev.reduce((sum, dev) => sum + parseInt(dev.count || 0), 0);
        }

        const totalPRs = totalPRsByDev.reduce((sum, dev) => sum + parseInt(dev.count || 0), 0);

        metrics = [
          {
            label: 'Total PRs',
            value: totalPRs,
          },
          {
            label: 'Total Open PRs',
            value: totalOpenPRs,
          },
          {
            label: 'Total Closed PRs',
            value: totalClosedPRs,
          },
        ];
      }
    } catch (error) {
      console.error('Error processing PR data:', error);
      metrics = [
        { label: 'Total PRs', value: 0 },
        { label: 'Total Open PRs', value: 0 },
        { label: 'Total Closed PRs', value: 0 },
      ];
    }

    return metrics;
  };

  const getUnitForTitle = (title) => {
    switch (title) {
      case 'Pull Requests':
      case 'Total Pull Requests':
      case 'Total Open Pull Requests':
      case 'Total Closed Pull Requests':
      case 'Total Merged PRs Without Review':
        return null;

      case 'Pull Requests Approval Rate':
      case 'Merge Requests Approval Rate':
        return '%';

      case 'Average PRs Iteration Time':
      case 'Average MRs Iteration Time':
        return 'hrs';

      case 'Pull Requests Size':
      case 'Merge Requests Size':
        return null;

      case 'Total Cycle Time':
        return 'Days';

      case 'Static Code Analysis':
        return '/100';

      default:
        return null;
    }
  };

  const getClassName = () => {
    if (index % 3 === 0) return 'data-card open-bugs';
    if (index % 3 === 1) return 'data-card open-task';
    return 'data-card open-story';
  };

  const getCardHeight = () => {
    if (isLargeCard) {
      return 'min-h-[450px]';
    }
    if (title === 'Total Cycle Time' || title === 'Static Code Analysis') {
      return 'min-h-[320px]';
    }
    if (
      title === 'Total Merged PRs Without Review' ||
      title === 'Total Merged MRs Without Review'
    ) {
      return 'min-h-[300px]';
    }
    if (title === 'Pull Requests Size' || title === 'Merge Requests Size') {
      return 'min-h-[300px]';
    }
    if (metrics.length > 3) {
      return 'min-h-[320px]';
    }
    return 'min-h-[300px]';
  };

  const getCardWidth = () => {
    if (isLargeCard) {
      return 'col-span-2';
    }
    return 'col-span-1';
  };

  const getTrendBorderColor = () => {
    if (index % 3 === 0) return 'rgb(52, 211, 153)';
    if (index % 3 === 1) return 'rgb(255, 159, 67)';
    return 'rgb(239, 68, 68)';
  };

  return (
    <div
      className={`
        ${getCardWidth()}
        ${getClassName()}
        ${
          isSelected
            ? 'selected hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
            : 'hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
        } 
        flex flex-col transition-all duration-300 ease-in-out
        w-full
        ${getCardHeight()}
        ${className}
      `}
      style={{ borderBottom: `0.4vh solid ${getTrendBorderColor()}` }}
    >
      <div className="text-md flex justify-between items-center mb-3 gap-2 min-w-0">
        <div className="flex items-center min-w-0 flex-1">
          <h3 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'} truncate mr-2`}>
            {title}
          </h3>
          <div className="relative group w-5 h-5 flex-shrink-0">
            <span
              data-tooltip-id={`tooltip-${title}`}
              data-tooltip-html={toolTip}
              data-tooltip-place={getTooltipPlacement(index + 1)}
              className="cursor-pointer"
            >
              <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
            </span>
            <ReactTooltip
              id={`tooltip-${title}`}
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
        <div className="flex items-center flex-shrink-0 ml-2">
          {renderTrendValue(trendValue, getUnitForTitle(title))}
        </div>
      </div>

      <div>
        <hr className="mt-2 mb-3 border-[#D1E2F0] dark:border-[#25384F]" />
      </div>

      {(title === 'Pull Requests' || title === 'Total Pull Requests') && (
        <div className="mb-3 flex items-center justify-between">
            <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'}`}>Pull Requests</span>
          <DropdownButton
            options={[
              { value: 'per-sprint', label: 'By Sprint' },
              { value: 'by-dev', label: 'By Developer' },
            ]}
            onSelect={(option) => setSelectedPRView(option.value)}
            selectedOption={getPRViewLabel(selectedPRView)}
            placeholder="Select View"
            width="md"
            height="sm"
            customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9"
          />
        </div>
      )}

      {hasDropdown && !(title === 'Pull Requests' || title === 'Total Pull Requests') && (
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{dropdownLabel}</span>
            <DropdownButton
              options={dropdownOptions}
              onSelect={handleDropdownChange}
              placeholder="Select"
              selectedOption={selectedDropdownValue}
              width="md"
              customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9"
            />
          </div>
        </div>
      )}

      {warningMessage && (
        <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">{warningMessage}</p>
        </div>
      )}

      <div className="flex flex-col flex-grow justify-between">
        {(() => {
          const metricsToDisplay =
            title === 'Pull Requests' || title === 'Total Pull Requests'
              ? getRealPRData()
              : mainContentData?.secondaryMetrics || [];

          return (
            metricsToDisplay.length > 0 && (
              <div className="text-sm flex-grow space-y-2">
                {metricsToDisplay.map((item, idx) => {
                  const tooltipContent =
                    item.toolTip ||
                    ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], item.label));

                  return (
                    <div key={idx} className="flex justify-between items-center py-1 gap-2 min-w-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate`}>
                          {item.label}
                        </span>
                        <div className="relative group w-4 h-4 flex-shrink-0">
                          <span
                            data-tooltip-id={`tooltip-secondary-${title}-${idx}`}
                            data-tooltip-html={tooltipContent}
                            data-tooltip-place="top"
                            className="cursor-pointer"
                          >
                            <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                          </span>
                          <ReactTooltip
                            id={`tooltip-secondary-${title}-${idx}`}
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
                      </div>
                      <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-md ml-2 flex-shrink-0 whitespace-nowrap text-left min-w-[60px]`}>
                        {typeof item.value === 'number' ? parseFloat(item.value.toFixed(2)) : item.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          );
        })()}

        {metrics.length > 0 && (
          <div className="text-sm flex-grow space-y-3">
            {metrics.map((metric, idx) => {
              const tooltipContent =
                metric.toolTip ||
                ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], metric.label));

              return (
                <div key={idx} className="flex justify-between items-center gap-2 min-w-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate`}>
                      {metric.label}
                    </span>
                    <div className="relative group w-4 h-4 flex-shrink-0">
                      <span
                        data-tooltip-id={`tooltip-metric-${title}-${idx}`}
                        data-tooltip-html={tooltipContent}
                        data-tooltip-place="top"
                        className="cursor-pointer"
                      >
                        <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-metric-${title}-${idx}`}
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
                  </div>
                  <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-md ml-2 flex-shrink-0 whitespace-nowrap text-left min-w-[60px]`}>
                    {typeof metric.value === 'number' ? parseFloat(metric.value.toFixed(2)) : metric.value}
                    {Number(metric.value) !== 0 && getUnitForTitle(title) && (
                      <span className={`ml-1 text-sm font-bold ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'}`}>
                        {getUnitForTitle(title)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isLargeCard && (
          <div className="mt-4 space-y-4">
            {warningMessage && (
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-400 rounded-r">
                <p className="text-xs text-orange-800 dark:text-orange-200 font-medium">
                  {warningMessage}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
              <span className="text-sm text-gray-400">High-Risk PRs</span>
              <span className="text-sm font-semibold text-red-400">
                {mainContentData?.highRiskCount || 0}
              </span>
            </div>

            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
              <span className="text-sm text-gray-400">Affected Modules</span>
              <span className="text-sm font-semibold text-white">
                {mainContentData?.affectedModules || 'None'}
              </span>
            </div>

            {mainContentData?.recentPRs && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Recent Unreviewed</h4>
                <div className="space-y-1">
                  {mainContentData.recentPRs.slice(0, 2).map((pr, idx) => (
                    <div key={idx} className="text-xs text-gray-400 p-2 bg-gray-800/30 rounded">
                      <div className="font-medium text-white truncate">{pr.title}</div>
                      <div className="text-gray-500 text-xs">{pr.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

GitDataCard.propTypes = {
  title: PropTypes.string.isRequired,
  trendValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  toolTip: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  isSelected: PropTypes.bool,
  mainContentData: PropTypes.shape({
    secondaryMetrics: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        toolTip: PropTypes.string,
      }),
    ),
    highRiskCount: PropTypes.number,
    affectedModules: PropTypes.string,
    recentPRs: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string,
        details: PropTypes.string,
      }),
    ),
  }),
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      toolTip: PropTypes.string,
    }),
  ),
  hasDropdown: PropTypes.bool,
  dropdownOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
    }),
  ),
  dropdownLabel: PropTypes.string,
  onDropdownChange: PropTypes.func,
  warningMessage: PropTypes.string,
  isLargeCard: PropTypes.bool,
  className: PropTypes.string,
};

export default GitDataCard;
