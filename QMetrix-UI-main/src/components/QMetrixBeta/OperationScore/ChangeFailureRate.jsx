import { useState, useEffect , useMemo} from 'react';
import { useSelector } from 'react-redux';
import CustomLineBarChart from '../../../../utils/CustomLineBarChart';
import { BarChartIcon, LineChartIcon } from '../../../../utils/commonIcons';
import NoDataPlaceholder from '../../../Common/NoDataPlaceholder';
import PropTypes from 'prop-types';
import { APP_STRINGS } from '../../../../constants';

export const ChangeFailureRate = ({ onAverageChange }) => {
  const [chartType, setChartType] = useState("bar");
  const [getDoraData, setGetDoraData] = useState([]);
  const theme = useSelector((state) => state.theme.theme);
  const gitData = useSelector((state) => state.git || {});
  const jiraData = useSelector((state) => state.jira || {});
  
  const defectDensityValue = jiraData?.selectedValue || '';

  useEffect(() => {
    if (gitData) {
      setGetDoraData(gitData.getDoraData || []);
    }
  }, [gitData]);

  const chartData = (getDoraData.cFTrend || []).map((item) => ({
    day: item.name || 'Unknown',
    changefailure: Number(item.changeFailureRate) || 0,
    changefailureColor: "#84A9FF" 
  }));

    const averageChangeFailureRate = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData.reduce((sum, item) => sum + item.changefailure, 0) / chartData.length;
  }, [chartData]);

  useEffect(() => {
    if (onAverageChange) {
      onAverageChange(averageChangeFailureRate);
    }
  }, [averageChangeFailureRate, onAverageChange]);
  return (
    <div>
  

      {(defectDensityValue === APP_STRINGS.VALUE_SPRINT ||
        defectDensityValue === APP_STRINGS.VALUE_RELEASE) &&
        chartData.length > 0 && (
        <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
                {`Change Failure Rate by ${defectDensityValue}s`}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative group">
                <LineChartIcon
                  className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                    chartType === "line"
                      ? (theme === 'light' ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                      : (theme === 'light' ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                  }`}
                  onClick={() => setChartType("line")}
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
          <div className="w-full" style={{ height: "320px" }}>
            <CustomLineBarChart 
              data={chartData} 
              showLine={chartType === "line"} 
              showBar={chartType === "bar"} 
              type={'changefailure'}
            />
          </div>
        </div>
      )}

      {(defectDensityValue === APP_STRINGS.VALUE_SPRINT ||
        defectDensityValue === APP_STRINGS.VALUE_RELEASE) &&
        chartData.length === 0 && (
        <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] shadow-lg">
          <NoDataPlaceholder height={220} />
        </div>
      )}
    </div>
  );
};

ChangeFailureRate.propTypes = {
  onAverageChange: PropTypes.func,
};
