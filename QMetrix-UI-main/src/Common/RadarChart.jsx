import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import PropTypes from 'prop-types';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const RadarChart = ({ data, options }) => {
  return <Radar data={data} options={options} />;
};

RadarChart.defaultProps = {
  data: {
    labels: [],
    datasets: [],
  },
  options: {
    elements: {
      line: {
        borderWidth: 3,
      },
    },
    
    scales: {
      r: {
        angleLines: {
          display: false,
        },
        suggestedMin: 50,
        suggestedMax: 100,
      },
    },
  },
};

RadarChart.propTypes = {
  data: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string),
    datasets: PropTypes.arrayOf(PropTypes.shape({
      label: PropTypes.string,
      data: PropTypes.arrayOf(PropTypes.number),
      fill: PropTypes.bool,
      backgroundColor: PropTypes.string,
      borderColor: PropTypes.string,
      pointBackgroundColor: PropTypes.string,
      pointBorderColor: PropTypes.string,
      pointHoverBackgroundColor: PropTypes.string,
      pointHoverBorderColor: PropTypes.string,
    })),
  }),
  options: PropTypes.object,
};

export default RadarChart;
