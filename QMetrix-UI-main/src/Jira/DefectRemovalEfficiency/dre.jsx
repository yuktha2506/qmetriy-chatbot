import { useState } from 'react';
import PropTypes from 'prop-types';
import LineChart from '../../Common/LineChart';
import PieChart from '../../Common/PieChart';
import BarChart from '../../Common/BarGraph';
import DropdownButton from '../../Common/DropDown';
import { useSelector } from 'react-redux';
// import Tooltip from '../../Common/ToolTip';
import DoughnutChart from '../../Common/DonutChart';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { InformationCircleIcon } from '@heroicons/react/outline';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import { getBoardLabels } from '../../../utils/boardUtils';

const ChartSection = ({ title, data }) => {
  const [selectedChartType, setSelectedChartType] = useState('bar');
  const rootStyles = getComputedStyle(document.documentElement);
  const theme = useSelector((state) => state.theme.theme);
  const themes = {
    light: {
      backgroundColor: 'white',
      labelColor: rootStyles.getPropertyValue('--label-color-light').trim(),
      gridColor: rootStyles.getPropertyValue('--grid-color-light').trim(),
      borderColor: rootStyles.getPropertyValue('--border-color-light').trim(),
      datalabelsColor: rootStyles.getPropertyValue('--datalabels-color-light').trim(),
      legendColor: rootStyles.getPropertyValue('--legend-color-light').trim(),
    },
    dark: {
      backgroundColor: '#2f3349',
      labelColor: rootStyles.getPropertyValue('--label-color-dark').trim(),
      gridColor: rootStyles.getPropertyValue('--grid-color-dark').trim(),
      borderColor: rootStyles.getPropertyValue('--border-color-dark').trim(),
      datalabelsColor: rootStyles.getPropertyValue('--datalabels-color-dark').trim(),
      legendColor: rootStyles.getPropertyValue('--legend-color-dark').trim(),
    },
  };

  const renderChart = (chartData, chartTitle) => {
    const labels = chartData.map((item) => item.name);
    const datasetData = chartData.map((item) => item.value);

    const getYAxisConfig = () => {
      return {
        beginAtZero: true,
        ticks: {
          stepSize: 20,
          callback: (value) => `${value}%`,
          color: themes[theme].labelColor,
        },
        title: {
          display: true,
          text: 'DRE (%)',
          color: themes[theme].labelColor,
        },
        grid: {
          display: false,
        },
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
      };
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        datalabels: {
          color: themes[theme].datalabelsColor,
          align: 'top',
          formatter: (value) => `${value}%`,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `DRE: ${context.parsed.y}%`;
            },
          },
        },
        title: {
          display: false,
        },
      },
      scales: {
        x: {
          border: {
            display: true,
            color: themes[theme].borderColor,
          },
          title: {
            display: true,
            text: chartTitle.includes('Release')
              ? 'Releases'
              : chartTitle.includes('Priority')
              ? 'Priorities'
              : 'Sprints',
            color: themes[theme].legendColor,
          },
          ticks: {
            color: themes[theme].labelColor,
          },
          grid: {
            display: false,
          },
        },
        y: getYAxisConfig(),
      },
    };

    switch (selectedChartType) {
      case 'bar':
        return (
          <BarChart
            labels={labels}
            datasetData={datasetData}
            datasetLabel={'DRE'}
            height={300}
            width={400}
            options={chartOptions}
          />
        );
      case 'line':
        return (
          <LineChart
            labels={labels}
            dataPoints={datasetData}
            label={'DRE'}
            tension={0.3}
            height={300}
            width={'100%'}
            options={chartOptions}
          />
        );
      case 'pie':
        return (
          <PieChart
            labels={labels}
            dataPoints={datasetData}
            label={'DRE'}
            height={250}
            width={400}
          />
        );
      case 'doughnut':
        return (
          <DoughnutChart
            labels={labels}
            dataPoints={datasetData}
            label={'DRE'}
            height={250}
            width={400}
          />
        );
      default:
        return null;
    }
  };

  const chartTypeOptions = [
    { label: 'Bar Chart', value: 'bar' },
    { label: 'Line Chart', value: 'line' },
    { label: 'Pie Chart', value: 'pie' },
    { label: 'Doughnut Chart', value: 'doughnut' },
  ];

  return (
    <div className="flex flex-col items-center p-2 dark:bg-[#182433] bg-light-100 rounded-lg shadow-md">
      <div className="flex justify-between w-full p-2">
        <h3 className="flex text-lg font-semibold dark:text-custom-gray text-[#202020]">{title}</h3>
        {data && data.length > 0 ? (
          <div className="flex w-auto">
            <DropdownButton
              buttonLabel={
                chartTypeOptions.find((option) => option.value === selectedChartType)?.label ||
                'Select Chart Type'
              }
              options={chartTypeOptions}
              selectedOption={
                chartTypeOptions.find((option) => option.value === selectedChartType)?.label
              }
              onSelect={(option) => setSelectedChartType(option.value)}
              placeholder="Select Chart"
            />
          </div>
        ) : (
          ''
        )}
      </div>
      {data && data.length > 0 ? (
        <div className="h-[300px] w-full p-2">{renderChart(data, title)}</div>
      ) : (
        <NoDataPlaceholder height={300} />
      )}
    </div>
  );
};

