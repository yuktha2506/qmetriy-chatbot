import { FaInfoCircle } from 'react-icons/fa';
import { Bar, Line } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);
import TooltipIcon from "../../../../utils/TooltipIcon";
import ReactDOMServer from "react-dom/server";
import getTooltipContent from '../../../../utils/Tooltip';
import tableDataConfig from '../../../../utils/tableDataConfig';
import { useState } from 'react';
import { BarChartIcon, LineChartIcon } from '../../../../utils/commonIcons';
import CustomLineBarChart from '../../../../utils/CustomLineBarChart';
import NoDataPlaceholder from '../../../Common/NoDataPlaceholder';

const rootStyles = getComputedStyle(document.documentElement);
const colors = [
  rootStyles.getPropertyValue('--bar-color-primary').trim(),
  rootStyles.getPropertyValue('--bar-color-secondary').trim(),
  rootStyles.getPropertyValue('--bar-color-tertiary').trim(),
  rootStyles.getPropertyValue('--bar-color-quaternary').trim(),
  rootStyles.getPropertyValue('--bar-color-quinary').trim(),
  rootStyles.getPropertyValue('--bar-color-senary').trim(),
];

const chartThemes = (theme, rootStyles) => {
  return {
    light: {
      backgroundColor: 'white',
      labelColor: rootStyles.getPropertyValue('--label-color-light').trim(),
      gridColor: rootStyles.getPropertyValue('--grid-color-light').trim(),
      datalabelsColor: rootStyles.getPropertyValue('--datalabels-color-light').trim(),
      legendColor: rootStyles.getPropertyValue('--legend-color-light').trim(),
    },
    dark: {
      backgroundColor: '#2f3349',
      labelColor: rootStyles.getPropertyValue('--label-color-dark').trim(),
      gridColor: rootStyles.getPropertyValue('--grid-color-dark').trim(),
      datalabelsColor: rootStyles.getPropertyValue('--datalabels-color-dark').trim(),
      legendColor: rootStyles.getPropertyValue('--legend-color-dark').trim(),
    },
  }[theme];
};

const generateChartData = (labels, data, label, colors) => {
  return {
    labels,
    datasets: [
      {
        label,
        data,
        backgroundColor: colors,
        borderColor: colors[0],
        tension: 0.3,
        fill: false,
      },
    ],
  };
};

const generateChartOptions = (theme, rootStyles) => {
  const themes = chartThemes(theme, rootStyles);

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: themes.legendColor,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      datalabels: {
        color: themes.datalabelsColor,
      },
    },
    scales: {
      x: {
        ticks: { color: themes.labelColor },
        grid: { display: false },
      },
      y: {
        ticks: { color: themes.labelColor },
        grid: { display: false },
      },
    },
    elements: {
      point: {
        radius: 4,
      },
    },
  };
};

