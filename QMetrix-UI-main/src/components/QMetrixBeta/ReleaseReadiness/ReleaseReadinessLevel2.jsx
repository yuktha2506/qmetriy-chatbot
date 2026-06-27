import { useState, useEffect, useRef, useMemo } from 'react';
import '../../../assets/css/level2.scss';
import BetaDataCard from '../BetaDataCard';
{/* Since the UI/UX design for the Grid View hasn't been finalized, we have temporarily commented out that section of the code. */}
// import GridDataCard from '../GridDataCard';
import PropTypes from 'prop-types';
import { fetchIssueCount } from '../../../constants';
import MetricsModal from '../DynamicFormulaHandlingModal';
import DropdownButton from '../../Common/DropDown';
import '../../../assets/css/commonColors.scss';
import { useSelector, useDispatch } from 'react-redux';
import { setProjectList } from '../../../store/JiraSlices/jiraSlice';
import { getId, APP_STRINGS } from '../../../constants';
import { AutomationDone, ManualDone } from './RRLevel2';
import { BurnDown } from './RRLevel2';
import { TestCoverage } from './RRLevel2';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { InfoIcon } from '../../../utils/commonIcons';
import { getProjectList } from '../../../constants';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented import later.
// import { getReleaseReadinessDetails } from '../../../constants';
import { getCXODashboardData } from '../../../constants';
import { addReleaseReadinessData } from '../../../store/CXOSlices/cxoSlice';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented import later.
// import { CommonFunction } from '../../../utils/commonFunctions';
import DataCard from '../DataCard';
import ReactDOMServer from "react-dom/server";
import getTooltipContent from '../../../utils/Tooltip';
import tableDataConfig from '../../../utils/tableDataConfig';
{/* Since the UI/UX design for the Grid View hasn't been finalized, we have temporarily commented out that section of the code. */}
// import { GridViewIcon } from '../../../utils/commonIcons';
import { ListViewIcon } from '../../../utils/commonIcons';
import { LineChartIcon, BarChartIcon } from '../../../utils/commonIcons';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';

