import { useState } from 'react';
import { useSelector } from 'react-redux';
import '../../../assets/css/global.scss';
import DoughnutChart from '../../Common/DonutChart';
import DropdownButton from '../../Common/DropDown';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';

function CostOfFixingDefects({ layout, itemDetails, itemIndex = 0 }) {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const costOfFixingDefectsData = jiraData?.costOfFixingDefectData || [];
  const [selectedCostView, setSelectedCostView] = useState('effort');
  const [selectedChartType, setSelectedChartType] = useState('line');

  const costViewOptions = [
    {
      label: 'Effort for Fixing a Defect',
      value: 'effort',
    },
    {
      label: 'Cost for Fixing a Defect',
      value: 'cost',
    },
  ];

  const costOfDefect = costOfFixingDefectsData[0];
  const cost = costOfDefect?.totalBugCost || 0;
  const hours = costOfDefect?.totalBugHours || 0;


  const getEffortData = () => {
    if (!costOfDefect?.bugs) return [];
    
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return costOfDefect.bugs.map((bug, index) => ({
      name: bug.bugId || `Defect ${index + 1}`,
      value: bug.totalHours || 0,
      color: dsShades[index % dsShades.length],
      assignee: bug.assignee || 'Unknown'
    }));
  };

  const getCostData = () => {
    if (!costOfDefect?.bugs) return [];
    
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return costOfDefect.bugs.map((bug, index) => ({
      name: bug.bugId || `Defect ${index + 1}`,
      value: bug.totalCost || 0,
      color: dsShades[index % dsShades.length],
      assignee: bug.assignee || 'Unknown'
    }));
  };

  const getEffortPieData = () => {
    return getEffortData().filter(item => item.value > 0);
  };

  const getCostPieData = () => {
    return getCostData().filter(item => item.value > 0);
  };

  const averageHours = costOfDefect?.bugs?.length 
    ? (costOfDefect.bugs.reduce((sum, bug) => sum + (bug.totalHours || 0), 0) / costOfDefect.bugs.length).toFixed(1)
    : 0;
  
  const averageCost = costOfDefect?.bugs?.length 
    ? (costOfDefect.bugs.reduce((sum, bug) => sum + (bug.totalCost || 0), 0) / costOfDefect.bugs.length).toFixed(1)
    : 0;

  return (
    <>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-3 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom:
              itemDetails.value !== undefined
                ? `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value)}`
                : 'none',
          }}
        >
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
                  {itemDetails.value}%
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

          <hr className="mt-2 mb-3 border-[#D1E2F0] dark:border-[#25384F]" />

          <div className="flex flex-col gap-3">
            {[
              { title: 'Total Defect Fixing Effort', value: hours, key: 'Hrs' },
              { title: 'Total Defect Fixing Cost', value: cost, key: '$' },
            ].map(({ title, value, key }, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex gap-1">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>{title}</span>
                </div>
                <span className={`text-sm text-left min-w-[80px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                  {value} {key}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-[#D1E2F0] dark:border-[#25384F] pt-3 mt-2">
              <div className="flex gap-1">
                <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                  Average Defect Fixing Effort
                </span>
                <span
                  data-tooltip-id={`tooltip-avg-effort-${itemIndex}`}
                  data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                    getTooltipContent('Average Defect Fixing Effort')
                  )}
                  className="cursor-pointer"
                >
                  <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                </span>
                <ReactTooltip
                  id={`tooltip-avg-effort-${itemIndex}`}
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
              <span className={`text-sm text-left min-w-[80px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>{averageHours} Hrs</span>
            </div>
            <div className="flex justify-between mt-2">
              <div className="flex gap-1">
                <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                  Average Defect Fixing Cost
                </span>
                <span
                  data-tooltip-id={`tooltip-avg-cost-${itemIndex}`}
                  data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                    getTooltipContent('Average Defect Fixing Cost')
                  )}
                  className="cursor-pointer"
                >
                  <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                </span>
                <ReactTooltip
                  id={`tooltip-avg-cost-${itemIndex}`}
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
              <span className={`text-sm text-left min-w-[80px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>{averageCost} $</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-start">
          <div className="col-span-4">
            <div 
              className="bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
              style={{
                borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                    {itemDetails.name}
                  </h2>
                  <span
                    data-tooltip-id={`tooltip-cost-of-fixing`}
                    data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                    data-tooltip-place="bottom"
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                  </span>
                  <ReactTooltip
                    id={`tooltip-cost-of-fixing`}
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
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'}`}>
                    {itemDetails.value}%
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    className="w-4 h-4 text-green-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                    />
                  </svg>
                </div>
              </div>
              
              <div className="border-b border-[#D1E2F0] dark:border-[#25384F] mb-4"></div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                    Total Defect Fixing Effort
                  </span>
                  <span className={`text-sm text-left min-w-[80px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                    {hours} Hrs
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                    Total Defect Fixing Cost
                  </span>
                  <span className={`text-sm text-left min-w-[80px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>
                    {cost} $
                  </span>
                </div>
              </div>
            </div>
          </div>

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
                      options={costViewOptions}
                      selectedOption={costViewOptions.find((option) => option.value === selectedCostView)?.label}
                      onSelect={(option) => setSelectedCostView(option.value)}
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
                      {selectedCostView === 'effort' ? (
                        getEffortData().length > 0 ? (
                          selectedChartType === 'pie' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <DoughnutChart
                                labels={getEffortPieData().map(item => item.name)}
                                dataPoints={getEffortPieData().map(item => item.value)}
                                backgroundColors={getEffortPieData().map(item => item.color)}
                                label="Defect"
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
                                          return `${context.label}: ${context.raw} hrs (${percentage}%)`;
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
                              data={getEffortData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                              showLine={selectedChartType === 'line'}
                              showBar={selectedChartType === 'bar'}
                              type="costOfFixingDefectsDistribution"
                              showAssignee={true}
                            />
                          )
                        ) : (
                          <NoDataPlaceholder height={220} />
                        )
                      ) : (
                        getCostData().length > 0 ? (
                          selectedChartType === 'pie' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <DoughnutChart
                                labels={getCostPieData().map(item => item.name)}
                                dataPoints={getCostPieData().map(item => item.value)}
                                backgroundColors={getCostPieData().map(item => item.color)}
                                label="Defect"
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
                                          return `${context.label}: $${context.raw} (${percentage}%)`;
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
                              data={getCostData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                              showLine={selectedChartType === 'line'}
                              showBar={selectedChartType === 'bar'}
                              type="costOfFixingDefectsDistribution"
                              showAssignee={true}
                            />
                          )
                        ) : (
                          <NoDataPlaceholder height={220} />
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

      {/* Tooltips */}
      <ReactTooltip
        id={`tooltip-effort-${itemDetails.name}`}
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
      <ReactTooltip
        id={`tooltip-cost-${itemDetails.name}`}
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
    </>
  );
}

CostOfFixingDefects.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
  itemIndex: PropTypes.number.isRequired,
};

export default CostOfFixingDefects;
