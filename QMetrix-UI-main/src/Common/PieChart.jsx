import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

ChartJS.register(ArcElement, Tooltip, Legend);

const PieChart = ({
  labels,
  dataPoints,
  backgroundColors,
  label = 'My Pie Dataset', 
  hoverOffset = 4,         
  height = '300px',         
  width = '300px',          
  options: customOptions = {},  
}) => {
  const rootStyles = getComputedStyle(document.documentElement);
  const colors = [
    rootStyles.getPropertyValue('--pie-multiColor-primary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-secondary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-tertiary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-quaternary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-quinary').trim(),
    rootStyles.getPropertyValue('--pie-multiColor-senary').trim(),
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

  const data = {
    labels: labels,
    datasets: [
      {
        label: label,
        data: dataPoints,
        backgroundColor: backgroundColors || colors,
        hoverOffset: hoverOffset,
        borderWidth: 0,
      },
    ],
  };

  const defaultOptions = {
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
          },
        },
      },
      datalabels: {
        align: 'top',
        anchor: 'end',
        color: themes[theme].legendColor,
        font: {
          weight: 'bold',
          size: 10,
        },
      },
      tooltip: {
        enabled: true,
      },
    },
  };

  const options = {
    ...defaultOptions,
    ...customOptions, 
  };

  return (
    <div style={{ height: height, width: width }}>
      <Pie data={data} options={options} height={null} width={null} />
    </div>
  );
};

PieChart.propTypes = {
  labels: PropTypes.array.isRequired,
  dataPoints: PropTypes.array.isRequired,
  backgroundColors: PropTypes.array,
  label: PropTypes.string,
  hoverOffset: PropTypes.number,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.object,
};

PieChart.defaultProps = {
  label: 'My Pie Dataset',
  hoverOffset: 4,
  height: '300px',
  width: '300px',
  options: {},
};

export default PieChart;


