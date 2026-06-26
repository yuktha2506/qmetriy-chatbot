import { useState } from 'react';
import { useSelector } from 'react-redux';
import ReactSpeedometer from 'react-d3-speedometer';
import BarChart from '../../Common/BarGraph';
import LineChart from '../../Common/LineChart';
import DropdownButton from '../../Common/DropDown';
import DoughnutChart from '../../Common/DonutChart';
import PieChart from '../../Common/PieChart';

function JitterTime() {
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

  const chartOptions = [
    { label: 'Line Chart', value: 'lineChart' },
    { label: 'Bar Chart', value: 'barChart' },
    { label: 'Doughnut Chart', value: 'doughnutChart' },
    { label: 'Pie Chart', value: 'pieChart' },
  ];
  const totalJitterTimeLabel = [
    'Ticket ID 1',
    'Ticket ID 2',
    'Ticket ID 3',
    'Ticket ID 4',
    'Ticket ID 5',
    'Ticket ID 6',
  ];
  const totalJitterTimedata = [20, 50, 50, 100, 70, 90];
  const [selectTotalJitterTimeChart, setSelectTotalJitterTimeChart] = useState('lineChart');
  const handleTotalJitterTimeChartSelect = (option) => {
    setSelectTotalJitterTimeChart(option.value);
  };
  const totalJitterTimeBarLineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 20,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItem) => `Total Jitter Time: ${tooltipItem[0].raw + ' hrs '}`,
          label: (tooltipItem) => `${tooltipItem.label}`,
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        anchor: 'end',
        align: 'top',
        offset: 4,
        font: {
          weight: 'bold',
          size: 12,
          margin: 2,
        },
        formatter: (value) => {
          if (typeof value === 'number') {
            return value.toFixed(1);
          }
          return 'N/A';
        },
      },
    },
    scales: {
      x: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          font: {
            size: 12,
          },
        },
        title: {
          display: true,
          text: 'Tickets',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 13,
          },
          padding: 10,
        },
        stacked: true,
        barPercentage: 0.8,
        categoryPercentage: 0.7,
      },
      y: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          padding: 20,
          callback: (value) => {
            if (value % 20 === 0) {
              return value;
            }
            return '';
          },
        },
        title: {
          display: true,
          text: 'Total Jitter Time ( in hrs )',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 12,
          },
        },
        min: 0,
      },
    },
  };
  const jitterTimeDonutChartOptions = {
    layout: {
      padding: 10,
    },
    plugins: {
      legend: {
        display: true,
        position: 'right',
        padding: 10,
        labels: {
          color: themes[theme].legendColor,
          font: {
            size: 12,
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        anchor: 'center',
        align: 'center',
        font: {
          weight: 'bold',
          size: 12,
        },
        formatter: (value) => {
          return value.toFixed(1) + ' hrs';
        },
      },
      tooltip: {
        callbacks: {
          title: (tooltipItem) => {
            return tooltipItem[0]?.raw
              ? `Jitter Time: ${tooltipItem[0].raw} hrs`
              : 'Jitter Time: N/A';
          },
          label: (tooltipItem) => tooltipItem.label || '',
        },
      },
      min: 0,
    },
  };
  const totalJitterTime = totalJitterTimedata.reduce((acc, curr) => acc + curr, 0);
  const averageJitterTime = (totalJitterTime / totalJitterTimedata.length).toFixed(1);
  const teamJitterTimeLabel = ['Vamsi', 'Sushma', 'Danush', 'Bhargavi', 'Navya', 'Ankur'];
  const teamJitterTimeData = [33, 40, 25, 53, 23, 15];
  const [selectTeamJitterTimeChart, setSelectTeamJitterTimeChart] = useState('barChart');
  const handleTeamJitterTimeChartSelect = (option) => {
    setSelectTeamJitterTimeChart(option.value);
  };
  const teamJitterTimeBarLineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 10,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItem) => `Jitter Time: ${tooltipItem[0].raw + ' hrs '}`,
          label: (tooltipItem) => `${tooltipItem.label}`,
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        anchor: 'end',
        align: 'top',
        offset: 4,
        font: {
          weight: 'bold',
          size: 12,
          margin: 2,
        },
        formatter: (value) => {
          if (typeof value === 'number') {
            return value.toFixed(1);
          }
          return 'N/A';
        },
      },
    },
    scales: {
      x: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          font: {
            size: 12,
          },
        },
        title: {
          display: true,
          text: 'Team Member',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 13,
          },
          padding: 10,
        },
        stacked: true,
        barPercentage: 0.8,
        categoryPercentage: 0.7,
      },
      y: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          padding: 20,
          callback: (value) => {
            if (value % 20 === 0) {
              return value;
            }
            return '';
          },
        },
        title: {
          display: true,
          text: 'Jitter Time ( in hrs )',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 12,
          },
        },
        min: 0,
      },
    },
  };
  const trendData = [
    { sprint: 1, jitterTime: 420 },
    { sprint: 2, jitterTime: 390 },
    { sprint: 3, jitterTime: 450 },
    { sprint: 4, jitterTime: 400 },
    { sprint: 5, jitterTime: 380 },
    { sprint: 6, jitterTime: 430 },
  ];

  const trendAnalysisData = trendData.map((data, index) => {
    if (index === 0) return { sprint: data.sprint, change: 0 };
    const previousJitterTime = trendData[index - 1].jitterTime;
    const change = ((data.jitterTime - previousJitterTime) / previousJitterTime) * 100;
    return { sprint: data.sprint, change: change.toFixed(2) };
  });

  const trendLabels = trendAnalysisData.map((data) => `Sprint ${data.sprint}`);
  const trendValues = trendAnalysisData.map((data) => {
    const change = data.change ? Number(data.change) : 0;
    return change;
  });
  const [selectTrendJitterTimeChart, setSelectTrendJitterTimeChart] = useState('lineChart');
  const handleTrendJitterTimeChartSelect = (option) => {
    setSelectTrendJitterTimeChart(option.value);
  };
  const trendJitterTimeBarLineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 10,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItem) => `Jitter Time: ${tooltipItem[0].raw + ' hrs '}`,
          label: (tooltipItem) => `${tooltipItem.label}`,
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        anchor: 'end',
        align: 'top',
        offset: 4,
        font: {
          weight: 'bold',
          size: 12,
          margin: 2,
        },
        formatter: (value) => {
          if (typeof value === 'number') {
            return value.toFixed(1);
          }
          return 'N/A';
        },
      },
    },
    scales: {
      x: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          font: {
            size: 12,
          },
        },
        title: {
          display: true,
          text: 'Sprints',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 13,
          },
          padding: 10,
        },
        stacked: true,
        barPercentage: 0.8,
        categoryPercentage: 0.7,
      },
      y: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          padding: 20,
          callback: (value) => {
            if (value % 20 === 0) {
              return value;
            }
            return '';
          },
        },
        title: {
          display: true,
          text: 'Jitter Time ( in hrs )',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 12,
          },
        },
      },
    },
  };
  const trendJitterTimeDonutChartOptions = {
    layout: {
      padding: 10,
    },
    plugins: {
      legend: {
        display: true,
        position: 'right',
        padding: 10,
        labels: {
          color: themes[theme].legendColor,
          font: {
            size: 12,
          },
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        anchor: 'center',
        align: 'center',
        font: {
          weight: 'bold',
          size: 12,
        },
        formatter: (value, context) => {
          if (context.dataIndex === 0) {
            return '';
          }
          if (typeof value === 'number') {
            return value.toFixed(1);
          }
          return 'N/A';
        },
      },
      tooltip: {
        callbacks: {
          title: (tooltipItem) => {
            return tooltipItem[0]?.raw
              ? `Jitter Time: ${tooltipItem[0].raw} hrs`
              : 'Jitter Time: N/A';
          },
          label: (tooltipItem) => tooltipItem.label || '',
        },
      },
    },
  };
  const workTypeLabel = ['Features', 'Bugs', 'Technical Debt'];
  const workTypeData = [30, 45, 34];
  const [selectWorkTypeJitterTimeChart, setSelectWorkTypeJitterTimeChart] = useState('doughnutChart');
  const handleWorkTypeJitterTimeChartSelect = (option) => {
    setSelectWorkTypeJitterTimeChart(option.value);
  };
  const workTypeJitterTimeBarLineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 10,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItem) => `Work Type Jitter Time: ${tooltipItem[0].raw + ' hrs '}`,
          label: (tooltipItem) => `${tooltipItem.label}`,
        },
      },
      datalabels: {
        color: themes[theme].datalabelsColor,
        anchor: 'end',
        align: 'top',
        offset: 4,
        font: {
          weight: 'bold',
          size: 12,
          margin: 2,
        },
        formatter: (value) => {
          if (typeof value === 'number') {
            return value.toFixed(1);
          }
          return 'N/A';
        },
      },
    },
    scales: {
      x: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          font: {
            size: 12,
          },
        },
        title: {
          display: true,
          text: 'Work Type',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 13,
          },
          padding: 10,
        },
        stacked: true,
        barPercentage: 0.3,
        categoryPercentage: 0.4,
        barThickness: 20,
      },
      y: {
        border: {
          display: true,
          color: themes[theme].borderColor,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: themes[theme].labelColor,
          padding: 20,
          callback: (value) => {
            if (value % 20 === 0) {
              return value;
            }
            return '';
          },
        },
        title: {
          display: true,
          text: 'Jitter Time ( in hrs )',
          color: themes[theme].legendColor,
          font: {
            weight: 'Bold',
            size: 12,
          },
        },
        min: 0,
        maxBarThickness: 10,
      },
    },
  };
  return (
    <div className="relative rounded-lg transition-transform duration-300">
      <div className="w-full flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="w-1/2 cursor-pointer relative h-[24rem] bg-white dark:bg-[#182433] rounded-lg transition-transform duration-300 shadow-lg p-4">
            <div className="flex justify-between">
              <h1 className="mb-2 text-center flex items-center justify-between text-lg font-semibold text-black dark:text-[#e1def5e6]">
                Total Time Jitter
              </h1>
              <div className='w-auto'>
              <DropdownButton
                buttonLabel="Select Chart"
                options={chartOptions}
                selectedOption={chartOptions.find((option) => option.value === selectTotalJitterTimeChart)?.label}
                onSelect={handleTotalJitterTimeChartSelect}
              />
              </div>
            </div>
            <div className="w-full h-80 flex items-center justify-center">
              {selectTotalJitterTimeChart === 'lineChart' ? (
                <LineChart
                  labels={totalJitterTimeLabel}
                  dataPoints={totalJitterTimedata}
                  label={''}
                  borderColor={''}
                  tension="0.3"
                  height={310}
                  width="96%"
                  options={totalJitterTimeBarLineChartOptions}
                />
              ) : selectTotalJitterTimeChart === 'barChart' ? (
                <BarChart
                  labels={totalJitterTimeLabel}
                  datasetData={totalJitterTimedata}
                  backgroundColors={''}
                  borderColors={''}
                  datasetLabel=""
                  options={totalJitterTimeBarLineChartOptions}
                  height=""
                  width=""
                />
              ) : selectTotalJitterTimeChart === 'doughnutChart' ? (
                <DoughnutChart
                  labels={totalJitterTimeLabel}
                  dataPoints={totalJitterTimedata}
                  label=" "
                  borderColor={''}
                  hoverOffset="4"
                  height={250}
                  width="96%"
                  options={jitterTimeDonutChartOptions}
                />
              ) : (
                <PieChart
                labels={totalJitterTimeLabel}
                dataPoints={totalJitterTimedata}
                label=" "
                borderColor={''}
                hoverOffset="4"
                height={250}
                width="96%"
                options={jitterTimeDonutChartOptions}
              />
              )}
            </div>
          </div>
          <div className="w-1/2 cursor-pointer relative h-[24rem] bg-white dark:bg-[#182433] rounded-lg transition-transform duration-300 shadow-lg p-4">
            <div className="flex">
              <h1 className="mb-2 text-center flex items-center justify-between text-lg font-semibold text-black dark:text-[#e1def5e6]">
                Average Time Jitter Per Sprint ( in hrs )
              </h1>
            </div>
            <div className="w-full h-80 flex items-center justify-center mt-10">
              <ReactSpeedometer
                maxValue={100}
                value={averageJitterTime}
                needleColor="#7367f0"
                segmentColors={['#28A81EB3', '#00FF00B3', '#FFCC66B3', '#FF6633B3', '#FF0000B3']}
                segments={5}
                textColor= {themes[theme].legendColor}
                width={360}
                ringWidth={20}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-1/2 cursor-pointer relative h-[24rem] bg-white dark:bg-[#182433] rounded-lg transition-transform duration-300 shadow-lg p-4">
            <div className="flex justify-between">
              <h1 className="mb-2 text-center flex items-center justify-between text-lg font-semibold text-black dark:text-[#e1def5e6]">
                Time Jitter Per Team Member
              </h1>
              <div className='w-auto'>
              <DropdownButton
                buttonLabel="Select Chart"
                options={chartOptions}
                selectedOption={chartOptions.find((option) => option.value === selectTeamJitterTimeChart)?.label}
                onSelect={handleTeamJitterTimeChartSelect}
              />
              </div>
            </div>
            <div className="w-full h-80 flex items-center justify-center">
              {selectTeamJitterTimeChart === 'lineChart' ? (
                <LineChart
                  labels={teamJitterTimeLabel}
                  dataPoints={teamJitterTimeData}
                  label={''}
                  borderColor={''}
                  tension="0.3"
                  height={310}
                  width="96%"
                  options={teamJitterTimeBarLineChartOptions}
                />
              ) : selectTeamJitterTimeChart === 'barChart' ? (
                <BarChart
                  labels={teamJitterTimeLabel}
                  datasetData={teamJitterTimeData}
                  backgroundColors={''}
                  borderColors={''}
                  datasetLabel=""
                  options={teamJitterTimeBarLineChartOptions}
                  height=""
                  width=""
                />
              ) : selectTeamJitterTimeChart === 'doughnutChart' ? (
                <DoughnutChart
                  labels={teamJitterTimeLabel}
                  dataPoints={teamJitterTimeData}
                  label=" "
                  borderColor={''}
                  hoverOffset="4"
                  height={250}
                  width="96%"
                  options={jitterTimeDonutChartOptions}
                />
              ) : (
                <PieChart
                labels={teamJitterTimeLabel}
                dataPoints={teamJitterTimeData}
                label=" "
                borderColor={''}
                hoverOffset="4"
                height={250}
                width="96%"
                options={jitterTimeDonutChartOptions}
              />
              )}
            </div>
          </div>
          <div className="w-1/2 cursor-pointer relative h-[24rem] bg-white dark:bg-[#182433] rounded-lg transition-transform duration-300 shadow-lg p-4">
            <div className="flex justify-between">
              <h1 className="mb-2 text-center flex items-center justify-between text-lg font-semibold text-black dark:text-[#e1def5e6]">
                Time Jitter Trend Analysis
              </h1>
              <div className='w-auto'>
              <DropdownButton
                buttonLabel="Select Chart"
                options={chartOptions}
                selectedOption={chartOptions.find((option) => option.value === selectTrendJitterTimeChart)?.label}
                onSelect={handleTrendJitterTimeChartSelect}
              />
              </div>
            </div>
            <div className="w-full h-80 flex items-center justify-center">
              {selectTrendJitterTimeChart === 'lineChart' ? (
                <LineChart
                  labels={trendLabels}
                  dataPoints={trendValues}
                  label={''}
                  borderColor={''}
                  tension="0.3"
                  height={310}
                  width="96%"
                  options={trendJitterTimeBarLineChartOptions}
                />
              ) : selectTrendJitterTimeChart === 'barChart' ? (
                <BarChart
                  labels={trendLabels}
                  datasetData={trendValues}
                  backgroundColors={''}
                  borderColors={''}
                  datasetLabel=""
                  options={trendJitterTimeBarLineChartOptions}
                  height=""
                  width=""
                />
              ) : selectTrendJitterTimeChart === 'doughnutChart' ? (
                <DoughnutChart
                  labels={trendLabels}
                  dataPoints={trendValues}
                  label=" "
                  borderColor={''}
                  hoverOffset="4"
                  height={250}
                  width="96%"
                  options={trendJitterTimeDonutChartOptions}
                />
              ) : (
                <PieChart
                labels={trendLabels}
                dataPoints={trendValues}
                label=" "
                borderColor={''}
                hoverOffset="4"
                height={250}
                width="96%"
                options={trendJitterTimeDonutChartOptions}
              />
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-1/2 cursor-pointer relative h-[24rem] bg-white dark:bg-[#182433] rounded-lg transition-transform duration-300 shadow-lg p-4">
            <div className="flex justify-between">
              <h1 className="mb-2 text-center flex items-center justify-between text-lg font-semibold text-black dark:text-[#e1def5e6]">
                Time Jitter By Work Type
              </h1>
              <div className='w-auto'>
              <DropdownButton
                buttonLabel="Select Chart"
                options={chartOptions}
                selectedOption={chartOptions.find((option) => option.value === selectWorkTypeJitterTimeChart)?.label}
                onSelect={handleWorkTypeJitterTimeChartSelect}
              />
              </div>
            </div>
            <div className="w-full h-80 flex items-center justify-center">
              {selectWorkTypeJitterTimeChart === 'lineChart' ? (
                <LineChart
                  labels={workTypeLabel}
                  dataPoints={workTypeData}
                  label={''}
                  borderColor={''}
                  tension="0.3"
                  height={310}
                  width="96%"
                  options={workTypeJitterTimeBarLineChartOptions}
                />
              ) : selectWorkTypeJitterTimeChart === 'barChart' ? (
                <BarChart
                  labels={workTypeLabel}
                  datasetData={workTypeData}
                  backgroundColors={''}
                  borderColors={''}
                  datasetLabel=""
                  options={workTypeJitterTimeBarLineChartOptions}
                  height=""
                  width=""
                />
              ) : selectWorkTypeJitterTimeChart === 'doughnutChart' ? (
                <DoughnutChart
                  labels={workTypeLabel}
                  dataPoints={workTypeData}
                  label=" "
                  borderColor={''}
                  hoverOffset="4"
                  height={250}
                  width="96%"
                  options={jitterTimeDonutChartOptions}
                />
              ) : (
                <PieChart
                  labels={workTypeLabel}
                  dataPoints={workTypeData}
                  label=" "
                  borderColor={''}
                  hoverOffset="4"
                  height={250}
                  width="96%"
                  options={jitterTimeDonutChartOptions}
                />
              )}
            </div>
          </div>
          <div className="w-1/2"> </div>
        </div>
      </div>
    </div>
  );
}

export default JitterTime;
