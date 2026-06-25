import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import 'chart.js/auto';

import DropdownButton from '../../Common/DropDown';
import BarChart from '../../Common/BarGraph';
import LineChart from '../../Common/LineChart';
import DoughnutChart from '../../Common/DonutChart';
import PieChart from '../../Common/PieChart';

const CycleTimeGraphs = () => {
  const [selectedChart, setSelectedChart] = useState('barGraph');
  const [getCycleTimeData, setGetCycleTimeData] = useState({});
  const [selectedValue, setSelectedValue] = useState({
    label: 'Select an option',
    value: 'Sprint',
  });
  const jiraData = useSelector((state) => state.jira || {});
  const gitData = useSelector((state) => state.git || {});
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    if (jiraData) {
      setSelectedValue({
        label: jiraData.selectedValueLabel || 'Select an option',
        value: jiraData.selectedValue || 'Sprint',
      });
    }

    if (gitData?.gitCycleTimeData) {
      setGetCycleTimeData(gitData.gitCycleTimeData);
    }
  }, [jiraData, gitData]);

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

  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {},
    plugins: {
      tooltip: {
        callbacks: {
          label: function (tooltipItem) {
            let datasetLabel = tooltipItem.dataset.label || '';
            let value = tooltipItem.raw;
            if (datasetLabel === 'Cycle Time') {
              return tooltipItem.dataset.label + ' : ' + value + ' days';
            }
            return tooltipItem.dataset.label + ' : ' + value;
          },
        },
      },
      legend: {
        position: 'bottom',
        labels: {
          color: themes[theme].legendColor,
          boxWidth: 50,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
        },
        border: {
          color: themes[theme].borderColor,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          callback: function (value) {
            return Number.isInteger(value) ? value : null;
          },
        },
        border: {
          color: themes[theme].borderColor,
        },
      },
    },
  };

  const dashedLineColor = rootStyles.getPropertyValue('--line-color-secondary').trim();
  const redColor = rootStyles.getPropertyValue('--bar-color-primary').trim();
  const blueColor = rootStyles.getPropertyValue('--bar-color-secondary').trim();

  const barLabels = getCycleTimeData?.cycleTimeByDev?.map((dev) => dev.name) || [];
  const barDatasetData = getCycleTimeData?.cycleTimeByDev?.map((dev) => dev.cycleTime) || [];

  const CycleTimeTrendData = {
    labels: getCycleTimeData?.cycleTimePerSprintOrRelease?.map((sprint) => sprint.name) || [],
    datasets: [
      {
        label: 'Cycle Time',
        data:
          getCycleTimeData?.cycleTimePerSprintOrRelease?.map((sprint) => sprint.cycleTime) || [],
        borderColor: dashedLineColor,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'PRs Merged',
        data:
          getCycleTimeData?.cycleTimePerSprintOrRelease?.map((sprint) => sprint.prsMerged) || [],
        backgroundColor: redColor,
        barThickness: 25,
        type: 'bar',
        borderRadius: { topLeft: 10, topRight: 10 },
      },
      {
        label: 'PRs in Progress',
        data: getCycleTimeData?.cycleTimePerSprintOrRelease?.map((sprint) => sprint.prsOpen) || [],
        backgroundColor: blueColor,
        barThickness: 25,
        type: 'bar',
        borderRadius: { topLeft: 10, topRight: 10 },
      },
    ],
  };

  const chartOptions = [
    { label: 'Bar Chart', value: 'barGraph' },
    { label: 'Line Chart', value: 'lineGraph' },
    { label: 'Doughnut Chart', value: 'doughnutChart' },
    { label: 'Pie Chart', value: 'pieChart' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        {/* Cycle Time Trend */}
        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
          <h4 className="text-lg font-semibold text-black dark:text-gray-300 mb-4">
            {`Cycle Time ${selectedValue?.value} Trend`}
          </h4>
          <div style={{ height: '300px' }}>
            {CycleTimeTrendData.labels.length > 0 && CycleTimeTrendData.datasets.length > 0 ? (
              <Line data={CycleTimeTrendData} options={commonChartOptions} />
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <span className="italic text-sm text-gray-900 dark:text-gray-300">
                  No records to display...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cycle Time Distribution */}
        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-black dark:text-gray-300">
              Cycle Time by Dev
            </h4>
            <div>
              {barLabels.length > 0 && (
                <DropdownButton
                  buttonLabel="Select Chart"
                  options={chartOptions}
                  selectedOption={
                    chartOptions.find((option) => option.value === selectedChart)?.label
                  }
                  onSelect={(option) => setSelectedChart(option.value)}
                />
              )}
            </div>
          </div>

          <div style={{ height: '300px' }}>
            {barLabels.length > 0 && barDatasetData.length > 0 ? (
              <>
                {selectedChart === 'barGraph' && (
                  <BarChart
                    labels={barLabels}
                    datasetData={barDatasetData}
                    datasetLabel="Cycle Time"
                    height={300}
                    width={500}
                    options={commonChartOptions}
                  />
                )}
                {selectedChart === 'lineGraph' && (
                  <LineChart
                    labels={barLabels}
                    dataPoints={barDatasetData}
                    label="Cycle Time"
                    tension={0.3}
                    height={300}
                    width={470}
                    options={commonChartOptions}
                    showDataLabels={false}
                  />
                )}
                {selectedChart === 'doughnutChart' && (
                  <DoughnutChart
                    labels={barLabels}
                    dataPoints={barDatasetData}
                    label="Cycle Time"
                    height="300px"
                    width="350px"
                    cutoutPercentage="70%"
                    legendPosition="right"
                  />
                )}
                {selectedChart === 'pieChart' && (
                  <PieChart
                    labels={barLabels}
                    dataPoints={barDatasetData}
                    label="Cycle Time"
                    height="300px"
                    width="350px"
                    cutoutPercentage="70%"
                    legendPosition="right"
                  />
                )}
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <span className="italic text-sm text-gray-900 dark:text-gray-300">
                  No records to display...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CycleTimeGraphs;
