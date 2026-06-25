import { useState, useEffect } from 'react';
import DropdownButton from '../../Common/DropDown';
import BarChart from '../../Common/BarGraph';
import LineChart from '../../Common/LineChart';
import DoughnutChart from '../../Common/DonutChart';
import { useSelector } from 'react-redux';
import { APP_STRINGS } from '../../../constants';
import PieChart from '../../Common/PieChart';

const PullRequestSize = () => {
  const [selectedChartBySprint, setSelectedChartBySprint] = useState('barGraph');
  const [selectedChartByDev, setSelectedChartByDev] = useState('barGraph');
  const [selectedChartByRelease, setSelectedChartByRelease] = useState('barGraph');
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [getPullRequestSizeData, setGetPullRequestSizeData] = useState([]);
  const rootStyles = getComputedStyle(document.documentElement);
  const theme = useSelector((state) => state.theme.theme);
  const repoConnector = useSelector(
    (state) => state.jira?.repositoryProvider?.repositoryProvider ?? null,
  );
  const jiraData = useSelector((state) => state.jira || {});
  const gitData = useSelector((state) => state.git || {});
  useEffect(() => {
    if (jiraData) {
      setSelectedValue({
        label: jiraData.selectedValueLabel || APP_STRINGS.SELECT_AN_OPTION,
        value: jiraData.selectedValue || '',
      });
    }
    if (gitData) {
      setGetPullRequestSizeData(gitData.prSizeData);
    }
  }, [jiraData, gitData]);
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
        labels: {
          boxWidth: 50,
          usePointStyle: true,
          pointStyle: 'circle',
          color: themes[theme].legendColor,
          font: {
            size: 12,
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
        borderColor: themes[theme].borderColor,
        ticks: {
          color: themes[theme].labelColor,
        },
      },
      y: {
        grid: {
          display: false,
        },
        borderColor: themes[theme].border,
        ticks: {
          color: themes[theme].labelColor,
          callback: function (value) {
            return Number.isInteger(value) ? value : null;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  const SprintLabels = getPullRequestSizeData?.averagePRSizePerSprint
    ? Object.keys(getPullRequestSizeData.averagePRSizePerSprint)
    : [];

  const SprintDatasetData = getPullRequestSizeData?.averagePRSizePerSprint
    ? Object.values(getPullRequestSizeData.averagePRSizePerSprint)
    : [];
  const TeamLabels =
    getPullRequestSizeData?.averagePRSizeByDeveloper?.map((item) => item.dev) ?? [];
  const TeamDataSets =
    getPullRequestSizeData?.averagePRSizeByDeveloper?.map(
      (item) => item.averageMRSize || item.averagePRSize,
    ) ?? [];
  const releaseLabels = getPullRequestSizeData?.averagePRSizePerRelease
    ? Object.keys(getPullRequestSizeData.averagePRSizePerRelease)
    : [];
  const releaseDatasetData = getPullRequestSizeData?.averagePRSizePerRelease
    ? Object.values(getPullRequestSizeData.averagePRSizePerRelease)
    : [];

  const chartOptions = [
    { label: 'Bar Chart', value: 'barGraph' },
    { label: 'Line Chart', value: 'lineGraph' },
    { label: 'Doughnut Chart', value: 'doughnutChart' },
    { label: 'Pie Chart', value: 'pieChart' },
  ];

  const handleSelectBySprint = (option) => {
    setSelectedChartBySprint(option.value);
  };

  const handleSelectByDev = (option) => {
    setSelectedChartByDev(option.value);
  };
  const handleSelectByRelease = (option) => {
    setSelectedChartByRelease(option.value);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        {selectedValue?.value === APP_STRINGS.VALUE_SPRINT && (
          <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-black dark:text-gray-300">
                {repoConnector === 'GitLab'
                  ? 'Average MR Size Per Sprint'
                  : repoConnector === 'GitHub'
                  ? 'Average PR Size Per Sprint'
                  : 'Average PR Size Per Sprint'}
              </h4>
              <div className="w-auto">
                {SprintLabels.length > 0 && (
                  <DropdownButton
                    buttonLabel="Select Chart"
                    options={chartOptions}
                    selectedOption={
                      chartOptions.find((option) => option.value === selectedChartBySprint)?.label
                    }
                    onSelect={handleSelectBySprint}
                  />
                )}
              </div>
            </div>

            <div style={{ height: '300px' }}>
              {SprintLabels.length > 0 && SprintDatasetData.length > 0 ? (
                <>
                  {selectedChartBySprint === 'barGraph' && (
                    <BarChart
                      labels={SprintLabels}
                      datasetData={SprintDatasetData}
                      datasetLabel={
                        repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'
                      }
                      height={300}
                      width={500}
                      options={commonChartOptions}
                    />
                  )}

                  {selectedChartBySprint === 'lineGraph' && (
                    <LineChart
                      labels={SprintLabels}
                      dataPoints={SprintDatasetData}
                      label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                      tension={0.3}
                      height={300}
                      width={470}
                      showGrid={false}
                    />
                  )}

                  {selectedChartBySprint === 'doughnutChart' && (
                    <DoughnutChart
                      labels={SprintLabels}
                      dataPoints={SprintDatasetData}
                      label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                      height="250px"
                      width="400px"
                      cutoutPercentage="70%"
                    />
                  )}
                  {selectedChartBySprint === 'pieChart' && (
                    <PieChart
                      labels={SprintLabels}
                      dataPoints={SprintDatasetData}
                      label="Average PR Size"
                      height="250px"
                      width="400px"
                      cutoutPercentage="70%"
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
        )}
        {selectedValue?.value === APP_STRINGS.VALUE_RELEASE && (
          <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-black dark:text-gray-300">
                {repoConnector === 'GitLab'
                  ? 'Average MR Size Per Release'
                  : repoConnector === 'GitHub'
                  ? 'Average PR Size Per Release'
                  : 'Average PR Size Per Release'}
              </h4>
              <div className="w-auto">
                {releaseLabels.length > 0 && (
                  <DropdownButton
                    buttonLabel="Select Chart"
                    options={chartOptions}
                    selectedOption={
                      chartOptions.find((option) => option.value === selectedChartByRelease)?.label
                    }
                    onSelect={handleSelectByRelease}
                  />
                )}
              </div>
            </div>
            <div style={{ height: '300px' }}>
              {releaseLabels.length > 0 && releaseDatasetData.length > 0 ? (
                <>
                  {selectedChartByRelease === 'barGraph' && (
                    <BarChart
                      labels={releaseLabels}
                      datasetData={releaseDatasetData}
                      datasetLabel={
                        repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'
                      }
                      height={300}
                      width={500}
                      options={commonChartOptions}
                    />
                  )}
                  {selectedChartByRelease === 'lineGraph' && (
                    <LineChart
                      labels={releaseLabels}
                      dataPoints={releaseDatasetData}
                      label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                      tension={0.3}
                      height={300}
                      width={470}
                      showGrid={false}
                    />
                  )}
                  {selectedChartByRelease === 'doughnutChart' && (
                    <div style={{ display: 'grid', placeItems: 'center', height: '300px' }}>
                      <DoughnutChart
                        labels={releaseLabels}
                        dataPoints={releaseDatasetData}
                        label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                        height="300px"
                        width="350px"
                        cutoutPercentage="70%"
                        legendPosition="right"
                      />
                    </div>
                  )}
                  {selectedChartByRelease === 'pieChart' && (
                    <PieChart
                      labels={releaseLabels}
                      dataPoints={releaseDatasetData}
                      label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                      height="300px"
                      width="400px"
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
        )}
        {(selectedValue?.value === APP_STRINGS.VALUE_SPRINT || selectedValue?.value === APP_STRINGS.VALUE_RELEASE) && (
          <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-black dark:text-gray-300">
                {repoConnector === 'GitLab'
                  ? 'Average MR Size By Developer'
                  : repoConnector === 'GitHub'
                  ? 'Average PR Size By Developer'
                  : 'Average PR Size By Developer'}
              </h4>
              <div className="w-auto">
                {TeamLabels.length > 0 && (
                  <DropdownButton
                    buttonLabel="Select Chart"
                    options={chartOptions}
                    selectedOption={
                      chartOptions.find((option) => option.value === selectedChartByDev)?.label
                    }
                    onSelect={handleSelectByDev}
                  />
                )}
              </div>
            </div>

            <div style={{ height: '300px' }}>
              {TeamLabels.length > 0 && TeamDataSets.length > 0 ? (
                <>
                  {selectedChartByDev === 'barGraph' && (
                    <BarChart
                      labels={TeamLabels}
                      datasetData={TeamDataSets}
                      datasetLabel={
                        repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'
                      }
                      height={300}
                      width={500}
                      options={commonChartOptions}
                    />
                  )}

                  {selectedChartByDev === 'lineGraph' && (
                    <LineChart
                      labels={TeamLabels}
                      dataPoints={TeamDataSets}
                      label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                      tension={0.3}
                      height={300}
                      width={470}
                      showGrid={false}
                    />
                  )}

                  {selectedChartByDev === 'doughnutChart' && (
                    <DoughnutChart
                      labels={TeamLabels}
                      dataPoints={TeamDataSets}
                      label={repoConnector === 'GitLab' ? 'Average MR Size' : 'Average PR Size'}
                      height="250px"
                      width="400px"
                      cutoutPercentage="70%"
                    />
                  )}
                  {selectedChartByDev === 'pieChart' && (
                    <PieChart
                      labels={TeamLabels}
                      dataPoints={TeamDataSets}
                      label="Average PR Size"
                      height="250px"
                      width="400px"
                      cutoutPercentage="70%"
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
        )}
      </div>
    </div>
  );
};

export default PullRequestSize;
