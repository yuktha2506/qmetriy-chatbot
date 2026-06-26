import { useState } from 'react';
import '../../../assets/css/issueType.scss';
import PropTypes from 'prop-types';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';
import DropdownButton from '../../Common/DropDown';
import NoDataPlaceholder from '../../Common/NoDataPlaceholder';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import DonutChart from '../../Common/DonutChart';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import { getBoardLabels } from '../../../utils/boardUtils';
import { APP_STRINGS } from '../../../constants';

const IssueType = ({ getStatusCount, getTaskCountValue, selectedValue, layout, itemDetails }) => {
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});

  const { sprintLabel, releaseLabel, isAzure } = getBoardLabels({
    projectList: jiraData?.projectList,
  });
  const selectedValueRaw =
    typeof selectedValue === 'string'
      ? selectedValue
      : selectedValue?.value || selectedValue?.label || '';

  const [selectedIssueWise, setSelectedIssueWise] = useState({
    label: 'Issue Wise',
    value: 'issue_wise',
  });
  const [selectedIssueType, setSelectedIssueType] = useState({
    label: isAzure ? 'User Story' : 'Stories',
    value: 'stories',
  });
  const [selectedChartType, setSelectedChartType] = useState('bar');

  const issueWiseOptions = [
    {
      label: 'Issue Wise',
      value: 'issue_wise',
    },
    {
      label: 'Status Wise',
      value: 'status_wise',
    },
    {
      label: 'Priority Wise',
      value: 'priority_wise',
    },
    {
      label: 'Team Member Wise',
      value: 'team_member_wise',
    },
  ];

  const issueTypeOptions = [
    {
      label: isAzure ? 'User Story' : 'Stories',
      value: 'stories',
    },
    {
      label: 'Epics',
      value: 'epics',
    },
    {
      label: 'Bugs',
      value: 'bugs',
    },
    {
      label: 'Tasks',
      value: 'tasks',
    },
    {
      label: 'Sub-task',
      value: 'sub-task',
    },
    {
      label: 'Others',
      value: 'others',
    },
  ];

  const handleIssueWiseSelect = (value) => {
    setSelectedIssueWise(value);
  };

  const handleIssueTypeSelect = (value) => {
    setSelectedIssueType(value);
  };

  const getFilteredIssueType = () => {
    switch (selectedIssueType.value) {
      case 'stories':
        return getStatusCount.filter((item) => item.name === (isAzure ? 'User Story' : 'Story'));
      case 'tasks':
        return getStatusCount.filter((item) => item.name === 'Task');
      case 'bugs':
        return getStatusCount.filter((item) => item.name === 'Bug');
      case 'epics':
        return getStatusCount.filter((item) => item.name === 'Epic');
      case 'sub-task':
        return getStatusCount.filter((item) => item.name === 'Sub-task');
      case 'others':
        return getStatusCount.filter((item) => item.name === 'Others');
      default:
        return [];
    }
  };

  const filteredIssueTypeData = getFilteredIssueType();
  const filteredData =
    filteredIssueTypeData.length > 0 ? filteredIssueTypeData : [{ open: 0, close: 0 }];

  const totalIssues = getTaskCountValue?.find((item) => item.getPriorityWise) || {};
  const issesTypes = totalIssues?.getPriorityWise?.result || [];
  const priorityRanking = {
    highest: 5,
    high: 4,
    medium: 3,
    low: 2,
    lowest: 1,
  };
  const sortedIssues = issesTypes
    ? issesTypes
        .map((item) => ({
          ...item,
          rank: priorityRanking[item.name.toLowerCase()] || 0,
        }))
        .sort((a, b) => b.rank - a.rank)
    : [];

  const statusTypes =
    getTaskCountValue.find((item) => item.statusDistribution)?.statusDistribution?.result || [];
  const filteredStatusTypes = statusTypes.filter(
    (item) => item.name.toLowerCase() !== 'done' && item.name.toLowerCase() !== 'closed',
  );

  const issuesTypes = getTaskCountValue.find((item) => item.openIssues)?.openIssues?.result || [];
  const teamIssuesTypes =
    getTaskCountValue.find((item) => item.openIssuesPerTeamMember)?.openIssuesPerTeamMember || [];

  const getChartData = () => {
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];

    switch (selectedIssueWise.value) {
      case 'priority_wise':
        return sortedIssues.map((item, index) => ({
          name: item.name,
          value: item.count,
          color: dsShades[index % dsShades.length],
        }));
      case 'status_wise':
        return filteredStatusTypes.map((item, index) => ({
          name: item.name,
          value: item.count,
          color: dsShades[index % dsShades.length],
        }));
      case 'issue_wise':
        return issuesTypes.map((item, index) => ({
          name: item.type,
          value: item.count,
          color: dsShades[index % dsShades.length],
        }));
      default:
        return [];
    }
  };

  const chartData = getChartData();

  const getLegendLabel = () => {
    switch (selectedIssueWise.value) {
      case 'priority_wise':
        return 'Priority Count';
      case 'status_wise':
        return 'Status Count';
      case 'issue_wise':
        return 'Issue Count';
      default:
        return 'Count';
    }
  };

  const tableData = teamIssuesTypes.map((row) => {
    const bugCount = row.types.find((type) => type.name === 'Bug')?.count || 0;
    const taskCount = row.types.find((type) => type.name === 'Task')?.count || 0;
    const storyTypeName = isAzure ? 'User Story' : 'Story';
    const storyCount = row.types.find((type) => type.name === storyTypeName)?.count || 0;
    const epicCount = row.types.find((type) => type.name === 'Epic')?.count || 0;
    const subtaskCount = row.types.find((type) => type.name === 'Sub-task')?.count || 0;
    const othersCount = row.types.find((type) => type.name === 'Others')?.count || 0;
    const totalCount = bugCount + taskCount + storyCount + epicCount + subtaskCount + othersCount;

    return {
      assignee: row.assignee,
      bug: bugCount,
      task: taskCount,
      story: storyCount,
      epic: epicCount,
      subtask: subtaskCount,
      others: othersCount,
      total: totalCount,
    };
  });

  return (
    <>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom: `solid 0.4vh ${getChangeColorForWidget(
              itemDetails.name,
              itemDetails.value || 0,
            )}`,
          }}
        >
          <div className="flex flex-col w-full">
            <div
              className="flex items-center justify-center border-b dark:border-[#25384F] pt-1 pb-4"
              style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}
            >
              <div className="flex items-center gap-2">
                <h2
                  className={`text-lg font-semibold ${
                    theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'
                  }`}
                >
                  {itemDetails.name}
                </h2>
                <div className="item-center">
                  <span
                    data-tooltip-id={`tooltip-${itemDetails.name}-title`}
                    data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                    data-tooltip-offset="15"
                    className="cursor-pointer"
                  >
                    <InformationCircleIcon
                      className={`h-5 w-5 ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'
                      }`}
                    />
                  </span>
                  <ReactTooltip
                    id={`tooltip-${itemDetails.name}-title`}
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
                      borderColor: theme === 'dark' ? '#224F78' : '#224F78',
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
              </div>

              <div className="w-auto ml-auto">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <span
                      className={`text-xl font-semibold ${
                        theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'
                      } mr-2`}
                    >
                      {itemDetails.value}
                    </span>
                  </div>
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
            </div>
            <div className="grid grid-cols-[45%_49%] gap-10">
              {/* Left side - Main metrics */}
              <div className="flex flex-col">
                <div className="flex py-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-[#0A2342] dark:text-gray-300 mb-4 gap-2 font-semibold">
                      <span>
                        {selectedValueRaw === APP_STRINGS.VALUE_RELEASE ? releaseLabel : sprintLabel} Wise Overview
                      </span>
                      <DropdownButton
                        buttonLabel={isAzure ? 'User Story' : 'Stories'}
                        options={issueTypeOptions}
                        onSelect={handleIssueTypeSelect}
                        value={selectedIssueType}
                        placeholder={isAzure ? 'User Story' : 'Stories'}
                        type="stories"
                        width="sm"
                      />
                    </div>
                    {filteredData.map((count) => (
                      <>
                        <div
                          className={`flex justify-between ${
                            theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                          }`}
                        >
                          <span className="flex gap-2">
                            Total {selectedIssueType.label}
                            <span
                              data-tooltip-id={`tooltip-${itemDetails.name}-total`}
                              data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                getTooltipContent(
                                  `Total ${selectedIssueType.label}`,
                                  [],
                                  'Issue Type',
                                ),
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
                              id={`tooltip-${itemDetails.name}-total`}
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
                          <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} font-semibold text-left min-w-[50px]`}>
                            {(count?.open || 0) + (count?.close || 0)}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between ${
                            theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                          }`}
                        >
                          <span className="flex gap-2">
                            Total Open {selectedIssueType.label}
                            <span
                              data-tooltip-id={`tooltip-${itemDetails.name}-open`}
                              data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                getTooltipContent(
                                  `Open ${selectedIssueType.label}`,
                                  [],
                                  'Issue Type',
                                ),
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
                              id={`tooltip-${itemDetails.name}-open`}
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
                          <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} font-semibold text-left min-w-[50px]`}>{count?.open || '0'}</span>
                        </div>
                        <div
                          className={`flex justify-between ${
                            theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                          }`}
                        >
                          <span className="flex gap-2">
                            Total Closed {selectedIssueType.label}
                            <span
                              data-tooltip-id={`tooltip-${itemDetails.name}-closed`}
                              data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                getTooltipContent(
                                  `Closed ${selectedIssueType.label}`,
                                  [],
                                  'Issue Type',
                                ),
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
                              id={`tooltip-${itemDetails.name}-closed`}
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
                          <span className={`${theme === 'light' ? 'text-[#0072BB]' : 'dark:text-gray-300'} font-semibold text-left min-w-[50px]`}>{count?.close || '0'}</span>
                        </div>
                      </>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right side - Detailed metrics */}
              <div className="flex flex-col text-sm py-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex justify-center">
                    <h2
                      className={`text-sm ${
                        theme === 'light'
                          ? 'text-[#0A2342] font-semibold'
                          : 'dark:text-gray-300 font-semibold'
                      }`}
                    >
                      Total Open Issues
                    </h2>
                  </div>
                  <div className="flex justify-center ml-auto">
                    <DropdownButton
                      buttonLabel="Issue Wise"
                      options={issueWiseOptions}
                      onSelect={handleIssueWiseSelect}
                      value={selectedIssueWise}
                      placeholder="Issue Wise"
                      type="issueWise"
                      width="md"
                    />
                  </div>
                </div>
                {selectedIssueWise.value === 'issue_wise' && issuesTypes.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {issuesTypes.map((item) => (
                      <div key={item.type} className="flex justify-between mr-2">
                        <span className="text-[#626262] dark:text-gray-400 text-sm capitalize">
                          {item.type}
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 text-sm">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedIssueWise.value === 'priority_wise' && sortedIssues.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {sortedIssues.map((item) => (
                      <div key={item.name} className="flex justify-between mr-2">
                        <span className="text-[#626262] dark:text-gray-400 text-sm capitalize">
                          {item.name}
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 text-sm">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedIssueWise.value === 'status_wise' && filteredStatusTypes.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {filteredStatusTypes.map((item) => (
                      <div key={item.name} className="flex justify-between mr-2">
                        <span className="text-[#626262] dark:text-gray-400 text-sm capitalize">
                          {item.name}
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 text-sm">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedIssueWise.value === 'team_member_wise' && teamIssuesTypes.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {teamIssuesTypes.map((row) => {
                      const storyTypeName = isAzure ? 'User Story' : 'Story';
                      const totalCount = [
                        'Bug',
                        'Task',
                        storyTypeName,
                        'Epic',
                        'Sub-task',
                        'Others',
                      ].reduce((total, issueType) => {
                        const foundType = row.types.find((type) => type.name === issueType);
                        return total + (foundType?.count || 0);
                      }, 0);

                      return (
                        <div key={row.name} className="flex flex-col mr-2">
                          <div className="flex justify-between font-medium">
                            <span className="text-[#626262] dark:text-gray-400">
                              {row.assignee}
                            </span>
                            <span className="text-[#202020] dark:text-gray-300">{totalCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
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
                        Issue Type
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-issue-type`}
                        data-tooltip-html={getTooltipContentByName('Issue Type')}
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon
                          className={`h-5 w-5 ${
                            theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'
                          }`}
                        />
                      </span>
                      <ReactTooltip
                        id={`tooltip-issue-type`}
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
                          borderColor: theme === 'dark' ? '#224F78' : '#224F78',
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
                        className={`text-2xl font-semibold ${
                          theme === 'light' ? 'text-[#0072BB]' : 'text-blue-400'
                        } mr-2`}
                      >
                        {itemDetails.value}
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

                  {/* Header line below Issue Type */}
                  <div
                    className="border-b dark:border-[#25384F] mb-4"
                    style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}
                  ></div>

                  {/* Sprint/Release Wise Overview */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[#0A2342] dark:text-gray-300 text-sm font-semibold">
                        {selectedValueRaw === APP_STRINGS.VALUE_RELEASE ? releaseLabel : sprintLabel} Wise Overview
                      </span>
                      <DropdownButton
                        buttonLabel={selectedIssueType.label}
                        options={issueTypeOptions}
                        onSelect={handleIssueTypeSelect}
                        value={selectedIssueType}
                        placeholder="Stories"
                        type="stories"
                        width="sm"
                      />
                    </div>

                    {/* Issue Type Metrics */}
                    <div className="space-y-4">
                      {filteredData.map((count, index) => (
                        <div key={index} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span
                              className={`${
                                theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                              } text-sm flex items-center gap-2`}
                            >
                              Total {selectedIssueType.label}
                              <span
                                data-tooltip-id={`tooltip-total-${selectedIssueType.value}`}
                                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                  getTooltipContent(
                                    `Total ${selectedIssueType.label}`,
                                    [],
                                    'Issue Type',
                                  ),
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
                                id={`tooltip-total-${selectedIssueType.value}`}
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
                            <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                              {(count?.open || 0) + (count?.close || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span
                              className={`${
                                theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                              } text-sm flex items-center gap-2`}
                            >
                              Open {selectedIssueType.label}
                              <span
                                data-tooltip-id={`tooltip-open-${selectedIssueType.value}`}
                                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                  getTooltipContent(
                                    `Open ${selectedIssueType.label}`,
                                    [],
                                    'Issue Type',
                                  ),
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
                                id={`tooltip-open-${selectedIssueType.value}`}
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
                            <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                              {count?.open || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span
                              className={`${
                                theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'
                              } text-sm flex items-center gap-2`}
                            >
                              Closed {selectedIssueType.label}
                              <span
                                data-tooltip-id={`tooltip-closed-${selectedIssueType.value}`}
                                data-tooltip-html={ReactDOMServer.renderToStaticMarkup(
                                  getTooltipContent(
                                    `Closed ${selectedIssueType.label}`,
                                    [],
                                    'Issue Type',
                                  ),
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
                                id={`tooltip-closed-${selectedIssueType.value}`}
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
                            <span className={`${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'} text-sm text-left min-w-[50px]`}>
                              {count?.close || 0}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Section - Right Side (8 columns) */}
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                <div className="flex flex-col h-full">
                  {/* Chart Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2
                      className={`text-lg font-semibold ${
                        theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'
                      }`}
                    >
                      Total Open Issues
                    </h2>
                    <div className="flex items-center gap-2">
                      <DropdownButton
                        buttonLabel={selectedIssueWise.label}
                        options={issueWiseOptions}
                        onSelect={handleIssueWiseSelect}
                        value={selectedIssueWise}
                        placeholder="Issue Wise"
                        type="issueWise"
                        width="lgx"
                      />
                      {/* Chart Type Buttons */}
                      <div className="flex items-center space-x-2 ml-2">
                        <div className="relative group">
                        <LineChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            selectedIssueWise.value === 'team_member_wise'
                              ? 'text-gray-400 bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                              : selectedChartType === 'line'
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                          }`}
                          onClick={() => selectedIssueWise.value !== 'team_member_wise' && setSelectedChartType('line')}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Line Chart
                        </div>
                        </div>
                        <div className="relative group">
                        <BarChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            selectedIssueWise.value === 'team_member_wise'
                              ? 'text-gray-400 bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                              : selectedChartType === 'bar'
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                          }`}
                          onClick={() => selectedIssueWise.value !== 'team_member_wise' && setSelectedChartType('bar')}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Bar Chart
                        </div>
                        </div>
                        <div className="relative group">
                        <DonutChartIcon
                          className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                            selectedIssueWise.value === 'team_member_wise'
                              ? 'text-gray-400 bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                              : selectedChartType === 'pie'
                              ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                              : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
                          }`}
                          onClick={() => selectedIssueWise.value !== 'team_member_wise' && setSelectedChartType('pie')}
                        />
                        <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                          Donut Chart
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart Content */}
                  <div className="flex-1 overflow-hidden">
                    {selectedIssueWise.value === 'team_member_wise' &&
                    teamIssuesTypes.length > 0 ? (
                      <div
                        className="h-full overflow-auto"
                        style={{ maxHeight: 'calc(100% - 0px)' }}
                      >
                        <table className="w-full text-sm min-w-max border-collapse">
                          <thead className="sticky top-0 z-10">
                            <tr
                              className="border-b dark:border-[#25384F]"
                              style={{ borderColor: theme === 'light' ? '#D1E2F0' : undefined }}
                            >
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Assignee
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Bug
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Task
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                {isAzure ? 'User Story' : 'Story'}
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Epic
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Sub-task
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Others
                              </th>
                              <th className="text-left py-2 px-2 text-[#626262] dark:text-gray-400 bg-white dark:bg-[#182433] whitespace-nowrap">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.map((row, index) => (
                              <tr
                                key={index}
                                className="border-b border-[#E5E5E5] dark:border-[#25384F] hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.assignee}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.bug}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.task}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.story}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.epic}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.subtask}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 whitespace-nowrap">
                                  {row.others}
                                </td>
                                <td className="py-2 px-2 text-[#202020] dark:text-gray-300 font-medium whitespace-nowrap">
                                  {row.total}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : chartData.length > 0 ? (
                    <div className="h-full">
                      <div className="overflow-x-auto" style={{ width: '100%', height: '240px' }}>
                        <div className="flex items-center" style={{ minWidth: '100%', height: '100%' }}>
                            {selectedChartType === 'pie' ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <DonutChart
                                  labels={chartData.map((item) => item.name)}
                                  dataPoints={chartData.map((item) => item.value)}
                                  backgroundColors={chartData.map((item) => item.color)}
                                  label={getLegendLabel()}
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
                                />
                              </div>
                            ) : (
                              <div style={{ width: '100%', height: '100%', paddingBottom: '20px' }}>
                                <CustomLineBarChart 
                                  data={chartData.map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))} 
                                  showLine={selectedChartType === 'line'} 
                                  showBar={selectedChartType === 'bar'} 
                                  type={'issueTypeDistribution'}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <NoDataPlaceholder height={180} />
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
IssueType.propTypes = {
  getStatusCount: PropTypes.array.isRequired,
  getTaskCountValue: PropTypes.array.isRequired,
  selectedValue: PropTypes.object.isRequired,
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};
export default IssueType;
