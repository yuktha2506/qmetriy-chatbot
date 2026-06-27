import { useEffect, useState, useRef, useMemo } from 'react';
import { getId } from '../../../../constants';
import LeadTimeTable from './OperationScoreLevel2';
import '../../../../assets/css/commonColors.scss';
import { useSelector, useDispatch } from 'react-redux';
import { setProjectList } from '../../../../store/JiraSlices/jiraSlice';
import BetaDataCard from '../../BetaDataCard';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { CommonFunction } from '../../../../utils/commonFunctions';
import { getProjectList } from '../../../../constants';
import { DeploymentFrequency } from './DeploymentFrequency';
import { ChangeFailureRate } from './ChangeFailureRate';
import { MeanTimeRecovery } from './MeanTimeRecovery';
import getTooltipContent from '../../../../utils/Tooltip';
import tableDataConfig from '../../../../utils/tableDataConfig';
import ReactDOMServer from "react-dom/server";
import CustomLineBarChart from '../../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, InfoIcon } from '../../../../utils/commonIcons';
import DropdownButton from '../../../Common/DropDown';
import { setSelectedRepository } from '../../../../store/GitSlices/gitSlices';
import Spinner from '../../../Common/Spinner';
import GridDataCard from '../../GridDataCard';
import PropTypes from 'prop-types';
const OperationScore = ({ selectedOperationMetrics, selectedView
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedCardTitle, setSelectedCardTitle] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [getLeadTime, setLeadTime] = useState([]);
  const [metData, setMetData] = useState([]);
  const [getDoraData, setGetDoraData] = useState([]);
  const gitData = useSelector((state) => state.git || {});
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const [repoList, setRepoList] = useState([]);
  const repoRef = useRef(null);
  const [isRepoOpen, setIsRepoOpen] = useState(false);
  const dispatch = useDispatch();
  const { handleRepo, handleSprint, handleRelease } = CommonFunction();
  const [selectedRepo, setSelectedRepo] = useState('');
  const [leadTimeChartType, setLeadTimeChartType] = useState("bar");
  const [convertedLeadTimeData, setConvertedLeadTimeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('Line');
  const [releaseChartMode, setReleaseChartMode] = useState("Days");
  const [fifteenDayChartData, setFifteenDayChartData] = useState("bar");
  const [fifteenDayDropdownChartData, setFifteenDayDropdownChartData] = useState("Days");
  const [deploymentFrequencyAvg, setDeploymentFrequencyAvg] = useState(0);
  const [changeFailureRateAvg, setChangeFailureRateAvg] = useState(0);
  const [meanTimeRecoveryAvg, setMeanTimeRecoveryAvg] = useState(0);
  const [leadTimeMetricsForCard, setLeadTimeMetricsForCard] = useState(null);
  const converted = [
    {
      day: 'Feb25',
      deploymentFrequency: 70,
      changeFailureRate: 60,
      meanTimeToRecovery: 31,
      leadTimeForChanges: 51,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Feb26',
      deploymentFrequency: 80,
      changeFailureRate: 70,
      meanTimeToRecovery: 32,
      leadTimeForChanges: 52,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Feb27',
      deploymentFrequency: 30,
      changeFailureRate: 80,
      meanTimeToRecovery: 33,
      leadTimeForChanges: 53,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Feb28',
      deploymentFrequency: 45,
      changeFailureRate: 85,
      meanTimeToRecovery: 34,
      leadTimeForChanges: 54,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Mar01',
      deploymentFrequency: 60,
      changeFailureRate: 90,
      meanTimeToRecovery: 35,
      leadTimeForChanges: 55,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Mar02',
      deploymentFrequency: 55,
      changeFailureRate: 75,
      meanTimeToRecovery: 34,
      leadTimeForChanges: 54,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Mar03',
      deploymentFrequency: 75,
      changeFailureRate: 65,
      meanTimeToRecovery: 33,
      leadTimeForChanges: 53,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Mar04',
      deploymentFrequency: 18,
      changeFailureRate: 78,
      meanTimeToRecovery: 32,
      leadTimeForChanges: 52,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Mar05',
      deploymentFrequency: 45,
      changeFailureRate: 85,
      meanTimeToRecovery: 31,
      leadTimeForChanges: 51,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    },
    {
      day: 'Mar06',
      deploymentFrequency: 30,
      changeFailureRate: 90,
      meanTimeToRecovery: 30,
      leadTimeForChanges: 50,
      deploymentFrequencyColor: '#8349CF',
      changeFailureRateColor: '#3296A1',
      meanTimeToRecoveryColor: '#B84446',
      leadTimeForChangesColor: '#5145BA',
    }
  ];

  const primaryChartColor = theme === 'light' ? '#5580A6' : '#84A9FF';

  const convertedOperationScore = [
    {
      day: 'Feb25',
      operationScore: 20,
      operationScoreColor: primaryChartColor,
    },
    {
      day: 'Feb26',
      operationScore: 23,
      operationScoreColor: primaryChartColor,
    },
    {
      day: 'Feb27',
      operationScore: 18,
      operationScoreColor: primaryChartColor,
    },
    {
      day: 'Feb28',
      operationScore: 20,
      operationScoreColor: primaryChartColor,
    },
    {
      day: 'Mar01',
      operationScore: 20,
      operationScoreColor: primaryChartColor,
    },
    {
      day: 'Mar02',
      operationScore: 10,
      operationScoreColor: primaryChartColor,
    },
    {
      day: 'Mar03',
      operationScore: 15,
      operationScoreColor: primaryChartColor,
    },
  ];

  const releaseChartData = [
    { value: '7', label: '7' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
  ]

  const toNormalCase = (camelCaseStr) => {
    return camelCaseStr
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (str) => str.toUpperCase());
  };

  useEffect(() => {
    const fetchDataForTooltip = async () => {
      try {
        let projects = jiraData?.projectList;
        if (!projects || projects.length === 0) {
          const projectList = await getProjectList();
          projects = projectList?.data || [];
          dispatch(setProjectList(projects));
        }
        const project = projects.find((p) => p._id === jiraData.selectedProjectId);

        if (!project) {
          console.error('Project not found');
          return;
        }

        const metricContribution = project.metricContribution.engineeringScore.operationScore || {};
        const formattedMetrics = Object.keys(metricContribution).map((key) => ({
          name: toNormalCase(key),
          contribution: metricContribution[key],
        }));

        setMetData(formattedMetrics);
      } catch (error) {
        console.error('Error fetching project list for Operation Score tooltip:', error);
      }
    };

    fetchDataForTooltip();
  }, [jiraData.selectedProjectId, selectedOperationMetrics]); // Added selectedOperationMetrics to dependencies

  useEffect(() => {
    if (gitData.leadTime) {
      setLeadTime(gitData.leadTime);
      const convertedData = gitData.leadTime.map(item => ({
        day: item.date,
        value: parseFloat(item.total?.toFixed(2)),
        valueColor: '#066FD1'
      }));
      setConvertedLeadTimeData(convertedData);
    }
  }, [gitData]);

  useEffect(() => {
    if (gitData) {
      setGetDoraData(gitData.getDoraData || []);
    } 
  }, [gitData]);

  useEffect(() => {
    if (jiraData) {
      setRepoList(jiraData.repoList || []);
      if (gitData && gitData.selectedRepo) {
        setSelectedRepo(gitData.selectedRepo);
      }
    }
  }, [jiraData, gitData]);

  const leadTimeForChanges = useMemo(
    () => (getLeadTime?.length ? parseFloat(getLeadTime[1]?.total?.toFixed(2)) : 0),
    [getLeadTime]
  );

  const dataOp = useMemo(() => {
    const doraMetrics = getDoraData?.metricsData || [];
    const deploymentFrequency =
      doraMetrics.find((item) => item?.metrics?.deploymentFrequency)?.metrics?.deploymentFrequency || {};
    const changeFailureRate =
      doraMetrics.find((item) => item?.metrics?.changeFailureRate)?.metrics?.changeFailureRate || {};
    const mttr =
      doraMetrics.find((item) => item?.metrics?.mttr)?.metrics?.mttr || {};

    return [
      {
        title: 'Deployment Frequency',
        trend: 0,
        trendValue: `${deploymentFrequency?.avgDeploymentsPerDay ?? 0}deploy/d`,
        toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Deployment Frequency`, tableDataConfig[`Deployment Frequency`])),
        showDetails: true,
        mainContentData: {
          secondaryMetrics: [
            { label: 'Total Success Count', value: deploymentFrequency?.successCount ?? 0 },
            { label: 'Total Days', value: deploymentFrequency?.totalDays ?? 0 },
          ],

        },
      },
      {
        title: 'Change Failure Rate',
        trend: 0,
        trendValue: `${changeFailureRate?.changeFailureRate ?? 0}%`,
        toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Change Failure Rate`, tableDataConfig[`Change Failure Rate`])),
        showDetails: true,
        mainContentData: {

          secondaryMetrics: [
            { label: 'Total Success Count', value: changeFailureRate?.successCount ?? 0 },
            { label: 'Failure Count', value: changeFailureRate?.failureCount ?? 0 },
          ],

        },
      },
      {
        title: 'Lead Time For Changes',
        trend: 0,
        trendValue: `${leadTimeForChanges}`,
        toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Lead Time For Changes`, tableDataConfig[`Lead Time For Changes`])),
        showDetails: true,
        mainContentData: {

          secondaryMetrics: [
            { label: 'Total Success Count', value: leadTimeForChanges?.successCount ?? 0 },
            { label: 'Failure Count', value: leadTimeForChanges?.failureCount ?? 0 },
          ],
        },
        isChartMetric: true,
      },
      {
        title: 'Mean Time To Recovery',
        trend: 0,
        trendValue: `${mttr?.mttr ?? 0}hour`,
        toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Mean Time To Recovery`, tableDataConfig[`Mean Time To Recovery`])),
        showDetails: true,
        mainContentData: {

          secondaryMetrics: [
            { label: 'Total Failures', value: mttr?.totalFailures ?? 0 },
            { label: 'Total Recovery Time', value: mttr?.totalRecoveryTime ?? 0 },
          ],

        },
      },
    ];
  }, [getDoraData, leadTimeForChanges]);

  const [cardDataDev, setCardDataDev] = useState(() => {
    const savedData = getId().cardsDataOperation;
    return savedData ? JSON.parse(savedData) : dataOp;
  });

  const handleSelectCard = (index, title) => {
    setCardDataDev((prevData) =>
      prevData.map((card, i) => ({
        ...card,
        isSelected: i === index ? !card.isSelected : card.isSelected,
      })),
    );
    const updatedCards = cardDataDev.map((card, i) =>
      i === index ? { ...card, showDetails: !card.showDetails } : card,
    );
    setCardDataDev(updatedCards);
    setSelectedCardIndex((prevIndex) => (prevIndex === index ? null : index));
    setSelectedCardTitle((prevTitle) => (prevTitle === title ? null : title));
  };

  const filteredMetricsData = useMemo(() =>
    dataOp.filter(metric => selectedOperationMetrics.includes(metric.title)),
    [dataOp, selectedOperationMetrics]
  );

  const moveCard = (dragIndex, hoverIndex) => {
    const updatedCards = [...filteredMetricsData];
    const [draggedCard] = updatedCards.splice(dragIndex, 1);
    updatedCards.splice(hoverIndex, 0, draggedCard);
  };

  const handleRepoChange = async (value) => {
    try {
      await handleRepo(value, dispatch);
      setLoading(true);
    } catch (error) {
      console.error('Error handling repo selection in handleRepo:', error);
    } finally {
      setLoading(false);
    }

    const selectedRep = repoList?.find((repo) => repo === value.label);
    sessionStorage.setItem('repo', selectedRep);
    setSelectedRepo(selectedRep);
    dispatch(setSelectedRepository(selectedRep));
    const storedSprintId = sessionStorage.getItem("sprintId");
    if (storedSprintId) {
      await handleSprint(storedSprintId, dispatch);
    }

    const storedReleaseId = sessionStorage.getItem("releaseId");
    if (storedReleaseId) {
      await handleRelease(storedReleaseId, dispatch);
    }
  };

  const calculateAverages = (dataArray, keys) => {
    const totals = {};
    const counts = {};
    dataArray.forEach(entry => {
      keys.forEach(key => {
        const val = entry[key];
        if (typeof val === 'number') {
          totals[key] = (totals[key] || 0) + val;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });
    const averages = {};
    keys.forEach(key => {
      averages[key] = counts[key] ? (totals[key] / counts[key]).toFixed(2) : '0.00';
    });
    return averages;
  };

  const trendAverages = calculateAverages(converted, [
    'deploymentFrequency',
    'changeFailureRate',
    'meanTimeToRecovery',
    'leadTimeForChanges',
  ]);
  const daysESAverages = calculateAverages(convertedOperationScore, ['operationScore']);
  useEffect(() => {
    if (gitData.leadTime?.length) {
      const overallLeadTimeData = gitData.leadTime[0] || {};
      const totalPRs = overallLeadTimeData.totalPRs ?? 0;
      const avgLTC = overallLeadTimeData.avgLTC ?? 0;
      const minLTC = overallLeadTimeData.minLTC ?? 0;
      const maxLTC = overallLeadTimeData.maxLTC ?? 0;
      const secondaryMetrics = [
        { label: "Total PRs", value: totalPRs },
        { label: "Average LTC (Days)", value: typeof avgLTC === 'number' ? avgLTC.toFixed(1) : avgLTC },
        { label: "Minimum LTC (Days)", value: typeof minLTC === 'number' ? minLTC.toFixed(1) : minLTC },
        { label: "Maximum LTC (Days)", value: typeof maxLTC === 'number' ? maxLTC.toFixed(1) : maxLTC },
      ];

      setLeadTimeMetricsForCard({ secondaryMetrics });
    } else {
      setLeadTimeMetricsForCard({
        secondaryMetrics: [
          { label: "Total PRs", value: 0 },
          { label: "Average LTC (Days)", value: "0.0" },
          { label: "Minimum LTC (Days)", value: "0.0" },
          { label: "Maximum LTC (Days)", value: "0.0" },
        ],
      });
    }
  }, [gitData.leadTime]);
  return (
    <>
      {loading && (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
          <Spinner />
        </div>
      )}
      <div className='flex justify-between gap-2 '>
        <div className="relative flex items-center">
          <h3 className={`text-xl font-semibold ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-[#d1d5db]'}`}>
            Operation Score Detailed View
          </h3>
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <InfoIcon className={`w-5 h-5 cursor-pointer ml-2 ${theme === 'light' ? 'text-[#24527A]' : 'text-[#d1d5db]'}`} />
            {showTooltip && (
              <div className={`absolute left-0 top-full mt-2 p-3 text-sm rounded shadow-lg z-10 w-max min-w-[200px] ${
                theme === 'light' 
                  ? 'bg-[#0D1621] text-white border border-[#224F78]' 
                  : 'bg-secondary-600 text-custom-gray'
              }`}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={theme === 'light' ? 'bg-[#224F78] text-white' : 'bg-gray-700 text-gray-100'}>
                      <th className="border-b px-3 py-2 text-left font-semibold">Metric</th>
                      <th className="border-b px-3 py-2 text-left font-semibold">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metData.map((metric, index) => (
                      <tr
                        key={index}
                        className={`${
                          theme === 'light' 
                            ? (index % 2 === 0 ? 'bg-[#0D1621]' : 'bg-[#1A2B3C]') + ' hover:bg-[#224F78] text-white'
                            : (index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800') + ' hover:bg-gray-700 text-gray-100'
                        } transition-all`}
                      >
                        <td className="px-3 py-2 border-b">
                          {metric.name}
                        </td>
                        <td className="px-3 py-2 border-b font-semibold">
                          {metric.contribution}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className='flex items-center gap-4'>
          <div>
            <DropdownButton
              buttonLabel="Select Repository"
              options={
                repoList?.map((repo) => ({
                  label: repo,
                })) || []
              }
              onSelect={handleRepoChange}
              placeholder="Select repository"
              selectedOption={selectedRepo}
              isOpen={isRepoOpen}
              setIsOpen={setIsRepoOpen}
              reference={repoRef}
              type="Repo"
            />
          </div>
        </div>

      </div>

      <div className="mt-4 space-y-6">
        <DndProvider backend={HTML5Backend}>
          {selectedView === 'grid' ? (
            <div className="grid grid-cols-3 gap-6 items-start mb-6">
              {filteredMetricsData
                .filter(metric => !['Test Cycle Time'].includes(metric.title))
                .sort((a, b) => a.index - b.index)
                .map((metric, index) => {
                  let mainContentData = { ...metric.mainContentData };
                  if (metric.title === 'Deployment Frequency') {
                    mainContentData = {
                      ...mainContentData,
                      secondaryMetrics: [
                        ...mainContentData.secondaryMetrics,
                        { label: 'Average Deployment Frequency', value: deploymentFrequencyAvg.toFixed(2) }
                      ]
                    };
                  }
                  if (metric.title === 'Change Failure Rate') {
                    mainContentData = {
                      ...mainContentData,
                      secondaryMetrics: [
                        ...mainContentData.secondaryMetrics,
                        { label: 'Average Change Failure Rate', value: changeFailureRateAvg.toFixed(2) }
                      ]
                    };
                  }
                  if (metric.title === 'Mean Time To Recovery') {
                    mainContentData = {
                      ...mainContentData,
                      secondaryMetrics: [
                        ...mainContentData.secondaryMetrics,
                        { label: 'Average Mean Time To Recovery', value: meanTimeRecoveryAvg.toFixed(2) }
                      ]
                    };
                  }
                  if (metric.title === 'Lead Time For Changes' && leadTimeMetricsForCard) {
                    mainContentData = {
                      ...mainContentData,
                      primaryMetricValue: null,
                      secondaryMetrics: leadTimeMetricsForCard.secondaryMetrics
                    };
                  }
                  return (
                    <GridDataCard
                      key={metric.title}
                      title={metric.title}
                      trend={metric.trend}
                      trendValue={metric.trendValue}
                      toolTip={metric.toolTip}
                      mainContentData={mainContentData}
                      isGridViewCard={true}
                      index={index}
                    />
                  );
                })}
              <GridDataCard
                title="Trend"
                isGridViewCard={true}
                isTestScoreTrendCard={false}
                metrics={[
                  { label: 'Average Operation Score', value: daysESAverages?.operationScore },
                  { label: 'Average Deployment Frequency', value: trendAverages?.deploymentFrequency },
                  { label: 'Average Change Failure Rate', value: trendAverages?.changeFailureRate },
                  { label: 'Average Mean Time To Recovery', value: trendAverages?.meanTimeToRecovery },
                  { label: 'Average Lead Time For Changes', value: trendAverages?.leadTimeForChanges },
                ]}
              />
            </div>
          ) : (
            <>
              {filteredMetricsData
                .sort((a, b) => a.index - b.index)
                .map((metric, index) => (
                  <div key={index} className="w-full">
                    <div className="grid grid-cols-12 gap-6 items-start">
                      <div className="col-span-4">
                        <BetaDataCard
                          title={metric.title}
                          trend={metric.trend}
                          trendValue={metric.trendValue}
                          toolTip={metric.toolTip}
                          index={index}
                          moveCard={moveCard}
                          isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                          onSelectCard={() => handleSelectCard(index, metric.title)}
                          mainContentData={metric.mainContentData}
                        />
                      </div>
                      <div className="col-span-8">
                        <div className="w-full h-full">
                          {metric.title === 'Lead Time For Changes' && (
                            <div className="flex flex-col h-full">
                              {selectedCardTitle === 'Lead Time For Changes' && selectedCardIndex === index && (
                                <div className="flex flex-col h-full">
                                  <div className="flex justify-end mb-4">
                                    <div className="flex space-x-1">
                                      <div className="relative group">
                                        <LineChartIcon
                                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${leadTimeChartType === "Line"
                                            ? 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]'
                                            : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]'
                                            }`}
                                          onClick={() => setLeadTimeChartType("Line")}
                                        />
                                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                                          Line Chart
                                        </div>
                                      </div>
                                      <div className="relative group">
                                        <BarChartIcon
                                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${leadTimeChartType === "bar"
                                            ? 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]'
                                            : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]'
                                            }`}
                                          onClick={() => setLeadTimeChartType("bar")}
                                        />
                                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                                          Bar Chart
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="h-64 overflow-x-auto overflow-y-hidden mt-6" style={{ width: '100%', maxWidth: '100%' }}>
                                    <div style={{ minWidth: '100%', height: '100%' }}>
                                      {
                                        leadTimeChartType === "Line" ? (
                                          <CustomLineBarChart data={convertedLeadTimeData} showLine={true} showBar={false} type={'leadTimeTrend'} />
                                        ) : (
                                          <CustomLineBarChart data={convertedLeadTimeData} showLine={false} showBar={true} type={'leadTimeTrend'} />
                                        )
                                      }
                                    </div>
                                  </div>
                                </div>
                              )}
                              <LeadTimeTable />
                            </div>
                          )}
                          {metric.title === 'Deployment Frequency' && <DeploymentFrequency onAverageChange={setDeploymentFrequencyAvg} />}
                          {metric.title === 'Change Failure Rate' && <ChangeFailureRate onAverageChange={setChangeFailureRateAvg} />}
                          {metric.title === 'Mean Time To Recovery' && <MeanTimeRecovery onAverageChange={setMeanTimeRecoveryAvg} />}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </>
          )}

          {(convertedOperationScore.length > 0) && selectedView === 'list' && (
            <div className="grid grid-cols-2 gap-6 mt-9">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <h2 className="w-[40%] text-[#0A2342] dark:text-[#d1d5db] text-lg font-semibold mb-2 text-left">
                    Operation score Trend
                  </h2>
                  <div className='flex'>
                    <DropdownButton
                      buttonLabel={releaseChartMode === "Days" ? "Days" : "Week"}
                      options={releaseChartData}
                      selectedOption={releaseChartData.find((option) => option.value === releaseChartMode)?.label}
                      placeholder="Days"
                      onSelect={(option) => setReleaseChartMode(option.value)}
                      width='sm'
                    />
                    <div className="flex items-center space-x-2 ml-2">
                      <div className="relative group">
                        <LineChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            chartType === "Line"
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                          }`}
                          onClick={() => setChartType("Line")}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Line Chart
                        </div>
                      </div>
                      <div className="relative group">
                        <BarChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            chartType === "bar"
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                          }`}
                          onClick={() => setChartType("bar")}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Bar Chart
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-64 overflow-x-auto overflow-y-hidden mt-6" style={{ width: '100%', height: "100%" }}>
                  <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                    {
                      chartType === "Line" ? (
                        <CustomLineBarChart data={convertedOperationScore} showLine={true} showBar={false} type={'dayOperationTrend'} />
                      ) : (
                        <CustomLineBarChart data={convertedOperationScore} showLine={false} showBar={true} type={'dayOperationTrend'} />
                      )
                    }
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between">
                <div className='flex items-center justify-between'>
                  <h2 className="text-[#0A2342] dark:text-[#d1d5db] text-lg font-semibold mb-2 text-center">
                    15 days Trend
                  </h2>
                  <div className='flex'>
                    <DropdownButton
                      buttonLabel={fifteenDayDropdownChartData === "Days" ? "Days" : "Week"}
                      options={releaseChartData}
                      selectedOption={releaseChartData.find((option) => option.value === fifteenDayDropdownChartData)?.label}
                      placeholder="Days"
                      onSelect={(option) => setFifteenDayDropdownChartData(option.value)}
                      width='sm'
                    />
                    <div className="flex items-center space-x-2 ml-2">
                      <div className="relative group">
                        <LineChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            fifteenDayChartData === "Line"
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                          }`}
                          onClick={() => setFifteenDayChartData("Line")}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Line Chart
                        </div>
                      </div>
                      <div className="relative group">
                        <BarChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            fifteenDayChartData === "bar"
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                          }`}
                          onClick={() => setFifteenDayChartData("bar")}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Bar Chart
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                <div className="h-64 overflow-x-auto overflow-y-hidden mt-6" style={{ width: '100%', maxWidth: '100%' }}>
                  <div style={{ minWidth: '100%', height: '100%' }}>
                    {
                      fifteenDayChartData === "Line" ? (
                        <CustomLineBarChart data={converted} showLine={true} showBar={false} type={'operationScoreTrend'} />
                      ) : (
                        <CustomLineBarChart data={converted} showLine={false} showBar={true} type={'operationScoreTrend'} />
                      )
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </DndProvider>
      </div>
    </>
  );
};

export default OperationScore;

OperationScore.propTypes = {
  selectedOperationMetrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedView: PropTypes.string.isRequired,
};
