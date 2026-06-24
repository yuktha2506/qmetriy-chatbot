import { Doughnut } from 'react-chartjs-2';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

const DoughnutChart = ({
  labels,
  dataPoints,
  backgroundColors,
  label,
  hoverOffset,
  height,
  width,
  cutoutPercentage,
  borderWidth,
  options: customOptions,
}) => {
  const rootStyles = getComputedStyle(document.documentElement);
  const colors = [
    rootStyles.getPropertyValue('--doughnut-singleColor-primary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-secondary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-tertiary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-quaternary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-quinary').trim(),
    rootStyles.getPropertyValue('--doughnut-singleColor-senary').trim(),
  ];
  const data = {
    labels: labels,
    datasets: [
      {
        label: label,
        data: dataPoints,
        backgroundColor: backgroundColors || colors,
        hoverOffset: hoverOffset || 4,
        borderWidth: borderWidth || 0,
      },
    ],
  };
  
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
    cutout: cutoutPercentage || '50%',
    plugins: {
      legend: {
        display: true,
        position: 'right',
        padding: 20,
        labels: {
          color: themes[theme].legendColor,
          font: {
            size: 12,
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        font: {
          weight: 'bold',
          size: 12,
        },
      },
    },
  };
  const options = {
    ...defaultOptions,
    ...customOptions,
  };
  return (
    <div style={{ height: height || '400px', width: width || '600px' }}>
      <Doughnut data={data} options={options} height={null} width={null} />
    </div>
  );
};

DoughnutChart.propTypes = {
  labels: PropTypes.array.isRequired,
  dataPoints: PropTypes.array.isRequired,
  backgroundColors: PropTypes.array.isRequired,
  label: PropTypes.string,
  hoverOffset: PropTypes.number,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  cutoutPercentage: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  borderWidth: PropTypes.number,
  options: PropTypes.object,

};

DoughnutChart.defaultProps = {
  label: 'My First Dataset',
  hoverOffset: 4,
  height: '400px',
  width: '600px',
  cutoutPercentage: '50%',
};

export default DoughnutChart;
