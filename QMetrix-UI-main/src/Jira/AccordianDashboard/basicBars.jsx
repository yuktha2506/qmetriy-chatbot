import ApexCharts from 'react-apexcharts';
import { useSelector } from 'react-redux';
import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { APP_STRINGS } from '../../../constants';

const BasicBars = ({ toggleValue }) => {
  const jiraData = useSelector((state) => state.jira || {});
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [toggleState, setToggleState] = useState(APP_STRINGS.API_SPRINT);
  const [showDataLabelsFirst, setShowDataLabelsFirst] = useState(false);
  const [showDataLabelsSecond, setShowDataLabelsSecond] = useState(false);

  useEffect(() => {
    if (jiraData) {
      setSelectedSprint({
        id: jiraData.selectedSprintId || '',
        name: jiraData.selectedSprintName || '',
      });
      setSelectedRelease({
        id: jiraData.selectedReleaseId || '',
        releaseName: jiraData.selectedReleaseName || '',
      });
      setSelectedValue({
        label: jiraData.selectedValueLabel || APP_STRINGS.SELECT_AN_OPTION,
        value: jiraData.selectedValue || '',
      });
    }
  }, [jiraData]);
  const isSprintMode = selectedValue.value === APP_STRINGS.VALUE_SPRINT;
  const isReleaseMode = selectedValue.value === APP_STRINGS.VALUE_RELEASE;

  const processTeamMemberData = useMemo(() => {
    const spByTeamMemberData = jiraData?.storyPointsData || [];
    
    if (
      !spByTeamMemberData ||
      !Array.isArray(spByTeamMemberData) ||
      spByTeamMemberData.length === 0
    ) {
      return {
        teamMemberLabels: [],
        teamMemberCommitted: [],
        teamMemberCompleted: [],
      };
    }

    const currentData = spByTeamMemberData.find((item) => item.SPByTeamMember);
    if (!currentData || !currentData.SPByTeamMember) {
      return {
        teamMemberLabels: [],
        teamMemberCommitted: [],
        teamMemberCompleted: [],
      };
    }

    const spByTeamMember = currentData.SPByTeamMember;
    const teamMemberLabels = Object.keys(spByTeamMember);
    const teamMemberCommitted = teamMemberLabels.map(
      (member) => spByTeamMember[member]?.committed || 0,
    );
    const teamMemberCompleted = teamMemberLabels.map(
      (member) => spByTeamMember[member]?.completed || 0,
    );

    return {
      teamMemberLabels,
      teamMemberCommitted,
      teamMemberCompleted,
    };
  }, [jiraData]);

  const processedData = useMemo(() => {
    const teamMemberData = processTeamMemberData;
    const sprintData = jiraData?.sprintList || [];
    const releaseData = jiraData?.releasesList || [];
    let dataSource = [];
    let selectedItem = null;

    if (isSprintMode) {
      dataSource = sprintData;
      selectedItem = selectedSprint;
    } else if (isReleaseMode) {
      dataSource = releaseData;
      selectedItem = selectedRelease;
    } else {
      dataSource = sprintData;
      selectedItem = selectedSprint;
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      return {
        labels: [],
        completedPercentages: [],
        committedPercentages: [],
        velocityData: [],
        committedData: [],
        completedData: [],
        gapData: [],
        initiallyCommittedData: [],
        finallyCommittedData: [],
        doneData: [],
      };
    }

    const allSortedData = [...dataSource].sort(
      (a, b) => new Date(a.startDate) - new Date(b.startDate),
    );

    let sortedData;

    if (selectedItem && selectedItem.id) {
      const selectedItemIndex = allSortedData.findIndex((item) => {
        if (isSprintMode) {
          return item.sprintId === selectedItem.id || item._id === selectedItem.id;
        } else if (isReleaseMode) {
          return item.releaseId === selectedItem.id || item._id === selectedItem.id;
        }
        return item.sprintId === selectedItem.id || item._id === selectedItem.id;
      });

      if (selectedItemIndex !== -1) {
        const endIndex = selectedItemIndex + 1;
        const startIndex = Math.max(0, endIndex - 6);
        sortedData = allSortedData.slice(startIndex, endIndex);
      } else {
        sortedData = allSortedData.slice(-6);
      }
    } else {
      sortedData = allSortedData.slice(-6);
    }

    const labels = sortedData.map((item) => {
      if (isSprintMode) {
        return item.name || `Sprint ${item.sprintId}`;
      } else if (isReleaseMode) {
        return item.releaseName || item.name || `Release ${item.releaseId}`;
      }
      return item.name || `Sprint ${item.sprintId}`;
    });

    const completedPercentages = sortedData.map((item) => {
      const committed = item.committedVsCompletedMetrics?.committedStoryPoints || 0;
      const completed = item.committedVsCompletedMetrics?.completedStoryPoints || 0;
      return committed > 0 ? Math.round((completed / committed) * 100) : 0;
    });

    const committedPercentages = sortedData.map((item) => {
      const total = item.totalStoryPoints || 0;
      const committed = item.committedVsCompletedMetrics?.committedStoryPoints || 0;
      return total > 0 ? Math.round((committed / total) * 100) : 100;
    });

    const committedData = sortedData.map(
      (item) => item.committedVsCompletedMetrics?.committedStoryPoints || 0,
    );

    const completedData = sortedData.map(
      (item) => item.committedVsCompletedMetrics?.completedStoryPoints || 0,
    );

    const gapData = committedData.map((committed, index) =>
      Math.max(0, committed - completedData[index]),
    );

    const initiallyCommittedData = sortedData.map(
      (item) => item.committedVsCompletedMetrics?.initialStoryPoints || 0,
    );

    const finallyCommittedData = sortedData.map(
      (item) => item.committedVsCompletedMetrics?.committedStoryPoints || 0,
    );

    const doneData = sortedData.map(
      (item) => item.committedVsCompletedMetrics?.completedStoryPoints || 0,
    );

    const velocityData = sortedData.map((item) => item.velocity?.completed || 0);

    const result = {
      labels,
      completedPercentages,
      committedPercentages,
      velocityData,
      committedData,
      completedData,
      gapData,
      initiallyCommittedData,
      finallyCommittedData,
      doneData,
      ...teamMemberData,
    };

    return result;
  }, [
    jiraData,
    selectedSprint,
    selectedRelease,
    isSprintMode,
    isReleaseMode,
    processTeamMemberData,
  ]);

  const rootStyles = getComputedStyle(document.documentElement);
  const theme = useSelector((state) => state.theme.theme);
  const themes = {
    light: {
      backgroundColor: 'white',
      labelColor: rootStyles.getPropertyValue('--label-color-light').trim(),
      gridColor: rootStyles.getPropertyValue('--grid-color-light').trim(),
      borderColor: rootStyles.getPropertyValue('--border-color-light').trim(),
      datalabelsColor: rootStyles.getPropertyValue('--datalabels-color-light').trim(),
      legendColor: rootStyles.getPropertyValue('--legend-color-light').trim(),
      tooltipTheme: 'light',
    },
    dark: {
      backgroundColor: '#2f3349',
      labelColor: rootStyles.getPropertyValue('--label-color-dark').trim(),
      gridColor: rootStyles.getPropertyValue('--grid-color-dark').trim(),
      borderColor: rootStyles.getPropertyValue('--border-color-dark').trim(),
      datalabelsColor: rootStyles.getPropertyValue('--datalabels-color-dark').trim(),
      legendColor: rootStyles.getPropertyValue('--legend-color-dark').trim(),
      tooltipTheme: 'dark',
    },
  };

  const tooltipTheme = themes[theme].tooltipTheme;

  const uData =
    isSprintMode || isReleaseMode ? processedData.completedData : processedData.completedData;
  const pData =
    isSprintMode || isReleaseMode ? processedData.committedData : processedData.committedData;
  const xLabels = isSprintMode || isReleaseMode ? processedData.labels : processedData.labels;

  const comittedByTeamMemberData = processedData.teamMemberCommitted || [];
  const completedByTeamMemberData = processedData.teamMemberCompleted || [];
  const userLabels = processedData.teamMemberLabels || [];

  const formatLabel = (value) => {
    if (!value || typeof value !== 'string') {
      return value || '';
    }

    const maxLineLength = 9;
    const words = value.split(' ');
    if (words.length === 1 && value.length > maxLineLength) {
      return value.length > maxLineLength ? value.substring(0, maxLineLength - 3) + '...' : value;
    }

    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;

      if (testLine.length <= maxLineLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(
            word.length > maxLineLength ? word.substring(0, maxLineLength - 3) + '...' : word,
          );
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  const getLineChartOptions = (label) => {
    return {
      chart: {
        type: 'line',
        height: 200,
        toolbar: {
          show: false,
        },
      },
      colors: [
        rootStyles.getPropertyValue('--line-color-primary').trim(),
        rootStyles.getPropertyValue('--line-color-secondary').trim(),
      ],
      xaxis: {
        categories: label,
        labels: {
          formatter: function (value) {
            return formatLabel(value);
          },
          style: {
            colors: themes[theme].labelColor,
            fontSize: '12px',
          },
        },
      },
      yaxis: {
        labels: {
          show: true,
          style: {
            colors: themes[theme].labelColor,
            fontSize: '12px',
          },
        },
      },
      grid: {
        borderColor: 'transparent',
      },
      stroke: {
        curve: 'smooth',
      },
      fill: {
        type: 'solid',
      },
      markers: {
        size: 6,
        colors: ['#FF4560', '#00E396'],
        hover: {
          size: 10,
          colors: ['#FF4560', '#00E396'],
        },
      },
      tooltip: {
        theme: tooltipTheme,
        marker: {
          show: true,
        },
      },
      dataLabels: {
        enabled: true,
        style: {
          colors: [themes[theme].datalabelsColor],
        },
      },
      legend: {
        labels: {
          colors: themes[theme].legendColor,
        },
      },
    };
  };

  const barChartOptions = {
    chart: {
      type: 'bar',
      height: 200,
      toolbar: {
        show: false,
      },
    },
    colors: [
      rootStyles.getPropertyValue('--bar-color-primary').trim(),
      rootStyles.getPropertyValue('--bar-color-secondary').trim(),
      rootStyles.getPropertyValue('--bar-color-tertiary').trim(),
    ],
    xaxis: {
      categories: xLabels,
      labels: {
        formatter: function (value) {
          return formatLabel(value);
        },
        style: {
          colors: themes[theme].labelColor,
          fontSize: '12px',
        },
      },
    },
    yaxis: {
      labels: {
        show: true,
        style: {
          colors: themes[theme].labelColor,
          fontSize: '12px',
        },
      },
    },
    grid: {
      borderColor: 'transparent',
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 10,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'all',
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: showDataLabelsFirst,
      enabledOnSeries: [0, 1, 2],
      style: {
        colors: [themes[theme].datalabelsColor],
        fontSize: '12px',
        fontWeight: 'bold',
      },
      background: {
        enabled: false,
      },
    },
    fill: {
      type: 'solid',
    },
    tooltip: {
      theme: tooltipTheme,
      marker: {
        show: true,
      },
    },
    legend: {
      labels: {
        colors: themes[theme].legendColor,
      },
    },
  };
  const mixedChartOptions = {
    chart: {
      type: 'line',
      height: 200,
      toolbar: {
        show: false,
      },
    },
    colors: [
      rootStyles.getPropertyValue('--bar-color-primary').trim(),
      rootStyles.getPropertyValue('--bar-color-quaternary').trim(),
      rootStyles.getPropertyValue('--bar-color-secondary').trim(),
      rootStyles.getPropertyValue('--bar-color-tertiary').trim(),
    ],
    xaxis: {
      categories: xLabels,
      labels: {
        formatter: function (value) {
          return formatLabel(value);
        },
        style: {
          colors: themes[theme].labelColor,
          fontSize: '12px',
        },
      },
    },
    yaxis: {
      labels: {
        show: true,
        style: {
          colors: themes[theme].labelColor,
          fontSize: '12px',
        },
      },
    },
    grid: {
      borderColor: 'transparent',
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 10,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'all',
      },
    },
    dataLabels: {
      enabled: showDataLabelsSecond,
      enabledOnSeries: [0, 1, 2, 3],
      style: {
        colors: [themes[theme].datalabelsColor],
        fontSize: '12px',
        fontWeight: 'bold',
      },
      background: {
        enabled: false,
      },
    },
    stroke: {
      width: [0, 0, 0, 3],
      curve: 'smooth',
    },
    fill: {
      type: ['solid', 'solid', 'solid', 'solid'],
    },
    tooltip: {
      theme: tooltipTheme,
      marker: {
        show: true,
      },
    },
    legend: {
      labels: {
        colors: themes[theme].legendColor,
      },
    },
  };

  const getTitle = () => {
    const dataType = toggleValue === 'storyPoints' ? 'Story Points' : 'Tickets';
    const viewType = isSprintMode ? 'Sprint' : isReleaseMode ? 'Release' : 'Sprint';
    return `${dataType} Committed VS Completed Trend - ${viewType} View`;
  };

  return (
    <div className="relative p-4 bg-white dark:bg-[#182433] rounded-lg shadow-lg text-[#202020] dark:text-custom-gray">
      <div className="flex justify-between">
        <h1 className="flex text-xl font-semibold">{getTitle()}</h1>
        <div className="flex ml-auto h-auto">
          <div className="border-2 border-[#c7c2f9] w-auto rounded-2xl bg-gray-300">
            <button
              onClick={() => setToggleState('sprint')}
              className={`py-1 px-2 rounded-xl ${
                toggleState === 'sprint' ? 'bg-primary-500 text-white' : 'bg-gray-300 text-black'
              }`}
            >
              {isSprintMode ? 'Sprint' : isReleaseMode ? 'Release' : 'Sprint'}
            </button>
            <button
              onClick={() => setToggleState('teamMember')}
              className={`py-1 px-2 rounded-xl ${
                toggleState === 'teamMember'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-300 text-black'
              }`}
            >
              Team Member
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="relative">
          {toggleState === 'sprint' || toggleState === 'release' ? (
            <ApexCharts
              options={getLineChartOptions(xLabels)}
              series={[
                {
                  name: `Total ${
                    toggleValue === 'storyPoints' ? 'Story Points' : 'Tickets'
                  } completed`,
                  data: uData,
                },
                {
                  name: `Total ${
                    toggleValue === 'storyPoints' ? 'Story Points' : 'Tickets'
                  } committed`,
                  data: pData,
                },
              ]}
              type="line"
              height={200}
            />
          ) : (
            <ApexCharts
              options={getLineChartOptions(userLabels)}
              series={[
                {
                  name: `Total ${
                    toggleValue === 'storyPoints' ? 'Story Points' : 'Tickets'
                  } completed`,
                  data: comittedByTeamMemberData,
                },
                {
                  name: `Total ${
                    toggleValue === 'storyPoints' ? 'Story Points' : 'Tickets'
                  } committed`,
                  data: completedByTeamMemberData,
                },
              ]}
              type="line"
              height={200}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 mt-4">
        <div>
          <h2 className="text-lg font-semibold">Committed VS Completed Gap Analysis</h2>
          <div className="flex ml-auto h-auto mt-1">
            <div className="border-2 border-[#c7c2f9] w-auto rounded-2xl bg-gray-300">
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowDataLabelsFirst(true)}
                  className={`py-1 px-3 rounded-xl text-xs ${
                    showDataLabelsFirst ? 'bg-primary-500 text-white' : 'bg-gray-300 text-black'
                  }`}
                  title="Show Data Labels"
                >
                  Show Labels
                </button>
                <button
                  onClick={() => setShowDataLabelsFirst(false)}
                  className={`py-1 px-3 rounded-xl text-xs ${
                    !showDataLabelsFirst ? 'bg-primary-500 text-white' : 'bg-gray-300 text-black'
                  }`}
                  title="Hide Data Labels"
                >
                  Hide Labels
                </button>
              </div>
            </div>
          </div>
          <ApexCharts
            options={barChartOptions}
            series={[
              { name: 'Committed', data: processedData.committedData },
              { name: 'Completed', data: processedData.completedData },
              { name: 'Gap', data: processedData.gapData },
            ]}
            type="bar"
            height={200}
            className="mt-8"
          />
        </div>
        <div className="h-auto">
          <div className="flex">
            <h2 className="text-lg font-semibold">Committed & Velocity Details</h2>
            <h2 className="text-lg font-semibold text-orange-400 absolute right-0 mr-4">
              Velocity : {processedData.velocityData.at(-1)}
            </h2>
          </div>
          <div className="flex ml-auto h-auto mt-1">
            <div className="border-2 border-[#c7c2f9] w-auto rounded-2xl bg-gray-300">
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowDataLabelsSecond(true)}
                  className={`py-1 px-3 rounded-xl text-xs ${
                    showDataLabelsSecond ? 'bg-primary-500 text-white' : 'bg-gray-300 text-black'
                  }`}
                  title="Show Data Labels"
                >
                  Show Labels
                </button>
                <button
                  onClick={() => setShowDataLabelsSecond(false)}
                  className={`py-1 px-3 rounded-xl text-xs ${
                    !showDataLabelsSecond ? 'bg-primary-500 text-white' : 'bg-gray-300 text-black'
                  }`}
                  title="Hide Data Labels"
                >
                  Hide Labels
                </button>
              </div>
            </div>
          </div>
          <ApexCharts
            options={mixedChartOptions}
            series={[
              {
                name: 'Initially Committed',
                type: 'bar',
                data: processedData.initiallyCommittedData,
              },
              { name: 'Finally Committed', type: 'bar', data: processedData.finallyCommittedData },
              { name: 'Done', type: 'bar', data: processedData.doneData },
              { name: 'Velocity', type: 'line', data: processedData.velocityData },
            ]}
            type="line"
            height={200}
            className="mt-8"
          />
        </div>
      </div>
    </div>
  );
};

BasicBars.propTypes = {
  toggleValue: PropTypes.string.isRequired,
};

export default BasicBars;
