import { useState } from 'react';
import DropdownButton from '../../Common/DropDown';
import BarChart from '../../Common/BarGraph';
import LineChart from '../../Common/LineChart';
import DoughnutChart from '../../Common/DonutChart';
import 'chart.js/auto';
import { useSelector } from 'react-redux';

const DeploymentFrequency = () => {
  const [selectedChartBySprint, setSelectedChartBySprint] = useState('barGraph');
  const [selectedChartByRelease, setSelectedChartByRelease] = useState('lineGraph');
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

  const commonChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 50,
          usePointStyle: true,
          pointStyle: 'circle',
          color: themes[theme].legendColor,
          font: {
            size: 12,
            weight: 'bold',
          },
        },
      },
      datalabels:{
        color: themes[theme].datalabelsColor
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        ticks: {
          color: themes[theme].labelColor,
        },
      },
      y: {
        grid: {
          display: false,
        },
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        ticks: {
          color: themes[theme].labelColor,
        },
      },
    },
    maintainAspectRatio: false,
  };

  const sprintLabels = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6'];
  const totalDeployments = [10, 15, 20, 12, 18, 22];
  const totalWorkingDays = [14, 14, 14, 14, 14, 14];
  const deploymentFrequencyPerSprint = totalDeployments.map((deployments, index) =>
    (deployments / totalWorkingDays[index]).toFixed(2),
  );

  const releaseLabels = ['Release 1', 'Release 2', 'Release 3', 'Release 4', 'Release 5'];
  const releaseDeployments = [25, 30, 35, 40, 45];
  const releaseWorkingDays = [30, 30, 30, 30, 30];
  const deploymentFrequencyPerRelease = releaseDeployments.map((deployments, index) =>
    (deployments / releaseWorkingDays[index]).toFixed(2),
  );

  const chartOptions = [
    { label: 'Bar Chart', value: 'barGraph' },
    { label: 'Line Graph', value: 'lineGraph' },
    { label: 'Doughnut', value: 'doughnutChart' },
  ];

  const handleSelectBySprint = (option) => {
    setSelectedChartBySprint(option.value);
  };

  const handleSelectByRelease = (option) => {
    setSelectedChartByRelease(option.value);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#2F3349] p-4 rounded-md shadow-md">
          <div className="flex flex-wrap justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-black dark:text-gray-300">
              Deployment Frequency Per Sprint
            </h4>
            <div className='w-auto'>
            <DropdownButton
              buttonLabel="Select Chart"
              options={chartOptions}
              onSelect={handleSelectBySprint}
            />
            </div>
          </div>

          <div style={{ height: '300px' }}>
            {selectedChartBySprint === 'barGraph' && (
              <BarChart
                labels={sprintLabels}
                datasetData={deploymentFrequencyPerSprint}
                datasetLabel="Deployment Frequency"
                height={300}
                width={500}
                options={commonChartOptions}
              />
            )}

            {selectedChartBySprint === 'lineGraph' && (
              <LineChart
                labels={sprintLabels}
                dataPoints={deploymentFrequencyPerSprint}
                label="Deployment Frequency"
                tension={0.3}
                height={300}
                width={470}
                showGrid={false}
              />
            )}

            {selectedChartBySprint === 'doughnutChart' && (
              <DoughnutChart
                labels={sprintLabels}
                dataPoints={deploymentFrequencyPerSprint}
                label="Deployment Frequency"
                height="250px"
                width="400px"
                cutoutPercentage="70%"
                legendPosition="right"
              />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#2F3349]  p-4 rounded-md shadow-md">
          <div className="flex flex-wrap justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-black dark:text-gray-300">
              Deployment Frequency Per Release
            </h4>
            <div className='w-auto'>
            <DropdownButton
              buttonLabel="Select Chart"
              options={chartOptions}
              onSelect={handleSelectByRelease}
            />
            </div>
          </div>

          <div style={{ height: '300px' }}>
            {selectedChartByRelease === 'barGraph' && (
              <BarChart
                labels={releaseLabels}
                datasetData={deploymentFrequencyPerRelease}
                datasetLabel="Deployment Frequency"
                height={300}
                width={500}
                options={commonChartOptions}
              />
            )}

            {selectedChartByRelease === 'lineGraph' && (
              <LineChart
                labels={releaseLabels}
                dataPoints={deploymentFrequencyPerRelease}
                label="Deployment Frequency"
                tension={0.3}
                height={300}
                width={470}
                showGrid={false}
              />
            )}

            {selectedChartByRelease === 'doughnutChart' && (
              <DoughnutChart
                labels={releaseLabels}
                dataPoints={deploymentFrequencyPerRelease}
                label="Deployment Frequency"
                height="250px"
                width="400px"
                cutoutPercentage="70%"
                legendPosition="right"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeploymentFrequency;