ChartSection.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      displayValue: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const DreChart = ({ layout, itemDetails }) => {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const defectRemovalEfficiencyData = jiraData?.defectRemovalEfficiencyData || [];
  const defectRemovalDataType = jiraData?.selectedValue || 'Sprint';
  const { sprintLabel, releaseLabel } = getBoardLabels();
  const selectedTypeLabel =
    String(defectRemovalDataType).toLowerCase() === 'release' ? releaseLabel : sprintLabel;

  // List view state
  const [selectedChartType, setSelectedChartType] = useState('line');
  const [selectedDreView, setSelectedDreView] = useState('sprint');
  const dreDatas = [
    {
      title: `Defect Removed In ${selectedTypeLabel}`,
      key: 'Days',
      value: `${Math.round(
        defectRemovalEfficiencyData[0]?.defectRemovalValue?.totalDefectBasedOnSelect ?? 0,
      )}`,
    },
    {
      title: `Prod Defect Found After ${releaseLabel}`,
      key: '',
      value: `${Math.round(
        defectRemovalEfficiencyData[0]?.defectRemovalValue?.totalDefectAfterProductRelease ?? 0,
      )}`,
    },
  ];
  const dreList = defectRemovalEfficiencyData[1]?.defectRemovalEfficiencyBySprintOrRelease ?? [];
  
  const averageDre = dreList.length
    ? Math.round(
        dreList.reduce((sum, item) => sum + item.defectRemovalPercentage, 0) / dreList.length,
      )
    : 0;

  // Dropdown options for list view
  const dreViewOptions = [
    {
      label: `DRE By ${selectedTypeLabel}`,
      value: 'sprint',
    },
    {
      label: 'DRE By Priority',
      value: 'priority',
    },
  ]; 

  const getDreSprintData = () => {
  const dsShades = ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8'];
  const list = Array.isArray(dreList)
    ? dreList
    : Array.isArray(dreList?.result)
    ? dreList.result
    : Array.isArray(dreList?.value)
    ? dreList.value
    : Array.isArray(dreList?.data)
    ? dreList.data
    : (dreList && typeof dreList === 'object' ? Object.values(dreList) : []);

  return list
    .map((item, index) => ({
      name: item.name,
      value: Math.round(item.defectRemovalPercentage || 0),
      color: dsShades[index % dsShades.length],
    }))
    .reverse();
};

  const getDrePriorityData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    const priorityData = defectRemovalEfficiencyData[2]?.defectRemovalEfficiencyByPriority?.defectRemovalPercentageByPriority || {};
    
    return Object.entries(priorityData).map(([priority, percentage], index) => ({
      name: priority,
      value: Math.round(parseFloat(percentage) || 0),
      color: dsShades[index % dsShades.length]
    }));
  };

  // Filtered data for pie charts only (remove items with no data)
  const getDreSprintPieData = () => {
    return getDreSprintData().filter((item) => item.value > 0);
  };

  const getDrePriorityPieData = () => {
    return getDrePriorityData().filter((item) => item.value > 0);
  };

  const handleDreViewSelect = (option) => {
    setSelectedDreView(option.value);
  };

  // const formatSprintData = (sprintData) => {
  //   return [...sprintData].reverse().map((item) => ({
  //     name: item.name,
  //     value: parseFloat(item.defectRemovalPercentage),
  //     displayValue: item.defectRemovalPercentage.toFixed(1),
  //   }));
  // };

  // const formatPriorityData = (priorityData) => {
  //   if (!priorityData?.defectRemovalPercentageByPriority) {
  //     return [];
  //   }
  //   return Object.entries(priorityData.defectRemovalPercentageByPriority).map(
  //     ([priority, percentage]) => ({
  //       name: priority,
  //       value: parseFloat(percentage),
  //       displayValue: `${parseFloat(percentage).toFixed(1)}%`,
  //     }),
  //   );
  // };

  // const sprintData = defectRemovalEfficiencyData[1]?.defectRemovalEfficiencyBySprintOrRelease || [];
  // const priorityData = defectRemovalEfficiencyData[2]?.defectRemovalEfficiencyByPriority || [];

  // const formattedSprintData = formatSprintData(sprintData);
  // const formattedPriorityData = formatPriorityData(priorityData);

  return (
    <div>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom:
              itemDetails.value !== undefined
                ? `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value)}`
                : 'none',
          }}
        >
          {/* Title and tooltip */}
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 my-2">
              <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                {itemDetails.name}
              </h2>
              <span
                data-tooltip-id={`tooltip-${itemDetails.name}`}
                data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                // data-tooltip-place={getTooltipPlacement(itemIndex + 1)}
                data-tooltip-offset="15"
                className="cursor-pointer"
              >
                <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
              </span>
              <ReactTooltip
                id={`tooltip-${itemDetails.name}`}
                // place={getTooltipPlacement(itemIndex + 1)}
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
                <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-lg`}>%</span>
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
              {dreDatas.map(({ title, value, key }) => (
                <div className="flex justify-between gap-2 items-center" key={key}>
                  <div className="flex gap-1">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{title}</span>
                  </div>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-b dark:border-[#25384F] py-3 mt-2 mb-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
              <div className="flex gap-1">
                <span
                  className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}
                >
                  Average DRE By {selectedTypeLabel}
                </span>
                <span
                  data-tooltip-id={`tooltip-${itemDetails.name}`}
                  data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                    getTooltipContent(`Average DRE By ${selectedTypeLabel}`),
                  )}
                  // data-tooltip-place={getTooltipPlacement(itemIndex + 1)}
                  data-tooltip-offset="15"
                  className="cursor-pointer"
                >
                  <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                </span>
                <ReactTooltip
                  id={`tooltip-${itemDetails.name}`}
                  // place={getTooltipPlacement(itemIndex + 1)}
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
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{averageDre} %</span>
            </div>
            <div className="flex flex-col justify-between max-h-28 overflow-y-auto">
              <span className={`${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'} font-semibold mb-2`}>DRE By Priority</span>
              {Object.entries(
                defectRemovalEfficiencyData[2]?.defectRemovalEfficiencyByPriority
                  ?.defectRemovalPercentageByPriority || {},
              ).map(([priority, percentage]) => (
                <div key={priority} className="flex justify-between">
                  <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{priority}</span>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{percentage} %</span>
                </div>
              )) || ' '}
            </div>
          </div>
        </div>
      ) : (
        // List View Implementation
        <div className="w-full">
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* Main Card */}
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
                        data-tooltip-id={`tooltip-dre`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-dre`}
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
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-lg`}>%</span>
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
                  <div className="border-b dark:border-[#25384F] mb-4" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}></div>
                  
                  {/* Metrics */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'
                        } text-sm`}
                      >
                        Defect Removed In {selectedTypeLabel}
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold`}>
                        {Math.round(defectRemovalEfficiencyData[0]?.defectRemovalValue?.totalDefectBasedOnSelect ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                        Prod Defect Found After Release
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold`}>
                        {Math.round(defectRemovalEfficiencyData[0]?.defectRemovalValue?.totalDefectAfterProductRelease ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chart Section */}
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Defect Removal Efficiency
                    </h2>
                    <div className="flex items-center gap-3">
                      <DropdownButton
                        buttonLabel={dreViewOptions.find(option => option.value === selectedDreView)?.label || 'Select View'}
                        options={dreViewOptions}
                        selectedOption={dreViewOptions.find(option => option.value === selectedDreView)?.label}
                        onSelect={handleDreViewSelect}
                        placeholder="Select View"
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
                    {selectedDreView === 'sprint' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              getDreSprintPieData().length > 0 ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DoughnutChart
                                  labels={getDreSprintPieData().map(item => item.name)}
                                  dataPoints={getDreSprintPieData().map(item => item.value)}
                                  backgroundColors={getDreSprintPieData().map(item => item.color)}
                                  label="DRE"
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
                                <NoDataPlaceholder height={200} />
                              )
                            ) : (
                              getDreSprintData().length > 0 ? (
                              <CustomLineBarChart
                                data={getDreSprintData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                showLine={selectedChartType === 'line'}
                                showBar={selectedChartType === 'bar'}
                                type="dreDistribution"
                              />
                              ) : (
                                <NoDataPlaceholder height={200} />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              getDrePriorityPieData().length > 0 ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DoughnutChart
                                  labels={getDrePriorityPieData().map(item => item.name)}
                                  dataPoints={getDrePriorityPieData().map(item => item.value)}
                                  backgroundColors={getDrePriorityPieData().map(item => item.color)}
                                  label="DRE By Priority"
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
                                <NoDataPlaceholder height={200} />
                              )
                            ) : (
                              getDrePriorityData().length > 0 ? (
                              <CustomLineBarChart
                                data={getDrePriorityData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                showLine={selectedChartType === 'line'}
                                showBar={selectedChartType === 'bar'}
                                type="dreDistribution"
                              />
                              ) : (
                                <NoDataPlaceholder height={200} />
                              )
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
    </div>
  );
};

DreChart.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};

export default DreChart;
