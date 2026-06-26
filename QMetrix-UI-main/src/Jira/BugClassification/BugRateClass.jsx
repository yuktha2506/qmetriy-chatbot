import DropdownButton from '../../Common/DropDown';
import DoughnutChart from '../../Common/DonutChart';
import '../../../assets/css/graphColors.scss';
import '../../../assets/css/commonColors.scss';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useState } from 'react';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import { getBoardLabels } from '../../../utils/boardUtils';

const BugRateClass = ({ layout, itemDetails }) => {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const bugClassificationData = jiraData?.bugClassificationData || [];
  const bugClassificationDataType = jiraData?.selectedValue || 'Sprint';
  const { sprintLabel, releaseLabel } = getBoardLabels();
  const selectedTypeLabel =
    String(bugClassificationDataType).toLowerCase() === 'release' ? releaseLabel : sprintLabel;
  const [selectedBugView, setSelectedBugView] = useState('sprint');
  const [selectedChartType, setSelectedChartType] = useState('bar');

  const bugViewOptions = [
    {
      label: `Bug Rate By ${selectedTypeLabel}`,
      value: 'sprint',
    },
    {
      label: 'Bug Assignment By Dev',
      value: 'dev',
    },
    {
      label: 'Bug Classification By Priority',
      value: 'priority',
    },
    {
      label: 'Bug Classification By Type',
      value: 'type',
    },
  ];

  const namesAndCounts = bugClassificationData
    ?.filter((item) => item.bugRateBySprintOrRelease)
    .map((item) => item.bugRateBySprintOrRelease)[0] || [];
  const bugClassificationTypeValues = bugClassificationData
    ?.filter((item) => item.bugClassificationByType)
    .map((item) => item.bugClassificationByType)[0] || [];
  const priorityValues = bugClassificationData
    ?.filter((item) => item.bugClassificationByPriority)
    .map((item) => item.bugClassificationByPriority)[0] || [];
  const developerValues = bugClassificationData
    ?.filter((item) => item.bugClassificationByDeveloper)
    .map((item) => item.bugClassificationByDeveloper)[0] || [];

  const getBugSprintData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return namesAndCounts.slice().map((item, index) => ({
      name: item.name,
      value: Math.round(parseFloat(item.count || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getBugDevData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return developerValues.map((item, index) => ({
      name: item.developer,
      value: Math.round(parseFloat(item.total || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getBugPriorityData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return priorityValues.map((item, index) => ({
      name: item.priority,
      value: Math.round(parseFloat(item.value || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getBugTypeData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return bugClassificationTypeValues.map((item, index) => ({
      name: item.label,
      value: Math.round(parseFloat(item.total || 0)),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getBugSprintPieData = () => {
    return getBugSprintData().filter((item) => item.value > 0);
  };

  const getBugDevPieData = () => {
    return getBugDevData().filter((item) => item.value > 0);
  };

  const getBugPriorityPieData = () => {
    return getBugPriorityData().filter((item) => item.value > 0);
  };

  const getBugTypePieData = () => {
    return getBugTypeData().filter((item) => item.value > 0);
  };

  const handleBugViewSelect = (option) => {
    setSelectedBugView(option.value);
  };

  const bugRateValue =
    bugClassificationData?.filter((item) => item.bugRate).map((item) => item.bugRate)[0] || {};
  const bugRatebyLOC =
    bugClassificationData
      ?.filter((item) => item.bugRateByLOC)
      .map((item) => item.bugRateByLOC)[0] || {};

  const [selectedBugRateClass, setSelectedBugRateClass] = useState({
    label: `By ${selectedTypeLabel}`,
    value: 'by_sprint',
  });

  const BugRateClassOptions = [
    {
      label: `By ${selectedTypeLabel}`,
      value: 'by_sprint',
    },
  ];

  const handleBugRateClassSelect = (option) => {
    setSelectedBugRateClass(option);
  };

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
            <div className="flex items-center justify-center border-b dark:border-[#25384F] pt-1 pb-4" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
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
                    <span className={`text-xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} mr-2`}>
                      {itemDetails.value}
                    </span>
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-lg`}>%</span>
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
                <div className="flex py-4 w-full">
                  <div className="space-y-2 text-sm w-full">
                    <div
                      className={`flex items-center justify-between gap-2 ${
                        theme === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-gray-300'
                      }`}
                    >
                      <span>Bug Rate By {selectedTypeLabel}</span>
                    </div>
                    <div
                      className={`flex justify-between ${
                        theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                      }`}
                    >
                      <span>Total Bugs In {selectedTypeLabel}</span>
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'
                        }`}
                      >
                        {bugRateValue?.totalBugs || 0}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between ${
                        theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                      }`}
                    >
                      <span>Total Issue In {selectedTypeLabel}</span>
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'
                        }`}
                      >
                        {bugRateValue?.totalTickets || 0}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between gap-2 border-t dark:border-[#25384F] ${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-gray-300'}`} style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
                      <span className="mt-4">Bug Rate By LOC</span>
                    </div>
                    <div className={`flex justify-between ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                      <span>Number Of Lines In Code</span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} font-semibold text-left min-w-[100px]`}>
                        {bugRatebyLOC.loc > 0 ? bugRatebyLOC.loc : 'Not Available'}
                      </span>
                    </div>
                    <div className={`flex justify-between ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                      <span className="flex gap-2">
                        Bug Rate By LOC
                        <span
                          data-tooltip-id={`tooltip-${itemDetails.name}tooltip-bug-rate-loc`}
                          data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                            getTooltipContent('Bug Rate By LOC'),
                          )}
                          data-tooltip-offset="15"
                          className="cursor-pointer"
                        >
                              <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                        </span>
                        <ReactTooltip
                          id={`tooltip-${itemDetails.name}tooltip-bug-rate-loc`}
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
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} font-semibold text-left min-w-[60px]`}>{bugRatebyLOC?.bugRateLoc || 0} %</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col text-sm py-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex justify-center ml-auto">
                    <DropdownButton
                      buttonLabel={`By ${selectedTypeLabel}`}
                      options={BugRateClassOptions}
                      onSelect={handleBugRateClassSelect}
                      value={selectedBugRateClass}
                      placeholder={`By ${selectedTypeLabel}`}
                      type="bySprint"
                      width="md"
                    />
                  </div>
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
                        data-tooltip-id={`tooltip-bug-classification`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-bug-classification`}
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
                      <span className={`text-xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} mr-2`}>
                        {itemDetails.value}%
                      </span>
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
                  
                  <div className="border-b dark:border-[#25384F] mb-4" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}></div>
                  
                  <div className="space-y-2">
                    <h3 className={`text-sm font-semibold mb-2 ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Bug Rate by {bugClassificationDataType}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                        Total Bugs In {bugClassificationDataType}
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[50px]`}>
                        {bugRatebyLOC.totalBugs || 0}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                        Total Issues In {bugClassificationDataType}
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[50px]`}>
                        {bugRateValue?.totalTickets || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-b dark:border-[#25384F] mb-4" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}></div>
                  
                  <div className="space-y-2">
                    <h3 className={`text-sm font-semibold mb-2 ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Bug Rate By LOC
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                        No. Of Lines In Code
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[100px]`}>
                        {bugRatebyLOC.loc > 0 ? bugRatebyLOC.loc : 'Not Available'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                        Bug Rate By LOC
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>
                        {bugRatebyLOC.bugRateLoc || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Bug Classification
                    </h2>
                    <div className="flex items-center gap-3">
                      <DropdownButton
                        buttonLabel="Select View"
                        options={bugViewOptions}
                        selectedOption={bugViewOptions.find((option) => option.value === selectedBugView)?.label}
                        onSelect={handleBugViewSelect}
                        width="lgx"
                      />
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
                  
                  <div className="flex-1">
                    {selectedBugView === 'sprint' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getBugSprintData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getBugSprintPieData().map(item => item.name)}
                                    dataPoints={getBugSprintPieData().map(item => item.value)}
                                    backgroundColors={getBugSprintPieData().map(item => item.color)}
                                    label="Bug Count"
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
                                  data={getBugSprintData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="bugClassificationDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : selectedBugView === 'dev' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getBugDevData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getBugDevPieData().map(item => item.name)}
                                    dataPoints={getBugDevPieData().map(item => item.value)}
                                    backgroundColors={getBugDevPieData().map(item => item.color)}
                                    label="Bug Count"
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
                                  data={getBugDevData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="bugClassificationDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : selectedBugView === 'priority' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getBugPriorityData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getBugPriorityPieData().map(item => item.name)}
                                    dataPoints={getBugPriorityPieData().map(item => item.value)}
                                    backgroundColors={getBugPriorityPieData().map(item => item.color)}
                                    label="Bug Count"
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
                                  data={getBugPriorityData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="bugClassificationDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {getBugTypeData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getBugTypePieData().map(item => item.name)}
                                    dataPoints={getBugTypePieData().map(item => item.value)}
                                    backgroundColors={getBugTypePieData().map(item => item.color)}
                                    label="Bug Count"
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
                                  data={getBugTypeData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="bugClassificationDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
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

BugRateClass.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};

export default BugRateClass;
