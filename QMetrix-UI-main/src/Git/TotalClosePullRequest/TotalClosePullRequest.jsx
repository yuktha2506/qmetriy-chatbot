import { useState, useEffect } from 'react';
import DropdownButton from '../../Common/DropDown';
import BarChart from '../../Common/BarGraph';
import LineChart from '../../Common/LineChart';
import DoughnutChart from '../../Common/DonutChart';
import 'chart.js/auto';
import { useSelector } from 'react-redux';
import { APP_STRINGS } from '../../../constants';
import PieChart from '../../Common/PieChart';

const TotalClosedPullRequest = () => {
  const [selectedChartByDev, setSelectedChartByDev] = useState('barGraph');
  const [selectedChartBySprint, setSelectedChartBySprint] = useState('barGraph');
  const [selectedChartByRelease, setSelectedChartByRelease] = useState('barGraph');
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [getClosedMergeRequestsData, setGetClosedMergeRequestsData] = useState([]);

  const rootStyles = getComputedStyle(document.documentElement);
  const theme = useSelector((state) => state.theme.theme);
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
      setGetClosedMergeRequestsData(gitData.closedPRs);
    }
  }, [jiraData, gitData]);
  const repoConnector = useSelector(
    (state) => state.jira?.repositoryProvider?.repositoryProvider ?? null,
  );
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
      datalabels: {
        color: themes[theme].datalabelsColor,
        font: {
          weight: 'bold',
          size: 12,
        },
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
        borderColor: themes[theme].borderColor,
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
  const SprintLabels =
    getClosedMergeRequestsData?.closedPullRequests?.map((item) => item.name) ?? [];
  const SprintDatasetData =
    getClosedMergeRequestsData?.closedPullRequests?.map((item) => item.count) ?? [];
  const TeamLabels =
    getClosedMergeRequestsData?.totalClosedPullRequestByDev?.map((item) => item.name) ?? [];
  const TeamDataSets =
    getClosedMergeRequestsData?.totalClosedPullRequestByDev?.map((item) => item.count) ?? [];
  const releaseLabels =
    getClosedMergeRequestsData?.closedPullRequests?.map((item) => item.name) ?? [];
  const releaseDatasetData =
    getClosedMergeRequestsData?.closedPullRequests?.map((item) => item.count) ?? [];

  const chartOptions = [
    { label: 'Bar Chart', value: 'barGraph' },
    { label: 'Line Chart', value: 'lineGraph' },
    { label: 'Doughnut Chart', value: 'doughnutChart' },
    { label: 'Pie Chart', value: 'pieChart' },
  ];

  const handleSelectByDev = (option) => {
    setSelectedChartByDev(option.value);
  };

  const handleSelectBySprint = (option) => {
    setSelectedChartBySprint(option.value);
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
                  ? 'Total Closed MR Per Sprint'
                  : repoConnector === 'GitHub'
                  ? 'Total Closed PR Per Sprint'
                  : 'Total Closed PR Per Sprint'}
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
                        repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'
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
                      label={repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'}
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
                      label={repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'}
                      height="300px"
                      width="400px"
                      cutoutPercentage="70%"
                      legendPosition="right"
                    />
                  )}
                  {selectedChartBySprint === 'pieChart' && (
                    <PieChart
                      labels={SprintLabels}
                      dataPoints={SprintDatasetData}
                      label={repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'}
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
        {selectedValue?.value === APP_STRINGS.VALUE_RELEASE && (
          <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-black dark:text-gray-300">
                {repoConnector === 'GitLab'
                  ? 'Total Closed MR Per Release'
                  : repoConnector === 'GitHub'
                  ? 'Total Closed PR Per Release'
                  : 'Total Closed PR Per Release'}
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
                        repoConnector === 'GitLab'
                          ? 'Total Closed Merge Requests'
                          : 'Total Closed Pull Requests'
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
                      label={
                        repoConnector === 'GitLab'
                          ? 'Total Closed Merge Requests'
                          : 'Total Closed Pull Requests'
                      }
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
                        label={
                          repoConnector === 'GitLab'
                            ? 'Total Closed Merge Requests'
                            : 'Total Closed Pull Requests'
                        }
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
                      label={
                        repoConnector === 'GitLab'
                          ? 'Total Closed Merge Requests'
                          : 'Total Closed Pull Requests'
                      }
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
                  ? 'Total Closed MR By Dev'
                  : repoConnector === 'GitHub'
                  ? 'Total Closed PR By Dev'
                  : 'Total Closed PR By Dev'}
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
                        repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'
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
                      label={repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'}
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
                      label={repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'}
                      height="300px"
                      width="400px"
                      cutoutPercentage="70%"
                      legendPosition="right"
                    />
                  )}
                  {selectedChartByDev === 'pieChart' && (
                    <PieChart
                      labels={TeamLabels}
                      dataPoints={TeamDataSets}
                      label={repoConnector === 'GitLab' ? 'Total Closed MR' : 'Total Closed PR'}
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
      </div>
    </div>
  );
};

export default TotalClosedPullRequest;
