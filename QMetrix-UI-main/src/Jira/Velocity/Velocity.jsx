import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import DoughnutChart from '../../Common/DonutChart';
import DropdownButton from '../../Common/DropDown';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';

export default function Velocity({ layout, itemDetails, itemIndex = 0 }) {
  const jiraData = useSelector((state) => state.jira || {});
  const Velocity = useMemo(() => jiraData?.velocityData || [], [jiraData?.velocityData]);
  const velocityPerMember = useMemo(() => Velocity?.velocityPerMember || {}, [Velocity]);
  const theme = useSelector((state) => state.theme.theme);
  const [selectedVelocityView, setSelectedVelocityView] = useState('teamMember');
  const [selectedChartType, setSelectedChartType] = useState('bar');

  const velocityViewOptions = [
    {
      label: 'Velocity Per Team Member',
      value: 'teamMember',
    },
    {
      label: 'Average Velocity',
      value: 'average',
    },
  ];

  const calculateAverages = useMemo(() => {
    const lastSixData = jiraData?.velocityData?.lastSixData || [];
    
    if (lastSixData.length === 0) {
      return {
        averagePlanned: 0,
        averageIncomplete: 0,
        averageCompleted: 0,
        averageCompletedLate: 0,
        averageVelocity: Velocity?.avgVelocity?.averageVelocity || 0,
        averageTeamMemberVelocity: 0
      };
    }

    const useHours = sessionStorage.getItem('velocityToggleType') === 'hours';
    const fieldMap = useHours
      ? {
          planned: 'hoursPlanned',
          incomplete: 'hoursIncomplete',
          completed: 'hoursCompleted',
          completedLate: 'hoursCompletedLate',
        }
      : {
          planned: 'planned',
          incomplete: 'incomplete',
          completed: 'completed',
          completedLate: 'completedLate',
        };

    const pick = (obj, primaryKey, fallbackKey) =>
      (obj?.[primaryKey] ?? obj?.[fallbackKey] ?? 0);

    const plannedValues = lastSixData.map(sprint => 
      pick(sprint.velocity, fieldMap.planned, 'planned')
    );
    const incompleteValues = lastSixData.map(sprint => 
      pick(sprint.velocity, fieldMap.incomplete, 'incomplete')
    );
    const completedValues = lastSixData.map(sprint => 
      pick(sprint.velocity, fieldMap.completed, 'completed')
    );
    const completedLateValues = lastSixData.map(sprint => 
      pick(sprint.velocity, fieldMap.completedLate, 'completedLate')
    );

    const average = (arr) => {
      if (!arr || arr.length === 0) return 0;
      const validValues = arr.filter(val => typeof val === 'number' && !isNaN(val));
      if (validValues.length === 0) return 0;
      return Math.round((validValues.reduce((sum, val) => sum + val, 0) / validValues.length) * 100) / 100;
    };

    const teamMemberValues = Object.values(velocityPerMember);
    const averageTeamMemberVelocity = average(teamMemberValues);

    return {
      averagePlanned: average(plannedValues),
      averageIncomplete: average(incompleteValues),
      averageCompleted: average(completedValues),
      averageCompletedLate: average(completedLateValues),
      averageVelocity: Velocity?.avgVelocity?.averageVelocity || 0,
      averageTeamMemberVelocity
    };
  }, [jiraData?.velocityData, Velocity?.avgVelocity?.averageVelocity, velocityPerMember]);

  const velocityMetrics = [
    { title: 'Average Planned', value: calculateAverages.averagePlanned },
    { title: 'Average Incomplete', value: calculateAverages.averageIncomplete },
    { title: 'Average Completed', value: calculateAverages.averageCompleted },
    { title: 'Average Completed Late', value: calculateAverages.averageCompletedLate },
  ];

  const bottomMetrics = [
    { title: 'Average Velocity', value: calculateAverages.averageVelocity },
    { title: 'Average Team Member Velocity', value: calculateAverages.averageTeamMemberVelocity },
  ];

  const getCurrentSprintData = () => {
    const lastSixData = jiraData?.velocityData?.lastSixData || [];
    const useHours = sessionStorage.getItem('velocityToggleType') === 'hours';
    
    const fieldMap = useHours
      ? {
          planned: 'hoursPlanned',
          incomplete: 'hoursIncomplete',
          completed: 'hoursCompleted',
          completedLate: 'hoursCompletedLate',
        }
      : {
          planned: 'planned',
          incomplete: 'incomplete',
          completed: 'completed',
          completedLate: 'completedLate',
        };

    const pick = (obj, primaryKey, fallbackKey) =>
      (obj?.[primaryKey] ?? obj?.[fallbackKey] ?? 0);

    const currentSprint = lastSixData[lastSixData.length - 1] || {};
    
    return {
      planned: pick(currentSprint.velocity, fieldMap.planned, 'planned'),
      incomplete: pick(currentSprint.velocity, fieldMap.incomplete, 'incomplete'),
      completed: pick(currentSprint.velocity, fieldMap.completed, 'completed'),
      completedLate: pick(currentSprint.velocity, fieldMap.completedLate, 'completedLate'),
    };
  };

  const currentSprintData = getCurrentSprintData();

  const listViewMetrics = [
    { title: 'Planned', value: currentSprintData.planned },
    { title: 'Incomplete', value: currentSprintData.incomplete },
    { title: 'Completed', value: currentSprintData.completed },
    { title: 'Completed Late', value: currentSprintData.completedLate },
  ];

  const getTeamMemberData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return Object.entries(velocityPerMember).map(([member, velocity], index) => ({
      name: member,
      value: velocity || 0,
      color: dsShades[index % dsShades.length]
    }));
  };

  const getAverageVelocityData = () => {
    const lastSixData = jiraData?.velocityData?.lastSixData || [];
    const useHours = sessionStorage.getItem('velocityToggleType') === 'hours';
    
    const fieldMap = useHours
      ? {
          planned: 'hoursPlanned',
          incomplete: 'hoursIncomplete',
          completed: 'hoursCompleted',
          completedLate: 'hoursCompletedLate',
        }
      : {
          planned: 'planned',
          incomplete: 'incomplete',
          completed: 'completed',
          completedLate: 'completedLate',
        };

    const pick = (obj, primaryKey, fallbackKey) =>
      (obj?.[primaryKey] ?? obj?.[fallbackKey] ?? 0);

    return lastSixData.map((sprint, index) => ({
      name: sprint.name || `Sprint ${index + 1}`,
      planned: pick(sprint.velocity, fieldMap.planned, 'planned'),
      incomplete: pick(sprint.velocity, fieldMap.incomplete, 'incomplete'),
      completed: pick(sprint.velocity, fieldMap.completed, 'completed'),
      completedLate: pick(sprint.velocity, fieldMap.completedLate, 'completedLate'),
    }));
  };

  const getAverageVelocityChartData = () => {
    const data = getAverageVelocityData();
    const colors = {
      planned: '#3B82F6',
      incomplete: '#F97316',
      completed: '#10B981',
      completedLate: '#8B5CF6'
    };

    return data.map(sprint => ({
      name: sprint.name,
      planned: sprint.planned,
      incomplete: sprint.incomplete,
      completed: sprint.completed,
      completedLate: sprint.completedLate,
      plannedColor: colors.planned,
      incompleteColor: colors.incomplete,
      completedColor: colors.completed,
      completedLateColor: colors.completedLate,
    }));
  };

  const getTeamMemberPieData = () => {
    return getTeamMemberData().filter(item => item.value > 0);
  };

  const getAverageVelocityPieData = () => {
    const data = getAverageVelocityData();
    const colors = {
      planned: '#3B82F6',
      incomplete: '#F97316',
      completed: '#10B981',
      completedLate: '#8B5CF6'
    };
    
    return [
      { name: 'Planned', value: data.reduce((sum, sprint) => sum + sprint.planned, 0), color: colors.planned },
      { name: 'Incomplete', value: data.reduce((sum, sprint) => sum + sprint.incomplete, 0), color: colors.incomplete },
      { name: 'Completed', value: data.reduce((sum, sprint) => sum + sprint.completed, 0), color: colors.completed },
      { name: 'Completed Late', value: data.reduce((sum, sprint) => sum + sprint.completedLate, 0), color: colors.completedLate },
    ].filter(item => item.value > 0);
  };

  return (
    <>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
          }}
        >
          {/* Title and tooltip */}
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 my-2">
              <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                {itemDetails.name}
              </h2>
              <span
                data-tooltip-id={`tooltip-${itemDetails.name}-${itemIndex}`}
                data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                data-tooltip-place="bottom"
                data-tooltip-offset="15"
                className="cursor-pointer"
              >
                <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
              </span>
              <ReactTooltip
                id={`tooltip-${itemDetails.name}-${itemIndex}`}
                effect="solid"
                offset={1}
                float={false}
                allowHTML={true}
                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                wrapper="div"
                opacity={1}
                style={{
                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: '#224F78',
                  color: 'white',
                  zIndex: 9999,
                  padding: '8px',
                  borderRadius: '5px',
                  maxWidth: '500px',
                  whiteSpace: 'normal',
                  position: 'absolute',
                }}
              />
            </div>
            <div className="flex items-center">
              <h2>
                <span className={`text-xl font-semibold mr-2 ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'}`}>
                  {itemDetails.value}
                </span>
              </h2>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="3.5"
                stroke="currentColor"
                className="w-4 h-4 ml-2 text-green-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                />
              </svg>
            </div>
          </div>

          {/* Main value display */}
          <div className="flex flex-col border-t border-[#D1E2F0] dark:border-[#25384F] pt-2 mt-2">
            {velocityMetrics.map(({ title, value }) => (
              <div className="flex justify-between gap-2 items-center mb-2" key={title}>
                <div className="flex gap-1">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>{title}</span>
                </div>
                <span className={`text-sm text-left min-w-[60px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col border-t border-[#D1E2F0] dark:border-[#25384F] pt-3 mt-2">
            {bottomMetrics.map(({ title, value }) => (
              <div className="flex justify-between gap-2 items-center mb-2" key={title}>
                <div className="flex gap-1">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>{title}</span>
                </div>
                <span className={`text-sm text-left min-w-[60px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Main Card - 4 columns */}
          <div className="col-span-4">
            <div 
              className="bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
              style={{
                borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
              }}
            >
              <div className="flex justify-between items-center w-full mb-4">
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                    {itemDetails.name}
                  </h2>
                  <span
                    data-tooltip-id={`tooltip-velocity-${itemIndex}`}
                    data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                    data-tooltip-place="bottom"
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                  </span>
                  <ReactTooltip
                    id={`tooltip-velocity-${itemIndex}`}
                    effect="solid"
                    offset={1}
                    float={false}
                    allowHTML={true}
                    arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                    wrapper="div"
                    opacity={1}
                    style={{
                      backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                      borderStyle: 'solid',
                      borderWidth: '1px',
                      borderColor: '#224F78',
                      color: 'white',
                      zIndex: 9999,
                      padding: '8px',
                      borderRadius: '5px',
                      maxWidth: '500px',
                      whiteSpace: 'normal',
                      position: 'absolute',
                    }}
                  />
                </div>
                <div className="flex items-center">
                  <span className={`text-xl font-semibold mr-2 ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'}`}>
                    {itemDetails.value}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    className="w-4 h-4 ml-2 text-green-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                    />
                  </svg>
                </div>
              </div>

              {/* Header line */}
              <div className="border-b border-[#D1E2F0] dark:border-[#25384F] mb-4"></div>

              {/* Main value display */}
              <div className="flex flex-col">
                {listViewMetrics.map(({ title, value }) => (
                  <div className="flex justify-between gap-2 items-center mb-2" key={title}>
                    <div className="flex gap-1">
                      <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>{title}</span>
                    </div>
                    <span className={`text-sm ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Section - 8 columns */}
          <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                    {itemDetails.name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <DropdownButton
                      buttonLabel="Select View"
                      options={velocityViewOptions}
                      selectedOption={velocityViewOptions.find((option) => option.value === selectedVelocityView)?.label}
                      onSelect={(option) => setSelectedVelocityView(option.value)}
                      width="lgx"
                    />
                    <div className="flex items-center space-x-2 ml-2">
                      <div className="relative group">
                        <LineChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            selectedChartType === 'line'
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                          }`}
                          onClick={() => setSelectedChartType('line')}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Line Chart
                        </div>
                      </div>
                      <div className="relative group">
                        <BarChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            selectedChartType === 'bar'
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                          }`}
                          onClick={() => setSelectedChartType('bar')}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Bar Chart
                        </div>
                      </div>
                      <div className="relative group">
                        <DonutChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            selectedChartType === 'pie'
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover-border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover-border-[#6C7A91B2]'
                          }`}
                          onClick={() => setSelectedChartType('pie')}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Donut Chart
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '250px' }}>
                    <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                      {selectedVelocityView === 'teamMember' ? (
                        getTeamMemberData().length > 0 ? (
                          selectedChartType === 'pie' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <DoughnutChart
                                labels={getTeamMemberPieData().map(item => item.name)}
                                dataPoints={getTeamMemberPieData().map(item => item.value)}
                                backgroundColors={getTeamMemberPieData().map(item => item.color)}
                                label="Velocity"
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      display: true,
                                      position: 'right',
                                      labels: {
                                        color: theme === 'dark' ? '#e5e7eb' : '#374151',
                                        usePointStyle: true,
                                        padding: 20,
                                      },
                                    },
                                    tooltip: {
                                      callbacks: {
                                        label: (context) => {
                                          const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                          const percentage = ((context.raw / total) * 100).toFixed(1);
                                          return `${context.label}: ${context.raw} (${percentage}%)`;
                                        },
                                      },
                                    },
                                  },
                                }}
                                height="200px"
                                width="250px"
                              />
                            </div>
                          ) : (
                            <CustomLineBarChart
                              data={getTeamMemberData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                              showLine={selectedChartType === 'line'}
                              showBar={selectedChartType === 'bar'}
                              type="velocityDistribution"
                            />
                          )
                        ) : (
                          <NoDataPlaceholder height={180} />
                        )
                      ) : (
                        getAverageVelocityData().length > 0 ? (
                          selectedChartType === 'pie' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <DoughnutChart
                                labels={getAverageVelocityPieData().map(item => item.name)}
                                dataPoints={getAverageVelocityPieData().map(item => item.value)}
                                backgroundColors={getAverageVelocityPieData().map(item => item.color)}
                                label="Velocity"
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      display: true,
                                      position: 'right',
                                      labels: {
                                        color: theme === 'dark' ? '#e5e7eb' : '#374151',
                                        usePointStyle: true,
                                        padding: 20,
                                      },
                                    },
                                    tooltip: {
                                      callbacks: {
                                        label: (context) => {
                                          const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                          const percentage = ((context.raw / total) * 100).toFixed(1);
                                          return `${context.label}: ${context.raw} (${percentage}%)`;
                                        },
                                      },
                                    },
                                  },
                                }}
                                height="200px"
                                width="250px"
                              />
                            </div>
                          ) : (
                            <CustomLineBarChart
                              data={getAverageVelocityChartData()}
                              showLine={selectedChartType === 'line'}
                              showBar={selectedChartType === 'bar'}
                              type="averageVelocityDistribution"
                            />
                          )
                        ) : (
                          <NoDataPlaceholder height={180} />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

Velocity.propTypes = {
  layout: PropTypes.string,
  itemDetails: PropTypes.shape({
    name: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  itemIndex: PropTypes.number,
};
