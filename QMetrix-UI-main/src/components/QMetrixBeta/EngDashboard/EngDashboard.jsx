import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AddMetricsModal from '../AddMetricsModal';
import PropTypes from 'prop-types';
import '../../../assets/css/level2.scss';
import DevScore from '../../QMetrixBeta/EngDashboard/DeveloperScore/DeveloperScore';
import TestScore from '../../QMetrixBeta/EngDashboard/TestScore/TestScore';
import OperationScore from '../../QMetrixBeta/EngDashboard/OperationScore/OperationScore';
import { updateWeightage } from '../../../constants';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { getProjectList } from '../../../constants';
import { setProjectList } from '../../../store/JiraSlices/jiraSlice';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented import later.
// import { getReleaseReadinessDetails } from '../../../constants';
import { getCXODashboardData, APP_STRINGS } from '../../../constants';
import { addReleaseReadinessData } from '../../../store/CXOSlices/cxoSlice';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented import later.
// import { CommonFunction } from '../../../utils/commonFunctions';
import ReactDOMServer from "react-dom/server";
import getTooltipContent from '../../../utils/Tooltip';
import tableDataConfig from '../../../utils/tableDataConfig';
import classNames from 'classnames';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LayoutGrid } from 'lucide-react';
import { ListViewIcon, InfoIcon } from '../../../utils/commonIcons';