export function CodeCoverage() {
  const [chartType, setChartType] = useState('bar');
  const theme = useSelector((state) => state.theme.theme);
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const lineLabels = [
    'Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16',
  ];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const transformedLineDataForCustom = lineLabels.map((label, index) => ({
    day: label,
    codecoveragevalue: lineData[index],
    codecoveragevalueColor: seriesColor,
  }));

  const barLabels = [
    'Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16', 'Oct 22', 'Oct 24', 'Oct 25',
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedBarDataForCustom = barLabels.map((label, index) => ({
    day: label,
    codecoveragevalue: barData[index],
    codecoveragevalueColor: seriesColor,
  }));

  return (

    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className={`text-lg mr-4 ${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-[#e5e7eb]'}`}>
            Code Coverage: 15 days trend                    </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("line")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Line Chart
            </div>
          </div>
          <div className="relative group">
            <BarChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "bar"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("bar")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Bar Chart
            </div>
          </div>
        </div>
      </div>
      <div className="w-full" style={{ height: "320px" }}>
        {(!transformedLineDataForCustom || transformedLineDataForCustom.length === 0 || !transformedBarDataForCustom || transformedBarDataForCustom.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart data={transformedLineDataForCustom} showLine={true} showBar={false} type={'codeCoverage'} />
        ) : (
          <CustomLineBarChart data={transformedBarDataForCustom} showLine={false} showBar={true} type={'codeCoverage'} />
        )}
      </div>
    </div>
  );
}

export function DefectDensity() {
  const [chartType, setChartType] = useState('bar');
  const theme = useSelector((state) => state.theme.theme);
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const lineLabels = [
    'Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16',
  ];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const transformedLineDataForCustom = lineLabels.map((label, index) => ({
    day: label,
    defectdensityvalue: lineData[index],
    defectdensityvalueColor: seriesColor,
  }));

  const barLabels = [
    'Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16', 'Oct 22', 'Oct 24', 'Oct 25',
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedBarDataForCustom = barLabels.map((label, index) => ({
    day: label,
    defectdensityvalue: barData[index],
    defectdensityvalueColor: seriesColor,
  }));

  return (
    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className={`text-lg mr-4 ${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-[#e5e7eb]'}`}>
            Defect Density: 15 days trend              </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("line")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Line Chart
            </div>
          </div>
          <div className="relative group">
            <BarChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "bar"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("bar")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Bar Chart
            </div>
          </div>
        </div>
      </div>
      <div className="w-full" style={{ height: "320px" }}>
        {(!transformedLineDataForCustom || transformedLineDataForCustom.length === 0 || !transformedBarDataForCustom || transformedBarDataForCustom.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart data={transformedLineDataForCustom} showLine={true} showBar={false} type={'defectDensity'} />
        ) : (
          <CustomLineBarChart data={transformedBarDataForCustom} showLine={false} showBar={true} type={'defectDensity'} />
        )}
      </div>
    </div>
  );
}
DefectDensity.propTypes = {
  defectDensity: PropTypes.object.isRequired,
};
export function ReleaseCycleTime() {
  const [chartType, setChartType] = useState('bar');
  const theme = useSelector((state) => state.theme.theme);
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const lineLabels = [
    'Sept 25',
    'Sept 26',
    'Sept 30',
    'Oct 01',
    'Oct 03',
    'Oct 07',
    'Oct 08',
    'Oct 16',
  ];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const transformedLineDataForCustom = lineLabels.map((label, index) => ({
    day: label,
    cycletimevalue: lineData[index],
    cycletimevalueColor: seriesColor,
  }));

  const barLabels = [
    'Sept 25',
    'Sept 26',
    'Sept 30',
    'Oct 01',
    'Oct 03',
    'Oct 07',
    'Oct 08',
    'Oct 16',
    'Oct 22',
    'Oct 24',
    'Oct 25',
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedBarDataForCustom = barLabels.map((label, index) => ({
    day: label,
    cycletimevalue: barData[index],
    cycletimevalueColor: seriesColor,
  }));

  return (

    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className={`text-lg mr-4 ${useSelector((state)=>state.theme.theme) === 'light' ? 'text-[#0A2342] font-semibold' : 'dark:text-[#e5e7eb]'}`}>
            Cycle Time: 15 days trend
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("line")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Line Chart
            </div>
          </div>
          <div className="relative group">
            <BarChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "bar"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("bar")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Bar Chart
            </div>
          </div>
        </div>
      </div>
      <div className="w-full" style={{ height: "320px" }}>
        {(!transformedLineDataForCustom || transformedLineDataForCustom.length === 0 || !transformedBarDataForCustom || transformedBarDataForCustom.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart
            data={transformedLineDataForCustom}
            showLine={true}
            showBar={false}
            type={'cycleTime'}
          />
        ) : (
          <CustomLineBarChart
            data={transformedBarDataForCustom}
            showLine={false}
            showBar={true}
            type={'cycleTime'}
          />
        )}
      </div>
    </div>
  );
}

ReleaseCycleTime.propTypes = {
  cycleTime: PropTypes.object.isRequired,
};

export function ReworkRatio() {
  const data = [
    {
      title: 'Total Lines of Code Requiring Rework',
      trendValue: 0,
      className: 'total-release-cycle-time',
      tooltip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Total Lines of Code Requiring Rework`, tableDataConfig[`Total Lines of Code Requiring Rework`])),
    },
    { title: 'Total lines of Code', trendValue: 0, className: 'total-number-of-releases', tooltip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Total lines of Code`, tableDataConfig[`Total lines of Code`])), },
  ];

  const theme = useSelector((state) => state.theme.theme);
  const lineLabels = [
    'Sept 25',
    'Sept 26',
    'Sept 30',
    'Oct 01',
    'Oct 03',
    'Oct 07',
    'Oct 08',
    'Oct 16',
  ];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const lineChartData = generateChartData(lineLabels, lineData, 'Testing-Productivity', colors);

  const barLabels = [
    'Sept 25',
    'Sept 26',
    'Sept 30',
    'Oct 01',
    'Oct 03',
    'Oct 07',
    'Oct 08',
    'Oct 16',
    'Oct 22',
    'Oct 24',
    'Oct 25',
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  const barChartData = generateChartData(barLabels, barData, 'Testing-Productivity', colors);
  const lineChartOptions = generateChartOptions(theme, rootStyles);

  return (
    <div className="pt-4 pb-5 pl-2 pr-2 bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] mt-1 rounded-md">
      <h3 className="text-2xl text-[#202020] dark:text-[#d1d5db] pl-2">Rework Ratio Detailed View</h3>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {data.map((item, index) => (
          <div
            key={index}
            className={`rounded-lg p-4 w-full bg-gray-100 dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] shadow-lg flex flex-col justify-between transition-opacity duration-300 ease-in-out metric-card ${item.className}`}
          >
            <div className="text-black dark:text-[#C8C8C8] text-md flex justify-between items-center mb-3">
              {item.title}
              <TooltipIcon title={item.title} tooltip={item.tooltip} theme={theme} placement="top" />
            </div>
            <span className="flex text-3xl text-custom-black dark:text-custom-white">
              {item.trendValue}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 mt-9">
        <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full shadow-lg flex flex-col justify-between">
          <h2 className="text-[#202020] dark:text-[#d1d5db] text-lg mb-2 text-center">15 days trend</h2>
          <div className="h-64 overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
            <div style={{ minWidth: '800px', height: '100%' }}>
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full shadow-lg flex flex-col justify-between">
          <h2 className="text-[#202020] dark:text-[#d1d5db] text-lg mb-2 text-center">15 days Trend</h2>
          <div className="h-64 overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
            <div style={{ minWidth: '800px', height: '100%' }}>
              <Bar data={barChartData} options={lineChartOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimeToFix({ timeToFix }) {
  const data = [
    {
      title: 'Total Number of Resolved Bugs',
      tooltip: `The total count of bugs that have been identified, fixed, and closed.`,
      trendValue: timeToFix?.totalResolvedBugs ? timeToFix?.totalResolvedBugs : 0,
      className: 'total-release-cycle-time',
    },
    {
      title: 'Total Effort Spent',
      tooltip: `The cumulative time and resources invested in completing tasks, including development, debugging, and testing.`,
      trendValue: timeToFix?.totalTimeSpent ? `${timeToFix?.totalTimeSpent} Days` : '0 Days',
      className: 'total-number-of-releases',
    },
  ];

  const theme = useSelector((state) => state.theme.theme);
  const lineLabels = [
    'Sept 25',
    'Sept 26',
    'Sept 30',
    'Oct 01',
    'Oct 03',
    'Oct 07',
    'Oct 08',
    'Oct 16',
  ];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const lineChartData = generateChartData(lineLabels, lineData, 'Testing-Productivity', colors);

  const barLabels = [
    'Sept 25',
    'Sept 26',
    'Sept 30',
    'Oct 01',
    'Oct 03',
    'Oct 07',
    'Oct 08',
    'Oct 16',
    'Oct 22',
    'Oct 24',
    'Oct 25',
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  const barChartData = generateChartData(barLabels, barData, 'Testing-Productivity', colors);
  const lineChartOptions = generateChartOptions(theme, rootStyles);
  return (
    <div className="pt-4 pb-5 pl-2 pr-2 bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] mt-1 rounded-md">
      <h3 className="text-2xl text-[#202020] dark:text-[#d1d5db] pl-2">Time To Fix Detailed View</h3>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {data.map((item, index) => (
          <div
            key={index}
            className={`rounded-lg p-4 w-full bg-gray-100 dark:bg-gray-700 border border-[#D1E2F0] dark:border-[#25384F] shadow-lg flex flex-col justify-between transition-opacity duration-300 ease-in-out metric-card ${item.className}`}
          >
            <div className="text-black dark:text-[#C8C8C8] text-md flex justify-between items-center mb-3">
              {item.title}
              {item.tooltip && (
                <span className="ml-2 relative group">
                  <FaInfoCircle className="text-gray-500 dark:text-gray-400 cursor-pointer" />
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-48 p-1 text-xs text-white bg-gray-700 dark:bg-gray-800 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {item.tooltip}
                  </span>
                </span>
              )}
            </div>
            <span className="flex text-3xl text-custom-black dark:text-custom-white">
              {item.trendValue}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 mt-9">
        <div className="bg-white dark:bg-secondary-500 border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full shadow-lg flex flex-col justify-between">
          <h2 className="text-[#202020] dark:text-[#d1d5db] text-lg mb-2 text-center">15 days trend</h2>
          <div className="h-64 overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
            <div style={{ minWidth: '800px', height: '100%' }}>
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-secondary-500 border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full shadow-lg flex flex-col justify-between">
          <h2 className="text-[#202020] dark:text-[#d1d5db] text-lg mb-2 text-center">15 days Trend</h2>
          <div className="h-64 overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
            <div style={{ minWidth: '800px', height: '100%' }}>
              <Bar data={barChartData} options={lineChartOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

TimeToFix.propTypes = {
  timeToFix: PropTypes.object.isRequired,
};
