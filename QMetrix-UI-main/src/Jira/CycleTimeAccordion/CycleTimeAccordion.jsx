import { useState } from 'react';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented imports later.
// import { cycleTime } from '../../../store/jira/CycleTime/getCycleTime';
// import { cycleMetrics } from '../../../store/jira/CycleTime/getCycleMetrics';
// import { useDispatch, useSelector } from 'react-redux';
// import { getId } from '../../../constants';
import { useSelector } from 'react-redux';
import DropdownButton from '../../Common/DropDown';
import DonutChart from '../../Common/DonutChart';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import tableDataConfig from '../../../utils/tableDataConfig';
import PropTypes from 'prop-types';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import { APP_STRINGS } from '../../../constants';

const CycleTime = ({ layout, itemDetails }) => {
  const jiraData = useSelector((state) => state.jira || {});
  const cycleTimeChartData = jiraData?.cycleTimeData || [];
  const cycleTimeDataType = jiraData?.selectedValue || APP_STRINGS.VALUE_SPRINT;

  // Dynamic labels based on board type (Azure Boards => Iteration/Epic)
  const boardTypeSession = String(
    sessionStorage.getItem(APP_STRINGS.SESSION_BOARD_TYPE) || '',
  ).toLowerCase();
  const projects =
    jiraData?.projectList || jiraData?.getAllProjectList || jiraData?.getAllProjectsList || [];
  const hasAnyAzureBoard =
    boardTypeSession.includes(APP_STRINGS.AZURE) ||
    (Array.isArray(projects) &&
      projects.some((p) => {
        const t = String(p?.boardType || p?.type || p?.projectTypeKey || '').toLowerCase();
        const self = String(p?.self || '').toLowerCase();
        return (
          t === APP_STRINGS.AZURE_BOARD ||
          t === APP_STRINGS.AZURE_BOARD_KEBAB ||
          t.includes(APP_STRINGS.AZURE) ||
          self.includes(APP_STRINGS.DEV_AZURE_COM)
        );
      }));
  const sprintLabel = hasAnyAzureBoard ? APP_STRINGS.LABEL_ITERATION : APP_STRINGS.VALUE_SPRINT;
  const releaseLabel = hasAnyAzureBoard ? APP_STRINGS.LABEL_EPIC : APP_STRINGS.VALUE_RELEASE;
  const displayTypeLabel =
    String(cycleTimeDataType).toLowerCase() === APP_STRINGS.API_RELEASE
      ? releaseLabel
      : sprintLabel;
  const sprintDataSet = cycleTimeChartData?.cycleTime?.cycleTimeTrend
    ? cycleTimeChartData.cycleTime.cycleTimeTrend
        .map((item) => Math.round(item.overall.cycleTime))
        .reverse()
    : [];

  const cycleTimeDatas = [
    {
      title: 'Total Time Spent',
      key: 'days',
      value: `${Math.round(
        cycleTimeChartData?.cycleTime?.cycleTimeTrend[0]?.overall?.totalTimeSpent ?? 0,
      )}`,
      toolTip: ReactDOMServer.renderToStaticMarkup(
        getTooltipContent(`Total Time Spent`, tableDataConfig[`Total Time Spent`]),
      ),
    },
    {
      title: 'Total Stories Closed',
      key: '',
      value: `${Math.round(
        cycleTimeChartData?.cycleTime?.cycleTimeTrend[0]?.overall?.completedStoriesCount ?? 0,
      )}`,
      toolTip: ReactDOMServer.renderToStaticMarkup(
        getTooltipContent(`Total Stories Closed`, tableDataConfig[`Total Stories Closed`]),
      ),
    },
  ];
  const theme = useSelector((state) => state.theme.theme);
  // For testing purposes we are using unified endpoints. If they work properly, we will remove the commented code later.
  // const [ , setCycleMetricData] = useState([]);
  // const [ , setCycleTimeData] = useState([]);
  // const dispatch = useDispatch();

  const [selectedCycleTimeView, setSelectedCycleTimeView] = useState({
    label: `Cycle Time ${displayTypeLabel} Trend`,
    value: 'trend',
  });
  const [selectedChartType, setSelectedChartType] = useState('line');

  const cycleTimeViewOptions = [
    {
      label: `Cycle Time ${displayTypeLabel} Trend`,
      value: 'trend',
    },
    {
      label: 'Cycle Time By Dev',
      value: 'by_dev',
    },
  ];

  const handleCycleTimeViewSelect = (value) => {
    setSelectedCycleTimeView(value);
  };

  // For testing purposes we are using unified endpoints. Cycle time data is now provided by getProjectManagementData via Redux.
  // If this works properly, we will remove the commented code later.
  // useEffect(() => {
  //   const fetchMergedData = async () => {
  //     try {
  //       const projectKeyId = getId().projectKeyId;
  //       if (!projectKeyId) {
  //         throw new Error('companyId or projectId is not defined');
  //       }
  //       const resultAction = await dispatch(cycleTime({ projectKeyId })).unwrap();
  //       if (resultAction) {
  //         setCycleTimeData(resultAction);
  //       }
  //     } catch (error) {
  //       console.error('Error fetching data:', error.message || error);
  //     }
  //   };
  //   fetchMergedData();
  // }, [dispatch]);

  // useEffect(() => {
  //   const fetchMergedPRs = async () => {
  //     try {
  //       const sprintId = getId().sprintId;
  //       if (!sprintId) {
  //         throw new Error('companyId or projectId is not defined');
  //       }
  //       const resultAction = await dispatch(cycleMetrics({ sprintId })).unwrap();
  //       if (resultAction) {
  //         setCycleMetricData(resultAction);
  //       }
  //     } catch (error) {
  //       console.error('Error fetching data:', error.message || error);
  //     }
  //   };
  //   fetchMergedPRs();
  // }, [dispatch]);

  const averageCycleTime = sprintDataSet.length
    ? Math.round(sprintDataSet.reduce((sum, value) => sum + value, 0) / sprintDataSet.length)
    : 0;

  const getCycleTimeTrendData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    const cycleTimeTrend = cycleTimeChartData?.cycleTime?.cycleTimeTrend || [];
    const trendData = cycleTimeTrend.map((item, index) => ({
      name: item.name,
      value: Math.round(item.overall?.cycleTime || 0),
      color: dsShades[index % dsShades.length]
    }));
    
    return trendData.reverse();
  };

  const getCycleTimeByDevData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    const byDeveloper = cycleTimeChartData?.cycleTimeByDeveloper?.byDeveloper || [];
    const devData = byDeveloper.map((item, index) => ({
      name: item.developer,
      value: Math.round(item.averageCycleTime || 0),
      color: dsShades[index % dsShades.length]
    }));
    
    return devData;
  };

  const cycleTimeTrendData = getCycleTimeTrendData();
  const cycleTimeByDevData = getCycleTimeByDevData();
  
  const getCycleTimeTrendPieData = () => {
    return cycleTimeTrendData.filter((item) => item.value > 0);
  };
  
  const getCycleTimeByDevPieData = () => {
    return cycleTimeByDevData.filter((item) => item.value > 0);
  };

  return (
    <>
      {layout === 'grid' ? (
        <div className={`relative h-80`}>
          <div
            className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
            style={{
              borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
            }}
          >
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2 my-2">
                <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                  {itemDetails.name}
                </h2>
                <span
                  data-tooltip-id={`tooltip-${itemDetails.name}`}
                  data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                  data-tooltip-offset="15"
                  className="cursor-pointer"
                >
                  <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                </span>
                <ReactTooltip
                  id={`tooltip-${itemDetails.name}`}
                  effect="solid"
                  offset={1}
                  float={false}
                  allowHTML={true}
                  arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                  wrapper="div"
                  opacity={1}
                  style={{
                    backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: '#224F78',
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
              <div className="flex items-center">
                <h2>
                  <span className={`text-xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} mr-2`}>
                    {itemDetails.value}
                  </span>
                  <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-sm`}>Days</span>
                </h2>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  className="w-4 h-4 ml-2 text-green-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
              </div>
            </div>

            {/* Main value display */}
            <div className="flex flex-col border-t dark:border-[#25384F] pt-2 mt-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
              <div className="flex flex-col justify-between py-1">
                {cycleTimeDatas.map(({ title, value, toolTip, key }) => (
                  <div className="flex justify-between gap-2 mb-1 items-center" key={key}>
                  <div className="flex gap-1">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{title}</span>
                      <span
                        data-tooltip-id={`tooltip-${title}`}
                        data-tooltip-html={toolTip}
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-${title}`}
                        effect="solid"
                        offset={1}
                        float={false}
                        allowHTML={true}
                        arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                        wrapper="div"
                        opacity={1}
                        style={{
                          backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                          borderStyle: 'solid',
                          borderWidth: '1px',
                          borderColor: '#224F78',
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
                    <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>
                      {value} {key}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-b dark:border-[#25384F] py-3 mt-2 mb-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
                <div className="flex gap-1">
                  <span
                    className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}
                  >
                    Average Cycle Time {displayTypeLabel} Trend
                  </span>
                  <span
                    data-tooltip-id={`tooltip-${itemDetails.name}`}
                    data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                      getTooltipContent(`Average Cycle Time ${displayTypeLabel} Trend`),
                    )}
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                  </span>
                  <ReactTooltip
                    id={`tooltip-${itemDetails.name}`}
                    effect="solid"
                    offset={1}
                    float={false}
                    allowHTML={true}
                    arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                    wrapper="body"
                    opacity={1}
                    style={{
                      backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                      borderStyle: 'solid',
                      borderWidth: '1px',
                      borderColor: '#224F78',
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
                <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{averageCycleTime} Days</span>
              </div>
              <div className="flex flex-col justify-between max-h-28 overflow-y-auto">
                <span className={`${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'} font-semibold mb-2`}>Cycle Time By Dev</span>
                {cycleTimeChartData?.cycleTimeByDeveloper?.byDeveloper?.map((developer, index) => (
                  <div key={developer.developer || index} className="flex justify-between">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{developer.developer}</span>
                    <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>
                      {Math.round(developer.averageCycleTime)} Days
                    </span>
                  </div>
                )) || (
                  ' '
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-4">
              <div 
                className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80"
                style={{
                  borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                        Cycle Time
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-cycle-time`}
                        data-tooltip-html={getTooltipContentByName('Cycle Time')}
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-cycle-time`}
                        effect="solid"
                        offset={1}
                        float={false}
                        allowHTML={true}
                        arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                        wrapper="div"
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
                    <div className="flex items-center">
                      <span className={`text-2xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} mr-2`}>
                        {itemDetails.value}
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-lg`}>Days</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        className="w-4 h-4 ml-2 text-green-500"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Header line below Cycle Time */}
                  <div className="border-b dark:border-[#25384F] mb-4" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}></div>

                  {/* Cycle Time Metrics */}
                  <div className="flex-1 flex flex-col">
                    <div className="space-y-4">
                      {cycleTimeDatas.map(({ title, value, key }, index) => (
                        <div key={index} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm flex items-center gap-2`}>
                              {title}
                              <span
                                data-tooltip-id={`tooltip-${title.replace(/\s+/g, '-').toLowerCase()}`}
                                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                  getTooltipContent(title, tableDataConfig[title] || []),
                                )}
                                data-tooltip-place="bottom"
                                data-tooltip-offset="15"
                                className="cursor-pointer"
                              >
                                <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                              </span>
                              <ReactTooltip
                                id={`tooltip-${title.replace(/\s+/g, '-').toLowerCase()}`}
                                effect="solid"
                                offset={1}
                                float={false}
                                allowHTML={true}
                                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                                wrapper="div"
                                opacity={1}
                                style={{
                                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                                  borderStyle: 'solid',
                                  borderWidth: '1px',
                                  borderColor: '#224F78',
                                  color: 'white',
                                  zIndex: 9999,
                                  padding: '8px',
                                  borderRadius: '5px',
                                  maxWidth: '500px',
                                  whiteSpace: 'normal',
                                  position: 'absolute',
                                }}
                              />
                            </span>
                            <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>
                              {value} {key}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Section - Right Side (8 columns) */}
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
                <div className="flex flex-col h-full">
                  {/* Chart Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Cycle Time
                    </h2>
                    <div className="flex items-center gap-2">
                      {/* Single Dropdown */}
                      <DropdownButton
                        buttonLabel={selectedCycleTimeView.label}
                        options={cycleTimeViewOptions}
                        onSelect={handleCycleTimeViewSelect}
                        value={selectedCycleTimeView}
                        placeholder={`Cycle Time ${displayTypeLabel} Trend`}
                        type="cycleTimeView"
                        width="lgx"
                      />
                      {/* Chart Type Buttons */}
                      <div className="flex items-center space-x-2 ml-2">
                        <div className="relative group">
                          <LineChartIcon
                            className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                              selectedChartType === 'line'
                                ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                                : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]')
                            }`}
                            onClick={() => setSelectedChartType('line')}
                          />
                          <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                            Line Chart
                          </div>
                        </div>
                        <div className="relative group">
                          <BarChartIcon
                            className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                              selectedChartType === 'bar'
                                ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                                : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]')
                            }`}
                            onClick={() => setSelectedChartType('bar')}
                          />
                          <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                            Bar Chart
                          </div>
                        </div>
                        <div className="relative group">
                          <DonutChartIcon
                            className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                              selectedChartType === 'pie'
                                ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                                : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover-border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover-border-[#6C7A91B2]'
                            }`}
                            onClick={() => setSelectedChartType('pie')}
                          />
                          <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                            Donut Chart
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart Content */}
                  <div className="flex-1">
                    {selectedCycleTimeView.value === 'trend' && cycleTimeTrendData.length > 0 ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DonutChart
                                  labels={getCycleTimeTrendPieData().map(item => item.name)}
                                  dataPoints={getCycleTimeTrendPieData().map(item => item.value)}
                                  backgroundColors={getCycleTimeTrendPieData().map(item => item.color)}
                                  label="Cycle Time"
                                  height="200px"
                                  width="250px"
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: {
                                        display: true,
                                        position: 'right',
                                        labels: {
                                          color: theme === 'dark' ? '#e5e7eb' : '#374151',
                                          usePointStyle: true,
                                          padding: 20,
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
                                  }}
                                />
                              </div>
                            ) : (
                              <CustomLineBarChart 
                                data={cycleTimeTrendData.map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))} 
                                showLine={selectedChartType === 'line'} 
                                showBar={selectedChartType === 'bar'} 
                                type={'cycleTimeDistribution'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : selectedCycleTimeView.value === 'by_dev' && cycleTimeByDevData.length > 0 ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DonutChart
                                  labels={getCycleTimeByDevPieData().map(item => item.name)}
                                  dataPoints={getCycleTimeByDevPieData().map(item => item.value)}
                                  backgroundColors={getCycleTimeByDevPieData().map(item => item.color)}
                                  label="Cycle Time By Dev"
                                  height="200px"
                                  width="250px"
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: {
                                        display: true,
                                        position: 'right',
                                        labels: {
                                          color: theme === 'dark' ? '#e5e7eb' : '#374151',
                                          usePointStyle: true,
                                          padding: 20,
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
                                  }}
                                />
                              </div>
                            ) : (
                              <CustomLineBarChart 
                                data={cycleTimeByDevData.map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))} 
                                showLine={selectedChartType === 'line'} 
                                showBar={selectedChartType === 'bar'} 
                                type={'cycleTimeDistribution'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <NoDataPlaceholder height={200} message="No data available for the selected view" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

CycleTime.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};

export default CycleTime;
