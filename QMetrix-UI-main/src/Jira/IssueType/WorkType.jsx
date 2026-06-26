import { useState } from 'react';
import DoughnutChart from '../../Common/DonutChart';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import DropdownButton from '../../Common/DropDown';
import BarChart from '../../Common/BarGraph';
import PieChart from '../../Common/PieChart';
import LineChart from '../../Common/LineChart';

const WorkTypeChart = ({ getTaskCountValue }) => {
  const [selectedChart, setSelectedChart] = useState('doughnutChart');
  const rootStyles = getComputedStyle(document.documentElement);
  const backgroundColors = [
    rootStyles.getPropertyValue('--doughnut-singleColor-primary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-secondary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-tertiary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-quaternary').trim(),
  ];
  const issesTypes = getTaskCountValue.find((item) => item.openIssues)?.openIssues?.result;
  const labels = issesTypes ? issesTypes.map((item) => item.type) : [];
  const series = issesTypes ? issesTypes.map((item) => item.count) : [];
  const total = series.reduce((sum, count) => sum + count, 0);

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

  const chartOptions = [
    { label: 'Bar Chart', value: 'barChart' },
    { label: 'Doughnut Chart', value: 'doughnutChart' },
    { label: 'Pie Chart', value: 'pieChart' },
    { label: 'Line Chart', value: 'lineChart'}
  ];
  const handleSelect = (option) => {
    setSelectedChart(option.value);
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: themes[theme].legendColor,
          font: {
            size: 12,
            weight: '600',
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw || 0;
            return `${value}`;
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        font: {
          size: 14,
        },
        formatter: (value) => {
          return value;
        },
      },
    },
  };

  const commonChartOptions = {
    ...options,
    responsive: true,
    plugins: {
      legend: {
        display: false,
        position: 'top',
        labels: {
          color: themes[theme].legendColor,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw || 0;
            return `${value}`;
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
      },
    },
    borderRadius: {
      topRight: 10,
      topLeft: 10,
    },
  };
  
  const legendLabels = labels.map((label) => `${label}`);

  return (
    <div className="rounded-md flex flex-col justify-between py-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black">
      <div className="flex justify-between">
        <h2 className="text-base font-semibold mb-4 dark:text-container text-black">
          Total Issues : {total}
        </h2>
        <div className="w-auto">
          <DropdownButton
            buttonLabel="Select Chart"
            options={chartOptions}
            selectedOption={chartOptions.find((option) => option.value === selectedChart)?.label}
            onSelect={handleSelect}
            placeholder="Select Chart"
          />
        </div>
      </div>
      <div className="flex items-center justify-center">
        {selectedChart === 'doughnutChart' && (
          <DoughnutChart
            labels={legendLabels}
            dataPoints={series}
            backgroundColors={backgroundColors}
            label="Work Types"
            height="250px"
            width="400px"
            options={options}
          />
        )}
        {selectedChart === 'barChart' && (
          <div className="w-[80%]">
            <BarChart
              labels={legendLabels}
              datasetData={series}
              datasetLabel={['Work Type']}
              options={commonChartOptions}
              height="250px"
            />
          </div>
        )}
        {selectedChart === 'pieChart' && (
          <PieChart
            labels={legendLabels}
            dataPoints={series}
            label="Work Types"
            height="250px"
            width="400px"
            options={options}
          />
        )}
        {selectedChart === 'lineChart' && (
          <div className="w-[80%]">
            <LineChart
              labels={legendLabels}
              dataPoints={series}
              datasetLabel={['Work Type']}
              options={commonChartOptions}
              height="250px"
              tension={0.3}
            />
          </div>
        )}
      </div>
    </div>
  );
};

WorkTypeChart.propTypes = {
  getTaskCountValue: PropTypes.array.isRequired,
};

export default WorkTypeChart;
