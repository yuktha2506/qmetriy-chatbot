import PropTypes from 'prop-types';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { BarChartIcon, LineChartIcon } from '../../../../utils/commonIcons';
import DropdownButton from '../../../Common/DropDown';
import CustomLineBarChart from '../../../../utils/CustomLineBarChart';
import NoDataPlaceholder from '../../../Common/NoDataPlaceholder';
import { ManualDone, AutomationDone } from '../../ReleaseReadiness/RRLevel2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

/** Same shape as Release Readiness manual/automation stacked bars (blocked → retest). */
function productivityStackRow(testScoreObject, name) {
  const o = testScoreObject && typeof testScoreObject === 'object' ? testScoreObject : {};
  return [{
    name,
    blocked: Number(o.blocked) || 0,
    failed: Number(o.failed) || 0,
    passed: Number(o.passed) || 0,
    untested: Number(o.untested) || 0,
    retest: Number(o.retest) || 0,
  }];
}

export function DLAView() {
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const [chartType, setChartType] = useState("bar");
  const lineLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16"];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const barLabels = [
    "Sept 25",
    "Sept 26",
    "Sept 30",
    "Oct 01",
    "Oct 03",
    "Oct 07",
    "Oct 08",
    "Oct 16",
    "Oct 22",
    "Oct 24",
    "Oct 25",
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const dlaLineData = lineLabels.map((label, idx) => ({
    day: label,
    dla: lineData[idx],
    dlaColor: seriesColor,
  }));
  const dlaBarData = barLabels.map((label, idx) => ({
    day: label,
    dla: barData[idx],
    dlaColor: seriesColor,
  }));

  return (
    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
            Defect Leakage Analysis: 15 days trend              </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("line")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${useSelector((state) => state?.theme?.theme || 'light') === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Line Chart
            </div>
          </div>
          <div className="relative group">
            <BarChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "bar"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("bar")}
            />
            <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${useSelector((state) => state?.theme?.theme || 'light') === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
              Bar Chart
            </div>
          </div>
        </div>
      </div>
      <div className="w-full" style={{ height: "320px" }}>
        {(!dlaLineData || dlaLineData.length === 0 || !dlaBarData || dlaBarData.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart data={dlaLineData} showLine={true} showBar={false} type="dla" />
        ) : (
          <CustomLineBarChart data={dlaBarData} showLine={false} showBar={true} type="dla" />
        )}
      </div>
    </div>
  );
}

DLAView.propTypes = {
  defectLeakageAnalysis: PropTypes.object.isRequired,
};

export function TestAutomation() {
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const [chartType, setChartType] = useState("bar");
  const lineLabels = ['Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16'];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];
  const barLabels = [
    'Sept 25', 'Sept 26', 'Sept 30', 'Oct 01', 'Oct 03', 'Oct 07', 'Oct 08', 'Oct 16', 'Oct 22', 'Oct 24', 'Oct 25'
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedLineData = lineLabels.map((label, idx) => ({
    day: label,
    testAutomation: lineData[idx],
    testAutomationColor: seriesColor,
  }));
  const transformedBarData = barLabels.map((label, idx) => ({
    day: label,
    testAutomation: barData[idx],
    testAutomationColor: seriesColor,
  }));
  return (
    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
            Test Automation: 15 days trend
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("line")}
            />
            <div
              className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition
              ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}
            >
              Line Chart
            </div>
          </div>

          <div className="relative group">
            <BarChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "bar"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
              }`}
              onClick={() => setChartType("bar")}
            />
            <div
              className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition
              ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}
            >
              Bar Chart
            </div>
          </div>
        </div>
      </div>
      <div className="w-full" style={{ height: "320px" }}>
        {(!transformedLineData || transformedLineData.length === 0 || !transformedBarData || transformedBarData.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart
            data={transformedLineData}
            showLine={true}
            showBar={false}
            type="testAutomation"
          />
        ) : (
          <CustomLineBarChart
            data={transformedBarData}
            showLine={false}
            showBar={true}
            type="testAutomation"
          />
        )}
      </div>
    </div>
  );
}

export function AutoTestingProductivity({ testScoreObject = null }) {
  const row = productivityStackRow(testScoreObject, 'Automation Testing Productivity');
  return (
    <div className="w-full">
      <AutomationDone
        automationData={row}
        chartTitle="Automation Testing Productivity"
        widgetHeightClass="h-[262px]"
        showNoDataPlaceholder={false}
        chartAreaClass="w-full flex justify-center items-center mt-4"
      />
    </div>
  );
}

AutoTestingProductivity.propTypes = {
  testScoreObject: PropTypes.object,
};

export function TestCoverage() {
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const [chartType, setChartType] = useState("bar");
  const lineLabels = [
    "Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16",
  ];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];

  const transformedLineData = lineLabels.map((label, index) => ({
    day: label,
    testCoverage: lineData[index],
    testCoverageColor: seriesColor,
  }));

  const barLabels = [
    "Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16", "Oct 22", "Oct 24", "Oct 25",
  ];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedBarData = barLabels.map((label, index) => ({
    day: label,
    testCoverage: barData[index],
    testCoverageColor: seriesColor,
  }));

  return (

    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
            Test Coverage: 15 days trend              </h2>
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
        {(!transformedLineData || transformedLineData.length === 0 || !transformedBarData || transformedBarData.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart data={transformedLineData} showLine={true} showBar={false} type="testCoverage" />
        ) : (
          <CustomLineBarChart data={transformedBarData} showLine={false} showBar={true} type="testCoverage" />
        )}
      </div>
    </div>
  );
}

export function TestingProductivity({ testScoreObject = null }) {
  const row = productivityStackRow(testScoreObject, 'Testing Productivity');
  return (
    <div className="w-full">
      <ManualDone
        manualData={row}
        chartTitle="Testing Productivity"
        widgetHeightClass="h-[262px]"
        showNoDataPlaceholder={false}
        chartAreaClass="w-full flex justify-center items-center mt-4"
      />
    </div>
  );
}

TestingProductivity.propTypes = {
  testScoreObject: PropTypes.object,
};

export function TestingQuality() {
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const [chartType, setChartType] = useState("bar");
  const lineLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16"];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];
  const barLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16", "Oct 22", "Oct 24", "Oct 25"];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedLineData = lineLabels.map((label, idx) => ({
    day: label,
    testingQuality: lineData[idx],
    testingQualityColor: seriesColor,
  }));
  const transformedBarData = barLabels.map((label, idx) => ({
    day: label,
    testingQuality: barData[idx],
    testingQualityColor: seriesColor,
  }));

  return (
    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
            Testing Quality: 15 days trend                  </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
        {(!transformedLineData || transformedLineData.length === 0 || !transformedBarData || transformedBarData.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart
            data={transformedLineData}
            showLine={true}
            showBar={false}
            type="testingQuality"
          />
        ) : (
          <CustomLineBarChart
            data={transformedBarData}
            showLine={false}
            showBar={true}
            type="testingQuality"
          />
        )}
      </div>
    </div>
  );
}

TestingQuality.propTypes = {
  testingQuality: PropTypes.object.isRequired,
};

export function Traceability() {
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const [chartType, setChartType] = useState("bar");
  const lineLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16"];
  const lineData = [0, 1, 0, 0, 0, 0, 0, 0];
  const barLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16", "Oct 22", "Oct 24", "Oct 25"];
  const barData = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];

  const transformedLineData = lineLabels.map((label, idx) => ({
    day: label,
    traceability: lineData[idx],
    traceabilityColor: seriesColor,
  }));
  const transformedBarData = barLabels.map((label, idx) => ({
    day: label,
    traceability: barData[idx],
    traceabilityColor: seriesColor,
  }));

  return (
    <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 w-full h-[262px] dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
            Traceability: 15 days trend                  </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <LineChartIcon
              className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                chartType === "line"
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
                  ? 'text-white bg-[#24527A] border-[2px] border-[#24527A] dark:bg-[#066FD1] dark:border-[#066FD1]'
                  : 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA] dark:text-[#6C7A91] dark:border-[#6C7A91B2] dark:hover:bg-[#374B5D] dark:hover:border-[#6C7A91B2]'
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
        {(!transformedLineData || transformedLineData.length === 0 || !transformedBarData || transformedBarData.length === 0) ? (
          <NoDataPlaceholder height={220} />
        ) : chartType === "line" ? (
          <CustomLineBarChart
            data={transformedLineData}
            showLine={true}
            showBar={false}
            type="traceability"
          />
        ) : (
          <CustomLineBarChart
            data={transformedBarData}
            showLine={false}
            showBar={true}
            type="traceability"
          />
        )}
      </div>
    </div>
  );
}

export function TestCycleTime() {
  const [chartType, setChartType] = useState("bar");
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const seriesColor = theme === 'light' ? '#5580A6' : '#84A9FF';
  const [trendMode, setTrendMode] = useState('15');
  const trendOptions = [
    { value: '15', label: '15 Days Trend' },
    { value: '30', label: '30 Days Trend' },
    { value: '90', label: '90 Days Trend' },
  ];
  const lineLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16"];
  const lineData = [40, 40, 27, 27, 40, 40, 27, 27];
  const barLabels = ["Sept 25", "Sept 26", "Sept 30", "Oct 01", "Oct 03", "Oct 07", "Oct 08", "Oct 16", "Oct 22", "Oct 24", "Oct 25"];
  const barData = [40, 40, 27, 27, 40, 40, 27, 27, 40, 27, 40];

  const transformedLineData = lineLabels.map((label, idx) => ({
    day: label,
    testCycleTime: lineData[idx],
    testCycleTimeColor: seriesColor,
  }));
  const transformedBarData = barLabels.map((label, idx) => ({
    day: label,
    testCycleTime: barData[idx],
    testCycleTimeColor: seriesColor,
  }));

  return (
    <div className="flex flex-wrap gap-4">
      <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-lg flex-1 min-w-[250px] h-[262px]">
        <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mb-4">By Test Type</h2>

        <div className="space-y-4">
          <div className="flex items-center">
            <span className="w-20 text-[#24527A] dark:text-gray-400 text-sm flex-shrink-0">Functional</span>
            <div className="flex-1 relative h-3.5 rounded-full overflow-hidden bg-[#DBE1EA] dark:bg-gray-700 mx-3">
              <div
                className="absolute inset-y-0 left-0 bg-[#5580A6] dark:bg-[#84A9FF] rounded-full"
                style={{ width: `${(45 / 100) * 100}%` }}
              ></div>
            </div>
            <span className="text-[#0072BB] dark:text-gray-200 text-sm w-6 text-right flex-shrink-0">45</span>
          </div>

          <div className="flex items-center">
            <span className="w-20 text-[#24527A] dark:text-gray-400 text-sm flex-shrink-0">Regression</span>
            <div className="flex-1 relative h-3.5 rounded-full overflow-hidden bg-[#DBE1EA] dark:bg-gray-700 mx-3">
              <div
                className="absolute inset-y-0 left-0 bg-[#5580A6] dark:bg-[#84A9FF] rounded-full"
                style={{ width: `${(80 / 100) * 100}%` }}
              ></div>
            </div>
            <span className="text-[#0072BB] dark:text-gray-200 text-sm w-6 text-right flex-shrink-0">80</span>
          </div>

          <div className="flex items-center">
            <span className="w-20 text-[#24527A] dark:text-gray-400 text-sm flex-shrink-0">Performance</span>
            <div className="flex-1 relative h-3.5 rounded-full overflow-hidden bg-[#DBE1EA] dark:bg-gray-700 mx-3">
              <div
                className="absolute inset-y-0 left-0 bg-[#5580A6] dark:bg-[#84A9FF] rounded-full"
                style={{ width: `${(25 / 100) * 100}%` }}
              ></div>
            </div>
            <span className="text-[#0072BB] dark:text-gray-200 text-sm w-6 text-right flex-shrink-0">25</span>
          </div>

          <div className="flex items-center">
            <span className="w-20 text-[#24527A] dark:text-gray-400 text-sm flex-shrink-0">Security</span>
            <div className="flex-1 relative h-3.5 rounded-full overflow-hidden bg-[#DBE1EA] dark:bg-gray-700 mx-3">
              <div
                className="absolute inset-y-0 left-0 bg-[#5580A6] dark:bg-[#84A9FF] rounded-full"
                style={{ width: `${(75 / 100) * 100}%` }}
              ></div>
            </div>
            <span className="text-[#0072BB] dark:text-gray-200 text-sm w-6 text-right flex-shrink-0">75</span>
          </div>

          <div className="flex items-center mt-6">
            <div className="w-20 flex-shrink-0"></div>
            <div className="flex-1 relative mx-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400 text-xs">0</span>
                <span className="text-gray-600 dark:text-gray-400 text-xs">25</span>
                <span className="text-gray-600 dark:text-gray-400 text-xs">50</span>
                <span className="text-gray-600 dark:text-gray-400 text-xs">75</span>
                <span className="text-gray-600 dark:text-gray-400 text-xs">100</span>
              </div>
            </div>

            <div className="w-6 flex-shrink-0"></div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-lg flex-1 min-w-[350px] h-[262px]">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb]">Test Cycle Time</h2>

          <div className="flex items-center space-x-2">
            <DropdownButton
              buttonLabel={trendOptions.find(o => o.value === trendMode)?.label}
              options={trendOptions}
              selectedOption={trendOptions.find(o => o.value === trendMode)?.label}
              placeholder="15 Days Trend"
              onSelect={(option) => setTrendMode(option.value)}
              width='xs'
            />
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
        <div className="w-full" style={{ height: "200px" }}>
          {(!transformedLineData || transformedLineData.length === 0 || !transformedBarData || transformedBarData.length === 0) ? (
            <NoDataPlaceholder height={180} />
          ) : chartType === "line" ? (
            <CustomLineBarChart
              data={transformedLineData}
              showLine={true}
              showBar={false}
              type="testCycleTime"
            />
          ) : (
            <CustomLineBarChart
              data={transformedBarData}
              showLine={false}
              showBar={true}
              type="testCycleTime"
            />
          )}
        </div>
      </div>

    </div>

  );
}
