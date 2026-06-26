import { useState } from 'react';
import { useSelector } from 'react-redux';
import DropdownButton from '../../Common/DropDown';
import DoughnutChart from '../../Common/DonutChart';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import PropTypes from 'prop-types';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';

const DefectRejectionRatio = ({ layout, itemDetails }) => {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const defectRejectionData = jiraData?.defectRejectionData || [];
  const defectRejectionDataType = jiraData?.selectedValue || 'Sprint';
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
    String(defectRejectionDataType).toLowerCase() === 'release' ? releaseLabel : sprintLabel;

  const drrDatas = [
    {
      title: `Defect Rejected In ${selectedTypeLabel}`,
      key: '',
      value: `${Math.round(
        defectRejectionData[0]?.defectRejectedRate?.totalRejectedDefect[0]?.count ?? 0,
      )}`,
    },
    {
      title: `Total Defect In ${selectedTypeLabel}`,
      key: '',
      value: `${Math.round(defectRejectionData[0]?.defectRejectedRate?.totalDefect ?? 0)}`,
    },
  ];

  // const drrSprintList = defectRejectionData[1]?.defectRejectionBySprintOrRelease?.value ?? [];
  const drrSprintList =
  Array.isArray(defectRejectionData[1]?.defectRejectionBySprintOrRelease?.value)
    ? defectRejectionData[1].defectRejectionBySprintOrRelease.value
    : Array.isArray(defectRejectionData[1]?.defectRejectionBySprintOrRelease?.result)
    ? defectRejectionData[1].defectRejectionBySprintOrRelease.result
    : [];
  const averageRejectionBySprint = drrSprintList.length
    ? Math.round(
        drrSprintList.reduce((sum, item) => sum + item.defectRejected, 0) / drrSprintList.length,
      )
    : 0;

  const developerRejectionList =
  Array.isArray(defectRejectionData[2]?.defectRejectedByDeveloper)
    ? defectRejectionData[2].defectRejectedByDeveloper
    : Array.isArray(defectRejectionData[2]?.defectRejectedByDeveloper?.result)
    ? defectRejectionData[2].defectRejectedByDeveloper.result
    : [];
  const averageRejectionByDeveloper = developerRejectionList.length
    ? Math.round(
        developerRejectionList.reduce((sum, item) => sum + item.defectRejected, 0) /
          developerRejectionList.length,
      )
    : 0;

  const classificationData = defectRejectionData[3]?.defectRejectionClassification?.[0] || {};
  const averageRejectionByClassification =
    classificationData.invalidCount !== undefined
      ? Math.round(
          (classificationData.invalidCount +
            classificationData.notReproducibleCount +
            classificationData.duplicateCount) /
            3,
        )
      : 0;

  const [selectedChartType, setSelectedChartType] = useState('line');
  const [selectedDrrView, setSelectedDrrView] = useState('sprint');

  const drrViewOptions = [
    {
      label: `Defect Rejected In ${selectedTypeLabel}`,
      value: 'sprint',
    },
    {
      label: 'Defect Rejected By Team Member',
      value: 'team_member',
    },
    {
      label: 'Defect Rejection Classification',
      value: 'classification',
    },
  ];

  const getDrrSprintData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return drrSprintList.map((item, index) => ({
      name: item.name,
      value: Math.round(item.defectRejected || 0),
      color: dsShades[index % dsShades.length]
    })).reverse();
  };

  const getDrrTeamMemberData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return developerRejectionList.map((item, index) => ({
      name: item.teamMember,
      value: Math.round(item.defectRejected || 0),
      color: dsShades[index % dsShades.length],
    }));
  };

  const getDrrClassificationData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    
    return [
      {
        name: 'Invalid',
        value: Math.round(classificationData.invalidCount || 0),
        color: dsShades[0],
      },
      {
        name: 'Not Reproducible',
        value: Math.round(classificationData.notReproducibleCount || 0),
        color: dsShades[1],
      },
      {
        name: 'Duplicate',
        value: Math.round(classificationData.duplicateCount || 0),
        color: dsShades[2],
      },
    ];
  };

  const getDrrSprintPieData = () => {
    return getDrrSprintData().filter((item) => item.value > 0);
  };

  const getDrrTeamMemberPieData = () => {
    return getDrrTeamMemberData().filter((item) => item.value > 0);
  };

  const getDrrClassificationPieData = () => {
    return getDrrClassificationData().filter((item) => item.value > 0);
  };

  const handleDrrViewSelect = (option) => {
    setSelectedDrrView(option.value);
  };

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
              <h2
                className={`text-lg font-semibold ${
                  theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'
                }`}
              >
                {itemDetails.name}
              </h2>
              <span
                data-tooltip-id={`tooltip-${itemDetails.name}`}
                data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                data-tooltip-offset="15"
                className="cursor-pointer"
              >
                <InformationCircleIcon
                  className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`}
                />
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
                <span
                  className={`text-xl font-semibold ${
                    theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'
                  } mr-2`}
                >
                  {itemDetails.value}
                </span>
                <span
                  className={`${
                    theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'
                  } text-sm`}
                >
                  %
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
          <div
            className="flex flex-col border-t dark:border-[#25384F] pt-2 mt-2"
            style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}
          >
            <div className="flex flex-col justify-between py-1">
              {drrDatas.map(({ title, value, key }) => (
                <div className="flex justify-between gap-2 items-center" key={key}>
                  <div className="flex gap-1">
                    <span
                      className={`${
                        theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'
                      } text-sm`}
                    >
                      {title}
                    </span>
                  </div>
                  <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{value}</span>
                </div>
              ))}
            </div>
            <div
              className="flex justify-between border-t dark:border-[#25384F] pt-3 mt-2"
              style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}
            >
              <div className="flex gap-1">
                <span
                  className={`${
                    theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'
                  } text-sm flex gap-2`}
                >
                  Average DRR By {selectedTypeLabel}
                  <span
                    data-tooltip-id={`tooltip-averageDRR-${itemDetails.name}`}
                    data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                      getTooltipContent(`Average DRR By ${selectedTypeLabel}`),
                    )}
                    data-tooltip-place="bottom"
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon
                      className={`h-4 w-4 ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'
                      }`}
                    />
                  </span>
                  <ReactTooltip
                    id={`tooltip-averageDRR-${itemDetails.name}`}
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
                </span>
              </div>
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{averageRejectionBySprint} %</span>
            </div>
            <div className="flex justify-between mt-2">
              <div className="flex gap-1">
                <span
                  className={`${
                    theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'
                  } text-sm flex gap-2`}
                >
                  Average DRR By Team Member
                  <span
                    data-tooltip-id={`tooltip-average-DRR-By-Team-Member-${itemDetails.name}`}
                    data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                      getTooltipContent('Average DRR By Team Member'),
                    )}
                    data-tooltip-place="bottom"
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon
                      className={`h-4 w-4 ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'
                      }`}
                    />
                  </span>
                  <ReactTooltip
                    id={`tooltip-average-DRR-By-Team-Member-${itemDetails.name}`}
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
                </span>
              </div>
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{averageRejectionByDeveloper} </span>
            </div>
            <div className="flex justify-between mt-2">
              <div className="flex gap-1">
                <span
                  className={`${
                    theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'
                  } text-sm flex gap-2`}
                >
                  Average DRR By Classification
                  <span
                    data-tooltip-id={`tooltip-average-DRR-by-classification-${itemDetails.name}`}
                    data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                      getTooltipContent('Average DRR By Classification'),
                    )}
                    data-tooltip-place="bottom"
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon
                      className={`h-4 w-4 ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'
                      }`}
                    />
                  </span>
                  <ReactTooltip
                    id={`tooltip-average-DRR-by-classification-${itemDetails.name}`}
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
                </span>
              </div>
              <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm font-semibold text-left min-w-[60px]`}>{averageRejectionByClassification} </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* Main Card */}
            <div className="col-span-4">
              <div
                className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80"
                style={{
                  borderBottom: `solid 0.4vh ${getChangeColorForWidget(
                    itemDetails.name,
                    itemDetails.value || 0,
                  )}`,
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2
                        className={`text-lg font-semibold ${
                          theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'
                        }`}
                      >
                        {itemDetails.name}
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-drr`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon
                          className={`h-4 w-4 ${
                            theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'
                          }`}
                        />
                      </span>
                      <ReactTooltip
                        id={`tooltip-drr`}
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
                      <span
                        className={`text-xl font-semibold ${
                          theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'
                        } mr-2`}
                      >
                        {itemDetails.value}
                      </span>
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-300'
                        } text-lg`}
                      >
                        %
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
                  <div
                    className="border-b dark:border-[#25384F] mb-4"
                    style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}
                  ></div>

                  <div className="text-[#0A2342] dark:text-gray-300 text-sm font-semibold mb-6">
                    {selectedTypeLabel} Wise Overview
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                        } text-sm`}
                      >
                        Defect Rejected In {selectedTypeLabel}
                      </span>
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'
                        } text-sm`}
                      >
                        {Math.round(
                          defectRejectionData[0]?.defectRejectedRate?.totalRejectedDefect[0]
                            ?.count ?? 0,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                        } text-sm`}
                      >
                        Total Defect In {selectedTypeLabel}
                      </span>
                      <span
                        className={`${
                          theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'
                        } text-sm`}
                      >
                        {Math.round(defectRejectionData[0]?.defectRejectedRate?.totalDefect ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2
                      className={`text-lg font-semibold ${
                        theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'
                      }`}
                    >
                      Defect Rejection Ratio
                    </h2>
                    <div className="flex items-center gap-3">
                      <DropdownButton
                        buttonLabel="Select View"
                        options={drrViewOptions}
                        selectedOption={
                          drrViewOptions.find((option) => option.value === selectedDrrView)?.label
                        }
                        onSelect={handleDrrViewSelect}
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
                                : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
                    {selectedDrrView === 'sprint' ? (
                      <div className="h-full">
                        <div
                          className="overflow-x-auto overflow-y-hidden"
                          style={{ width: '100%', height: '250px' }}
                        >
                          <div
                            className="flex items-center"
                            style={{ minWidth: '100%', height: '100%' }}
                          >
                            {getDrrSprintData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getDrrSprintPieData().map(item => item.name)}
                                  dataPoints={getDrrSprintPieData().map(item => item.value)}
                                  backgroundColors={getDrrSprintPieData().map(item => item.color)}
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
                                              const total = context.dataset.data.reduce(
                                                (a, b) => a + b,
                                                0,
                                              );
                                              const percentage = (
                                                (context.raw / total) *
                                                100
                                              ).toFixed(1);
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
                                  data={getDrrSprintData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="drrDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : selectedDrrView === 'team_member' ? (
                      <div className="h-full">
                        <div
                          className="overflow-x-auto overflow-y-hidden"
                          style={{ width: '100%', height: '250px' }}
                        >
                          <div
                            className="flex items-center"
                            style={{ minWidth: '100%', height: '100%' }}
                          >
                            {getDrrTeamMemberData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    labels={getDrrTeamMemberPieData().map(item => item.name)}
                                    dataPoints={getDrrTeamMemberPieData().map(item => item.value)}
                                    backgroundColors={getDrrTeamMemberPieData().map(item => item.color)}
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
                                              const total = context.dataset.data.reduce(
                                                (a, b) => a + b,
                                                0,
                                              );
                                              const percentage = (
                                                (context.raw / total) *
                                                100
                                              ).toFixed(1);
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
                                  data={getDrrTeamMemberData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="drrDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full">
                        <div
                          className="overflow-x-auto overflow-y-hidden"
                          style={{ width: '100%', height: '280px' }}
                        >
                          <div
                            className="flex items-center"
                            style={{ minWidth: '100%', height: '100%' }}
                          >
                            {getDrrClassificationData().length > 0 ? (
                              selectedChartType === 'pie' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <DoughnutChart
                                    // data={getDrrClassificationPieData()}
                                    labels={getDrrClassificationPieData().map(item => item.name)}
                                    dataPoints={getDrrClassificationPieData().map(item => item.value)}
                                    backgroundColors={getDrrClassificationPieData().map(item => item.color)}
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
                                              const total = context.dataset.data.reduce(
                                                (a, b) => a + b,
                                                0,
                                              );
                                              const percentage = (
                                                (context.raw / total) *
                                                100
                                              ).toFixed(1);
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
                                  data={getDrrClassificationData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                                  showLine={selectedChartType === 'line'}
                                  showBar={selectedChartType === 'bar'}
                                  type="drrDistribution"
                                />
                              )
                            ) : (
                              <NoDataPlaceholder height={200} />
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
};

DefectRejectionRatio.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};

export default DefectRejectionRatio;
