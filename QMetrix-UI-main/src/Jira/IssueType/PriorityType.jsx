import { useSelector } from 'react-redux';
import PieChart from '../../Common/PieChart';
import PropTypes from 'prop-types';
import DropdownButton from '../../Common/DropDown';
import { useState } from 'react';
import BarChart from '../../Common/BarGraph';
import DoughnutChart from '../../Common/DonutChart';
import LineChart from '../../Common/LineChart';

const PriorityType = ({ getTaskCountValue }) => {
  const [selectedChart, setSelectedChart] = useState('pieChart');
  const rootStyles = getComputedStyle(document.documentElement);
  const totalIssues = getTaskCountValue?.find((item) => item.getPriorityWise) || {};
  const issesTypes = totalIssues?.getPriorityWise?.result || [];  
  const priorityRanking = {
    highest: 5,
    high: 4,
    medium: 3,
    low: 2,
    lowest: 1,
  };
  const sortedIssues = issesTypes
    ? issesTypes
        .map((item) => ({
          ...item,
          rank: priorityRanking[item.name.toLowerCase()] || 0,
        }))
        .sort((a, b) => b.rank - a.rank)
    : [];
  const labels = sortedIssues ? sortedIssues.map((item) => item.name) : [];
  const dataPoints = sortedIssues ? sortedIssues.map((item) => item.count) : [];
  const backgroundColors = [
    rootStyles.getPropertyValue('--pie-multiColor-primary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-secondary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-tertiary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-quaternary').trim(),
  ];

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
  const customOptions = {
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: themes[theme].legendColor,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw || 0;
            return ` ${value}`;
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        font: {
          size: 14,
        },
      },
    },
  };

  const commonChartOptions = {
    ...customOptions,
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

  return (
    <div className="rounded-md flex flex-col justify-between py-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black">
      <div className="flex justify-between">
        <h2 className="text-base font-semibold mb-4 dark:text-container text-black">
          Total Issues : {totalIssues?.getPriorityWise?.total || 0}
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
        {selectedChart === 'pieChart' && (
          <PieChart
            labels={labels}
            dataPoints={dataPoints}
            backgroundColors={backgroundColors}
            label="Priority Type"
            height="250px"
            width="400px"
            options={customOptions}
          />
        )}
        {selectedChart === 'barChart' && (
          <div className="w-[80%]">
            <BarChart
              labels={labels}
              datasetData={dataPoints}
              datasetLabel={['Priority Type']}
              options={commonChartOptions}
              height="250px"
            />
          </div>
        )}
        {selectedChart === 'doughnutChart' && (
          <DoughnutChart
            labels={labels}
            dataPoints={dataPoints}
            label="Priority Type"
            height="250px"
            width="400px"
            options={customOptions}
          />
        )}
        {selectedChart === 'lineChart' && (
          <div className="w-[80%]">
            <LineChart
              labels={labels}
              dataPoints={dataPoints}
              label="Priority Type"
              height="250px"
              width="400px"
              options={customOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
};
PriorityType.propTypes = {
  getTaskCountValue: PropTypes.array.isRequired,
};
export default PriorityType;
