import { Bar } from 'react-chartjs-2';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useSelector } from 'react-redux';
import '../../assets/css/commonColors.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChart = ({
  labels,
  datasetData,
  backgroundColors,
  borderColors,
  datasetLabel,
  options: customOptions,
  height,
  width,
  isGroupChart,
  legendPosition,
  barThickness,
}) => {
  const rootStyles = getComputedStyle(document.documentElement);
  const colors = [
    rootStyles.getPropertyValue('--bar-color-primary').trim(),
    rootStyles.getPropertyValue('--bar-color-secondary').trim(),
    rootStyles.getPropertyValue('--bar-color-tertiary').trim(),
    rootStyles.getPropertyValue('--bar-color-quaternary').trim(),
    rootStyles.getPropertyValue('--bar-color-quinary').trim(),
    rootStyles.getPropertyValue('--bar-color-senary').trim(),
  ];

  let grpData = {
    labels: labels,
    datasets: datasetData,
  };
  let SingleData = {
    labels: labels,
    datasets: [
      {
        label: datasetLabel,
        data: datasetData,
        backgroundColor: backgroundColors || colors,
        borderColor: borderColors || colors,
        borderWidth: 1,
        barThickness: barThickness,
      },
    ],
  };
  const data = isGroupChart ? grpData : SingleData;

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

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: legendPosition,
        label: {
          color: themes[theme].legendColor,
        },
        display: true,
      },
      title: {
        display: true,
        text: 'Bar Chart',
      },
    },
    borderRadius: {
      topLeft: 10,
      topRight: 10,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: themes[theme].labelColor,
        },
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        title: {
          display: true,
          color: themes[theme].legendColor,
          font: {
            size: 14,
          },
        },
        barThickness: barThickness,
      },
      y: {
        beginAtZero: true,
        grid: { display: false },
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        ticks: {
          color: themes[theme].labelColor,
        },
        title: {
          display: true,
          color: themes[theme].labelColor,
          font: {
            size: 14,
          },
        },
      },
    },
  };

  const options = {
    ...defaultOptions,
    ...customOptions,
  };

  return <Bar data={data} options={options} height={height} width={width} />;
};

BarChart.propTypes = {
  labels: PropTypes.arrayOf(PropTypes.string),
  datasetData: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.object])),
  backgroundColors: PropTypes.arrayOf(PropTypes.string),
  borderColors: PropTypes.arrayOf(PropTypes.string),
  datasetLabel: PropTypes.string,
  options: PropTypes.object,
  height: PropTypes.number,
  width: PropTypes.number,
  isGroupChart: PropTypes.bool,
  legendPosition: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  barThickness: PropTypes.number,
};

BarChart.defaultProps = {
  height: 400,
  width: 600,
  datasetLabel: 'My Dataset',
  isGroupChart: false,
  legendPosition: 'top',
  barThickness: 40,
};

export default BarChart;