const ESDashboard = ({
  getEngineeringScore,
  getEngineeringScoreTrends,
  pageValue,
  setPageValue,
  chartType,
  setChartType,
  handlePageChange,
  type,
  fetchGetRelaseReadinessTrends,
  getReleaseReadiness,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const theme = useSelector((state) => state.theme.theme);
  const [selectedMetricsEng, setSelectedMetricsEng] = useState([]);
  const [metricsDataEng, setMetricsDataEng] = useState([]);
  const [selectedCardTitle, setSelectedCardTitle] = useState(null);
  const [metData, setMetData] = useState([]);
  const [activeScore, setActiveScore] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDeveloperMetrics, setSelectedDeveloperMetrics] = useState([]);
  const [selectedTestMetrics, setSelectedTestMetrics] = useState([]);
  const [selectedOperationMetrics, setSelectedOperationMetrics] = useState([]);
  const [selectedView, setSelectedView] = useState('grid');
  const jiraData = useSelector((state) => state.jira || {});
  // For testing purposes we are using unified endpoints. If they work properly, we will remove the commented code later.
  // const { fetchData } = CommonFunction();
  const dispatch = useDispatch();
  const [metricsDataForModal, setMetricsDataForModal] = useState({
    Engineering: [],
    Developer: [],
    Test: [],
    Operation: [],
  });
  const dataEng = [
    {
      title: 'Developer Score',
      value: '2.2 d',
      trend: 33,
      trendValue: getEngineeringScore?.developerScoreObject?.developerScore || 0,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Developer Score`, tableDataConfig[`Developer Score`] || [])),
      showDetails: true,
    },
    {
      title: 'Test Score',
      value: '7.2 hr',
      trend: 32,
      trendValue: getEngineeringScore?.testScoreObject?.testScore || 0,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Test Score`, tableDataConfig[`Test Score`] || [])),
      showDetails: true,
    },
    {
      title: 'Operation Score',
      value: '21.4 hr',
      trend: -59.4,
      trendValue: getEngineeringScore?.operationScoreObject?.operationScore || 0,
      toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Operation Score`, tableDataConfig[`Operation Score`] || [])),
      showDetails: true,
    },
  ];

  const toNormalCase = (camelCaseStr) => {
    return camelCaseStr
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (str) => str.toUpperCase());
  };


  const fetchAndSetMetData = async (projectsOverride) => {
    try {
      let projects = Array.isArray(projectsOverride) && projectsOverride.length > 0
        ? projectsOverride
        : jiraData?.projectList;
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

      const metricContribution = project.metricContribution.engineeringScore.engineeringScoreLevelOne || {};
      const formattedMetrics = Object.keys(metricContribution).map((key) => ({
        name: toNormalCase(key),
        contribution: metricContribution[key],
      }));
      setMetData(formattedMetrics);

      const filteredCards = dataEng.filter(card =>
        formattedMetrics.some(metric => metric.name === card.title && metric.contribution > 0)
      );
      setMetricsDataEng(filteredCards);
      setSelectedMetricsEng(filteredCards.map(card => card.title));

      if (filteredCards.length > 0 && !selectedCardTitle) {
        setSelectedCardTitle(filteredCards[0].title);
        setActiveScore(filteredCards[0].title);
      } else if (filteredCards.length === 0) {
        setSelectedCardTitle(null);
        setActiveScore(null);
      }

      const engineeringMetrics = [
        { name: 'Developer Score', key: 'developerScore' },
        { name: 'Test Score', key: 'testScore' },
        { name: 'Operation Score', key: 'operationScore' },
      ];

      const developerRawMetrics = project.metricContribution?.engineeringScore?.developerScore || {};
      const testRawMetrics = project.metricContribution?.engineeringScore?.testScore || {};
      const operationRawMetrics = project.metricContribution?.engineeringScore?.operationScore || {};

      const newEngineeringData = engineeringMetrics.map(metric => ({
        name: metric.name,
        percentage: project.metricContribution?.engineeringScore?.engineeringScoreLevelOne?.[metric.key] || 0, // FIX: Get actual percentage
      }));

      const newDeveloperData = Object.keys(developerRawMetrics).map(key => ({
        name: toNormalCase(key),
        percentage: developerRawMetrics[key] || 0
      }));

      const newTestData = Object.keys(testRawMetrics).map(key => ({
        name: toNormalCase(key),
        percentage: testRawMetrics[key] || 0
      }));

      const newOperationData = Object.keys(operationRawMetrics).map(key => ({
        name: toNormalCase(key),
        percentage: operationRawMetrics[key] || 0
      }));

      const initialSelectedDevMetrics = Object.keys(developerRawMetrics)
        .filter(key => developerRawMetrics[key] > 0)
        .map(toNormalCase);
      setSelectedDeveloperMetrics(initialSelectedDevMetrics);

      const initialSelectedTestMetrics = Object.keys(testRawMetrics)
        .filter(key => testRawMetrics[key] > 0)
        .map(key => key === 'dla' ? 'DLA' : toNormalCase(key));
      setSelectedTestMetrics(initialSelectedTestMetrics);
      const initialSelectedOperationMetrics = Object.keys(operationRawMetrics)

        .filter(key => operationRawMetrics[key] > 0)

        .map(toNormalCase);

      setSelectedOperationMetrics(initialSelectedOperationMetrics);

      setMetricsDataForModal({
        Engineering: newEngineeringData,
        Developer: newDeveloperData,
        Test: newTestData,
        Operation: newOperationData,
      });


    } catch (error) {
      console.error('Error fetching project list or metric contributions:', error);
    }
  };

  useEffect(() => {
    fetchAndSetMetData();
  }, [jiraData.selectedProjectId, jiraData?.metricContribution?.engineeringScore]);

  const handleApplyMetrics = async (values, backendTitle) => {
    try {
      await updateWeightage(values, backendTitle);
      toast.success('Metrics contribution updated successfully!', {
        className: 'bg-secondary-500 text-gray-100',
      });

      const selectedNames = values.map(metric => metric.name);

      if (backendTitle === 'developerScore') {
        setSelectedDeveloperMetrics(selectedNames);
      }
      if (backendTitle === 'testScore') {
        setSelectedTestMetrics(selectedNames);
      }
      if (backendTitle === 'operationScore') {
        setSelectedOperationMetrics(selectedNames);
      }


      if (backendTitle === 'engineeringScore') {
        if (selectedNames.length > 0) {
          setSelectedCardTitle(selectedNames[0]);
          setActiveScore(selectedNames[0]);
        } else {
          setSelectedCardTitle(null);
          setActiveScore(null);
        }
      }

      // For testing purposes we are using this change. If this endpoint works properly, we will remove the commented code later.
      // jiraData.selectedValue === 'Release'
      //   ? await fetchData(getReleaseReadinessDetails, addReleaseReadinessData, { value: 'release' })
      //   : await fetchData(getReleaseReadinessDetails, addReleaseReadinessData, { value: 'sprint' });
      const cxoValue =
        jiraData.selectedValue === APP_STRINGS.VALUE_RELEASE
          ? APP_STRINGS.API_RELEASE
          : APP_STRINGS.API_SPRINT;
      const cxoResponse = await getCXODashboardData({ value: cxoValue, sections: 'cxoData' });
      if (cxoResponse?.data?.cxoData !== undefined) {
        dispatch(addReleaseReadinessData(cxoResponse.data.cxoData));
      }

      const updatedProjectListResponse = await getProjectList();
      const updatedProjects = updatedProjectListResponse?.data || [];
      if (updatedProjects.length > 0) {
        dispatch(setProjectList(updatedProjects));
      }
      await fetchAndSetMetData(updatedProjects);
    } catch (error) {
      toast.error('Failed to update metrics contribution.', {
        className: 'bg-red-500 text-gray-100',
      });
      console.error('Error updating metric contributions:', error);
    } finally {
      setIsOpen(false);
    }
  };


  const getTooltipPlacement = (index) => {
    if ((index % 3) === 0) return "bottom-end";
    if ((index % 3) === 1) return "bottom-start";
    return "bottom";
  };

  const scores = dataEng.map(item => ({
    label: item.title,
    value: item.trendValue,
  })).filter(score => selectedMetricsEng.includes(score.label));


  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <div className={`pt-4 pb-5 pl-2 pr-2 ${theme === 'light' ? 'bg-transparent border border-[#7896AE]' : 'bg-[#151F2C] border border-[#25384F66]'} mt-6 rounded-md w-[calc(100%-2.5rem)] ml-5`}>
          {/* Header inside bordered container */}
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex items-center">
              <h3 className={`text-2xl ${theme === 'light' ? 'text-[#24527A] font-semibold' : 'text-[#d1d5db]'}`}>Engineering Score</h3>
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
                            <td className="px-3 py-2 border-b">{metric.name}</td>
                            <td className="px-3 py-2 border-b font-semibold">{metric.contribution}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex gap-3'>
                <div className="relative group">
                  <div
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 flex items-center justify-center ${selectedView === 'grid' ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]') : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')}`}
                    onClick={() => setSelectedView('grid')}
                  >
                    <LayoutGrid className={`w-5 h-5 ${selectedView === 'grid' ? 'text-white' : theme === 'light' ? 'text-[#7EA6CA] group-hover:text-white' : 'text-[#6C7A91]'}`} />
                  </div>
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Grid View
                  </div>
                </div>
                <div className="relative group">
                  <ListViewIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${selectedView === 'list' ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]') : theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]'}`}
                    onClick={() => setSelectedView('list')}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    List View
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setIsOpen(true)}
                  className={`flex justify-center items-center px-4 py-1.5 text-base font-semibold text-white rounded-md ${theme === 'light' ? 'bg-[#24527A] hover:bg-[#5580A6] active:bg-[#24527A]' : (isOpen ? 'bg-[#005AAD]' : 'bg-[#066FD1] hover:bg-[#2B8AE3]')}`}
                  style={{ width: '200px' }}
                >
                  Metrics Contribution
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center w-full gap-2">
            {metricsDataEng.length > 0 && (
              <div className={`flex flex-wrap ${theme === 'light' ? 'border border-[#B9D6EF] bg-[#FFFFFF]' : 'border border-[#25384F]'} p-2 space-x-2 rounded-md flex-grow`}>
                {scores.map((score, index) => {
                  const scoreData = dataEng.find(item => item.title === score.label);
                  return (
                    <div
                      key={score.label}
                      onClick={() => {
                        setSelectedCardTitle(score.label);
                        setActiveScore(score.label);
                      }}
                      className={classNames(
                        'px-4 py-2 cursor-pointer text-lg flex items-center gap-1 flex-grow justify-center',
                        {
                          [theme === 'light' ? 'bg-[#EFF8FE] text-[#202020]' : 'bg-[#1E2B3C] text-[#E8E9EA]']: activeScore === score.label,
                          [theme === 'light' ? 'bg-transparent text-[#202020]' : 'bg-transparent text-[#E8E9EA]']: activeScore !== score.label,
                        }
                      )}
                    >
                      <span className={`${theme === 'light' ? 'text-[#0A2342]' : ''}`}>{score.label}</span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'text-[#066FD1]'}`}>({score.value})</span>
                      <div className="relative flex items-center">
                        <InfoIcon
                          className={`w-4 h-4 ml-1 ${theme === 'light' ? 'text-[#24527A]' : 'text-[#A3B1C9]'}`}
                          data-tooltip-id={`es-tooltip-${score.label}`}
                          data-tooltip-html={scoreData ? scoreData.toolTip : ''}
                          data-tooltip-place={getTooltipPlacement(index + 1)}
                          data-tooltip-offset="15"
                        />
                      </div>
                    </div>
                  );
                })}
                {scores.map((score, index) => {
                  const scoreData = dataEng.find(item => item.title === score.label);
                  if (!scoreData) return null;

                  return (
                    <ReactTooltip
                      key={`es-tooltip-component-${score.label}`}
                      id={`es-tooltip-${score.label}`}
                      place={getTooltipPlacement(index + 1)}
                      effect="solid"
                      offset={1}
                      float={false}
                      allowHTML={true}
                      arrowColor={theme === "dark" ? "#173A5A" : "#0D1621"}
                      opacity={1}
                      style={{
                        backgroundColor: theme === "dark" ? "#173A5A" : "#0D1621",
                        borderStyle: "solid",
                        borderWidth: "1px",
                        borderColor: theme === "dark" ? "#224F78" : "#224F78",
                        color: "white",
                        zIndex: 9999,
                        padding: "8px",
                        borderRadius: "5px",
                        maxWidth: "500px",
                        whiteSpace: "normal",
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <AddMetricsModal
            metricsData={metricsDataForModal}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            onApply={handleApplyMetrics}
            title="Engineering"
          />

          {selectedCardTitle !== null && (
            <div className="mt-4">
              {selectedCardTitle === 'Developer Score' && (
                <DevScore
                  timeToFix={getEngineeringScore?.developerScoreObject?.timeToFix}
                  defectDensity={getEngineeringScore?.developerScoreObject?.defectDensity}
                  getEngineeringScoreTrends={getEngineeringScoreTrends}
                  pageValue={pageValue}
                  setPageValue={setPageValue}
                  chartType={chartType}
                  setChartType={setChartType}
                  handlePageChange={handlePageChange}
                  type={type}
                  fetchGetRelaseReadinessTrends={fetchGetRelaseReadinessTrends}
                  selectedDeveloperMetrics={selectedDeveloperMetrics}
                  selectedView={selectedView}
                />
              )}
              {selectedCardTitle === 'Test Score' && (
                <TestScore
                  testScoreObject={getEngineeringScore?.testScoreObject}
                  getReleaseReadiness={getReleaseReadiness}
                  selectedTestMetrics={selectedTestMetrics}
                  selectedView={selectedView}
                />
              )}
              {selectedCardTitle === 'Operation Score' && (

                <OperationScore

                  getReleaseReadiness={getReleaseReadiness}

                  selectedOperationMetrics={selectedOperationMetrics}
                  selectedView={selectedView}

                />

              )}

            </div>
          )}
        </div>
      </DndProvider>
    </>
  );
};

export default ESDashboard;

ESDashboard.propTypes = {
  getEngineeringScore: PropTypes.object.isRequired,
  getEngineeringScoreTrends: PropTypes.array.isRequired,
  chartType: PropTypes.string.isRequired,
  setChartType: PropTypes.string.isRequired,
  pageValue: PropTypes.string.isRequired,
  setPageValue: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  handlePageChange: PropTypes.func.isRequired,
  fetchGetRelaseReadinessTrends: PropTypes.func.isRequired,
  getReleaseReadiness: PropTypes.object.isRequired,
};