const ReleaseReadinessLevel2 = ({
  getReleaseReadiness,
  pageValue,
  chartType,
  setChartType,
  handlePageChange,
  getReleaseReadinessTrends,
  type,
  fetchGetRelaseReadinessTrends,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedView, setSelectedView] = useState(APP_STRINGS.VIEW_LIST);
  const [fifteenDayDropdownChartData, setFifteenDayDropdownChartData] = useState('Days');
  const [fifteenDayChartData, setFifteenDayChartData] = useState('bar');
  const [issueCounts, setIssueCounts] = useState([]);
  const [dynamicMetrics, setDynamicMetrics] = useState([]);
  const [staticMetrics, setStaticMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [metricsData, setMetricsData] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [selectedCardTitle, setSelectedCardTitle] = useState(null);
  const [isStoryPoints, setIsStoryPoints] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const jiraData = useSelector((state) => state.jira || {});
  const theme = useSelector((state) => state.theme.theme);
  const [metData, setMetData] = useState([]);
  // For testing purposes we are using unified endpoints. If they work properly, we will remove the commented code later.
  // const { fetchData } = CommonFunction();
  const dispatch = useDispatch();
  const dropdownRef = useRef(null);

  let metricsDataReleaseReadiness=[];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectId = getId().projectId;
        const value = type?.toLowerCase() || APP_STRINGS.API_RELEASE; 
        const response = await fetchIssueCount({ projectId, value });

        setIssueCounts(response.data); 
        const dynamicMetric = (response.data || []).map(item => ({
        name: item.name,
        percentage: 0, 
      }));
      setDynamicMetrics(dynamicMetric);

      const staticMetric = [
        { name: 'Test Coverage', percentage: 0 },
        { name: 'Manual Test Result', percentage: 0 },
        { name: 'Burndown', percentage: 0 },
        { name: 'Automation Test Result', percentage: 0 },
      ];
        setStaticMetrics(staticMetric);
     setMetricsData([...dynamicMetric, ...staticMetric]);

      } catch (err) {
        setIssueCounts([]);
      }
    };
    fetchData();
  }, [type, pageValue, getId().projectId, getId().releaseId, getId().sprintId]);

     metricsDataReleaseReadiness=[...dynamicMetrics, ...staticMetrics];

  // Load metrics contribution data on mount
  useEffect(() => {
    const loadMetricsContribution = async () => {
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

        const metricContribution = project.metricContribution?.releaseReadiness || {};
        const formattedMetrics = Object.keys(metricContribution).map((key) => ({
          name: toNormalCase(key),
          contribution: metricContribution[key],
        }));

        setMetData(formattedMetrics);

        // Set selected metrics based on available contributions
        const availableMetrics = formattedMetrics.map((metric) => metric.name);
        setSelectedMetrics(availableMetrics);
      } catch (error) {
        console.error('Error loading metrics contribution:', error);
      }
    };

    loadMetricsContribution();
  }, [dispatch, jiraData?.projectList, jiraData.selectedProjectId]);

  const releaseReadinesMetricsData = jiraData?.metricContribution?.releaseReadiness;
  const toNormalCase = (camelCaseStr) => {
    return camelCaseStr
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (str) => str.toUpperCase());
  };
  useEffect(() => {
    if (jiraData.selectedValue === APP_STRINGS.VALUE_SPRINT && jiraData.Sprint) {
      const sprintData = jiraData.Sprint;
      const committedVsCompleted = sprintData.committedVsCompletedMetrics;
      
      if (committedVsCompleted) {
        const hasStoryPointsData = 
          (committedVsCompleted.initialStoryPoints && Number(committedVsCompleted.initialStoryPoints) > 0) ||
          (committedVsCompleted.committedStoryPoints && Number(committedVsCompleted.committedStoryPoints) > 0) ||
          (committedVsCompleted.completedStoryPoints && Number(committedVsCompleted.completedStoryPoints) > 0);
        
        const hasHoursData = 
          (committedVsCompleted.initialOriginalEstimateHrs && Number(committedVsCompleted.initialOriginalEstimateHrs) > 0) ||
          (committedVsCompleted.committedHours && Number(committedVsCompleted.committedHours) > 0) ||
          (committedVsCompleted.completedHours && Number(committedVsCompleted.completedHours) > 0);
        
        if (hasStoryPointsData) {
          setIsStoryPoints(true);
        } else if (hasHoursData) {
          setIsStoryPoints(false);
        }
      }
    } else if (jiraData.selectedValue === APP_STRINGS.VALUE_RELEASE && jiraData.Release) {
      const releaseData = jiraData.Release;
      const committedVsCompleted = releaseData.committedVsCompletedMetrics;
      
      if (committedVsCompleted) {
        const hasStoryPointsData = 
          (committedVsCompleted.initialStoryPoints && Number(committedVsCompleted.initialStoryPoints) > 0) ||
          (committedVsCompleted.committedStoryPoints && Number(committedVsCompleted.committedStoryPoints) > 0) ||
          (committedVsCompleted.completedStoryPoints && Number(committedVsCompleted.completedStoryPoints) > 0);
        
        const hasHoursData = 
          (committedVsCompleted.initialOriginalEstimateHrs && Number(committedVsCompleted.initialOriginalEstimateHrs) > 0) ||
          (committedVsCompleted.committedHours && Number(committedVsCompleted.committedHours) > 0) ||
          (committedVsCompleted.completedHours && Number(committedVsCompleted.completedHours) > 0);
        
        if (hasStoryPointsData) {
          setIsStoryPoints(true);
        } else if (hasHoursData) {
          setIsStoryPoints(false);
        }
      }
    }
  }, [jiraData.selectedValue, jiraData.Sprint, jiraData.Release]);

  useEffect(() => {
    if (releaseReadinesMetricsData) {
      const formattedMetrics = Object.keys(releaseReadinesMetricsData).map((key) => ({
        name: toNormalCase(key),
        contribution: releaseReadinesMetricsData[key],
      }));
      setMetData(formattedMetrics);
    }
  }, [releaseReadinesMetricsData]);

  useEffect(() => {
    const companyId = getId().companyId;
    const sprintId = getId().sprintId;
    const projectId = getId().projectId;
    const releaseId = getId().releaseId;
    fetchGetRelaseReadinessTrends({
      companyId: companyId,
      projectId: projectId,
      releaseId: releaseId,
      value: type.toLowerCase(),
      pageValue: pageValue,
      sprintId: sprintId,
    });
  }, [fetchGetRelaseReadinessTrends]);

  const handleApplyMetrics = async (selectedMetrics) => {
    try {
      const projectList = await getProjectList();
      const projects = projectList?.data || [];
      if (projects.length > 0) {
        dispatch(setProjectList(projects));
      }
      const project = projects.find((p) => p._id === jiraData.selectedProjectId);

      if (!project) {
        console.error('Project not found');
        return;
      }

      const metricContribution = project.metricContribution.releaseReadiness || {};
      const formattedMetrics = Object.keys(metricContribution).map((key) => ({
        name: toNormalCase(key),
        contribution: metricContribution[key],
      }));

      setMetData(formattedMetrics);
      // For testing purposes we are using this change. If this endpoint works properly, we will remove the commented code later.
      // jiraData.selectedValue === 'Release'
      //         ? await fetchData(getReleaseReadinessDetails, addReleaseReadinessData, { value: 'release' })
      //         : await fetchData(getReleaseReadinessDetails, addReleaseReadinessData, { value: 'sprint' });
      const cxoValue =
        jiraData.selectedValue === APP_STRINGS.VALUE_RELEASE
          ? APP_STRINGS.API_RELEASE
          : APP_STRINGS.API_SPRINT;
      const cxoResponse = await getCXODashboardData({ value: cxoValue, sections: 'cxoData' });
      if (cxoResponse?.data?.cxoData !== undefined) {
        dispatch(addReleaseReadinessData(cxoResponse.data.cxoData));
      }

      setSelectedMetrics(selectedMetrics);
    } catch (error) {
      console.error('Error fetching project list:', error);
    }
  };

