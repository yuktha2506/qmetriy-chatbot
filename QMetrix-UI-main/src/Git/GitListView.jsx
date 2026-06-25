import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import { InfoIcon, LineChartIcon, BarChartIcon, DonutChartIcon } from '../../utils/commonIcons';
import { renderTrendValue } from '../../utils/renderTrendValue';
import CustomLineBarChart from '../../utils/CustomLineBarChart';
import DonutChart from '../Common/DonutChart';
import getTooltipContent from '../../utils/Tooltip';
import ReactDOMServer from 'react-dom/server';
import DropdownButton from '../Common/DropDown';
import '../../assets/css/datacard.css';
import '../../assets/css/level2.scss';

const GitListView = ({
  title,
  trendValue,
  toolTip,
  index,
  isSelected = false,
  mainContentData,
  metrics = [],
  warningMessage = null,
  chartData = null,
  chartType = 'line', // 'line', 'bar', or 'donut'
  className = '',
  prLabel,prShortLabel
}) => {
  const theme = useSelector((state) => state.theme.theme);
  const [currentChartType, setCurrentChartType] = useState(chartType);

  // State for dropdown selections
  const [selectedPRType, setSelectedPRType] = useState('total-pull-requests');
  const [selectedViewType, setSelectedViewType] = useState(
    title === 'Total Cycle Time' ? 'sprint-trend' : 'per-sprint',
  );
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState('15');

  // Helper functions to get labels for selected values
  const getPRTypeLabel = (value) => {
    const options = [
      { value: 'total-pull-requests', label: 'Total Pull Requests' },
      { value: 'total-open', label: 'Total Open Pull Requests' },
      { value: 'total-closed', label: 'Total Closed Pull Requests' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getViewTypeLabel = (value) => {
    const options = [
      { value: 'per-sprint', label: 'Total PR Per Sprint' },
      { value: 'by-dev', label: 'Total PR By Dev' },
      { value: 'total-average', label: 'Total Average PR Iteration Time' },
      { value: 'sprint-trend', label: 'Cycle Time Sprint Trend' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getApprovalRateLabel = (value) => {
    const options = [
      { value: 'per-sprint', label: 'Average PR Approval Rate Per Sprint' },
      { value: 'by-dev', label: 'Average PR Approval Rate By Dev' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getIterationTimeLabel = (value) => {
    const options = [
      { value: 'total-average', label: 'Total Average PR Iteration Time' },
      { value: 'per-sprint', label: 'Avg PR Iteration Time Per Sprint' },
      { value: 'by-dev', label: 'Avg PR Iteration Time By Dev' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getPRSizeLabel = (value) => {
    const options = [
      { value: 'per-sprint', label: 'Average PR Size Per Sprint' },
      { value: 'by-dev', label: 'Average PR Size By Developer' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getCycleTimeLabel = (value) => {
    const options = [
      { value: 'sprint-trend', label: 'Cycle Time Sprint Trend' },
      { value: 'by-dev', label: 'Cycle Time by Dev' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  const getTrendPeriodLabel = (value) => {
    const options = [
      { value: '15', label: '15 Days Trend' },
      { value: '30', label: '30 Days Trend' },
      { value: '90', label: '90 Days Trend' },
    ];
    return options.find((opt) => opt.value === value)?.label || value;
  };

  // Get real data from Redux store
  const gitData = useSelector((state) => state.git || {});
  const { sonarQubeGitData } = useSelector((state) => state.sonarQubeGit || {});

  // Update selectedViewType when title changes
  useEffect(() => {
    if (title === 'Total Cycle Time') {
      setSelectedViewType('sprint-trend');
    } else {
      setSelectedViewType('per-sprint');
    }
  }, [title]);

  const getTooltipPlacement = (index) => {
    if (index % 3 === 0) return 'bottom-end';
    if (index % 3 === 1) return 'bottom-start';
    return 'bottom';
  };

  // Get real chart data from Redux store
  const getRealChartData = () => {
    switch (title) {
      case 'Pull Requests':
      case 'Total Pull Requests': {
        let dataSource, labels, dataPoints, label;

        if (selectedPRType === 'total-pull-requests') {
          dataSource = gitData.totalPRs?.totalPullRequests || [];
          labels = dataSource.map((item) => item.name) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = dataSource.map((item) => parseFloat(item.count)) || [0, 0, 0, 0, 0, 18];
          label = 'Total Pull Requests';
        } else if (selectedPRType === 'total-open') {
          if (gitData.openPRs?.openPullRequests) {
            dataSource = gitData.openPRs.openPullRequests;
          } else if (gitData.openPRs?.data?.openPullRequests) {
            dataSource = gitData.openPRs.data.openPullRequests;
          } else {
            dataSource = [];
          }
          
          labels = dataSource.map((item) => item.name) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = dataSource.map((item) => item.count) || [0, 0, 0, 0, 0, 0];
          label = 'Total Open Pull Requests';
        } else if (selectedPRType === 'total-closed') {
          if (gitData.closedPRs?.closedPullRequests) {
            dataSource = gitData.closedPRs.closedPullRequests;
          } else if (gitData.closedPRs?.data?.closedPullRequests) {
            dataSource = gitData.closedPRs.data.closedPullRequests;
          } else {
            dataSource = [];
          }
          
          labels = dataSource.map((item) => item.name) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = dataSource.map((item) => parseFloat(item.count)) || [0, 0, 22, 2, 7, 18];
          label = 'Total Closed Pull Requests';
        }

        if (selectedViewType === 'by-dev') {
          if (selectedPRType === 'total-pull-requests') {
            dataSource = gitData.totalPRs?.getTotalPullRequestsByDev || [];
            labels = dataSource.map((item) => item.name) || [
              'Ajith5431',
              'Dhanush-gr',
              'ankurTrigent',
              'RadhaCSwamy',
              'Sushma-Sathyan',
            ];
            dataPoints = dataSource.map((item) => parseFloat(item.count)) || [3, 1, 4, 2, 8];
            label = 'Total PRs By Developer';
          } else if (selectedPRType === 'total-open') {
            if (gitData.openPRs?.totalOpenPullRequestsByDev) {
              dataSource = gitData.openPRs.totalOpenPullRequestsByDev;
            } else if (gitData.openPRs?.data?.totalOpenPullRequestsByDev) {
              dataSource = gitData.openPRs.data.totalOpenPullRequestsByDev;
            } else {
              dataSource = [];
            }
            labels = dataSource.map((item) => item.name) || [];
            dataPoints = dataSource.map((item) => item.count) || [];
            label = 'Open PRs By Developer';
          } else if (selectedPRType === 'total-closed') {
            if (gitData.closedPRs?.totalClosedPullRequestByDev) {
              dataSource = gitData.closedPRs.totalClosedPullRequestByDev;
            } else if (gitData.closedPRs?.data?.totalClosedPullRequestByDev) {
              dataSource = gitData.closedPRs.data.totalClosedPullRequestByDev;
            } else {
              dataSource = [];
            }
            labels = dataSource.map((item) => item.name) || [
              'Ajith5431',
              'Dhanush-gr',
              'ankurTrigent',
              'RadhaCSwamy',
              'Sushma-Sathyan',
            ];
            dataPoints = dataSource.map((item) => item.count) || [3, 1, 4, 2, 8];
            label = 'Closed PRs By Developer';
          }
        }

        const blueShades = ['#066FD1', '#0B5AA0', '#0F4A7F', '#1A3A5E', '#2A4A6E', '#3A5A7E'];
        const chartData = labels.map((label, index) => ({
          name: label,
          value: dataPoints[index] || 0,
          color: blueShades[index % blueShades.length],
        }));

        const totalPRsData = {
          labels,
          dataPoints,
          label,
          borderColor: '#84A9FF',
          chartData,
        };

        return totalPRsData;
      }

      case 'Total Open Pull Requests': {
        const openSprintData = gitData.openPRs?.data?.openPullRequests || [];
        const labels = openSprintData.map((item) => item.name) || [
          'QM Sprint 31',
          'QM Sprint 32',
          'QM Sprint 33',
          'QM Sprint 34',
          'QM Sprint 35',
          'QM Sprint 36',
        ];
        const dataPoints = openSprintData.map((item) => item.count) || [0, 0, 0, 0, 0, 0];

        const blueShades = ['#066FD1', '#0B5AA0', '#0F4A7F', '#1A3A5E', '#2A4A6E', '#3A5A7E'];
        const chartData = labels.map((label, index) => ({
          name: label,
          value: dataPoints[index] || 0,
          color: blueShades[index % blueShades.length],
        }));

        const openPRsData = {
          labels,
          dataPoints,
          label: 'Total Open Pull Requests',
          borderColor: '#84A9FF',
          chartData,
        };
        return openPRsData;
      }

      case 'Total Closed Pull Requests': {
        const closedSprintData = gitData.closedPRs?.data?.closedPullRequests || [];
        const labels = closedSprintData.map((item) => item.name) || [
          'QM Sprint 31',
          'QM Sprint 32',
          'QM Sprint 33',
          'QM Sprint 34',
          'QM Sprint 35',
          'QM Sprint 36',
        ];
        const dataPoints = closedSprintData.map((item) => parseFloat(item.count)) || [
          0, 0, 22, 2, 7, 18,
        ];

        const closedPRsData = {
          labels,
          dataPoints,
          label: 'Total Closed Pull Requests',
          borderColor: '#84A9FF',
        };
        return closedPRsData;
      }

      case 'Pull Requests Approval Rate': {
        let dataSource, labels, dataPoints, label;

        if (selectedViewType === 'per-sprint') {
          dataSource = gitData.gitApprovalRateData?.approvalRatePerSprint || [];
          labels = dataSource.map((item) => item.sprint) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = dataSource.map((item) => item.approvalRate) || [0, 0, 0, 0, 50, 78];
          label = 'Average PR Approval Rate Per Sprint';
        } else if (selectedViewType === 'by-dev') {
          dataSource = gitData.gitApprovalRateData?.approvalRateByDev || [];
          labels = dataSource.map((item) => item.name) || [
            'Ajith5431',
            'Dhanush-gr',
            'ankurTrigent',
            'RadhaCSwamy',
            'Sushma-Sathyan',
          ];
          dataPoints = dataSource.map((item) => item.approvalRate) || [67, 100, 100, 100, 63];
          label = 'Average PR Approval Rate By Dev';
        }

        const approvalRateData = {
          labels,
          dataPoints,
          label,
          borderColor: '#84A9FF',
        };
        return approvalRateData;
      }

      case 'Average PRs Iteration Time': {
        let dataSource, labels, dataPoints, label;
        if (selectedViewType === 'total-average') {
          const overallAverage = gitData.gitIterationTimeData?.AveragePRsIterationTime || '5.5';
          labels = ['Overall Average'];
          dataPoints = [parseFloat(overallAverage)];
          label = 'Total Average PR Iteration Time';
        } else if (selectedViewType === 'per-sprint') {
          dataSource = gitData.gitIterationTimeData?.averagePRIterationTimePerSprint || [];
          labels = dataSource.map((item) => item.sprint) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = dataSource.map((item) => parseFloat(item.iterationTime)) || [
            0, 0, 0, 0, 6.7, 5.5,
          ];
          label = 'Avg PR Iteration Time Per Sprint';
        } else if (selectedViewType === 'by-dev') {
          dataSource = gitData.gitIterationTimeData?.averagePRIterationTimeByDev || [];
          labels = dataSource.map((item) => item.name) || [
            'Ajith5431',
            'Dhanush-gr',
            'ankurTrigent',
            'RadhaCSwamy',
            'Sushma-Sathyan',
          ];
          dataPoints = dataSource.map((item) => parseFloat(item.iterationTime)) || [
            0.9, 0, 0.1, 0, 9.6,
          ];
          label = 'Avg PR Iteration Time By Dev';
        }

        const iterationTimeData = {
          labels,
          dataPoints,
          label,
          borderColor: '#84A9FF',
        };

        return iterationTimeData;
      }

      case 'Pull Requests Size': {
        let dataSource, labels, dataPoints, label;
        if (selectedViewType === 'per-sprint') {
          dataSource = gitData.prSizeData?.averagePRSizePerSprint || {};
          labels = Object.keys(dataSource) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = Object.values(dataSource) || [0, 0, 119, 43, 435, 700];
          label = 'Average PR Size Per Sprint';
        } else if (selectedViewType === 'by-dev') {
          dataSource = gitData.prSizeData?.averagePRSizeByDeveloper || [];
          labels = dataSource.map((item) => item.dev) || [
            'Ajith5431',
            'Dhanush-gr',
            'ankurTrigent',
            'RadhaCSwamy',
            'Sushma-Sathyan',
          ];
          dataPoints = dataSource.map((item) => item.averagePRSize) || [379, 103, 1748, 1704, 119];
          label = 'Average PR Size By Developer';
        }

        const prSizeData = {
          labels,
          dataPoints,
          label,
          borderColor: '#84A9FF',
        };
        return prSizeData;
      }

      case 'Total Cycle Time': {
        let dataSource, labels, dataPoints, label, groupedData;
        if (selectedViewType === 'sprint-trend') {
          dataSource = gitData.gitCycleTimeData?.cycleTimePerSprintOrRelease || [];
          labels = dataSource.map((item) => item.name) || [
            'QM Sprint 31',
            'QM Sprint 32',
            'QM Sprint 33',
            'QM Sprint 34',
            'QM Sprint 35',
            'QM Sprint 36',
          ];
          dataPoints = dataSource.map((item) => item.cycleTime) || [0, 0, 0, 0, 2, 1];
          label = 'Cycle Time Sprint Trend';
          groupedData = dataSource.map((sprint) => ({
            day: sprint.name,
            'Cycle Time': sprint.cycleTime || 0,
            'PRs Merged': sprint.prsMerged || 0,
            'PRs in Progress': sprint.prsOpen || 0,
          }));
        } else if (selectedViewType === 'by-dev') {
          dataSource = gitData.gitCycleTimeData?.cycleTimeByDev || [];
          labels = dataSource.map((item) => item.name) || [
            'Ajith5431',
            'Dhanush-gr',
            'ankurTrigent',
            'RadhaCSwamy',
            'Sushma-Sathyan',
          ];
          dataPoints = dataSource.map((item) => item.cycleTime) || [0.9, 2.0, 1.0, 0, 1.0];
          label = 'Cycle Time by Dev';
          groupedData = labels.map((dev, index) => ({
            day: dev,
            value: dataPoints[index] || 0,
          }));
        }

        const cycleTimeData = {
          labels,
          dataPoints,
          label,
          borderColor: '#84A9FF',
          groupedData,
        };
        return cycleTimeData;
      }

      case 'Static Code Analysis': {
        const labels = sonarQubeGitData?.labels || [
          'QMSprint 22',
          'QMSprint 23',
          'QMSprint 24',
          'QMSprint 25',
          'QMSprint 26',
          'QMSprint 27',
        ];
        const dataPoints = sonarQubeGitData?.dataPoints || [15, 20, 18, 12, 25, 22];

        const blueShades = ['#066FD1', '#0B5AA0', '#0F4A7F', '#1A3A5E', '#2A4A6E', '#3A5A7E'];
        const chartData = labels.map((label, index) => ({
          name: label,
          value: dataPoints[index] || 0,
          color: blueShades[index % blueShades.length],
        }));

        const staticCodeData = {
          labels,
          dataPoints,
          label: 'Static Code Analysis',
          borderColor: '#84A9FF',
          backgroundColor: blueShades,
          chartData,
        };
        return staticCodeData;
      }

      default:
        return chartData;
    }
  };

  const handleChartTypeChange = (type) => {
    setCurrentChartType(type);
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

  if (title === 'Static Code Analysis') {
    return (
      <div className="flex gap-6 w-full">
        <div
          className={`
            ${getClassName()}
            ${
              isSelected
                ? 'selected hover:cursor-pointer bg-[#FFFFFF] dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
                : 'hover:cursor-pointer bg-[#FFFFFF] dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
            } 
            flex flex-col transition-all duration-300 ease-in-out
            min-h-[200px] w-[700px]
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
          <div className="text-md flex justify-between items-center mb-3 gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
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
  
          <hr className="mt-2 mb-3 border-[#D1E2F0] dark:border-[#25384F]" />
      
          <div className="flex-grow">
            {mainContentData?.secondaryMetrics?.length > 0 && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {mainContentData.secondaryMetrics.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 gap-2 min-w-0">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate`}>
                        {item.label}
                      </span>
                      <div className="relative group w-4 h-4 flex-shrink-0">
                        <span
                          data-tooltip-id={`tooltip-${item.label}`}
                          data-tooltip-html={item.toolTip || ''}
                          data-tooltip-place="top"
                          className="cursor-pointer"
                        >
                          <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-${item.label}`}
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
                    <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm ml-4 flex-shrink-0 whitespace-nowrap text-left min-w-[60px]`}
                    >
                      {typeof item.value === 'number' ? parseFloat(item.value.toFixed(2)) : item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
  
            {metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {metrics.map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 gap-2 min-w-0">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate`}>
                        {metric.label}
                      </span>
                      <div className="relative group w-4 h-4 flex-shrink-0">
                        <span
                          data-tooltip-id={`tooltip-${metric.label}`}
                          data-tooltip-html={metric.toolTip || ''}
                          data-tooltip-place="top"
                          className="cursor-pointer"
                        >
                          <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-${metric.label}`}
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
                    <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm ml-4 flex-shrink-0 whitespace-nowrap text-left min-w-[60px]`}>
                      {typeof metric.value === 'number' ? parseFloat(metric.value.toFixed(2)) : metric.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 w-full">
      <div
        className={`
          ${getClassName()}
          ${
            isSelected
              ? 'selected hover:cursor-pointer bg-[#FFFFFF] dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
              : 'hover:cursor-pointer bg-[#FFFFFF] dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md'
          } 
          flex flex-col transition-all duration-300 ease-in-out
          min-h-[200px] w-1/3
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

        <hr className="mt-2 mb-3 border-[#D1E2F0] dark:border-[#25384F]" />

        {warningMessage && (
          <div className="mb-4 p-3 bg-orange-100 dark:bg-[#293345] border border-orange-300 dark:border-orange-700 rounded-md">
            <p className="text-sm text-orange-800 dark:text-orange-200">{warningMessage}</p>
          </div>
        )}

        <div className="space-y-2 flex-grow">
          {mainContentData?.secondaryMetrics?.length > 0 && (
            <div className="text-sm space-y-2">
              {mainContentData.secondaryMetrics.map((item, idx) => {
                const tooltipContent =
                  item.toolTip ||
                  ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], item.label));

                return (
                  <div key={idx} className="flex justify-between items-center py-[2px] gap-2 min-w-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate`}>
                        {item.label}
                      </span>
                      <div className="relative group w-4 h-4 flex-shrink-0">
                        <span
                          data-tooltip-id={`tooltip-metric-${idx}-${item.label.replace(
                            /\s+/g,
                            '-',
                          )}`}
                          data-tooltip-html={tooltipContent}
                          data-tooltip-place="top"
                          className="cursor-pointer"
                        >
                          <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-metric-${idx}-${item.label.replace(/\s+/g, '-')}`}
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
          )}

          {metrics.length > 0 && (
            <div className="text-sm space-y-2 mt-5">
              {metrics.map((metric, idx) => {
                const tooltipContent =
                  metric.toolTip ||
                  ReactDOMServer.renderToStaticMarkup(getTooltipContent(title, [], metric.label));

                return (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm truncate`}>
                        {metric.label}
                      </span>
                      <div className="relative group w-4 h-4 flex-shrink-0">
                        <span
                          data-tooltip-id={`tooltip-metric-add-${idx}-${metric.label.replace(
                            /\s+/g,
                            '-',
                          )}`}
                          data-tooltip-html={tooltipContent}
                          data-tooltip-place="top"
                          className="cursor-pointer"
                        >
                          <InfoIcon style={{ color: theme === 'light' ? '#24527A' : '#A3B1C9' }} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-metric-add-${idx}-${metric.label.replace(/\s+/g, '-')}`}
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
                    <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-md ml-2 flex-shrink-0 text-left min-w-[60px]`}>
                      {metric.value}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className={`
          hover:cursor-pointer bg-[#FFFFFF] dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md
          flex flex-col transition-all duration-300 ease-in-out
          min-h-[262px] flex-1
        `}
      >
        <div className="flex justify-between items-center mb-2">
          <h2
            className={`text-lg whitespace-nowrap ${
              ['Pull Requests','Pull Requests Approval Rate','Average PRs Iteration Time','Pull Requests Size','Total Cycle Time'].includes(title)
                ? (theme === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-gray-200 font-semibold')
                : (theme === 'light' ? 'text-[#202020] font-medium' : 'dark:text-gray-200 font-medium')
            }`}
          >
            {title}
          </h2>

          <div className="flex items-center gap-3">
            {title === 'Pull Requests' && (
              <div className="flex items-center gap-3">
                <DropdownButton
                  options={[
                    { value: 'total-pull-requests', label: 'Total Pull Requests' },
                    { value: 'total-open', label: 'Total Open Pull Requests' },
                    { value: 'total-closed', label: 'Total Closed Pull Requests' },
                  ]}
                  onSelect={(option) => setSelectedPRType(option.value)}
                  selectedOption={getPRTypeLabel(selectedPRType)}
                  placeholder="Select PR Type"
                  width="md"
                  height="sm"
                  customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
                />
                <DropdownButton
                  options={[
                    { value: 'per-sprint', label: 'Total PR Per Sprint' },
                    { value: 'by-dev', label: 'Total PR By Dev' },
                  ]}
                  onSelect={(option) => setSelectedViewType(option.value)}
                  selectedOption={getViewTypeLabel(selectedViewType)}
                  placeholder="Select View"
                  width="md"
                  height="sm"
                  customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
                />
              </div>
            )}

            {title === 'Pull Requests Approval Rate' && (
              <DropdownButton
                options={[
                  { value: 'per-sprint', label: 'Average PR Approval Rate Per Sprint' },
                  { value: 'by-dev', label: 'Average PR Approval Rate By Dev' },
                ]}
                onSelect={(option) => setSelectedViewType(option.value)}
                selectedOption={getApprovalRateLabel(selectedViewType)}
                placeholder="Select View"
                width="lg"
                height="sm"
                customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
              />
            )}

            {title === 'Average PRs Iteration Time' && (
              <DropdownButton
                options={[
                  { value: 'total-average', label: 'Total Average PR Iteration Time' },
                  { value: 'per-sprint', label: 'Avg PR Iteration Time Per Sprint' },
                  { value: 'by-dev', label: 'Avg PR Iteration Time By Dev' },
                ]}
                onSelect={(option) => setSelectedViewType(option.value)}
                selectedOption={getIterationTimeLabel(selectedViewType)}
                placeholder="Select View"
                width="lg"
                height="sm"
                customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
              />
            )}

            {title === 'Pull Requests Size' && (
              <DropdownButton
                options={[
                  { value: 'per-sprint', label: 'Average PR Size Per Sprint' },
                  { value: 'by-dev', label: 'Average PR Size By Developer' },
                ]}
                onSelect={(option) => setSelectedViewType(option.value)}
                selectedOption={getPRSizeLabel(selectedViewType)}
                placeholder="Select View"
                width="lg"
                height="sm"
                customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
              />
            )}

            {title === 'Total Cycle Time' && (
              <DropdownButton
                options={[
                  { value: 'sprint-trend', label: 'Cycle Time Sprint Trend' },
                  { value: 'by-dev', label: 'Cycle Time by Dev' },
                ]}
                onSelect={(option) => setSelectedViewType(option.value)}
                selectedOption={getCycleTimeLabel(selectedViewType)}
                placeholder="Select View"
                width="lg"
                height="sm"
                customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
              />
            )}

            {![
              'Pull Requests',
              'Pull Requests Approval Rate',
              'Average PRs Iteration Time',
              'Pull Requests Size',
              'Total Cycle Time',
            ].includes(title) && (
              <DropdownButton
                options={[
                  { value: '15', label: '15 Days Trend' },
                  { value: '30', label: '30 Days Trend' },
                  { value: '90', label: '90 Days Trend' },
                ]}
                onSelect={(option) => setSelectedTrendPeriod(option.value)}
                selectedOption={getTrendPeriodLabel(selectedTrendPeriod)}
                placeholder="Select Trend Period"
                width="md"
                height="sm"
                customClassName="inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] h-9 truncate"
              />
            )}

            <div className="flex items-center space-x-2">
              <div className="relative group">
              <LineChartIcon
                className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                  currentChartType === 'line'
                    ? (theme === 'light'
                        ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                        : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                    : (theme === 'light'
                        ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                        : 'text-[#A3B1C9] border-[1.4px] border-[#A3B1C9] hover:bg-[#82B6E7] hover:text-white hover:border-[#82B6E7] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]')
                }`}
                onClick={() => handleChartTypeChange('line')}
              />
              <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                Line Chart
              </div>
              </div>

              <div className="relative group">
              <BarChartIcon
                className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                  currentChartType === 'bar'
                    ? (theme === 'light'
                        ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                        : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                    : (theme === 'light'
                        ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                        : 'text-[#A3B1C9] border-[1.4px] border-[#A3B1C9] hover:bg-[#82B6E7] hover:text-white hover:border-[#82B6E7] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]')
                }`}
                onClick={() => handleChartTypeChange('bar')}
              />
              <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                Bar Chart
              </div>
              </div>

              <div className="relative group">
              <DonutChartIcon
                className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                  currentChartType === 'donut'
                    ? (theme === 'light'
                        ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                        : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                    : (theme === 'light'
                        ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                        : 'text-[#A3B1C9] border-[1.4px] border-[#A3B1C9] hover:bg-[#82B6E7] hover:text-white hover:border-[#82B6E7] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]')
                }`}
                onClick={() => handleChartTypeChange('donut')}
              />
              <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                Donut Chart
              </div>
              </div>
            </div>
          </div>
        </div>

        {chartData ||
        [
          'Pull Requests',
          'Total Pull Requests',
          'Total Open Pull Requests',
          'Total Closed Pull Requests',
          'Pull Requests Approval Rate',
          'Average PRs Iteration Time',
          'Pull Requests Size',
          'Total Cycle Time',
          'Static Code Analysis',
        ].includes(title) ? (
          <>
            {(() => {
              const realChartData = getRealChartData();

              const hasData = (() => {
                if (realChartData?.groupedData && Array.isArray(realChartData.groupedData)) {
                  return realChartData.groupedData.length > 0;
                }

                // Check for chart data (used in donut charts)
                if (realChartData?.chartData && Array.isArray(realChartData.chartData)) {
                  return realChartData.chartData.length > 0;
                }

                if (realChartData?.labels && realChartData?.dataPoints) {
                  return realChartData.labels.length > 0 && realChartData.dataPoints.length > 0;
                }

                if (realChartData?.dataPoints && Array.isArray(realChartData.dataPoints)) {
                  return (
                    realChartData.dataPoints.length > 0 &&
                    realChartData.dataPoints.some((point) => point !== null && point !== undefined)
                  );
                }

                return false;
              })();

              if (!hasData) {
                return (
                  <div className="flex items-center justify-center" style={{ height: '220px' }}>
                    <div className="text-center">
                      <div className="text-gray-400 dark:text-gray-500 mb-3 flex justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="17"
                          height="17"
                          viewBox="0 0 17 17"
                          fill="none"
                          className="w-10 h-10"
                        >
                          <path
                            d="M6.5 4.5C6.77614 4.5 7 4.27614 7 4C7 3.72386 6.77614 3.5 6.5 3.5C6.22386 3.5 6 3.72386 6 4C6 4.27614 6.22386 4.5 6.5 4.5Z"
                            fill="currentColor"
                          />
                          <path
                            d="M6.5 8.5C6.77614 8.5 7 8.27614 7 8C7 7.72386 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.72386 6 8C6 8.27614 6.22386 8.5 6.5 8.5Z"
                            fill="currentColor"
                          />
                          <path
                            d="M6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.7239 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.7239 6 12C6 12.2761 6.22386 12.5 6.5 12.5Z"
                            fill="currentColor"
                          />
                          <path
                            d="M12 1.5H2C1.73478 1.5 1.48043 1.60536 1.29289 1.79289C1.10536 1.98043 1 2.23478 1 2.5V13.5C1 13.7652 1.10536 14.0196 1.29289 14.2071C1.48043 14.3946 1.73478 14.5 2 14.5H9V13.5H2V10.5H13V2.5C13 2.23478 12.8946 1.98043 12.7071 1.79289C12.5196 1.60536 12.2652 1.5 12 1.5ZM12 9.5H2V6.5H12V9.5ZM12 5.5H2V2.5H12V5.5Z"
                            fill="currentColor"
                          />
                          <path
                            d="M12.9157 12.5312L11.5273 13.9196M11.5273 12.5312L12.9157 13.9196"
                            stroke="currentColor"
                            strokeWidth="0.79955"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12.2214 15.4429C13.4483 15.4429 14.4429 14.4483 14.4429 13.2214C14.4429 11.9946 13.4483 11 12.2214 11C10.9946 11 10 11.9946 10 13.2214C10 14.4483 10.9946 15.4429 12.2214 15.4429Z"
                            stroke="currentColor"
                            strokeWidth="0.79955"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M14.9948 15.9987L13.8008 14.8047"
                            stroke="currentColor"
                            strokeWidth="0.79955"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                        No data available for this view
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                        Try selecting different filters or check back later
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="w-full" style={{ height: '180px' }}>
                  {currentChartType === 'donut' ? (
                    <div className="w-full flex items-center justify-center">
                      <div style={{ width: '280px', height: '160px' }}>
                        <DonutChart
                          labels={(() => {
                            const chartData = getRealChartData();
                            return chartData.chartData
                              ? chartData.chartData.map((item) => item.name)
                              : chartData.labels || [];
                          })()}
                          dataPoints={(() => {
                            const chartData = getRealChartData();
                            return chartData.chartData
                              ? chartData.chartData.map((item) => item.value)
                              : chartData.dataPoints || [];
                          })()}
                          backgroundColors={(() => {
                            const chartData = getRealChartData();
                            return chartData.chartData
                              ? chartData.chartData.map((item) => item.color)
                              : ['#066FD1', '#0B5AA0', '#0F4A7F', '#1A3A5E', '#2A4A6E', '#3A5A7E'];
                          })()}
                          label={(() => {
                            const chartData = getRealChartData();
                            return chartData.label || title;
                          })()}
                          height="160px"
                          width="280px"
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '65%',
                            plugins: {
                              legend: {
                                display: true,
                                position: 'right',
                                labels: {
                                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                                  usePointStyle: true,
                                  padding: 10,
                                  font: {
                                    size: 10,
                                  },
                                  boxWidth: 6,
                                },
                              },
                              tooltip: {
                                callbacks: {
                                  label: (context) => {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.raw / total) * 100).toFixed(1);
                                    return `${context.label}: ${context.raw} (${percentage}%)`;
                                  },
                                },
                              },
                            },
                            layout: {
                              padding: {
                                left: 0,
                                right: 0,
                                top: 10,
                                bottom: 10,
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <CustomLineBarChart
                      data={(() => {
                        const chartData = getRealChartData();

                        if (title === 'Total Cycle Time' && chartData.groupedData) {
                          return chartData.groupedData;
                        }

                        const labels = chartData.labels || [];
                        const dataPoints = chartData.dataPoints || [];
                        const dataKey = 'value';

                        const transformedData = labels.map((label, index) => ({
                          day: label,
                          [dataKey]: dataPoints[index] || 0,
                        }));

                        return transformedData;
                      })()}
                      showLine={currentChartType === 'line'}
                      showBar={currentChartType === 'bar'}
                      type={
                        title === 'Total Cycle Time'
                          ? selectedViewType === 'sprint-trend'
                            ? 'gitCycleTime'
                            : 'gitData'
                          : 'gitData'
                      }
                      legendLabel={prLabel}
                      legendLabel2={prShortLabel}
                    />
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <div className="flex items-center justify-center" style={{ height: '180px' }}>
            <div className="text-center">
              <div className="text-gray-400 dark:text-gray-500 mb-3 flex justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  viewBox="0 0 17 17"
                  fill="none"
                  className="w-10 h-10"
                >
                  <path
                    d="M6.5 4.5C6.77614 4.5 7 4.27614 7 4C7 3.72386 6.77614 3.5 6.5 3.5C6.22386 3.5 6 3.72386 6 4C6 4.27614 6.22386 4.5 6.5 4.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M6.5 8.5C6.77614 8.5 7 8.27614 7 8C7 7.72386 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.72386 6 8C6 8.27614 6.22386 8.5 6.5 8.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.7239 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.7239 6 12C6 12.2761 6.22386 12.5 6.5 12.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 1.5H2C1.73478 1.5 1.48043 1.60536 1.29289 1.79289C1.10536 1.98043 1 2.23478 1 2.5V13.5C1 13.7652 1.10536 14.0196 1.29289 14.2071C1.48043 14.3946 1.73478 14.5 2 14.5H9V13.5H2V10.5H13V2.5C13 2.23478 12.8946 1.98043 12.7071 1.79289C12.5196 1.60536 12.2652 1.5 12 1.5ZM12 9.5H2V6.5H12V9.5ZM12 5.5H2V2.5H12V5.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M12.9157 12.5312L11.5273 13.9196M11.5273 12.5312L12.9157 13.9196"
                    stroke="currentColor"
                    strokeWidth="0.79955"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12.2214 15.4429C13.4483 15.4429 14.4429 14.4483 14.4429 13.2214C14.4429 11.9946 13.4483 11 12.2214 11C10.9946 11 10 11.9946 10 13.2214C10 14.4483 10.9946 15.4429 12.2214 15.4429Z"
                    stroke="currentColor"
                    strokeWidth="0.79955"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14.9948 15.9987L13.8008 14.8047"
                    stroke="currentColor"
                    strokeWidth="0.79955"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                No data available
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Try selecting different filters or check back later
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

GitListView.propTypes = {
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
  warningMessage: PropTypes.string,
  chartData: PropTypes.shape({
    labels: PropTypes.array,
    dataPoints: PropTypes.array,
    datasetData: PropTypes.array,
    label: PropTypes.string,
    borderColor: PropTypes.string,
    isGroupChart: PropTypes.bool,
  }),
  chartType: PropTypes.oneOf(['line', 'bar', 'donut']),
  className: PropTypes.string,
  prLabel: PropTypes.string,
  prShortLabel: PropTypes.string,
};

export default GitListView;
