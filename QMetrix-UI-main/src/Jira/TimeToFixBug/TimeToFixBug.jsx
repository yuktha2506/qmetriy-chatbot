import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import DropdownButton from '../../Common/DropDown';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import DoughnutChart from '../../Common/DonutChart';
import { getBoardLabels } from '../../../utils/boardUtils';

const TimeToFixBug = ({ layout, itemDetails }) => {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const ttfDataType = jiraData?.selectedValue || 'Sprint';
  const timeToFixData = useMemo(() => {
    return jiraData?.TimeToFixData || [];
  }, [jiraData?.TimeToFixData]);
  const cxoData = useSelector((state) => state.cxo || {});
  const [getReleaseReadiness, setReleaseReadiness] = useState({});

  useEffect(() => {
    if (cxoData) {
      setReleaseReadiness(cxoData.releaseReadinessData || {});
    }
  }, [cxoData]);
  const timeToFixVal =
    getReleaseReadiness?.savedCXO?.engineeringScoreObject?.developerScoreObject?.timeToFix || {};
  const ttfResolvedBugs = timeToFixVal?.totalResolvedBugs ?? 0;
  const ttfEffortSpent = timeToFixVal?.totalTimeSpent ?? 0;
  const { sprintLabel, releaseLabel } = getBoardLabels();
    const selectedTypeLabel =
      String(ttfDataType).toLowerCase() === 'release' ? releaseLabel : sprintLabel;

  const [selectedChartType, setSelectedChartType] = useState('line');
  const [selectedTtfView, setSelectedTtfView] = useState('sprint');

  const ttfViewOptions = [
    {
      label: `Time To Fix By ${selectedTypeLabel}`,
      value: 'sprint',
    },
    {
      label: 'Time To Fix By Dev',
      value: 'dev',
    },
    {
      label: 'Time To Fix By Priority',
      value: 'priority',
    },
    {
      label: 'Time To Fix By Type',
      value: 'type',
    },
  ];

  const ttfSprintList = timeToFixData?.filter(item => item.ttfBySprintOrRelease)?.map((item) => item.ttfBySprintOrRelease)[0] || [];
  const ttfDevList = timeToFixData?.filter(item => item.ttfByDeveloper)?.map((item) => item.ttfByDeveloper)[0] || [];
  const ttfPriorityList = timeToFixData?.filter(item => item.ttfByPriorityWise)?.map((item) => item.ttfByPriorityWise)[0] || [];
  const ttfTypeList = timeToFixData?.filter(item => item.ttfByType)?.map((item) => item.ttfByType)[0] || [];

  const getTtfSprintData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return ttfSprintList.slice().map((item, index) => ({
      name: item.name,
      value: Math.round(parseFloat(item.averageTTF || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getTtfDevData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return ttfDevList.map((item, index) => ({
      name: item.assignee,
      value: Math.round(parseFloat(item.averageTTF || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getTtfPriorityData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return ttfPriorityList.map((item, index) => ({
      name: item.priority,
      value: Math.round(parseFloat(item.averageTTF || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getTtfTypeData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return ttfTypeList.map((item, index) => ({
      name: item.label,
      value: Math.round(parseFloat(item.averageTTF || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getTtfSprintPieData = () => {
    return getTtfSprintData().filter((item) => item.value > 0);
  };

  const getTtfDevPieData = () => {
    return getTtfDevData().filter((item) => item.value > 0);
  };

  const getTtfPriorityPieData = () => {
    return getTtfPriorityData().filter((item) => item.value > 0);
  };

  const getTtfTypePieData = () => {
    return getTtfTypeData().filter((item) => item.value > 0);
  };

  const handleTtfViewSelect = (option) => {
    setSelectedTtfView(option.value);
  };

  const [selectedTimeToFixWise, setSelectedTimeToFixWise] = useState({
    label: `By ${selectedTypeLabel}`,
    value: 'by_sprint',
  });

  const timeToFixWiseOptions = [
    {
      label: `By ${selectedTypeLabel}`,
      value: 'by_sprint',
    },
    {
      label: 'By Priority',
      value: 'by_priority',
    },
    {
      label: 'By Dev',
      value: 'by_dev',
    },
    {
      label: 'By Type',
      value: 'by_type',
    },
  ];

  const handleTimeToFixWiseSelect = (value) => {
    setSelectedTimeToFixWise(value);
  };

  const currentTimeToFixData = useMemo(() => {
    const namesAndCounts =
      timeToFixData
        ?.filter((item) => item.ttfBySprintOrRelease)
        .map((item) => item.ttfBySprintOrRelease)[0] || [];
    const calculateOverallAverage = (data) => {
      if (!data || data.length === 0) return 0;

      const sum = data.reduce((acc, item) => {
        return acc + (parseFloat(item.averageTTF) || 0);
      }, 0);

      return (sum / data.length).toFixed(1);
    };

    const overallAverage = calculateOverallAverage(namesAndCounts);
    const TTfValues =
      timeToFixData?.filter((item) => item.ttfByType).map((item) => item.ttfByType)[0] || [];
    const priorityValues =
      timeToFixData
        ?.filter((item) => item.ttfByPriorityWise)
        .map((item) => item.ttfByPriorityWise)[0] || [];
    const developerValues =
      timeToFixData?.filter((item) => item.ttfByDeveloper).map((item) => item.ttfByDeveloper)[0] ||
      [];

    const dataMap = {
      by_sprint: {
        data: namesAndCounts,
        labelKey: 'name',
        valueKey: 'averageTTF',
        overallAverage: overallAverage,
        displayLabel: `Average Time To Fix Bug By ${ttfDataType}`,
      },
      by_priority: { data: priorityValues, labelKey: 'priority', valueKey: 'averageTTF' },
      by_dev: { data: developerValues, labelKey: 'assignee', valueKey: 'averageTTF' },
      by_type: { data: TTfValues, labelKey: 'label', valueKey: 'averageTTF' },
    };

    return dataMap[selectedTimeToFixWise.value] || { data: [], labelKey: '', valueKey: '' };
  }, [timeToFixData, selectedTimeToFixWise.value, ttfDataType]);

  return (
    <>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom: `solid 0.4vh ${getChangeColorForWidget(
              itemDetails.name,
              itemDetails.value,
            )}`,
          }}
        >
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-center border-b border-[#D1E2F0] dark:border-[#25384F] pt-1 pb-4">
              <div className="flex items-center gap-2">
                <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                  {itemDetails.name}
                </h2>
                <div className="item-center">
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

              <div className="w-auto ml-auto">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <span className={`text-xl font-semibold mr-2 ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'}`}>
                      {itemDetails.value}
                    </span>
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-sm`}>Days</span>
                  </div>
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
            </div>
            <div className="grid grid-cols-[45%_45%] gap-16">
              <div className="flex flex-col">
                <div className="flex py-4">
                  <div className="space-y-2 text-sm mt-2 flex flex-col w-full">
                    <div className={`flex justify-between w-full ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                      <span className="flex gap-2">
                        Total Number Of Resolved Bugs
                        <span
                          data-tooltip-id={`tooltip-total-number-of-resolved-bugs-${itemDetails.name}`}
                          data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                            getTooltipContent('Total Number Of Resolved Bugs'),
                          )}
                          data-tooltip-place="bottom"
                          data-tooltip-offset="15"
                          className="cursor-pointer"
                        >
                          <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-total-number-of-resolved-bugs-${itemDetails.name}`}
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
                      <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} flex ml-auto text-left min-w-[50px]`}>{ttfResolvedBugs}</span>
                    </div>
                    <div className={`flex justify-between mb-2 ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                      <span className="flex gap-2">
                        Total Effort Spent
                        <span
                          data-tooltip-id={`tooltip-total-effort-spent-${itemDetails.name}`}
                          data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                            getTooltipContent('Total Effort Spent'),
                          )}
                          data-tooltip-place="bottom"
                          data-tooltip-offset="15"
                          className="cursor-pointer"
                        >
                          <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-total-effort-spent-${itemDetails.name}`}
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
                      <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-left min-w-[80px]`}>{ttfEffortSpent} Days</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col text-sm py-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex justify-center ml-auto">
                    <DropdownButton
                      buttonLabel={selectedTimeToFixWise.label}
                      options={timeToFixWiseOptions}
                      onSelect={handleTimeToFixWiseSelect}
                      value={selectedTimeToFixWise}
                      placeholder={`By ${selectedTypeLabel}`}
                      type="bySprint"
                      width="md"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 px-2 max-h-40 overflow-y-auto">
                  {selectedTimeToFixWise.value === 'by_sprint' ? (
                    <>
                      {currentTimeToFixData.data.length > 1 && (
                        <div className="flex justify-between pt-2 mt-2">
                          <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm flex gap-2`}>
                            Average TTFB By {ttfDataType}
                            <span
                              data-tooltip-id={`tooltip-average-TTFB-${itemDetails.name}`}
                              data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                getTooltipContent(`Average TTFB By ${ttfDataType}`),
                              )}
                              data-tooltip-place="bottom"
                              data-tooltip-offset="15"
                              className="cursor-pointer"
                            >
                              <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                            </span>
                            <ReactTooltip
                              id={`tooltip-average-TTFB-${itemDetails.name}`}
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
                          <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[80px]`}>
                            {currentTimeToFixData.overallAverage} Days
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {currentTimeToFixData.data.map((item, index) => (
                        <div key={index} className="flex justify-between mr-2">
                          <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                            {item[currentTimeToFixData.labelKey]}
                          </span>
                          <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'text-gray-300'} text-sm text-left min-w-[80px]`}>
                            {item[currentTimeToFixData.valueKey]} Days
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
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
                        {itemDetails.name}
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-ttf`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-ttf`}
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
                      <span className={`text-xl font-semibold mr-2 ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'}`}>
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
                  
                  {/* Header line */}
                  <div className="border-b border-[#D1E2F0] dark:border-[#25384F] mb-4"></div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                          Total Number Of Resolved Bugs
                        </span>
                        <span
                          data-tooltip-id={`tooltip-resolved-bugs-${itemDetails.name}`}
                          data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                            getTooltipContent('Total Number Of Resolved Bugs')
                          )}
                          data-tooltip-place="bottom"
                          data-tooltip-offset="15"
                          className="cursor-pointer"
                        >
                          <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-resolved-bugs-${itemDetails.name}`}
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
                      <span className={`text-sm text-left min-w-[50px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                        {ttfResolvedBugs}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                          Total Effort Spent
                        </span>
                        <span
                          data-tooltip-id={`tooltip-effort-spent-${itemDetails.name}`}
                          data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                            getTooltipContent('Total Effort Spent')
                          )}
                          data-tooltip-place="bottom"
                          data-tooltip-offset="15"
                          className="cursor-pointer"
                        >
                          <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-effort-spent-${itemDetails.name}`}
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
                      <span className={`text-sm text-left min-w-[80px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                        {ttfEffortSpent} Days
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chart Section */}
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Time to Fix Bugs
                    </h2>
                    <div className="flex items-center gap-3">
                      <DropdownButton
                        buttonLabel="Select View"
                        options={ttfViewOptions}
                        selectedOption={ttfViewOptions.find((option) => option.value === selectedTtfView)?.label}
                        onSelect={handleTtfViewSelect}
                        width="lgx"
                      />
                      <div className="flex items-center space-x-2 ml-2">
                        <div className="relative group">
                          <LineChartIcon
                            className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                              selectedChartType === 'line'
                                ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                                : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
                                : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
                                ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
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
                  
                  <div className="flex-1">
                    {selectedTtfView === 'sprint' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '280px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getTtfSprintData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getTtfSprintPieData().map(item => item.name)}
                                    dataPoints={getTtfSprintPieData().map(item => item.value)}
                                    backgroundColors={getTtfSprintPieData().map(item => item.color)}
                                    label="Time to Fix"
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
                                    height="200px"
                                    width="250px"
                                  />
                                </div>
                              ) : (
                                <CustomLineBarChart
                                  data={getTtfSprintData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="ttfDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={180} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : selectedTtfView === 'dev' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '280px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getTtfDevData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getTtfDevPieData().map(item => item.name)}
                                    dataPoints={getTtfDevPieData().map(item => item.value)}
                                    backgroundColors={getTtfDevPieData().map(item => item.color)}
                                    label="Time to Fix"
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
                                    height="200px"
                                    width="250px"
                                  />
                                </div>
                              ) : (
                                <CustomLineBarChart
                                  data={getTtfDevData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="ttfDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={180} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : selectedTtfView === 'priority' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '280px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getTtfPriorityData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getTtfPriorityPieData().map(item => item.name)}
                                    dataPoints={getTtfPriorityPieData().map(item => item.value)}
                                    backgroundColors={getTtfPriorityPieData().map(item => item.color)}
                                    label="Time to Fix"
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
                                    height="200px"
                                    width="250px"
                                  />
                                </div>
                              ) : (
                                <CustomLineBarChart
                                  data={getTtfPriorityData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="ttfDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={180} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '280px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getTtfTypeData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getTtfTypePieData().map(item => item.name)}
                                    dataPoints={getTtfTypePieData().map(item => item.value)}
                                    backgroundColors={getTtfTypePieData().map(item => item.color)}
                                    label="Time to Fix"
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
                                    height="200px"
                                    width="250px"
                                  />
                                </div>
                              ) : (
                                <CustomLineBarChart
                                  data={getTtfTypeData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="ttfDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={180} />
                            )}
                          </div>
                        </div>
                      </div>
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

TimeToFixBug.propTypes = {
  timeToFixData: PropTypes.array.isRequired,
  TimeToFixDataType: PropTypes.string.isRequired,
  timeToFixVal: PropTypes.number.isRequired,
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
  itemIndex: PropTypes.number.isRequired,
};

export default TimeToFixBug;
