import { useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import DropdownButton from '../../Common/DropDown';
import BarChart from '../../Common/BarGraph';
import LineChart from '../../Common/LineChart';
import DoughnutChart from '../../Common/DonutChart';
import PieChart from '../../Common/PieChart';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon,DonutChartIcon } from '../../../utils/commonIcons';

const ChartSection = ({ data, title, theme }) => {
  const [selectedChartType, setSelectedChartType] = useState('bar');
  const rootStyles = getComputedStyle(document.documentElement);
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
  const voilet = rootStyles.getPropertyValue('--bar-color-primary').trim();

  const getChartData = (chartData) => {
    return chartData.map((obj) => ({
      name: obj.name,
      value: obj.defectDensityKLOC,
    }));
  };

  const renderChart = (chartData, chartTitle) => {
    const processedData = getChartData(chartData);
    const labels = processedData.map((item) => item.name);
    const datasetData = processedData.map((item) => item.value);

    const getYAxisConfig = () => {
      const maxValue = Math.max(...datasetData);
      const adjustedMax = (maxValue + 0.05).toFixed(1);

      return {
        beginAtZero: true,
        max: adjustedMax,
        ticks: {
          stepSize: 2,
          callback: (value) => value,
          color: themes[theme].labelColor,
        },
        title: {
          display: false,
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
      plugins: {
        legend: {
          display: false,
        },
        datalabels: {
          color: themes[theme].datalabelsColor,
          align: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              return `Defect Density: ${value}`;
            },
          },
        },
        title: {
          display: false,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: chartTitle.includes('Epic')
              ? 'Epics'
              : chartTitle.includes('UserStory')
              ? 'User Stories'
              : chartTitle.includes('Sprint')
              ? 'Sprints'
              : 'Releases',
            color: themes[theme].legendColor,
          },
          ticks: {
            color: themes[theme].labelColor,
          },
          grid: {
            display: false,
          },
          border: {
            display: true,
            color: themes[theme].borderColor,
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
            backgroundColors={voilet}
            borderColors={voilet}
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
            tension={0.3}
            height={300}
            width={'100%'}
            options={chartOptions}
          />
        );
      case 'doughnut':
        return (
          <DoughnutChart
            labels={labels}
            dataPoints={datasetData}
            tension={0.3}
            height={300}
            width={'100%'}
            options={''}
          />
        );
      case 'pie':
        return (
          <PieChart
            labels={labels}
            dataPoints={datasetData}
            tension={0.3}
            height={300}
            width={'100%'}
            options={''}
          />
        );
      default:
        return null;
    }
  };

  const chartTypeOptions = [
    { label: 'Bar Chart', value: 'bar' },
    { label: 'Line Chart', value: 'line' },
    { label: 'Doughnut Chart', value: 'doughnut' },
    { label: 'Pie Chart', value: 'pie' },
  ];

  return (
    <div className="flex flex-col p-4 dark:bg-[#182433] bg-light-100 rounded-lg shadow-md">
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-lg font-semibold dark:text-custom-gray text-[#202020]">{title}</h3>
        <div className="w-auto">
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
          />
        </div>
      </div>
      <div className="h-[300px] w-full">{renderChart(data, title)}</div>
    </div>
  );
};

ChartSection.propTypes = {
  data: PropTypes.array.isRequired,
  title: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
};

const DefectDensity = ({ layout, itemDetails }) => {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const defectDensity = jiraData?.defectDensityData || [];
  const defectDensityValue = jiraData?.selectedValue || 'Sprint';
  // Dynamic labels based on board type (Azure Boards => Iteration/Epic)
  const boardTypeSession = String(sessionStorage.getItem('boardType') || '').toLowerCase();
  const projects =
    jiraData?.projectList || jiraData?.getAllProjectList || jiraData?.getAllProjectsList || [];
  const hasAnyAzureBoard =
    boardTypeSession.includes('azure') ||
    (Array.isArray(projects) &&
      projects.some((p) => {
        const t = String(p?.boardType || p?.type || p?.projectTypeKey || '').toLowerCase();
        const self = String(p?.self || '').toLowerCase();
        return (
          t === 'azure board' ||
          t === 'azure-board' ||
          t.includes('azure') ||
          self.includes('dev.azure.com')
        );
      }));
  const sprintLabel = hasAnyAzureBoard ? 'Iteration' : 'Sprint';
  const releaseLabel = hasAnyAzureBoard ? 'Epic' : 'Release';
  const defectDensityLabel =
    String(defectDensityValue).toLowerCase() === 'release' ? releaseLabel : sprintLabel;
  const defectDensityDatas = [
    {
      title: 'Total Bugs',
      key: '',
      value: `${Math.round(defectDensity[0]?.defectDensity?.totalBugs ?? 0)}`,
    },
    {
      title: 'No. Of Lines Of Code',
      key: '',
      value: `${Math.round(defectDensity[0]?.defectDensity?.ncloc ?? 0)}`,
    },
  ];
  const defectDensityList = defectDensity[0]?.defectDensityBySprintOrRelease || [];
  
  const averageDefectDensity = defectDensityList.length
    ? Math.round(
        defectDensityList.reduce((sum, item) => sum + (item.defectDensityKLOC || item.defectDensity || 0), 0) /
          defectDensityList.length,
      )
    : 0;

  const [selectedChartType, setSelectedChartType] = useState('line');

  const getDefectDensityData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];

    return defectDensityList.map((item, index) => {
      const rawValue = item.defectDensityKLOC ?? item.defectDensity ?? item.value ?? 0;
      const numericValue = parseFloat(rawValue) || 0;
      return {
        name: item.name || `Item ${index + 1}`,
        value: numericValue,
        color: dsShades[index % dsShades.length]
      };
    }).reverse();
  };

  const getDefectDensityPieData = () => {
    return getDefectDensityData().filter((item) => parseFloat(item.value) > 0);
  };

  return (
    <>
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
                <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-sm`}>KLOC</span>
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

          <div className="flex flex-col border-t dark:border-[#25384F] pt-2 mt-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
            <div className="flex flex-col justify-between py-1 gap-2">
              {defectDensityDatas.map(({ title, value, key }) => (
                <div className="flex justify-between gap-2 items-center" key={key}>
                  <div className="flex gap-1">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{title}</span>
                  </div>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t dark:border-[#25384F] py-3 mt-2 mb-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
              <div className="flex gap-1">
                <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>
                  Average Defect Density By {defectDensityValue}
                </span>
                <span
                  data-tooltip-id={`tooltip-${itemDetails.name}`}
                  data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                    getTooltipContent(`Average Defect Density By ${defectDensityLabel}`),
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
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[80px]`}>{averageDefectDensity} KLOC</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="col-span-12 grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <div 
              className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-[10px] p-6 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md h-80"
              style={{
                borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
              }}
            >
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      {itemDetails.name}
                    </h2>
                    <span
                      data-tooltip-id={`tooltip-defect-density`}
                      data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                      data-tooltip-place="bottom"
                      data-tooltip-offset="15"
                      className="cursor-pointer"
                    >
                      <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                    </span>
                    <ReactTooltip
                      id={`tooltip-defect-density`}
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
                      <span className="text-xl font-semibold text-blue-400 mr-2">
                        {itemDetails.value}
                      </span>
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

                {/* Header line */}
                  <div className="border-t dark:border-[#25384F] pt-4 mt-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}></div>

                {/* Metrics Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`${
                        theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                      } text-sm`}
                    >
                      Total Defects In {defectDensityLabel}
                    </span>
                    <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                      {Math.round(defectDensity[0]?.defectDensity?.totalBugs ?? 0)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm`}>
                      Number Of Lines In Code
                    </span>
                    <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                      {Math.round(defectDensity[0]?.defectDensity?.ncloc ?? 0)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm`}>
                      Defect Density By KLOC
                    </span>
                    <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[60px]`}>
                      {defectDensity[0]?.defectDensity?.defectDensity 
                        ? parseFloat(defectDensity[0].defectDensity.defectDensity).toFixed(2)
                        : '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section - 8 columns */}
          <div className="col-span-8">
            <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-[10px] p-6 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md h-80">
              <div className="h-full flex flex-col">
                {/* Chart Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className={`text-lg font-semibold ${
                      theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'
                    }`}
                  >
                    Defect Density By {defectDensityLabel}
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Chart Type Buttons */}
                    <div className="flex items-center space-x-2">
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
                            : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover-border-[#6C7A91B2]'
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
                <div className="h-64">
                  {defectDensityList.length > 0 ? (
                    <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '100%' }}>
                      <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                        {selectedChartType === 'pie' ? (
                          getDefectDensityPieData().length > 0 ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <DoughnutChart
                                labels={getDefectDensityPieData().map(item => item.name)}
                                dataPoints={getDefectDensityPieData().map(item => item.value)}
                                backgroundColors={getDefectDensityPieData().map(item => item.color)}
                                label="Defect Density"
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
                                          const value = context.parsed;
                                          return `Defect Density: ${value.toFixed(2)}`;
                                        },
                                      },
                                    },
                                  },
                                }}
                              />
                            </div>
                          ) : (
                            <NoDataPlaceholder height={220} />
                          )
                        ) : (
                          <CustomLineBarChart
                            data={getDefectDensityData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                            showLine={selectedChartType === 'line'}
                            showBar={selectedChartType === 'bar'}
                            type="defectDensityDistribution"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <NoDataPlaceholder height={220} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DefectDensity;

DefectDensity.propTypes = {
  defectDensity: PropTypes.array.isRequired,
  defectDensityValue: PropTypes.array.isRequired,
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};
