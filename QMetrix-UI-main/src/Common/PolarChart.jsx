import { PolarArea } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend);

const PolarAreaChart = ({ labels, datasetData, customOptions }) => {
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

  const data = {
    labels: labels || ['Red', 'Green', 'Yellow', 'Grey', 'Blue'], 
    datasets: [
      {
        label: 'Dataset',
        data: datasetData,
        backgroundColor: [
          rootStyles.getPropertyValue('--bar-color-primary').trim(),
          rootStyles.getPropertyValue('--bar-color-secondary').trim(),
          rootStyles.getPropertyValue('--bar-color-tertiary').trim(),
          rootStyles.getPropertyValue('--bar-color-quaternary').trim(),
          rootStyles.getPropertyValue('--bar-color-quinary').trim(),
        ],
        borderWidth: 1,
        borderColor: 'black',
      },
    ],
  };

  const options = {
    responsive: true,
    layout: {
      padding: 20,
    },
    scales: {
      r: {
        ticks: {
          display: false,
        },
        grid: {
          color: themes[theme].labelColor, 
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: customOptions?.plugins?.legend?.position || 'top',
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem) {
            return `${tooltipItem.label}: ${tooltipItem.raw}`;
          },
        },
      },
    },
    ...customOptions, 
  };

  return <PolarArea data={data} options={options} />;
};

PolarAreaChart.propTypes = {
  labels: PropTypes.arrayOf(PropTypes.string), 
  datasetData: PropTypes.arrayOf(PropTypes.number), 
  customOptions: PropTypes.object, 
};

export default PolarAreaChart;