useEffect(() => {
  if (metData.length > 0) {
    const filteredMetrics = metData.filter((metric) => metric.contribution > 0);
    setSelectedMetrics(filteredMetrics.map((m) => m.name));
  }
}, [metData]);

useEffect(() => {
  if (metData.length > 0) {
  const dynamicMetrics = (issueCounts || []).map(item => ({
  name: item.name,
  percentage: 0, // default; later you can update this
}));

const staticMetrics = [
  { name: 'Test Coverage', percentage: 0 },
  { name: 'Manual Test Result', percentage: 0 },
  { name: 'Burndown', percentage: 0 },
  { name: 'Automation Test Result', percentage: 0 },
];
     metricsDataReleaseReadiness = [...dynamicMetrics, ...staticMetrics];
  }
}, [metData]);
const converted = [
  {
    day: 'Feb25',
    automation: 70,
    manual: 60,
    bugs: 31,
    dla: 51,
    traceability: 41,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Feb26',
    automation: 80,
    manual: 70,
    bugs: 32,
    dla: 52,
    traceability: 42,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Feb27',
    automation: 30,
    manual: 80,
    bugs: 33,
    dla: 53,
    traceability: 43,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Feb28',
    automation: 45,
    manual: 85,
    bugs: 34,
    dla: 54,
    traceability: 44,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Mar01',
    automation: 60,
    manual: 90,
    bugs: 35,
    dla: 55,
    traceability: 45,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Mar02',
    automation: 55,
    manual: 75,
    bugs: 34,
    dla: 54,
    traceability: 44,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Mar03',
    automation: 75,
    manual: 65,
    bugs: 33,
    dla: 53,
    traceability: 43,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Mar04',
    automation: 18,
    manual: 78,
    bugs: 32,
    dla: 52,
    traceability: 42,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Mar05',
    automation: 45,
    manual: 85,
    bugs: 31,
    dla: 51,
    traceability: 41,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  },
  {
    day: 'Mar06',
    automation: 30,
    manual: 90,
    bugs: 30,
    dla: 50,
    traceability: 40,
    automationColor: '#8349CF',
    manualColor: '#3296A1',
    bugsColor: '#B84446',
    dlaColor: '#5145BA',
    traceabilityColor: '#D46C0C'
  }
];
const data = getReleaseReadinessTrends?.map(item => {
  const dateObj = new Date(item.date);
  const monthAbbr = dateObj.toLocaleString('en-US', { month: 'short' });
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return {
    day: `${monthAbbr}${day}`,
    releaseReadiness: item.readinessScore,
    releaseReadinessColor: '#066FD1'
  };
});
const monthMap = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};
const convertedRR = data?.sort((a, b) => {
  const [monthA, dayA] = [a.day.slice(0, 3), parseInt(a.day.slice(3))];
  const [monthB, dayB] = [b.day.slice(0, 3), parseInt(b.day.slice(3))];

  const dateA = new Date(2025, monthMap[monthA], dayA);
  const dateB = new Date(2025, monthMap[monthB], dayB);

  return dateA - dateB;
});
    const releaseChartData = [
    { value: '7', label: '7' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
  ]
const automation = getReleaseReadiness?.savedCXO?.releaseReadinessObject?.automationTestResult?.percentage;
const manual= getReleaseReadiness?.savedCXO?.releaseReadinessObject?.manualTestResult?.percentage;
  // Update metrics data based on available contributions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const newData = useMemo(() => {

    const issueTypeMetrics = (issueCounts || []).map((item) => ({
      title: item.name,
      trend: 0, // Set trend if you have logic for it
      openValue: item.open || 0,
      closedValue: item.close || 0,
      totalValue: (item.open || 0) + (item.close || 0),
      toolTip: ReactDOMServer.renderToStaticMarkup(
        getTooltipContent(item.name, tableDataConfig[item.name]),
      ),
      showDetails: false,
      releaseReadiness: true,
      openQuery: item.openQuery,
      closedQuery: item.closedQuery,
      allQuery: item.allQuery,
    }));

  const staticMetricTitles = ['Test Coverage', 'Manual Test Result', 'Burndown', 'Automation Test Result'];

  const staticMetricObjects = staticMetricTitles.map((title) => ({
    title,
    trend: 0,
    trendValue: 0,
    toolTip: ReactDOMServer.renderToStaticMarkup(
      getTooltipContent(title, tableDataConfig[title])
    ),
    showDetails: false,
    releaseReadiness: true,
  }));

  return [...issueTypeMetrics, ...staticMetricObjects];
  }, [issueCounts, getReleaseReadiness, isStoryPoints]);

  // Only store to sessionStorage when user makes changes to metrics
  useEffect(() => {
    if (selectedMetrics.length > 0) {
      sessionStorage.setItem('titlesToDisplay', JSON.stringify(selectedMetrics));
    }
  }, [selectedMetrics]);

  const handleSelectCard = (index, title) => {
    setMetricsData((prevData) =>
      prevData.map((card, i) => ({
        ...card,
        isSelected: i === index ? !card.isSelected : card.isSelected,
        showDetails: i === index ? !card.showDetails : card.showDetails,
      })),
    );
    setSelectedCardIndex((prevIndex) => (prevIndex === index ? null : index));
    setSelectedCardTitle((prevTitle) => (prevTitle === title ? null : title));
  };

  const handleMetricChange = (metricTitle) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricTitle) ? prev.filter((m) => m !== metricTitle) : [...prev, metricTitle],
    );
  };

  const handleToggleMetric = () => {
    setIsStoryPoints(!isStoryPoints);
  };

  const updatedMetricsData = metricsData.map((metric) => {
    if (metric.title === 'Burndown') {
      return {
        ...metric,
        toolTip: isStoryPoints? ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Burndown Story Points`,tableDataConfig[`Burndown Story Points`])):ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Burndown Hours`,tableDataConfig[`Burndown Hours`])),
        trendValue: isStoryPoints
          ? getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown?.burndownPercentage ?? 0
          : getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown?.burndownHrsPercentage ?? 0,
      };
    }
  if (metric.title === 'Automation Test Result') {
    return {
      ...metric,
      toolTip: ReactDOMServer.renderToStaticMarkup(
        getTooltipContent(`Automation Test Result`, tableDataConfig[`Automation Test Result`])
      ),
      trendValue: automation > 0 ? `${automation}%` : '0%',
    };
  }
    if (metric.title === 'Manual Test Result') {
    return {
      ...metric,
      toolTip: ReactDOMServer.renderToStaticMarkup(
        getTooltipContent(`Manual Test Result`, tableDataConfig[`Manual Test Result`])
      ),
      trendValue: manual > 0 ? `${manual}%` : '0%',
    };
  }
    return metric;
  });

  const moveCard = (dragIndex, hoverIndex) => {
    const updatedCards = [...metricsData];
    const [draggedCard] = updatedCards.splice(dragIndex, 1);
    updatedCards.splice(hoverIndex, 0, draggedCard);
    setMetricsData(updatedCards);
  };

  const handleOutsideClick = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (metricsData.length > 0 && selectedMetrics.length > 0) {
      const updatedMetrics = metricsData.map((metric) => {
        const selectedMetric = selectedMetrics.find((m) => m.name === metric.name);
        return {
          ...metric,
          percentage: selectedMetric ? selectedMetric.percentage : 0,
        };
      });
      setMetricsData(updatedMetrics);
    }
  }, [selectedMetrics]);

