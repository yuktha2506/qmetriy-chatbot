import { useState } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import DonutChart from '../../Common/DonutChart';
import { LineChartIcon, BarChartIcon, DonutChartIcon } from '../../../utils/commonIcons';
import DropdownButton from '../../Common/DropDown';

function Burndown({ layout, itemDetails, itemIndex = 0 }) {
  const theme = useSelector((state) => state.theme.theme);
  const [selectedBurndown, setSelectedBurndown] = useState({
    label: 'Sprint Burndown',
    value: 'sprint_burndown',
  });
  const [selectedChartType, setSelectedChartType] = useState('bar');
  
  const handleBurndownSelect = (option) => {
    setSelectedBurndown(option);
  };

  const burndownOptions = [
    { label: 'Sprint Burndown', value: 'sprint_burndown' },
    { label: 'Project Burndown', value: 'project_burndown' },
    { label: 'Epic Burndown', value: 'epic_burndown' },
    { label: 'Project Burnup', value: 'project_burnup' },
  ];

  const getHardcodedChartData = () => {
    const sprints = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6'];
    const dsShades = theme === 'light' 
      ? ['#5580A6', '#6A8FB0', '#7FA0BA', '#94B0C4', '#A9C1CE', '#BED1D8']
      : ['#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF', '#6699FF'];
    const staticValues = [25, 25, 25, 25, 25, 25];
    
    return sprints.map((sprint, index) => ({
      name: sprint,
      value: staticValues[index],
      color: dsShades[index % dsShades.length],
    }));
  };

  const getPieChartData = () => {
    const data = getHardcodedChartData();
    return data.filter(item => item.value > 0);
  };

  const burndownDatas = [
    {
      title: 'Average Sprint Burndown',
      key: '',
      value: 0,
    },
  ];

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

          <div className="flex flex-col border-t border-[#D1E2F0] dark:border-[#25384F] pt-2 mt-2">
            <div className="flex flex-col justify-between py-1">
              {burndownDatas.map(({ title, value, key }) => (
                <div className="flex justify-between gap-2 items-center mb-1" key={key}>
                  <div className="flex gap-1">
                    <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>{title}</span>
                  </div>
                  <span className={`text-sm text-left min-w-[60px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-between border-t border-[#D1E2F0] dark:border-[#25384F] pt-3 mt-2">
              <span className={`${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'} text-sm`}>Project Burn Up</span>
              <div className="flex justify-between mt-2">
                <div className="flex gap-1">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>Average TODO</span>
                </div>
                <span className={`text-sm text-left min-w-[60px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>{0} </span>
              </div>
              <div className="flex justify-between mt-2">
                <div className="flex gap-1">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>Average Score</span>
                </div>
                <span className={`text-sm text-left min-w-[60px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>{0} </span>
              </div>
              <div className="flex justify-between mt-2">
                <div className="flex gap-1">
                  <span className={`text-sm ${theme === 'light' ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>Average Done</span>
                </div>
                <span className={`text-sm text-left min-w-[60px] ${theme === 'light' ? 'text-[#0072BB] font-semibold' : 'dark:text-gray-300'}`}>{0} </span>
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
                  borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, itemDetails.value || 0)}`,
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                        {itemDetails.name}
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-burndown-${itemIndex}`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon className={`h-5 w-5 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-500'}`} />
                      </span>
                      <ReactTooltip
                        id={`tooltip-burndown-${itemIndex}`}
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
                  <div className="border-t border-[#D1E2F0] dark:border-[#25384F] pt-2 mt-2"></div>
                </div>
              </div>
            </div>
            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                      {selectedBurndown.label}
                    </h2>
                    <div className="flex items-center gap-2">
                      <DropdownButton
                        buttonLabel={selectedBurndown?.label || 'Select Burndown'}
                        options={burndownOptions}
                        onSelect={handleBurndownSelect}
                        selectedOption={selectedBurndown?.label}
                        value={selectedBurndown}
                        placeholder="Select Burndown"
                        type="burndown"
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

                  <div className="flex-1 overflow-hidden">
                    <div className="h-full">
                      {selectedChartType === 'pie' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <DonutChart
                            labels={getPieChartData().map((item) => item.name)}
                            dataPoints={getPieChartData().map((item) => item.value)}
                            backgroundColors={getPieChartData().map((item) => item.color)}
                            height="250px"
                            width="250px"
                          />
                        </div>
                      ) : (
                        <CustomLineBarChart
                          data={getHardcodedChartData().map((d) => ({ ...d, color: theme === 'light' ? '#5580A6' : '#6699FF' }))}
                          showLine={selectedChartType === 'line'}
                          showBar={selectedChartType === 'bar'}
                          type={'burndownDistribution'}
                        />
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

Burndown.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
  itemIndex: PropTypes.number.isRequired,
};

export default Burndown;
