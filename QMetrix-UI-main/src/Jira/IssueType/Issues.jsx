import { useState } from 'react';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale } from 'chart.js';
import PropTypes from 'prop-types';
import TooltipIcon from "../../../utils/TooltipIcon";
import { useSelector } from 'react-redux';
import getTooltipContent from '../../../utils/Tooltip';
import ReactDOMServer from "react-dom/server";
import { APP_STRINGS } from '../../../constants';

ChartJS.register(BarElement, CategoryScale, LinearScale);

const MetricsDashboard = ({ getStatusCount, selectedValue }) => {
  const [activeTab, setActiveTab] = useState('Epics');
  const theme = useSelector((state) => state.theme.theme);

  const getFilteredIssueType = () => {
    if (activeTab === 'Stories') {
      return getStatusCount.filter((item) => item.name === 'Story');
    } else if (activeTab === 'Tasks') {
      return getStatusCount.filter((item) => item.name === 'Task');
    } else if (activeTab === 'Bugs') {
      return getStatusCount.filter((item) => item.name === 'Bug');
    } else if (activeTab === 'Epics') {
      return getStatusCount.filter((item) => item.name === 'Epic');
    } else if (activeTab === 'Sub-task') {
      return getStatusCount.filter((item) => item.name === 'Sub-task');
    } else if (activeTab === 'Others') {
      return getStatusCount.filter((item) => item.name === 'Others');
    }
    return [];
  };
  const filteredIssueTypeData = getFilteredIssueType();
  const filteredData =
    filteredIssueTypeData.length > 0 ? filteredIssueTypeData : [{ open: 0, close: 0 }];

    const getTooltipPlacement = (index) => {
      if ((index % 3) === 0) return "bottom-end";
      if ((index % 3) === 1) return "bottom-start";
      return "bottom";
    };


  return (
    <div className="p-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black rounded">
      <p className="text-gray-400 mb-4">
        {selectedValue === APP_STRINGS.VALUE_RELEASE
          ? APP_STRINGS.VALUE_RELEASE
          : APP_STRINGS.VALUE_SPRINT}{' '}
        Wise Overview
      </p>
      <div className="flex space-x-4 mb-4">
        {['Epics', 'Bugs', 'Stories', 'Tasks', 'Sub-task', 'Others'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded transition ${
              activeTab === tab
                ? 'bg-primary-500 text-white'
                : 'dark:bg-gray-800 bg-neutral-200 dark:text-container text-black dark:hover:bg-grey-700 hover:bg-neutral-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {filteredData.map((count, index) => (
        <>
          <div className="grid grid-cols-3 gap-2 mt-8" key={index}>
            <div className="p-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black rounded-lg shadow-lg border border-gray-300 dark:border-[#25384F]">
              <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Total {activeTab}</h3>
              <TooltipIcon title={`Total ${activeTab}`} tooltip={ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Total ${activeTab}`, [], 'Issue Type' ))} theme={theme} placement={getTooltipPlacement(index + 1)} />
              </div>
              <p className="text-3xl font-bold mt-2">{(count?.open || 0) + (count?.close || 0)}</p>
            </div>
            <div className="p-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black rounded-lg shadow-lg border border-gray-300 dark:border-[#25384F]">
              <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Open {activeTab}</h3>
              <TooltipIcon title={`Total ${activeTab}`} tooltip={ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Open ${activeTab}`, [], 'Issue Type' ))} theme={theme} placement={getTooltipPlacement(index + 1)} />
              </div>
              <p className="text-3xl font-bold mt-2">{count?.open || '0'}</p>
            </div>
            <div className="p-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black rounded-lg shadow-lg border border-gray-300 dark:border-[#25384F]">
              <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Closed {activeTab}</h3>
              <TooltipIcon title={`Total ${activeTab}`} tooltip={ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Closed ${activeTab}`, [], 'Issue Type' ))} theme={theme} placement={getTooltipPlacement(index + 1)} />
              </div>
              <p className="text-3xl font-bold mt-2">{count?.close || '0'}</p>
            </div>
          </div>
        </>
      ))}
    </div>
  );
};

export default MetricsDashboard;

MetricsDashboard.propTypes = {
  getStatusCount: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedValue: PropTypes.object.isRequired,
};
