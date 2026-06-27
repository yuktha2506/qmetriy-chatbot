import { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import DropdownButton from '../../../Common/DropDown';
import { getId } from '../../../../constants';
import '../../../../assets/css/commonColors.scss';
import { useDispatch, useSelector } from 'react-redux';
import { setProjectList } from '../../../../store/JiraSlices/jiraSlice';
import { CodeCoverage } from './DSLevel2';
import { ReworkRatio } from './DSLevel2';
import { DefectDensity } from './DSLevel2';
import { TimeToFix } from './DSLevel2';
import BetaDataCard from '../../BetaDataCard';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import getTooltipContent from '../../../../utils/Tooltip';
import tableDataConfig from '../../../../utils/tableDataConfig';
import ReactDOMServer from "react-dom/server";
import CustomLineBarChart from '../../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, InfoIcon } from '../../../../utils/commonIcons';
import GridDataCard from '../../GridDataCard';
import Spinner from '../../../Common/Spinner';
import { getProjectList } from '../../../../constants';
import { ReleaseCycleTime } from './DSLevel2';
import StaticCodeAnalysisCard from './StaticCodeAnalysisCard';
import TimeToFixBugCard from './TimeToFixBugCard';

const DevScore = ({
  timeToFix,
  defectDensity,
  cycleTime,
  getEngineeringScoreTrends,
  pageValue,
  type,
  fetchGetRelaseReadinessTrends,
  handlePageChange,
  selectedDeveloperMetrics,
  selectedView
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const [metricsDataDev, setMetricsDataDev] = useState([]);
  const [selectedCardTitle, setSelectedCardTitle] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [cycleTimeData, setCycleTimeData] = useState([]);
  const [chartType, setChartType] = useState('Line');
  const [fifteenDayChartData, setFifteenDayChartData] = useState("bar");
  const [fifteenDayDropdownChartData, setFifteenDayDropdownChartData] = useState("Days");
  const [loading, setLoading] = useState(false);
  const jiraData = useSelector((state) => state.jira || {});
  const cxoData = useSelector((state) => state.cxo || {});
  const theme = useSelector((state) => state.theme.theme);
  const [defectDensityAvg, setDefectDensityAvg] = useState(0);
  const [codeCoverageAvg, setCodeCoverageAvg] = useState(0);
  const [metData, setMetData] = useState([]);
  const { sonarQubeGitData } = useSelector((state) => state.sonarQubeGit || {});
  const dispatch = useDispatch();

  const timeToFixVal = cxoData?.releaseReadinessData?.savedCXO?.engineeringScoreObject?.developerScoreObject?.timeToFix || {};
  const totalResolvedBugs = timeToFixVal?.totalResolvedBugs ?? 0;
  const totalEffortSpent = timeToFixVal?.totalTimeSpent ?? 0;
  const toNormalCase = (camelCaseStr) => {
    return camelCaseStr
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (str) => str.toUpperCase());
  };

  let staticCodeTrendVal = 0;

  if (Array.isArray(jiraData.repoList) && jiraData.repoList.length > 0) {
    staticCodeTrendVal = ['undefined', 'null', '', '0'].includes(
      `${cxoData?.releaseReadinessData?.savedCXO?.engineeringScoreObject?.developerScoreObject?.combinedScanData?.staticCodeAnalysisScore}`,
    )
      ? 0
      : Number(
        cxoData?.releaseReadinessData?.savedCXO?.engineeringScoreObject?.developerScoreObject
          ?.combinedScanData?.staticCodeAnalysisScore,
      ) || 0;
  }

  useEffect(() => {
    if (jiraData) {
      setCycleTimeData(jiraData.cycleTimeData || []);
    }
  }, [jiraData]);

  useEffect(() => {
    const companyId = getId().companyId;
    const sprintId = getId().sprintId;
    const projectId = getId().projectId;
    const releaseId = getId().releaseId;

    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchGetRelaseReadinessTrends({
          companyId,
          projectId,
          releaseId,
          value: type.toLowerCase(),
          pageValue,
          sprintId,
        });

        let projects = jiraData?.projectList;
        if (!projects || projects.length === 0) {
          const projectList = await getProjectList();
          projects = projectList?.data || [];
          dispatch(setProjectList(projects));
        }
        const project = projects.find((p) => p._id === jiraData.selectedProjectId);

        if (project) {
          const developerRawMetrics = project.metricContribution?.engineeringScore?.developerScore || {};
          const formattedDeveloperMetrics = Object.keys(developerRawMetrics).map((key) => ({
            name: toNormalCase(key),
            contribution: developerRawMetrics[key],
          }));
          setMetData(formattedDeveloperMetrics);
        }

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fetchGetRelaseReadinessTrends, pageValue, type, jiraData.selectedProjectId, selectedDeveloperMetrics]); // Add selectedDeveloperMetrics to dependencies

  const engineeringScoreTrends = getEngineeringScoreTrends ? getEngineeringScoreTrends : [];
  const labels = engineeringScoreTrends
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((item) =>
      new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    );
  const sortedLabels = engineeringScoreTrends.sort((a, b) => new Date(a.date) - new Date(b.date));
  const engineeringScore = sortedLabels.map((item) => item.engineeringScore);

  const primaryChartColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const rootStyles = getComputedStyle(document.documentElement);
  const convertedDeveloperScore = labels.map((label, index) => ({
    day: label,
    developerScore: engineeringScore[index],
    developerScoreColor: primaryChartColor,
  }));

  const dataDev = useMemo(() => [
    {
      title: 'Cycle Time',
      trend: 29,
      trendValue: `${Math.round(cycleTimeData?.cycleTime?.cycleTimeTrend[0]?.overall?.cycleTime ?? 0)} Days`,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Cycle Time`, tableDataConfig[`Cycle Time`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Total Time Spent', value: Math.round(cycleTimeData?.cycleTime?.cycleTimeTrend[0]?.overall?.totalTimeSpent ?? 0) },
          { label: 'Total Stories Closed', value: Math.round(cycleTimeData?.cycleTime?.cycleTimeTrend[0]?.overall?.completedStoriesCount ?? 0) },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Cycle Time', value: Math.round(cycleTimeData?.cycleTime?.cycleTimeTrend[0]?.overall?.averageCycleTime ?? 0) }]
            : []),
        ],
      }
    },
    {
      title: 'Defect Density',
      trend: 13,
      trendValue: `${defectDensity?.density ?? 0} KLOC`,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Defect Density`, tableDataConfig[`Defect Density`])),
      showDetails: true,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Total Defect', value: defectDensity?.totalBugs ?? 0 },
          { label: 'Total Lines of code', value: defectDensity?.ncloc ?? 0 },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Defect Density', value: defectDensityAvg.toFixed(2) }]
            : []),
        ],
      }
    },
    {
      title: 'Time To Fix Bug',
      trend: 101,
      trendValue: `${timeToFix?.averageTimeToFix === undefined ? 0 : timeToFix?.averageTimeToFix} Days`,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Time To Fix Bug`, tableDataConfig[`Time To Fix Bug`])),
      showDetails: true,
      metrics: [
        { label: 'Total Number Of Resolved Bugs', value: totalResolvedBugs },
        { label: 'Total Effort Spent', value: totalEffortSpent },
      ]
    },
    {
      title: 'Code Coverage',
      trend: 0,
      trendValue: 93.71,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Code Coverage`, tableDataConfig[`Code Coverage`])),
      showDetails: true,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Lines of code tested', value: 3936 },
          { label: 'Total lines of code', value: 4200 },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Code Coverage', value: codeCoverageAvg.toFixed(2) }]
            : []),],
      },
    },
    {
      title: 'Static Code Analysis',
      value: '3.2',
      trend: 0,
      trendValue: staticCodeTrendVal,
      toolTip: ReactDOMServer.renderToStaticMarkup(
        getTooltipContent(
          'Static Code Analysis',
          tableDataConfig['Static Code Analysis'] || []
        )
      ),

      showDetails: true,
      metrics: [
        {
          label: 'Duplicated Files',
          value: sonarQubeGitData?.duplicated_files || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Duplicated Files', tableDataConfig['Duplicated Files']))
        },
        {
          label: 'Duplicated Blocks',
          value: sonarQubeGitData?.duplicated_blocks || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Duplicated Blocks', tableDataConfig['Duplicated Blocks']))
        },
        {
          label: 'Non-Commented Lines Of Code',
          value: sonarQubeGitData?.ncloc || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Non-Commented Lines of Code', tableDataConfig['Non-Commented Lines of Code']))
        },
        {
          label: 'Duplicated Lines',
          value: sonarQubeGitData?.duplicated_lines || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Duplicated Lines', tableDataConfig['Duplicated Lines']))
        },
        {
          label: 'Vulnerabilities',
          value: sonarQubeGitData?.vulnerabilities || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Vulnerabilities', tableDataConfig['Vulnerabilities']))
        },
        {
          label: 'Code Smells',
          value: sonarQubeGitData?.code_smells || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Code Smells', tableDataConfig['Code Smells']))
        },
        {
          label: 'Security Hotspots',
          value: sonarQubeGitData?.security_hotspots || 0,
          toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Security Hotspots', tableDataConfig['Security Hotspots']))
        },
      ]
    }
    ,
    {
      title: 'Rework Ratio',
      trend: 0,
      trendValue: 0,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Rework Ratio`, tableDataConfig[`Rework Ratio`])),
      showDetails: true,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Total Lines Of Code Requiring To Rework', value: 0 },
          { label: 'Total Lines Of Code', value: 0 },
        ],
      }
    }
  ], [cycleTimeData, defectDensity, timeToFix, staticCodeTrendVal, codeCoverageAvg, selectedView, defectDensityAvg]);

  const developerTrendOptions = [
    { value: '7', label: '7' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
  ]

  const barChartData = {
    labels: [
      'Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16', 'Oct 22', 'Oct 24', 'Oct 25',
    ],
    datasets: [
      {
        label: 'Defect Density',
        data: [60, 70, 80, 85, 90, 75, 65, 78, 85, 90, 95],
        backgroundColor: rootStyles.getPropertyValue('--bar-color-primary').trim(),
      },
      {
        label: 'Time To Fix Bug',
        data: [5, 8, 6, 5, 7, 9, 8, 5, 7, 6, 5],
        backgroundColor: rootStyles.getPropertyValue('--bar-color-secondary').trim(),
      },
      {
        label: 'Release Cycle Time',
        data: [2, 3, 1, 4, 2, 3, 2, 1, 2, 3, 2],
        backgroundColor: rootStyles.getPropertyValue('--bar-color-tertiary').trim(),
      },
    ],
  };

  const convertedDevScoreTrend = barChartData.labels.map((day, index) => ({
    day,
    defectDensity: barChartData.datasets[0].data[index],
    timeToFixBug: barChartData.datasets[1].data[index],
    releaseCycleTime: barChartData.datasets[2].data[index],
    defectDensityColor: barChartData.datasets[0].backgroundColor,
    timeToFixBugColor: barChartData.datasets[1].backgroundColor,
    releaseCycleTimeColor: barChartData.datasets[2].backgroundColor,
  }));

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

  const trendAverages = calculateAverages(convertedDevScoreTrend, [
    'defectDensity',
    'timeToFixBug',
    'releaseCycleTime',
  ]);
  const daysESAverages = calculateAverages(convertedDeveloperScore, ['developerScore']);


  const [cardDataDev, setCardDataDev] = useState(() => {
    const savedData = getId().cardsDataDev;
    return savedData ? JSON.parse(savedData) : dataDev;
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

  const updatedMetricsData = metricsDataDev.map((metric) => {
    const trendData = dataDev.find((d) => d.title === metric.title);
    if (trendData) {
      return {
        ...metric,
        trendValue: trendData.trendValue,
      };
    }
    return metric;
  });

  useEffect(() => {
    setMetricsDataDev(dataDev);
  }, [dataDev]);

  const filteredMetricsData = updatedMetricsData.filter(metric =>
    selectedDeveloperMetrics.includes(metric.title)
  );


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
            Developer Score Detailed View
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
      </div>
      <div className="mt-4 space-y-6">
        <DndProvider backend={HTML5Backend}>
          {selectedView === 'grid' ? (
            <div className="grid grid-cols-3 gap-6 items-start mb-6">
              {filteredMetricsData
                .slice()
                .sort((a, b) => {
                  const order = { 'Time To Fix Bug': 2, 'Static Code Analysis': 3 };
                  if (order[a.title] && order[b.title]) return order[a.title] - order[b.title];
                  if (order[a.title]) return -1;
                  if (order[b.title]) return 1;
                  return 0;
                })
                .map((metric, index) => (
                  metric.title === 'Static Code Analysis' ? (
                    <StaticCodeAnalysisCard
                      key={metric.title}
                      title={metric.title}
                      trendValue={metric.trendValue}
                      toolTip={metric.toolTip}
                      mainContentData={metric.mainContentData}
                      metrics={metric.metrics} // Pass metrics if applicable to StaticCodeAnalysisCard
                      index={index}
                      isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                      onSelectCard={() => handleSelectCard(index, metric.title)}
                      className="col-span-2"
                    />
                  ) : metric.title === 'Time To Fix Bug' ? (

                    <TimeToFixBugCard
                      key={metric.title}
                      title={metric.title}
                      trendValue={metric.trendValue}
                      toolTip={metric.toolTip}
                      mainContentData={metric.mainContentData}
                      metrics={metric.metrics} // Pass metrics if applicable to StaticCodeAnalysisCard
                      index={index}
                      isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                      onSelectCard={() => handleSelectCard(index, metric.title)}

                    />
                  ) : (
                    <GridDataCard
                      key={metric.title}
                      title={metric.title}
                      trend={metric.trend}
                      trendValue={metric.trendValue}
                      toolTip={metric.toolTip}
                      mainContentData={metric.mainContentData}
                      isGridViewCard={true}
                      index={index}
                      className="col-span-1"
                    />
                  )
                ))}

              <GridDataCard
                title="Trend"
                isGridViewCard={true}
                isTestScoreTrendCard={false}
                metrics={[
                  { label: 'Average Days ES Trend', value: daysESAverages?.developerScore },
                  { label: 'Average Defect Density', value: trendAverages?.defectDensity },
                  { label: 'Average Time to Fix Bug', value: trendAverages?.timeToFixBug },
                  { label: 'Average Release Cycle Time', value: trendAverages?.releaseCycleTime },
                ]}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-6 items-start mb-6">
                {filteredMetricsData
                  .filter(metric => ['Time To Fix Bug', 'Static Code Analysis'].includes(metric.title))
                  .sort((a, b) => {
                    const order = { 'Time To Fix Bug': 1, 'Static Code Analysis': 2 };
                    return order[a.title] - order[b.title];
                  })
                  .map((metric, index) => (
                    <div key={metric.title} className={metric.title === 'Static Code Analysis' ? 'col-span-8' : 'col-span-4'}>
                      {metric.title === 'Static Code Analysis' ? (
                        <StaticCodeAnalysisCard
                          title={metric.title}
                          trendValue={metric.trendValue}
                          toolTip={metric.toolTip}
                          mainContentData={metric.mainContentData}
                          metrics={metric.metrics}
                          index={index}
                          isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                          onSelectCard={() => handleSelectCard(index, metric.title)}
                        />
                      ) : metric.title === 'Time To Fix Bug' ? (
                        <TimeToFixBugCard
                          key={metric.title}
                          title={metric.title}
                          trendValue={metric.trendValue}
                          toolTip={metric.toolTip}
                          mainContentData={metric.mainContentData}
                          metrics={metric.metrics} // Pass metrics if applicable to StaticCodeAnalysisCard
                          index={index}
                          isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                          onSelectCard={() => handleSelectCard(index, metric.title)}

                        />
                      ) : (
                        <BetaDataCard
                          title={metric.title}
                          trend={metric.trend}
                          trendValue={metric.trendValue}
                          toolTip={metric.toolTip}
                          index={index}
                          isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                          onSelectCard={() => handleSelectCard(index, metric.title)}
                          navigate={metric.title === 'Static Code Analysis' ? 'git' : (metric.title === 'Cycle Time' ? 'jira' : '')}
                          mainContentData={metric.mainContentData}
                        />
                      )}
                    </div>
                  ))}
              </div>

              {filteredMetricsData
                .filter(metric => !['Time To Fix Bug', 'Static Code Analysis'].includes(metric.title))
                .sort((a, b) => a.index - b.index)
                .map((metric, index) => (
                  <div
                    key={index}
                    className="w-full"
                  >
                    <div className="grid grid-cols-12 gap-6 items-start">
                      <div className="col-span-4">
                        <BetaDataCard
                          title={metric.title}
                          trend={metric.trend}
                          trendValue={metric.trendValue}
                          toolTip={metric.toolTip}
                          index={index}
                          isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                          onSelectCard={() => handleSelectCard(index, metric.title)}
                          navigate={metric.title === 'Static Code Analysis' ? 'git' : ''}
                          mainContentData={metric.mainContentData}
                        />
                      </div>
                      {selectedCardTitle && ['Time To Fix Bug', 'Static Code Analysis'].includes(selectedCardTitle) && (
                        <div className="w-full mb-6">
                          <div className="grid grid-cols-12 gap-6 items-start">
                            <div className="col-span-12">
                              {selectedCardTitle === 'Time To Fix Bug' && <TimeToFix timeToFix={timeToFix} />}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="col-span-8">
                        <div className="w-full h-full">
                          {metric.title === 'Code Coverage' && <CodeCoverage onAverageChange={setCodeCoverageAvg} />}
                          {metric.title === 'Defect Density' && <DefectDensity defectDensity={defectDensity} onAverageChange={setDefectDensityAvg} />}
                          {metric.title === 'Time To Fix Bug' && <TimeToFix timeToFix={timeToFix} />}
                          {metric.title === 'Rework Ratio' && <ReworkRatio />}
                          {metric.title === 'Cycle Time' && <ReleaseCycleTime cycleTime={cycleTime} />}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </>
          )}
        </DndProvider>
      </div>

      {selectedCardIndex === null && selectedView === 'list' && (
        <div className="grid grid-cols-2 gap-6 mt-9">

          <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h2 className="w-[40%] text-[#0A2342] dark:text-[#d1d5db] text-lg font-semibold mb-2 text-left">
                Days ES Trend
              </h2>
              <div className="flex">
                <DropdownButton
                  options={[
                    { value: '7', label: '7' },
                    { value: '15', label: '15' },
                    { value: '30', label: '30' },
                  ]}
                  onSelect={handlePageChange}
                  placeholder="Select"
                  selectedOption={pageValue || '7'}
                  width="sm"
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
                    <CustomLineBarChart
                      data={convertedDeveloperScore}
                      showLine={true}
                      showBar={false}
                      type="dayDeveloperScoreTrend"
                    />
                  ) : (
                    <CustomLineBarChart
                      data={convertedDeveloperScore}
                      showLine={false}
                      showBar={true}
                      type="dayDeveloperScoreTrend"
                    />
                  )
                }
              </div>
            </div>
          </div>


          <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between">
            <div className='flex items-center justify-between'>
              <h2 className="text-[#0A2342] dark:text-[#d1d5db] text-lg font-semibold mb-2 text-center">
                15 Days Trend
              </h2>
              <div className='flex'>
                <DropdownButton
                  buttonLabel={fifteenDayDropdownChartData === "Days" ? "Days" : "Week"}
                  options={developerTrendOptions}
                  selectedOption={developerTrendOptions.find((option) => option.value === fifteenDayDropdownChartData)?.label}
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
                    <CustomLineBarChart
                      data={convertedDevScoreTrend}
                      showLine={true}
                      showBar={false}
                      type={'developerScoreTrend'}
                    />
                  ) : (
                    <CustomLineBarChart
                      data={convertedDevScoreTrend}
                      showLine={false}
                      showBar={true}
                      type={'developerScoreTrend'}
                    />
                  )
                }
              </div>
            </div>
          </div>

        </div>
      )}

    </>
  );
};

export default DevScore;

DevScore.propTypes = {
  timeToFix: PropTypes.number.isRequired,
  defectDensity: PropTypes.number.isRequired,
  cycleTime: PropTypes.number.isRequired,
  pageValue: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  handlePageChange: PropTypes.func.isRequired,
  fetchGetRelaseReadinessTrends: PropTypes.func.isRequired,
  getEngineeringScoreTrends: PropTypes.array.isRequired,
  selectedDeveloperMetrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedView: PropTypes.string.isRequired,
};
