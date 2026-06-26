import { useState } from 'react';
import { useSelector } from 'react-redux';
import '../../../assets/css/global.scss';
import PropTypes from 'prop-types';
import DropdownButton from '../../Common/DropDown';
import DoughnutChart from '../../Common/DonutChart';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';

export default function DefectLeakageAnalysis({ layout, itemDetails }) {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const dlaData = Array.isArray(jiraData?.dlaData) ? jiraData.dlaData : [];
  const dlaDataType = jiraData?.selectedValue || 'Sprint';
  // Dynamic labels based on board type (Azure Boards => Iteration/Epic)
  const boardTypeSession = String(sessionStorage.getItem('boardType') || '').toLowerCase();
  const projects =
    jiraData?.projectList || jiraData?.getAllProjectList || jiraData?.getAllProjectsList || [];
  const hasAnyAzureBoard =
    boardTypeSession.includes('azure') ||
    (Array.isArray(projects) &&
      projects.some((p) => {
        const t = String(p?.boardType || p?.type || p?.projectTypeKey || '').toLowerCase();
        const self = String(p?.self || '').toLowerCase();
        return (
          t === 'azure board' ||
          t === 'azure-board' ||
          t.includes('azure') ||
          self.includes('dev.azure.com')
        );
      }));
  const sprintLabel = hasAnyAzureBoard ? 'Iteration' : 'Sprint';
  const releaseLabel = hasAnyAzureBoard ? 'Epic' : 'Release';
  const selectedTypeLabel =
    String(dlaDataType).toLowerCase() === 'release' ? releaseLabel : sprintLabel;

  const dlaDatas = [
    {
      title: `Total Bugs In ${selectedTypeLabel}`,
      key: 'Days',
      value: `${Math.round(dlaData[0]?.dlaSprintOrRelease[0]?.totalBugCount ?? 0)}`,
    },
    {
      title: `Escaped Bugs In ${selectedTypeLabel}`,
      key: '',
      value: `${Math.round(dlaData[0]?.dlaSprintOrRelease[0]?.escapedDefects ?? 0)}`,
    },
  ];

  const dlaList = dlaData[0]?.dlaSprintOrRelease ?? [];
  const averageDla = dlaList.length
    ? Math.round(dlaList.reduce((sum, item) => sum + item.dla, 0) / dlaList.length)
    : 0;

  const [selectedChartType, setSelectedChartType] = useState('bar');
  const [selectedDlaView, setSelectedDlaView] = useState('sprint');
  const [selectedDataType, setSelectedDataType] = useState('number');

  const dlaViewOptions = [
    {
      label: `DLA By ${selectedTypeLabel}`,
      value: 'sprint',
    },
    {
      label: 'DLA By Priority',
      value: 'priority',
    },
  ];

  const dataTypeOptions = [
    {
      label: 'Number',
      value: 'number',
    },
    {
      label: 'Percentage',
      value: 'percentage',
    },
  ];

  const getDlaSprintData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];

    return dlaList.map((item, index) => ({
      name: item.name,
      value: selectedDataType === 'percentage' 
        ? Math.round(((item.dla || 0) / 60) * 100) 
        : Math.round(item.dla || 0),
      color: dsShades[index % dsShades.length]
    })).reverse();
  };


  const getDlaPriorityData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    const priorityData = dlaData[0]?.dlaSprintOrRelease?.[0]?.priorityWise || [];
    
    return priorityData.map((item, index) => ({
      name: item.priority,
      value: selectedDataType === 'percentage' 
        ? Math.round(((item.priorityDla || 0) / 60) * 100) 
        : Math.round(item.priorityDla || 0),
      color: dsShades[index % dsShades.length]
    }));
  };

  const getDlaSprintPieData = () => {
    return getDlaSprintData().filter((item) => item.value > 0);
  };

  const getDlaPriorityPieData = () => {
    return getDlaPriorityData().filter((item) => item.value > 0);
  };

  const handleDlaViewSelect = (option) => {
    setSelectedDlaView(option.value);
  };

  const handleDataTypeSelect = (option) => {
    setSelectedDataType(option.value);
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
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 my-2">
              <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                {itemDetails.name}
              </h2>
              <span
                data-tooltip-id={`tooltip-${itemDetails.name}`}
                data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                data-tooltip-offset="15"
                className="cursor-pointer"
              >
                <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
              </span>
              <ReactTooltip
                id={`tooltip-${itemDetails.name}`}
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
                <span className={`text-xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} mr-2`}>
                  {itemDetails.value}
                </span>
                <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'} text-lg`}>%</span>
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

          <div className="flex flex-col border-t dark:border-[#25384F] pt-2 mt-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
            <div className="flex flex-col justify-between py-1">
              {dlaDatas.map(({ title, value, key }) => (
                <div className="flex justify-between gap-2 items-center" key={key}>
                  <div className="flex gap-1">
                    <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{title}</span>
                  </div>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-b dark:border-[#25384F] py-3 mt-2 mb-2" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}>
              <div className="flex gap-1">
                <span
                  className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}
                >
                  Average DLA By {selectedTypeLabel}
                </span>
                <span
                  data-tooltip-id={`tooltip-${itemDetails.name}`}
                  data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                    getTooltipContent(`Average DLA By ${selectedTypeLabel}`),
                  )}
                  data-tooltip-offset="15"
                  className="cursor-pointer"
                >
                  <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                </span>
                <ReactTooltip
                  id={`tooltip-${itemDetails.name}`}
                  effect="solid"
                  offset={1}
                  float={false}
                  allowHTML={true}
                  arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                  wrapper="body"
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
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{averageDla} %</span>
            </div>
            <div className="flex flex-col justify-between max-h-28 overflow-y-auto">
              <span className={`${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'} font-semibold mb-2`}>DLA By Priority</span>
              {dlaData[0]?.dlaSprintOrRelease?.[0]?.priorityWise?.map((priorityItem, index) => (
                <div key={priorityItem.priority || index} className="flex justify-between">
                  <span className={`${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{priorityItem.priority}</span>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{priorityItem.priorityDla} %</span>
                </div>
              )) || ' '}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-4">
              <div 
                className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80"
                style={{
                  borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                        {itemDetails.name}
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-dla`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-4 w-4 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-dla`}
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
                      <span className={`text-xl font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'} mr-2`}>
                        {itemDetails.value}%
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
                  <div className="border-b dark:border-[#25384F] mb-4" style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}></div>                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm`}>
                        Total Bugs In {dlaDataType}
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                        {Math.round(dlaData[0]?.dlaSprintOrRelease[0]?.totalBugCount ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'} text-sm`}>
                        Escaped Bugs In {dlaDataType}
                      </span>
                      <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                        {Math.round(dlaData[0]?.dlaSprintOrRelease[0]?.escapedDefects ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      Defect Leakage Analysis
                    </h2>
                    <div className="flex items-center gap-3">
                      <DropdownButton
                        buttonLabel={dlaViewOptions.find(option => option.value === selectedDlaView)?.label || 'Select View'}
                        options={dlaViewOptions}
                        selectedOption={dlaViewOptions.find(option => option.value === selectedDlaView)?.label}
                        onSelect={handleDlaViewSelect}
                        placeholder="Select View"
                      />
                      <DropdownButton
                        buttonLabel={dataTypeOptions.find(option => option.value === selectedDataType)?.label || 'Select Type'}
                        options={dataTypeOptions}
                        selectedOption={dataTypeOptions.find(option => option.value === selectedDataType)?.label}
                        onSelect={handleDataTypeSelect}
                        placeholder="Select Type"
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
                    {selectedDlaView === 'sprint' ? (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '233px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              getDlaSprintPieData().length > 0 ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DoughnutChart
                                  labels={getDlaSprintPieData().map(item => item.name)}
                                  dataPoints={getDlaSprintPieData().map(item => item.value)}
                                  backgroundColors={getDlaSprintPieData().map(item => item.color)}
                                  label="DLA"
                                  height="200px"
                                  width="250px"
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
                                            return `${context.label}: ${context.raw}${selectedDataType === 'percentage' ? '%' : ''} (${percentage}%)`;
                                          },
                                        },
                                      },
                                    },
                                  }}
                                />
                              </div>
                              ) : (
                                <NoDataPlaceholder height={200} />
                              )
                            ) : (
                              getDlaSprintData().length > 0 ? (
                              <CustomLineBarChart
                                data={getDlaSprintData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                showLine={selectedChartType === 'line'}
                                showBar={selectedChartType === 'bar'}
                                type="dlaDistribution"
                                dataType={selectedDataType}
                              />
                              ) : (
                                <NoDataPlaceholder height={200} />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full">
                        <div className="overflow-x-auto overflow-y-hidden" style={{ width: '100%', height: '233px' }}>
                          <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              getDlaPriorityPieData().length > 0 ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DoughnutChart
                                  labels={getDlaPriorityPieData().map(item => item.name)}
                                  dataPoints={getDlaPriorityPieData().map(item => item.value)}
                                  backgroundColors={getDlaPriorityPieData().map(item => item.color)}
                                  label="DLA By Priority"
                                  height="200px"
                                  width="250px"
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
                                            return `${context.label}: ${context.raw}${selectedDataType === 'percentage' ? '%' : ''} (${percentage}%)`;
                                          },
                                        },
                                      },
                                    },
                                  }}
                                />
                              </div>
                              ) : (
                                <NoDataPlaceholder height={200} />
                              )
                            ) : (
                              getDlaPriorityData().length > 0 ? (
                              <CustomLineBarChart
                                data={getDlaPriorityData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                showLine={selectedChartType === 'line'}
                                showBar={selectedChartType === 'bar'}
                                type="dlaDistribution"
                                dataType={selectedDataType}
                              />
                              ) : (
                                <NoDataPlaceholder height={200} />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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

DefectLeakageAnalysis.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};