useEffect(() => {
  setMetricsData(newData);
}, [newData]);

   const automationData = getReleaseReadiness?.savedCXO?.releaseReadinessObject?.automationTestResult;
  const manualData = getReleaseReadiness?.savedCXO?.releaseReadinessObject?.manualTestResult;

  return (
    <div className={`pt-4 pb-5 pl-2 pr-2 ${theme === 'light' ? 'bg-transparent border border-[#7896AE]' : 'bg-[#151F2C] border border-[#25384F66]'} mt-6 rounded-md w-[calc(100%-2.5rem)] ml-5`}>
      <div className="flex items-center justify-between w-full">
        <div className="relative flex items-center">
          <h3 className={`text-2xl ${theme === 'light' ? 'text-[#24527A] font-semibold' : 'text-gray-300'}`}>
            Release Readiness
          </h3>
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <InfoIcon className={`w-5 h-5 cursor-pointer ml-2 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-300'}`} />
            {showTooltip && (
              <div
                className="absolute left-0 top-full mt-2 p-3 bg-white text-black border border-gray-300 
                  dark:bg-gray-800 dark:text-white dark:border-gray-700 text-sm rounded-lg 
                  shadow-lg z-10 w-max min-w-[220px]"
              >
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                      <th className="border-b px-3 py-2 text-left font-semibold">Metric</th>
                      <th className="border-b px-3 py-2 text-left font-semibold">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metData.map((metric, index) => (
                      <tr
                        key={index}
                        className={`${
                          index % 2 === 0
                            ? 'bg-gray-50 dark:bg-gray-900'
                            : 'bg-white dark:bg-gray-800'
                        } hover:bg-gray-200 dark:hover:bg-gray-700 transition-all`}
                      >
                        <td className="px-3 py-2 border-b text-gray-900 dark:text-gray-100">
                          {metric.name}
                        </td>
                        <td className="px-3 py-2 border-b text-gray-900 dark:text-gray-100 font-semibold">
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

        {selectedCardIndex === null && (
          <div className="pr-10 w-1/4">
            <div className="relative">
    <div className="absolute -right-10 -bottom-6 flex items-center space-x-2">
        <div className="flex space-x-1">
          {/* Since the UI/UX design for the Grid View hasn't been finalized, we have temporarily commented out that section of the code. */}
            {/* <GridViewIcon
                  className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                    selectedView === "grid"
                      ? 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]'
                      : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]'
                  }`}
                  title="Grid View"
                  onClick={() => setSelectedView('grid')}
                /> */}
                  <div className="relative group">
                    <ListViewIcon
                      className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                        selectedView === APP_STRINGS.VIEW_LIST
                          ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                          : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                      }`}
                      onClick={() => setSelectedView('list')}
                    />
                    <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                      List View
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(true)}
                  className={`flex justify-center items-center px-4 py-1.5 text-base font-semibold text-white rounded-md 
                    ${theme === 'light' ? 'bg-[#24527A] hover:bg-[#5580A6]' : (isOpen ? 'bg-[#005AAD]' : 'bg-[#066FD1] hover:bg-[#2B8AE3]')}`}
                  style={{ width: "200px" }}
                >
                  Metrics Contribution
                </button>
              </div>
            </div>

            <MetricsModal
              metricsData={metricsDataReleaseReadiness}
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              onApply={handleApplyMetrics}
              title="releaseReadiness"
            />
            {isDropdownOpen && (
              <div className="absolute bg-white dark:bg-secondary-600 border-2 border-indigo-500 rounded-lg mt-1 w-60 max-h-60 overflow-y-auto custom-scrollbar z-10">
                {metricsData.map((metric, index) => (
                  <label
                    key={index}
                    className="flex items-center p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric.title)}
                      onChange={() => handleMetricChange(metric.title)}
                      className="mr-2"
                    />
                    <span className="text-custom-black dark:text-custom-white">{metric.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap mt-2">
        <DndProvider backend={HTML5Backend}>
          <div className="flex w-full flex-wrap gap-4">
            {updatedMetricsData
              .filter(metric =>
                selectedMetrics.some(sel =>
                  sel && metric.title &&
                  sel.toLowerCase().replace(/[-\s]/g, '') === metric.title.toLowerCase().replace(/[-\s]/g, '')
                ) &&
                !['Test Coverage', 'Manual Test Result', 'Burndown', 'Automation Test Result'].includes(metric.title)
              )
              .map((metric, index) => (
                <div key={index} className="w-[calc(25%-0.75rem)] py-2">

                  <DataCard
                    total={metric?.totalValue ?? 0}
                    open={metric?.openValue ?? 0}
                    closed={metric?.closedValue ?? 0}
                    title={metric.title}
                    toolTip={metric.toolTip}
                    index={index}
                    openQuery={metric.openQuery}
                    closedQuery={metric.closedQuery}
                    allQuery={metric.allQuery}
                  />
                </div>
              ))}
</div>

{/* Since the UI/UX design for the Grid View hasn't been finalized, we have temporarily commented out that section of the code. */}

{/* {selectedView === APP_STRINGS.VIEW_GRID && (
<div className="flex w-full flex-wrap -mx-2">
    {
  selectedView === APP_STRINGS.VIEW_GRID && (
    <div className="flex w-full flex-wrap -mx-2">
  {[...updatedMetricsData,
    ...(
        updatedMetricsData.length > 0 &&
          updatedMetricsData.some(metric =>
            ['Automation Test Result', 'Manual Test Result', 'Burndown'].includes(metric.title)
          ) &&
          !updatedMetricsData.some(metric => metric.title === 'Trend')
          ? [{
            title: 'Trend',
            trend: null,
            trendValue: "0%",
            toolTip: 'Trend data not available',
            showDetails: false,
            isBurndown: false,
          }]
          : []
      )
      ]
        .filter(metric =>
          metric?.title &&
          ['Burndown', 'Automation Test Result', 'Manual Test Result', 'Trend'].includes(metric.title) &&
          (metric.title === 'Trend' || selectedMetrics?.includes(metric.title))
        )
        .map((metric, index) => (
          <div
            key={index}
            className={`px-2 py-2 mt-4 ${index === 0 ? 'w-[30%]' : 'w-[23.3333%]'}`}
          >
            <GridDataCard
              title={metric.title}
              trend={metric.trend}
              trendValue={
                metric?.trendValue != null
                  ? (metric.title === "Burndown"
                      ? `${metric.trendValue}%`
                      : metric.trendValue)
                  : ''
              }
              toolTip={metric.toolTip}
              showDetails={metric.showDetails}
              index={index}
              isSelected={
                selectedCardIndex === index && selectedCardTitle === metric.title
              }
              onSelectCard={() => handleSelectCard(index, metric.title)}
              isAnyCardSelected={metricsData.some((card) => card.isSelected)}
              moveCard={moveCard}
              isBurndown={metric.isBurndown}
              isStoryPoints={isStoryPoints}
              onToggleMetric={handleToggleMetric}
              burndownValue={
                getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown
              }
              automationData={
                getReleaseReadiness?.testProject?.automationRuns || {}
              }
              manualData={getReleaseReadiness?.testProject?.testruns}
              automationTestResult={getReleaseReadiness?.testProject?.automationRuns?.[0]?.manual_percentage ?? 0}
              manualTestResult={getReleaseReadiness?.testProject?.testruns?.[0]?.manual_percentage ?? 0}
              openBugs={openBug.reduce((sum, item) => sum + (item?.open || 0), 0)}
            />
          </div>
        ))}
    </div>
  )
}
</div>
)} */}
      {/* Since the UI/UX design for the Grid View hasn't been finalized, we have temporarily commented out that section of the code. */}
          {selectedView === APP_STRINGS.VIEW_LIST &&
            updatedMetricsData.length > 0 &&
            selectedMetrics?.includes('Burndown') && (
              <div className="flex w-full flex-wrap gap-4">
                {updatedMetricsData
                  .filter((metric) => metric.title === 'Burndown')
                  .map((metric, index) => (
                    <div key={index} className="w-[calc(30%-0.75rem)] py-2">
                      <BetaDataCard
                        title={metric.title}
                        trend={metric.trend}
                        trendValue={`${metric?.trendValue != null ? metric.trendValue : 0}%`}
                        toolTip={metric.toolTip}
                        showDetails={metric.showDetails}
                        index={index}
                        isSelected={
                          selectedCardIndex === index && selectedCardTitle === metric.title
                        }
                        onSelectCard={() => handleSelectCard(index, metric.title)}
                        isAnyCardSelected={metricsData.some((card) => card.isSelected)}
                        moveCard={moveCard}
                        isBurndown={true}
                        isStoryPoints={isStoryPoints}
                        onToggleMetric={handleToggleMetric}
                        burndownValue={
                          getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown
                        }
                        releaseReadinessScore={metric.releaseReadiness}
                      />
                    </div>
                  ))}
                <div className="w-[calc(70%-0.75rem)] py-2">
                  <DndProvider backend={HTML5Backend}>
                    <div>
                      <BurnDown
                        burndownData={
                          getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown
                        }
                        isStoryPoints={isStoryPoints}
                      />
                    </div>
                  </DndProvider>
                </div>
              </div>
            )}
          {selectedView === APP_STRINGS.VIEW_LIST &&
            updatedMetricsData.length > 0 &&
            selectedMetrics?.includes('Automation Test Result') && (
              <div className="flex w-full flex-wrap gap-4">
                {updatedMetricsData
                  .filter((metric) => metric.title === 'Automation Test Result')
                  .map((metric, index) => (
                    <div key={index} className="w-[calc(30%-0.75rem)] py-2">
                      <BetaDataCard
                        title={metric.title}
                        trend={metric.trend}
                        trendValue={`${metric?.trendValue != null ? metric.trendValue : 0}`}
                        toolTip={metric.toolTip}
                        showDetails={metric.showDetails}
                        index={index}
                        isSelected={
                          selectedCardIndex === index && selectedCardTitle === metric.title
                        }
                        onSelectCard={() => handleSelectCard(index, metric.title)}
                        isAnyCardSelected={metricsData.some((card) => card.isSelected)}
                        moveCard={moveCard}
                        releaseReadinessScore={metric.releaseReadiness}
                      />
                    </div>
                  ))}
                <div className="w-[calc(70%-0.75rem)] py-2">
                  <AutomationDone
                    automationData={automationData}
                  />
                </div>
              </div>
            )}
          {selectedView === APP_STRINGS.VIEW_LIST &&
            updatedMetricsData.length > 0 &&
            selectedMetrics?.includes('Manual Test Result') && (
              <div className="flex w-full flex-wrap gap-4">
                {updatedMetricsData
                  .filter((metric) => metric.title === 'Manual Test Result')
                  .map((metric, index) => (
                    <div key={index} className="w-[calc(30%-0.75rem)] py-2">
                      <BetaDataCard
                        title={metric.title}
                        trend={metric.trend}
                        trendValue={`${metric?.trendValue != null ? metric.trendValue : 0}`}
                        toolTip={metric.toolTip}
                        showDetails={metric.showDetails}
                        index={index}
                        isSelected={
                          selectedCardIndex === index && selectedCardTitle === metric.title
                        }
                        onSelectCard={() => handleSelectCard(index, metric.title)}
                        isAnyCardSelected={metricsData.some((card) => card.isSelected)}
                        moveCard={moveCard}
                        releaseReadinessScore={metric.releaseReadiness}
                      />
                    </div>
                  ))}
                <div className="w-[calc(70%-0.75rem)] py-2">
                  <ManualDone manualData={manualData} />
                </div>
              </div>
            )}
          {selectedView === APP_STRINGS.VIEW_LIST &&
            updatedMetricsData.length > 0 &&
            selectedMetrics?.includes('Test Coverage') && (
              <div className="flex w-full flex-wrap gap-4">
                {updatedMetricsData
                  .filter((metric) => metric.title === 'Test Coverage')
                  .map((metric, index) => (
                    <div key={index} className="w-[calc(30%-0.75rem)] py-2">
                      <BetaDataCard
                        title={metric.title}
                        trend={metric.trend}
                        trendValue={`${metric?.trendValue != null ? metric.trendValue : 0}%`}
                        toolTip={metric.toolTip}
                        showDetails={metric.showDetails}
                        index={index}
                        isSelected={
                          selectedCardIndex === index && selectedCardTitle === metric.title
                        }
                        onSelectCard={() => handleSelectCard(index, metric.title)}
                        isAnyCardSelected={metricsData.some((card) => card.isSelected)}
                        moveCard={moveCard}
                        isBurndown={metric.isBurndown}
                        isStoryPoints={isStoryPoints}
                        onToggleMetric={handleToggleMetric}
                        burndownValue={
                          getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown
                        }
                        releaseReadinessScore={metric.releaseReadiness}
                      />
                    </div>
                  ))}
                <div className="w-[calc(70%-0.75rem)] py-2">
                  <DndProvider backend={HTML5Backend}>
                    <div>
                      <TestCoverage />
                    </div>
                  </DndProvider>
                </div>
              </div>
            )}
</DndProvider>
      </div>
      <DndProvider backend={HTML5Backend}>
        {selectedCardTitle === 'Burndown' && (
          <div className="mt-4">
            <BurnDown
              burndownData={getReleaseReadiness?.savedCXO?.releaseReadinessObject?.burndown}
              isStoryPoints={isStoryPoints}
            />
          </div>
        )}
      </DndProvider>

      {/* {selectedCardTitle === 'Automation Test Result' && (
        <div className="mt-4">
          <AutomationDone
            automationData={
              getReleaseReadiness?.testProject?.automationRuns
                ? getReleaseReadiness?.testProject?.automationRuns
                : {}
            }
          />
        </div>
      )}
      {selectedCardTitle === 'Manual Test Result' && (
        <div className="mt-4">
          <ManualDone manualData={getReleaseReadiness?.testProject?.testruns || []} />
        </div>
      )} */}

      {(selectedView === APP_STRINGS.VIEW_LIST && updatedMetricsData.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mt-2">
            <div className={`${theme === 'light' ? 'bg-[#FFFFFF] border border-[#E5E5E5]' : 'bg-[#182433] border border-[#25384F]'} rounded-lg p-4 shadow-lg flex flex-col justify-start gap-2`} style={{ height: "264px" }}>
            <div className="flex items-center justify-between">
              <h2 className={`w-[40%] ${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-black dark:text-gray-300'} text-lg mb-2 text-left`}>
                Days RR Trend
              </h2>
              <div className='flex'>
              <DropdownButton
                options={releaseChartData}
                selectedOption={releaseChartData.find((option) => option.value === pageValue)?.label}
                placeholder="Days"
                onSelect={(option) => handlePageChange(option)}
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
            <div className="overflow-x-auto overflow-y-hidden mt-0" style={{ width: '100%', height:"100%" }}>
                {
                    chartType === "Line" ? (
                        <CustomLineBarChart data={convertedRR} showLine={true} showBar={false} type={'dayRRTrend'}/>
                    ) : (
                        <CustomLineBarChart data={convertedRR} showLine={false} showBar={true} type={'dayRRTrend'}/>
                    )
                }
            </div>
          </div>

          <div className={`${theme === 'light' ? 'bg-[#FFFFFF] border border-[#E5E5E5]' : 'bg-[#182433] border border-[#25384F]'} rounded-lg p-4 shadow-lg flex flex-col justify-start gap-1`} style={{ height: "264px" }}>
            <div className='flex items-center justify-between'>
            <h2 className={`${theme === 'light' ? 'text-[#0A2342] font-semibold' : 'text-black dark:text-gray-300'} text-lg mb-2 text-center`}>
              15 days Trend
            </h2>
                                        <div className='flex'>
                            <DropdownButton
                              buttonLabel={fifteenDayDropdownChartData  === "Days" ? "Days" : "Week"}
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
            <div className="overflow-x-auto overflow-y-hidden mt-0" style={{ width: '100%', height:"100%" }}>
                {
                    fifteenDayChartData === "Line" ? (
                        <CustomLineBarChart data={converted} showLine={true} showBar={false} type={'fifteenDayTrend'}/>
                    ) : (
                        <CustomLineBarChart data={converted} showLine={false} showBar={true} type={'fifteenDayTrend'}/>
                    )
                }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReleaseReadinessLevel2;

ReleaseReadinessLevel2.propTypes = {
  getStatusCount: PropTypes.array.isRequired,
  metricsData: PropTypes.any.isRequired,
  selectedMetrics: PropTypes.any.isRequired,
  getReleaseReadiness: PropTypes.object.isRequired,
  getReleaseReadinessTrends: PropTypes.array.isRequired,
  type: PropTypes.string.isRequired,
  chartType: PropTypes.string.isRequired,
  setChartType: PropTypes.string.isRequired,
  pageValue: PropTypes.string.isRequired,
  setPageValue: PropTypes.string.isRequired,
  handlePageChange: PropTypes.func.isRequired,
  fetchGetRelaseReadinessTrends: PropTypes.func.isRequired,
};
