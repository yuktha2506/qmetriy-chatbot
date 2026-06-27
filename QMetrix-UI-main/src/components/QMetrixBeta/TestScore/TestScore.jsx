import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Traceability } from './TSLevel2';
import { TestingQuality } from './TSLevel2';
import { TestingProductivity } from './TSLevel2';
import { AutoTestingProductivity } from './TSLevel2';
import { TestCoverage } from './TSLevel2';
import { TestAutomation } from './TSLevel2';
import { TestCycleTime } from './TSLevel2';
import '../../../../assets/css/commonColors.scss';
import { useDispatch, useSelector } from 'react-redux';
import { setProjectList } from '../../../../store/JiraSlices/jiraSlice';
import { DLAView } from './TSLevel2';
import { getId } from '../../../../constants';
import BetaDataCard from '../../BetaDataCard';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { getProjectList } from '../../../../constants';
import getTooltipContent from '../../../../utils/Tooltip';
import tableDataConfig from '../../../../utils/tableDataConfig';
import ReactDOMServer from "react-dom/server";
import { BarChartIcon, LineChartIcon } from '../../../../utils/commonIcons';
import CustomLineBarChart from '../../../../utils/CustomLineBarChart';
import DropdownButton from '../../../Common/DropDown';
import GridDataCard from '../../GridDataCard';
import { InfoIcon } from '../../../../utils/commonIcons';
import TestCycleTimeCard from './TestCycleTimeCard';

