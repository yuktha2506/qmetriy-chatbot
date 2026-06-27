import { useState, useEffect } from 'react';
import React from 'react';
import PropTypes from 'prop-types';
import { Bar } from 'react-chartjs-2';
import { useDispatch, useSelector } from 'react-redux';
import { setLastSyncedForProject } from '../../../store/JiraSlices/jiraSlice';
import axiosInstance from '../../../axiosInstance';
import DropdownButton from '../../Common/DropDown';
import BetaDataCard from '../BetaDataCard';
import { getId } from '../../../constants';
import getTooltipContent from '../../../utils/Tooltip';
import { processBurndownData as commonProcessBurndownData } from '../../../utils/burndownUtils';
import ReactDOMServer from 'react-dom/server';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { LineChartIcon, BarChartIcon } from '../../../utils/commonIcons';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
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

function AutomationDoneComponent({
  automationData,
  chartTitle = 'Automation Test Result',
  widgetHeightClass = 'h-[144px]',
  showNoDataPlaceholder = true,
  chartAreaClass = 'w-full flex justify-center items-center',
}) {
    const theme = useSelector((state) => state.theme.theme);
    const automationArray = Array.isArray(automationData)
    ? automationData
    : automationData && typeof automationData === 'object' && Object.keys(automationData).length > 0
    ? [automationData]
    : [];
  const DataCard1 = ({ blockedValue, failedValue, passedValue, untestedValue, retestValue }) => {
    const noData =
      blockedValue === 0 && failedValue === 0 && passedValue === 0 && untestedValue === 0 &&retestValue===0;

    const data = {
      labels: [''],
      datasets: [
        {
          label: 'Blocked',
          data: [blockedValue],
          backgroundColor: '#6CC7D1',
          hoverBackgroundColor: '#6CC7D1',
        },
        {
          label: 'Failed',
          data: [failedValue],
          backgroundColor: '#43AAB5',
          hoverBackgroundColor: '#43AAB5',
        },
        {
          label: 'Passed',
          data: [passedValue],
          backgroundColor: '#128490',
          hoverBackgroundColor: '#128490',
        },
        {
          label: 'Untested',
          data: [untestedValue],
          backgroundColor: '#18676F',
          hoverBackgroundColor: '#18676F',
        },
        {
         label: 'Retested',
         data: [retestValue], 
         backgroundColor: '#0C4A52',
         hoverBackgroundColor: '#0C4A52',
      }
      ],
    };

    return (
      <div className="w-full">
        <div className="grid grid-cols-1 gap-4 w-full">
          <div className={`dark:bg-[#182433] bg-[#FFFFFF] border dark:border-[#25384F] border-[#D1E2F0] rounded-lg p-4 w-full ${widgetHeightClass} dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]`}>
            <div className="items-center">
              <div className="flex items-center space-x-4">
                <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-gray-800 dark:text-gray-200'}`}>
                  {chartTitle}
                </h2>
              </div>
            </div>
            <div className={chartAreaClass} style={{ height: '90px' }}>
              {noData ? (
                showNoDataPlaceholder ? <NoDataPlaceholder height={90} /> : null
              ) : (
                <Bar
                  data={data}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    barThickness: 20,
                    layout: {
                      padding: 0,
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                          boxWidth: 12,
                          padding: 10,
                          color: theme === 'light' ? '#24527A' : '#d1d5db',
                          usePointStyle: true,
                          pointStyle: 'circle',
                        },
                      },
                      datalabels: {
                        anchor: 'center',
                        align: 'center',
                        color: '#ffffff',
                        font: {
                          weight: 'bold',
                        },
                        formatter: (value) => {
                          return value > 0 ? value : '';
                        },
                      },
                      tooltip: {
                        enabled: true,
                      },
                    },
                    scales: {
                      x: {
                        stacked: true,
                        ticks: {
                          display: false,
                        },
                        grid: {
                          display: false,
                          drawBorder: false,
                          drawTicks: false,
                        },
                      },
                      y: {
                        stacked: true,
                        grid: {
                          display: false,
                          drawBorder: false,
                          drawTicks: false,
                        },
                        ticks: {
                          display: false,
                        },
                      },
                    },
                    drawTicks: false,
                  }}
                  plugins={[ChartDataLabels]}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  DataCard1.propTypes = {
    title: PropTypes.string.isRequired,
    blockedValue: PropTypes.number.isRequired,
    failedValue: PropTypes.number.isRequired,
    passedValue: PropTypes.number.isRequired,
    untestedValue: PropTypes.number.isRequired,
    retestValue:PropTypes.number.isRequired,
    toolTip: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-5 w-full">
      {(automationArray.length > 0
          ? automationArray
          : [{ name: 'Automation Test Result', blocked: 0, failed: 0, passed: 0, untested: 0 ,retest:0}]
        ).map((item, index) => (
          <div key={item.name || index} className="w-[100%]">
            <DataCard1
              title={item.name}
              blockedValue={item.blocked}
              failedValue={item.failed}
              passedValue={item.passed}
              untestedValue={item.untested}
              retestValue={item.retest}
              toolTip="The outcome of executing test cases using automated tools or scripts."
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

AutomationDoneComponent.propTypes = {
  automationData: PropTypes.any.isRequired,
  chartTitle: PropTypes.string,
  widgetHeightClass: PropTypes.string,
  showNoDataPlaceholder: PropTypes.bool,
  chartAreaClass: PropTypes.string,
};
export const AutomationDone = React.memo(AutomationDoneComponent, (prevProps, nextProps) => {
  return (
    prevProps.chartTitle === nextProps.chartTitle
    && prevProps.widgetHeightClass === nextProps.widgetHeightClass
    && prevProps.showNoDataPlaceholder === nextProps.showNoDataPlaceholder
    && prevProps.chartAreaClass === nextProps.chartAreaClass
    && JSON.stringify(prevProps.automationData) === JSON.stringify(nextProps.automationData)
  );
});

function ManualDoneComponent({
  manualData,
  chartTitle = 'Manual Test Result',
  widgetHeightClass = 'h-[144px]',
  showNoDataPlaceholder = true,
  chartAreaClass = 'w-full flex justify-center items-center',
}) {
   const theme = useSelector((state) => state.theme.theme);
   const manualArray = Array.isArray(manualData)
    ? manualData
    : manualData && typeof manualData === 'object' && Object.keys(manualData).length > 0
    ? [manualData]
    : [];
  const DataCard1 = ({ blockedValue, failedValue, passedValue, untestedValue, retestValue }) => {
    const noData =
      blockedValue === 0 && failedValue === 0 && passedValue === 0 && untestedValue === 0 && retestValue ===0;

    const data = {
      labels: [''],
      datasets: [
        {
          label: 'Blocked',
          data: [blockedValue],
          backgroundColor: '#8C80F9',
          hoverBackgroundColor: '#8C80F9',
        },
        {
          label: 'Failed',
          data: [failedValue],
          backgroundColor: '#685BDB',
          hoverBackgroundColor: '#685BDB',
        },
        {
          label: 'Passed',
          data: [passedValue],
          backgroundColor: '#5145BA',
          hoverBackgroundColor: '#5145BA',
        },
        {
          label: 'Untested',
          data: [untestedValue],
          backgroundColor: '#372B9E',
          hoverBackgroundColor: '#372B9E',
        },
        {
  label: 'Retested',
  data: [retestValue], 
  backgroundColor: '#2B237E',
  hoverBackgroundColor: '#2B237E',
}
      ],
    };

    return (
      <div className="w-full">
        <div className="grid grid-cols-1 gap-4 w-full">
          <div className={`dark:bg-[#182433] bg-[#FFFFFF] border dark:border-[#25384F] border-[#D1E2F0] rounded-lg p-4 w-full ${widgetHeightClass} dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]`}>
            <div className="items-center">
              <div className="flex items-center space-x-4">
                <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-gray-800 dark:text-gray-200'}`}>
                  {chartTitle}
                </h2>
              </div>
            </div>
            <div className={chartAreaClass} style={{ height: '90px' }}>
              {noData ? (
                showNoDataPlaceholder ? <NoDataPlaceholder height={90} /> : null
              ) : (
                <Bar
                  data={data}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    barThickness: 20,
                    layout: {
                      padding: 0,
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                          boxWidth: 12,
                          padding: 10,
                          color: theme === 'light' ? '#24527A' : '#d1d5db',
                          usePointStyle: true,
                          pointStyle: 'circle',
                        },
                      },
                      datalabels: {
                        anchor: 'center',
                        align: 'center',
                        color: '#ffffff',
                        font: {
                          weight: 'bold',
                        },
                        formatter: (value) => {
                          return value > 0 ? value : '';
                        },
                      },
                      tooltip: {
                        enabled: true,
                      },
                    },
                    scales: {
                      x: {
                        stacked: true,
                        ticks: {
                          display: false,
                        },
                        grid: {
                          display: false,
                          drawBorder: false,
                          drawTicks: false,
                        },
                      },
                      y: {
                        stacked: true,
                        grid: {
                          display: false,
                          drawBorder: false,
                          drawTicks: false,
                        },
                        ticks: {
                          display: false,
                        },
                      },
                    },
                    drawTicks: false,
                  }}
                  plugins={[ChartDataLabels]}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  DataCard1.propTypes = {
    title: PropTypes.string.isRequired,
    blockedValue: PropTypes.number.isRequired,
    failedValue: PropTypes.number.isRequired,
    passedValue: PropTypes.number.isRequired,
    untestedValue: PropTypes.number.isRequired,
    retestValue: PropTypes.number.isRequired,
    toolTip: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-5 w-full">
         {(manualArray.length > 0
          ? manualArray
          : [{ name: 'Manual Test Result', blocked: 0, failed: 0, passed: 0, untested: 0 ,retest:0}]
        ).map((item, index) => (
          <div key={item.name || index} className="w-[100%]">
            <DataCard1
              title={item.name}
              blockedValue={item.blocked}
              failedValue={item.failed}
              passedValue={item.passed}
              untestedValue={item.untested}
              retestValue={item.retest}
              toolTip="The outcome of testing a software application without using any automation tools."
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ManualDoneComponent;

ManualDoneComponent.propTypes = {
  manualData: PropTypes.any.isRequired,
  chartTitle: PropTypes.string,
  widgetHeightClass: PropTypes.string,
  showNoDataPlaceholder: PropTypes.bool,
  chartAreaClass: PropTypes.string,
};

export const ManualDone = React.memo(ManualDoneComponent, (prevProps, nextProps) => {
  return (
    prevProps.chartTitle === nextProps.chartTitle
    && prevProps.widgetHeightClass === nextProps.widgetHeightClass
    && prevProps.showNoDataPlaceholder === nextProps.showNoDataPlaceholder
    && prevProps.chartAreaClass === nextProps.chartAreaClass
    && JSON.stringify(prevProps.manualData) === JSON.stringify(nextProps.manualData)
  );
});
export function BurnDown({ burndownData, isStoryPoints }) {
  const [chartType, setChartType] = useState('bar');
  const [chartMode, setChartMode] = useState('Days');
  const [actualStory, setActualStory] = useState([]);
  const [lastLoggedDate, setLastLoggedDate] = useState(null);
  const cxoData = useSelector((state) => state.cxo || {});
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    if (cxoData) {
      setActualStory(cxoData.actualStoryPoints || []);
    }
  }, [cxoData]);
  const data = [
    {
      title: 'Original Estimate',
      hrsValue: isStoryPoints ? burndownData?.originalEstimate : burndownData?.originalEstimateHrs,
      unit: isStoryPoints ? 'story points' : 'hrs',
      className: 'original-estimate',
      toolTip: isStoryPoints
        ? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Original Estimate Story Points`))
        : ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Original Estimate Hours`)),
    },
    {
      title: 'Effort Spent',
      hrsValue: isStoryPoints ? burndownData?.totalSpent : burndownData?.timeSpentHrs,
      unit: isStoryPoints ? 'story points' : 'hrs',
      className: 'effort-spent',
      toolTip: isStoryPoints
        ? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Effort Spent Story Points`))
        : ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Effort Spent Hours`)),
    },
  ];

  {
    data.map((metric, index) => (
      <div key={index} className="w-full">
        <BetaDataCard
          title={metric.title}
          trendValue={metric.hrsValue}
          toolTip={metric.toolTip}
          index={index}
          color="#08000000"
          unit={metric.unit}
        />
      </div>
    ));
  }

  const companyId = getId().companyId;
  const projectId = getId().projectId
  const lastSyncedByProjectId = useSelector((state) => state.jira?.lastSyncedByProjectId || {});
  const dispatch = useDispatch();

  const getLastSyncedFromCache = () => {
    if (!companyId || !projectId) return null;
    const timeKey = `lastSyncTime_${companyId}_${projectId}`;
    const cachedTime = sessionStorage.getItem(timeKey);
    if (cachedTime) {
      const rawDate = cachedTime.split(',')[0];
      const [day, month, year] = rawDate.split('/');
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const getLastSyncedFromAPI = async () => {
    try {
      if (!companyId || !projectId) return null;
      const response = await axiosInstance.get(`/api/jira/getLastSynced/${companyId}/${projectId}`);
      const lastSynced = response?.data?.lastSynced;
      if (!lastSynced) return null;
      const rawDate = lastSynced.split(',')[0];
      const [day, month, year] = rawDate.split('/');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error fetching last synced data:', error);
      return null;
    }
  };

  useEffect(() => {
    const cachedFromStore = lastSyncedByProjectId?.[projectId]?.lastSynced;
    const formatCached = (value) => {
      if (!value) return null;
      if (String(value).includes('/')) {
        const rawDate = String(value).split(',')[0];
        const [day, month, year] = rawDate.split('/');
        return `${year}-${month}-${day}`;
      }
      return value;
    };
    const cached = formatCached(cachedFromStore) || getLastSyncedFromCache();
    if (cached) {
      setLastLoggedDate(cached);
    } else {
      getLastSyncedFromAPI().then((date) => {
        if (date) {
          setLastLoggedDate(date);
          dispatch(setLastSyncedForProject({ projectId, lastSynced: date }));
        }
      });
    }
  }, [dispatch, lastSyncedByProjectId, projectId]);

  const burndownChartData = commonProcessBurndownData({
    burndowndata: burndownData,
    actualStory,
    isStoryPoints,
    jiraData: { Sprint: {}, Release: {} }, // RRLevel2 doesn't have jiraData structure
    selectedDeveloper: null, // RRLevel2 doesn't have selectedDeveloper
    getCapacity: 0, // RRLevel2 doesn't have capacity logic
    lastLoggedDate
  });

  const chartOptions = [
    { label: '7', value: '7' },
    { label: '15', value: '15' },
    { label: '30', value: '30' },
  ];

  const chartData = burndownChartData.map((item) => ({
    day: item.day,
    ideal: item.ideal,
    actual: item.actual,
    idealColor: '#5580A6',
    actualColor: '#F5AF33',
  }));
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-4 w-full">
        <div className={`dark:bg-[#182433] bg-[#FFFFFF] border dark:border-[#25384F] border-[#D1E2F0] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]`}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-gray-800 dark:text-gray-200'} mr-4`}>Burndown</h2>
            </div>
            <div className="flex">
              <DropdownButton
                buttonLabel={chartMode === 'Days' ? 'Days' : 'Week'}
                options={chartOptions}
                selectedOption={chartOptions.find((option) => option.value === chartMode)?.label}
                placeholder="Days"
                onSelect={(option) => setChartMode(option.value)}
                width="sm"
              />
              <div className="flex items-center space-x-2 ml-2">
                <div className="relative group">
                  <LineChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      chartType === 'Line'
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setChartType('Line')}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Line Chart
                  </div>
                </div>
                <div className="relative group">
                  <BarChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      chartType === 'bar'
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setChartType('bar')}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Bar Chart
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full" style={{ height: '180px' }}>
            {chartType === 'Line' ? (
              <CustomLineBarChart
                data={chartData}
                showLine={true}
                showBar={false}
                type={'burndown'}
              />
            ) : (
              <CustomLineBarChart
                data={chartData}
                showLine={false}
                showBar={true}
                type={'burndown'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

BurnDown.propTypes = {
  burndownData: PropTypes.shape({
    originalEstimate: PropTypes.number,
    totalSpent: PropTypes.number,
    originalEstimateHrs: PropTypes.number,
    timeSpentHrs: PropTypes.number,
  }).isRequired,
  isStoryPoints: PropTypes.bool.isRequired,
};
export function TestCoverage() {
  const [chartType, setChartType] = useState('bar');
  const [chartMode, setChartMode] = useState('Days');
  const theme = useSelector((state) => state.theme.theme);

  const chartOptions = [
    { label: '7', value: '7' },
    { label: '15', value: '15' },
    { label: '30', value: '30' },
  ];
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-4 w-full">
        <div className={`dark:bg-[#182433] bg-[#FFFFFF] border dark:border-[#25384F] border-[#D1E2F0] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-gray-800 dark:text-gray-200'} mr-4`}>Test Coverage</h2>
            </div>
            <div className="flex">
              <DropdownButton
                buttonLabel={chartMode === 'Days' ? 'Days' : 'Week'}
                options={chartOptions}
                selectedOption={chartOptions.find((option) => option.value === chartMode)?.label}
                placeholder="Days"
                onSelect={(option) => setChartMode(option.value)}
                width="sm"
              />
            
              <div className="flex items-center space-x-2 ml-2">
                <div className="relative group">
                  <LineChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      chartType === 'Line'
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setChartType('Line')}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Line Chart
                  </div>
                </div>
                <div className="relative group">
                  <BarChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      chartType === 'bar'
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setChartType('bar')}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Bar Chart
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full flex justify-center items-center" style={{ height: '90px' }}>
            <NoDataPlaceholder height={90} />
          </div>
        </div>
      </div>
    </div>
  );
}