const TestScore = ({ testScoreObject, selectedTestMetrics, selectedView }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedCardTitle, setSelectedCardTitle] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [metData, setMetData] = useState([]);
  const [testScoreChartType, setTestScoreChartType] = useState("Line");
  const [testScoreTrendMode, setTestScoreTrendMode] = useState("Days");
  const [testScoreMetricsChartType, setTestScoreMetricsChartType] = useState("bar");
  const [testScoreMetricsMode, setTestScoreMetricsMode] = useState("Days");

  const jiraData = useSelector((state) => state.jira || {});
  const theme = useSelector((state) => state.theme.theme);
  const dispatch = useDispatch();


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

        const metricContribution = project.metricContribution.engineeringScore.testScore || {};
        const formattedMetrics = Object.keys(metricContribution).map((key) => ({
          name: key === 'dla' ? 'DLA' : toNormalCase(key), contribution: metricContribution[key],
        }));

        setMetData(formattedMetrics);
      } catch (error) {
        console.error('Error fetching project list for Test Score tooltip:', error);
      }
    };

    fetchDataForTooltip();
  }, [jiraData.selectedProjectId, selectedTestMetrics]);

  const getPassPercentage = (productivityObj) => {
    const passed = Number(productivityObj?.passed) || 0;
    const failed = Number(productivityObj?.failed) || 0;
    const blocked = Number(productivityObj?.blocked) || 0;
    const untested = Number(productivityObj?.untested) || 0;
    const retest = Number(productivityObj?.retest) || 0;
    const total = passed + failed + blocked + untested + retest;

    if (total > 0) {
      return Math.round((passed / total) * 100);
    }
    return Number(productivityObj?.productivityPercentage) || 0;
  };

  const testingProductivity = getPassPercentage(testScoreObject?.testingProductivity);
  const automationTestingProductivity = getPassPercentage(testScoreObject?.automationTestingProductivity);
  const testCase = testScoreObject?.testingProductivity?.testCase;
  const teamSize = testScoreObject?.testingProductivity?.teamSize;



  const dataTest = useMemo(() => [
    {
      title: 'Test Automation',
      trend: 0,
      trendValue: '0',
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Test Automation`, tableDataConfig[`Test Automation`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Number of Automated Test Cases', value: 0 },
          { label: 'Total Number of Test Cases', value: 0 },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Test Automation', value: '0%' }]
            : []),

        ],
      },
    },
    {
      title: 'Test Cycle Time',
      trend: 40,
      trendValue: 40,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Test Cycle Time`, tableDataConfig[`Test Cycle Time`])),
      showDetails: true,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Average Test Cycle Time', value: 40 },
          { label: 'Average Cycle Time Trend', value: 27 },
          ...(selectedView === 'grid' ? [
            { label: 'Functional', value: 40 },
            { label: 'Performance', value: 40 },
            { label: 'Regression', value: 27 },
            { label: 'Security', value: 27 },
          ] : [])
        ]
      }
    },
    {
      title: 'Test Coverage',
      trend: 0,
      trendValue: 70.27,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Test Coverage`, tableDataConfig[`Test Coverage`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Number of Lines Executed', value: 2600 },
          { label: 'Total Number of Lines', value: 3700 },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Test Coverage', value: '70' }]
            : []),
        ],
      },
    },


    {
      title: 'Traceability',
      trend: 2,
      trendValue: '0',
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Traceability`, tableDataConfig[`Traceability`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Number of Test Cases Created', value: 0 },
          { label: 'Number of Functional Requirements to be Tested', value: 0 },

          ...(selectedView === 'grid'
            ? [{ label: 'Average Traceability', value: '0' }]
            : []),
        ],
      },
    },
    {
      title: 'Testing Quality',
      trend: 100,
      trendValue: testScoreObject?.testingQuality?.testingquality
        ? testScoreObject?.testingQuality?.testingquality
        : 0,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Testing Quality`, tableDataConfig[`Testing Quality`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          {
            label: 'Invalid or Low Priority Bugs', value: testScoreObject?.testingQuality?.lowPriorityBugs
              ? testScoreObject?.testingQuality?.lowPriorityBugs
              : 0,
          },
          {
            label: 'Total Bugs Logged', value: testScoreObject?.testingQuality?.totalBugs
              ? testScoreObject?.testingQuality?.totalBugs
              : 0,
          },

          ...(selectedView === 'grid'
            ? [{ label: 'Average Testing Quality', value: testScoreObject?.testingQuality?.testingquality }]
            : []),
        ],
      },
    },
    {
      title: 'Testing Productivity',
      trend: 0,
      trendValue: testingProductivity > 0 ? `${testingProductivity}%` : '0%',
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Testing Productivity`, tableDataConfig[`Testing Productivity`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          {
            label: 'Number of Test Cases Executed', value: testScoreObject?.testingProductivity
              ?.executedTestCases || 0
          },
          { label: 'Team Size', value: testScoreObject?.testingProductivity?.teamSize || 0 },
          ...(selectedView === 'grid'
            ? [{
            label: 'Average Testing Productivity', value: testingProductivity
            },
            ]
            : []),
        ],
      },
    },
    {
      title: 'Automation Testing Productivity',
      trend: 0,
      trendValue: automationTestingProductivity > 0 ? `${automationTestingProductivity}%` : '0%',
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Automation Testing Productivity`, tableDataConfig[`Automation Testing Productivity`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Number Of Tests Executed', value: testScoreObject?.automationTestingProductivity?.executedTestCases || 0 },
          { label: 'Team Size', value: testScoreObject?.automationTestingProductivity?.teamSize || 0 },

          {
            label: 'Auto Testing Productivity',
            value: automationTestingProductivity,
          },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Automation Testing Productivity', value: automationTestingProductivity > 0 ? `${automationTestingProductivity}` : '0' }]
            : []),
        ],
      },
    },
    {
      title: 'DLA',
      trend: 0,
      trendValue: `${testScoreObject?.dlaObject?.dla} %` || 0,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`DLA`, tableDataConfig[`DLA`])),
      showDetails: false,
      mainContentData: {
        secondaryMetrics: [
          { label: 'Prod Bugs', value: testScoreObject?.dlaObject?.prodBugs || 0 },
          { label: 'UAT Bugs', value: testScoreObject?.dlaObject?.uatBugs || 0 },
          { label: 'Escaped Bugs', value: testScoreObject?.dlaObject?.escapedBugs || 0 },
          { label: 'Total Bugs', value: testScoreObject?.dlaObject?.totalBugs || 0 },
          ...(selectedView === 'grid'
            ? [{ label: 'Average Defect Leakage Analysis', value: testScoreObject?.dlaObject?.dla ? `${testScoreObject?.dlaObject?.dla} ` : '0' }
            ]
            : []),
        ],
      },
    },

  ], [
    testScoreObject?.testingQuality?.testingquality,
    testScoreObject?.testingQuality?.lowPriorityBugs,
    testScoreObject?.testingQuality?.totalBugs,
    testingProductivity,
    testCase,
    teamSize,
    automationTestingProductivity,
    testScoreObject?.dlaObject?.dla,
    testScoreObject?.dlaObject?.prodBugs,
    testScoreObject?.dlaObject?.uatBugs,
    testScoreObject?.dlaObject?.escapedBugs,
    testScoreObject?.dlaObject?.totalBugs,
    selectedView
  ]);

  const testScoreTrendDropdownOptions = [
    { label: '7', value: '7' },
    { label: '15', value: '15' },
    { label: '30', value: '30' }
  ];
  const testScoreMetrics = [
    {
      day: 'Feb25',
      testCoverage: 65,
      testAutomation: 72,
      traceability: 80,
      testingQuality: 75,
      testingProductivity: 68,
      automationTestingProductivity: 70,
      dla: 60,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Feb26',
      testCoverage: 67,
      testAutomation: 74,
      traceability: 81,
      testingQuality: 76,
      testingProductivity: 70,
      automationTestingProductivity: 72,
      dla: 62,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Feb27',
      testCoverage: 66,
      testAutomation: 70,
      traceability: 78,
      testingQuality: 74,
      testingProductivity: 69,
      automationTestingProductivity: 71,
      dla: 61,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Feb28',
      testCoverage: 68,
      testAutomation: 73,
      traceability: 82,
      testingQuality: 77,
      testingProductivity: 71,
      automationTestingProductivity: 74,
      dla: 63,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Mar01',
      testCoverage: 70,
      testAutomation: 75,
      traceability: 85,
      testingQuality: 78,
      testingProductivity: 72,
      automationTestingProductivity: 75,
      dla: 64,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Mar02',
      testCoverage: 72,
      testAutomation: 77,
      traceability: 86,
      testingQuality: 79,
      testingProductivity: 73,
      automationTestingProductivity: 76,
      dla: 65,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Mar03',
      testCoverage: 74,
      testAutomation: 79,
      traceability: 88,
      testingQuality: 80,
      testingProductivity: 75,
      automationTestingProductivity: 78,
      dla: 66,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Mar04',
      testCoverage: 75,
      testAutomation: 80,
      traceability: 89,
      testingQuality: 81,
      testingProductivity: 76,
      automationTestingProductivity: 79,
      dla: 67,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Mar05',
      testCoverage: 76,
      testAutomation: 82,
      traceability: 90,
      testingQuality: 82,
      testingProductivity: 77,
      automationTestingProductivity: 80,
      dla: 68,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
    {
      day: 'Mar06',
      testCoverage: 77,
      testAutomation: 83,
      traceability: 91,
      testingQuality: 83,
      testingProductivity: 78,
      automationTestingProductivity: 81,
      dla: 69,
      testCoverageColor: '#8349CF',
      testAutomationColor: '#3296A1',
      traceabilityColor: '#5145BA',
      testingQualityColor: '#84A9FF',
      testingProductivityColor: '#8C564B',
      automationTestingProductivityColor: '#E377C2',
      dlaColor: '#7F7F7F',
    },
  ];
  const testScoreTrendData = [
    {
      day: 'Feb25',
      testScore: 65,
      testScoreColor: '#5580A6',
    },
    {
      day: 'Feb26',
      testScore: 68,
      testScoreColor: '#5580A6',
    },
    {
      day: 'Feb27',
      testScore: 62,
      testScoreColor: '#5580A6',
    },
    {
      day: 'Feb28',
      testScore: 66,
      testScoreColor: '#5580A6',
    },
    {
      day: 'Mar01',
      testScore: 70,
      testScoreColor: '#5580A6',
    },
    {
      day: 'Mar02',
      testScore: 74,
      testScoreColor: '#5580A6',
    },
    {
      day: 'Mar03',
      testScore: 69,
      testScoreColor: '#5580A6',
    },
  ];

  const [cardDataTest, setCardDataTest] = useState(() => {
    const savedData = getId().cardsDataTest;
    return savedData ? JSON.parse(savedData) : dataTest;
  });

  const handleSelectCard = (index, title) => {
    setCardDataTest((prevData) =>
      prevData.map((card, i) => ({
        ...card,
        isSelected: i === index ? !card.isSelected : card.isSelected,
      })),
    );
    const updatedCards = cardDataTest.map((card, i) =>
      i === index ? { ...card, showDetails: !card.showDetails } : card,
    );
    setCardDataTest(updatedCards);
    setSelectedCardIndex((prevIndex) => (prevIndex === index ? null : index));
    setSelectedCardTitle((prevTitle) => (prevTitle === title ? null : title));
  };

  const filteredMetricsData = dataTest.filter(metric =>
    selectedTestMetrics.includes(metric.title)
  );
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
  const trendAverages = calculateAverages(testScoreMetrics, [
    'automationTestResult',
    'manualTestResult',
    'openBugs',
    'dla',
    'traceability',
  ]);
  const testScoreAvg = calculateAverages(testScoreTrendData, ['testScore']);

  return (
    <>
      <div className='flex justify-between gap-2 '>
        <div className="relative flex items-center">
          <h3 className={`text-xl font-semibold ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-[#d1d5db]'}`}>
            Test Score Detailed View
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
                .sort((a, b) => a.index - b.index)
                .map((metric, index) => (
                  metric.title === 'Test Cycle Time' ? (
                    <TestCycleTimeCard
                      key={metric.title}
                      title={metric.title}
                      value={metric.value}
                      trendValue={metric.trendValue}
                      toolTip={metric.toolTip}
                      index={index}
                      onSelectCard={() => handleSelectCard(index, metric.title)}
                      className="col-span-2"
                      metricsLeft={[
                        { label: "Test Cycle Time", value: 4 },
                        { label: "Cycle Time Trend", value: 2 },
                        { label: "Average Test Cycle Time", value: 40 },
                        { label: "Average Cycle Time Trend", value: 40 },
                      ]}
                      metricsRight={[
                        { label: "Functional", value: 4 },
                        { label: "Performance", value: 4 },
                        { label: "Regression", value: 2 },
                        { label: "Security", value: 2 },
                      ]}
                    />) : (

                    <GridDataCard
                      key={metric.title}
                      title={metric.title}
                      trend={metric.trend}
                      trendValue={metric.trendValue}
                      toolTip={metric.toolTip}
                      mainContentData={metric.mainContentData}
                      isGridViewCard={true}
                      index={index}
                      isSelected={selectedCardIndex === index && selectedCardTitle === metric.title}
                      onSelectCard={() => handleSelectCard(index, metric.title)}
                    />
                  ))
                )}
              <GridDataCard
                title="Trend"
                isGridViewCard={true}
                isTestScoreTrendCard={true}
                metrics={[
                  { label: 'Average Test Score', value: testScoreAvg?.testScore },
                  { label: "Average Automation Test Results", value: trendAverages.automationTestResult },
                  { label: "Average Manual Test Results", value: trendAverages.manualTestResult },
                  { label: "Average Open Bugs", value: trendAverages.openBugs },
                  { label: "Average DLA", value: trendAverages.dla },
                  { label: "Average Traceability", value: trendAverages.traceability },
                ]}
              />
            </div>
          ) : (
            <>
              {filteredMetricsData
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
                          mainContentData={metric.mainContentData}
                        />
                      </div>

                      <div className="col-span-8">
                        <div className="w-full h-full">
                          {metric.title === 'Test Coverage' && <TestCoverage />}
                          {metric.title === 'Test Automation' && <TestAutomation />}
                          {metric.title === 'Traceability' && <Traceability />}
                          {metric.title === 'Testing Quality' && (
                            <TestingQuality testingQuality={testScoreObject} />
                          )}
                          {metric.title === 'Testing Productivity' && (
                            <TestingProductivity testScoreObject={testScoreObject?.testingProductivity} />
                          )}
                          {metric.title === 'Automation Testing Productivity' && (
                            <AutoTestingProductivity testScoreObject={testScoreObject?.automationTestingProductivity} />
                          )}
                          {metric.title === 'DLA' && (
                            <DLAView defectLeakageAnalysis={testScoreObject} />
                          )}
                          {metric.title === 'Test Cycle Time' && (
                            <TestCycleTime />
                          )}                        
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
                Test Score Days Trend
              </h2>
              <div className='flex'>
                <DropdownButton
                  buttonLabel={testScoreTrendMode}
                  options={testScoreTrendDropdownOptions}
                  selectedOption={testScoreTrendDropdownOptions.find((option) => option.value === testScoreTrendMode)?.label}
                  placeholder="Days"
                  onSelect={(option) => setTestScoreTrendMode(option.value)}
                  width='sm'
                />
                <div className="flex items-center space-x-2 ml-2">
                <div className="relative group">
                <LineChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      testScoreChartType === "Line"
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setTestScoreChartType("Line")}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Line Chart
                  </div>
                  </div>

                  <div className="relative group">
                  <BarChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      testScoreChartType === "bar"
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setTestScoreChartType("bar")}
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
                  testScoreChartType === "Line" ? (
                    <CustomLineBarChart data={testScoreTrendData} showLine={true} showBar={false} type={'testScoreTrend'} />
                  ) : (
                    <CustomLineBarChart data={testScoreTrendData} showLine={false} showBar={true} type={'testScoreTrend'} />
                  )
                }
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h2 className="text-[#0A2342] dark:text-[#d1d5db] text-lg font-semibold mb-2 text-center">
                Test Score 15 Days Trend
              </h2>
              <div className='flex'>
                <DropdownButton
                  buttonLabel={testScoreMetricsMode}
                  options={testScoreTrendDropdownOptions}
                  selectedOption={testScoreTrendDropdownOptions.find((option) => option.value === testScoreMetricsMode)?.label}
                  placeholder="Days"
                  onSelect={(option) => setTestScoreMetricsMode(option.value)}
                  width='sm'
                />
                <div className="flex items-center space-x-2 ml-2">
                <div className="relative group">
                <LineChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      testScoreMetricsChartType === "Line"
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setTestScoreMetricsChartType("Line")}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Line Chart
                  </div>
                  </div>

                  <div className="relative group">
                  <BarChartIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      testScoreMetricsChartType === "bar"
                        ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setTestScoreMetricsChartType("bar")}
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
                  testScoreMetricsChartType === "Line" ? (
                    <CustomLineBarChart data={testScoreMetrics} showLine={true} showBar={false} type={'testScoreMetrics'} />
                  ) : (
                    <CustomLineBarChart data={testScoreMetrics} showLine={false} showBar={true} type={'testScoreMetrics'} />
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

export default TestScore;

TestScore.propTypes = {
  testScoreObject: PropTypes.object.isRequired,
  selectedTestMetrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedView: PropTypes.string.isRequired,
};
