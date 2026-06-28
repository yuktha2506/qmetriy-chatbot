import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Calendar, Zap, CircleCheckBig, CircleX, ChevronDown, ChevronUp, Users, Clock, TrendingUp } from 'lucide-react';
import CustomDonutChart from '../../utils/CustomDonutChart';
// import CompletionDonutChart from '../../utils/CompletionDonutChart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from 'recharts';
import PropTypes from 'prop-types';

const ISSUE_TYPE_COLOR_MAP = {
  Story: '#16A34A',
  Bug: '#0072BB',
  Task: '#0A8DD7',
  Epic: '#F59E0B',
  Subtask: '#EF4444',
  Spike: '#A855F7',
  'Tech Debt': '#EC4899',
  Improvement: '#14B8A6',
  Documentation: '#F97316',
  Testing: '#06B6D4',
};

const FALLBACK_COLORS = [
  '#22C55E', '#0072BB', '#38BDF8', '#F59E0B', '#EF4444',
  '#A855F7', '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
];

const getIssueTypeColor = (issueType, index = 0) =>
  ISSUE_TYPE_COLOR_MAP[issueType] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

const BUDGET_STATUS_CONFIG_DARK = {
  'under budget': { label: 'STATUS: UNDER BUDGET', color: '#26E4D1', bg: '#26E4D11A' },
  'on budget': { label: 'STATUS: ON BUDGET', color: '#D68F56', bg: '#D68F561A' },
  'over budget': { label: 'STATUS: OVER BUDGET', color: '#BD112E', bg: '#BD112E1A' },
};

const BUDGET_STATUS_CONFIG_LIGHT = {
  'under budget': { label: 'STATUS: UNDER BUDGET', color: '#0ABDAB', bg: '#26E4D11A' },
  'on budget': { label: 'STATUS: ON BUDGET', color: '#DC7521', bg: '#D68F561F' },
  'over budget': { label: 'STATUS: OVER BUDGET', color: '#E12E4D', bg: '#FDE9EC' },
};

const getBudgetStatusConfig = (theme, status) =>
  (theme === 'light' ? BUDGET_STATUS_CONFIG_LIGHT : BUDGET_STATUS_CONFIG_DARK)[status] ||
  (theme === 'light' ? BUDGET_STATUS_CONFIG_LIGHT : BUDGET_STATUS_CONFIG_DARK)['on budget'];

const formatCurrency = (value) => {
  if (value == null || value === 0) return '$0';
  return `$${Number(value).toLocaleString()}`;
};

const formatCompactCurrency = (value) => {
  const abs = Math.abs(value);
  if (abs >= 1000) return `$${Math.round(abs / 1000)}K`;
  return `$${abs}`;
};

const formatNumber = (value) => {
  if (value == null) return '0';
  return Number(value).toLocaleString();
};

const shortenSprintLabel = (label) => {
  const raw = String(label || '').replace(/\s*\(active\)\s*$/i, '').trim();
  if (!raw) return '';
  if (raw.length <= 18) return raw;
  const words = raw.split(/\s+/);
  return words.length >= 2 ? words[words.length - 1] : raw;
};

function DeliveryCard({ card, theme }) {
  const IconComponent = card.icon;
  const isLight = theme === 'light';
  return (
    <div
      className={`flex-1 rounded-[10px] p-4 min-w-0 ${isLight ? '' : 'bg-[#151F2C]'}`}
      style={isLight ? { backgroundColor: 'var(--N-LM-GR01, #F8FAFC)', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #364153' }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-[14px] ${isLight ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`} style={{ fontFamily: 'Inter' }}>{card.label}</span>
        <div
          className="flex h-7 w-7 items-center justify-center"
          style={{ backgroundColor: card.iconBg, borderRadius: '10px' }}
        >
          <IconComponent className="h-4 w-4" style={{ color: card.iconColor }} />
        </div>
      </div>
      <div className={`text-[30px] font-bold ${isLight ? 'text-[#1A3A54]' : 'text-white'}`}>{card.value}</div>
      <div className={`mt-1 text-[12px] ${isLight ? 'text-[#5580A6]' : 'text-[#6A7282]'}`}>{card.subtitle}</div>
    </div>
  );
}

DeliveryCard.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']),
  card: PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    subtitle: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    iconColor: PropTypes.string.isRequired,
    iconBg: PropTypes.string.isRequired,
    iconBorder: PropTypes.string.isRequired,
  }).isRequired,
};

function CumulativeBarTooltip({ active, payload, hoveredType }) {
  if (active && payload && payload.length) {
    const entry = hoveredType
      ? payload.find((e) => e.name === hoveredType)
      : payload.find((e) => e.value > 0);
    if (!entry) return null;
    return (
      <div className="rounded-md border border-[#224F78] bg-[#173A5A] px-3 py-2 text-xs text-white shadow-lg">
        <p className="m-0 flex items-center gap-1.5 font-semibold">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.fill }}
          />
          {entry.name}: {entry.value}
        </p>
      </div>
    );
  }
  return null;
}

CumulativeBarTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  hoveredType: PropTypes.string,
};

function SprintBreakdownTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + entry.value, 0);
    return (
      <div className="rounded-md border border-[#224F78] bg-[#173A5A] px-3 py-2 text-xs text-white shadow-lg">
        <p className="m-0 mb-1 font-semibold">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="m-0 flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.fill }}
            />
            {entry.name}: {entry.value}
          </p>
        ))}
        <p className="m-0 mt-1 border-t border-[#2A5A7A] pt-1 font-semibold">Total: {total}</p>
      </div>
    );
  }
  return null;
}

SprintBreakdownTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
};

function BudgetBarTooltip({ active, payload, hoveredSegment }) {
  if (!active || !payload || !payload.length || !hoveredSegment) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  let content = null;
  if (hoveredSegment === 'SpendInBudget') {
    content = (
      <p className="m-0 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
        Spend: {formatCurrency(data.totalSpend)}
      </p>
    );
  } else if (hoveredSegment === 'Remaining') {
    content = (
      <p className="m-0 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#25384F' }} />
        Remaining: {formatCurrency(data.Remaining)}
      </p>
    );
  } else if (hoveredSegment === 'Overspend') {
    content = (
      <p className="m-0 font-semibold" style={{ color: '#FF6467' }}>
        Over Budget: +{formatCurrency(data.Overspend)}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-[#224F78] bg-[#173A5A] px-3 py-2 text-xs text-white shadow-lg">
      {content}
    </div>
  );
}

BudgetBarTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  hoveredSegment: PropTypes.string,
};

function OverspendBarShape(props) {
  const { x, y, width, height, fill } = props;
  if (!width || width <= 0) return null;
  const sw = 1.5;
  const overlap = height / 2;
  const strokeColor = props.payload?.color || '#16A34A';
  return (
    <rect
      x={x - overlap + sw / 2}
      y={y + sw / 2}
      width={width + overlap - sw}
      height={height - sw}
      fill={fill}
      rx={(height - sw) / 2}
      ry={(height - sw) / 2}
      stroke={strokeColor}
      strokeWidth={sw}
    />
  );
}

OverspendBarShape.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  fill: PropTypes.string,
  payload: PropTypes.shape({
    color: PropTypes.string,
  }),
};

const InvestmentProfile = ({ isHoursBasedProject = false }) => {
  const [isSprintBreakdownExpanded, setIsSprintBreakdownExpanded] = useState(false);
  const [hoveredBarType, setHoveredBarType] = useState(null);
  const [hoveredBudgetSegment, setHoveredBudgetSegment] = useState(null);

  const releaseDashboardData = useSelector((state) => state.releaseDashboard?.data);
  const theme = useSelector((state) => state.theme?.theme);
  const investmentProfile = releaseDashboardData?.investmentProfile;
  const budgetCostAnalysis = releaseDashboardData?.budgetCostAnalysis;

  const issueTypeBreakdown = useMemo(() => investmentProfile?.issueTypeBreakdown || [], [investmentProfile]);
  const sprintBreakdown = useMemo(() => investmentProfile?.sprintBreakdown || [], [investmentProfile]);

  const allIssueTypes = useMemo(() => {
    const types = new Set();
    issueTypeBreakdown.forEach((item) => types.add(item.issueType));
    sprintBreakdown.forEach((sprint) =>
      (sprint.issueTypeBreakdown || []).forEach((item) => types.add(item.issueType)),
    );
    const preferredOrder = ['Story', 'Bug', 'Task'];
    return [...types].sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [issueTypeBreakdown, sprintBreakdown]);

  const issueTypeColorMap = useMemo(() => {
    const map = {};
    allIssueTypes.forEach((type, idx) => {
      map[type] = getIssueTypeColor(type, idx);
    });
    return map;
  }, [allIssueTypes]);

  const deliveryCards = useMemo(() => {
    if (!investmentProfile) return [];
    return [
      { label: 'Planned', value: investmentProfile.plannedTickets ?? 0, subtitle: 'Tickets', icon: Calendar, iconColor: '#51A2FF', iconBg: '#2B7FFF33', iconBorder: '#51A2FF' },
      { label: 'Unplanned', value: investmentProfile.unplannedTickets ?? 0, subtitle: 'Tickets', icon: Zap, iconColor: '#FDC700', iconBg: '#F0B10033', iconBorder: '#FDC700' },
      { label: 'Completed', value: investmentProfile.completedTickets ?? 0, subtitle: 'Tickets', icon: CircleCheckBig, iconColor: '#05DF72', iconBg: '#00C95033', iconBorder: '#05DF72' },
      { label: 'Spill Over', value: investmentProfile.spilloverTickets ?? 0, subtitle: 'Tickets', icon: CircleX, iconColor: '#FF6467', iconBg: '#FB2C3633', iconBorder: '#FF6467' },
    ];
  }, [investmentProfile]);

  const sortedIssueTypeBreakdown = useMemo(() => {
    const preferredOrder = ['Story', 'Bug', 'Task'];
    return [...issueTypeBreakdown].sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.issueType);
      const idxB = preferredOrder.indexOf(b.issueType);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [issueTypeBreakdown]);

  const workTypeData = useMemo(() =>
    sortedIssueTypeBreakdown.map((item) => ({
      type: item.issueType,
      completed: `${item.completedTicketCount ?? 0}/${item.committedTicketCount ?? 0}`,
      effort: isHoursBasedProject
        ? `${formatNumber(item.completedHours)}h`
        : formatNumber(item.completedPoints),
      spentDollars: formatCurrency(item.totalCompletedCost),
      completedPct: `${item.completionPercentage ?? 0}%`,
      color: issueTypeColorMap[item.issueType] || '#38BDF8',
    })),
  [sortedIssueTypeBreakdown, issueTypeColorMap, isHoursBasedProject]);

  const donutData = useMemo(() =>
    sortedIssueTypeBreakdown.map((item) => ({
      label: item.issueType,
      value: item.totalCompletedCost ?? 0,
      color: issueTypeColorMap[item.issueType] || '#38BDF8',
    })),
  [sortedIssueTypeBreakdown, issueTypeColorMap]);

  // const completionDonutData = useMemo(() =>
  //   issueTypeBreakdown.map((item) => ({
  //     label: item.issueType,
  //     completed: item.completedTicketCount ?? 0,
  //     committed: item.committedTicketCount ?? 0,
  //     color: issueTypeColorMap[item.issueType] || '#38BDF8',
  //   })),
  // [issueTypeBreakdown, issueTypeColorMap]);

  const cumulativeBarData = useMemo(() => {
    const row = { name: 'Effort' };
    issueTypeBreakdown.forEach((item) => {
      row[item.issueType] = isHoursBasedProject ? (item.completedHours || 0) : (item.completedPoints || 0);
    });
    return [row];
  }, [issueTypeBreakdown, isHoursBasedProject]);

  const cumulativeBarTotal = useMemo(() => {
    return isHoursBasedProject
      ? (investmentProfile?.totalCompletedHours || 0)
      : (investmentProfile?.totalCompletedStoryPoints || 0);
  }, [investmentProfile, isHoursBasedProject]);

  const sprintBreakdownChartData = useMemo(() =>
    sprintBreakdown.map((sprint) => {
      const row = { sprint: sprint.sprintName };
      (sprint.issueTypeBreakdown || []).forEach((item) => {
        row[item.issueType] = isHoursBasedProject ? (item.completedHours || 0) : (item.completedPoints || 0);
      });
      return row;
    }),
  [sprintBreakdown, isHoursBasedProject]);

  const sprintYAxisMax = useMemo(() => {
    if (!sprintBreakdownChartData.length) return 100;
    const maxTotal = Math.max(
      ...sprintBreakdownChartData.map((row) =>
        allIssueTypes.reduce((sum, type) => sum + (row[type] || 0), 0),
      ),
    );
    const rounded = Math.ceil(maxTotal / 50) * 50;
    return rounded || 100;
  }, [sprintBreakdownChartData, allIssueTypes]);

  const sprintYAxisTicks = useMemo(() => {
    const step = sprintYAxisMax / 4;
    return [0, step, step * 2, step * 3, sprintYAxisMax];
  }, [sprintYAxisMax]);

  const budgetItems = useMemo(() => {
    const analysisData = budgetCostAnalysis?.analysisData || [];
    const order = { Story: 1, Bug: 2, Task: 3 };
    return analysisData
      .map((item) => ({
        label: item.issueType,
        budget: item.committedTicketCost,
        spend: item.completedTicketCost,
        color: issueTypeColorMap[item.issueType] || '#16A34A',
        variance: item.overBudget,
      }))
      .sort((a, b) => (order[a.label] ?? 99) - (order[b.label] ?? 99));
  }, [budgetCostAnalysis, issueTypeColorMap]);

  const budgetStatus = budgetCostAnalysis?.status || 'on budget';
  const budgetStatusCfg = getBudgetStatusConfig(theme, budgetStatus);
  const variancePct = useMemo(() => {
    const budget = budgetCostAnalysis?.allocatedBudget || 0;
    const variance = budgetCostAnalysis?.variance || 0;
    return budget > 0 ? Math.round((variance / budget) * 1000) / 10 : 0;
  }, [budgetCostAnalysis]);

  const varianceColor = budgetStatusCfg.color;

  if (!investmentProfile) {
    return (
      <div className="flex items-center justify-center h-48 text-[#99A1AF]">
        No investment profile data available.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Delivery Section */}
      <div
        className={`rounded-[10px] p-5 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
        style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
      >
        <h3 className={`mb-3 font-medium text-[18px] ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`} style={{ fontFamily: 'Inter' }}>
          Delivery
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {deliveryCards.map((card) => (
            <DeliveryCard key={card.label} card={card} theme={theme} />
          ))}
        </div>
      </div>

      {/* Work Type Investment Section */}
      <div
        className={`rounded-[10px] p-5 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
        style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
      >
        <h3 className={`mb-4 font-medium text-[18px] ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`} style={{ fontFamily: 'Inter' }}>
          Work Type Investment
        </h3>
        <div className="flex items-center gap-6">
          {/* Spent ($) Donut Chart */}
          <div className="w-[220px] shrink-0">
            <CustomDonutChart
              data={donutData}
              innerRadius={50}
              outerRadius={80}
              height={220}
              showLegend={false}
              showTooltip={true}
              valueFormatter={formatCurrency}
            />
          </div>

          {/* Completed / Committed Chart */}
          {/* <div className="w-[200px] shrink-0"> */}
            {/* <CompletionDonutChart
              data={completionDonutData}
              size={170}
              innerRadius={50}
              outerRadius={75}
            /> */}
          {/* </div> */}

          {/* Stats Table */}
          <div className="flex-1 min-w-0">
            <div className="max-h-[200px] overflow-y-auto" style={{ fontFamily: 'Inter' }}>
              <table className="w-full text-[14px]" style={{ tableLayout: 'fixed' }}>
                <thead className={`sticky top-0 z-10 ${theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#182433]'}`}>
                  <tr className={`text-left text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>
                    <th className="pb-3 pr-4 font-medium" style={{ width: '25%' }}>Type</th>
                    <th className="pb-3 pr-4 font-medium" style={{ width: '18%' }}>Completed</th>
                    <th className="pb-3 pr-4 font-medium" style={{ width: '18%' }}>{isHoursBasedProject ? 'Spent Hrs' : 'Spent Story Points'}</th>
                    <th className="pb-3 pr-4 font-medium" style={{ width: '18%' }}>Spent ($)</th>
                    <th className="pb-3 font-medium" style={{ width: '21%' }}>Completed %</th>
                  </tr>
                </thead>
                <tbody>
                  {workTypeData.map((row) => (
                    <tr key={row.type} className={theme === 'light' ? 'border-t border-[#A6C3DC]' : 'border-t border-[#1C2E42]'}>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className={theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}>{row.type}</span>
                        </div>
                      </td>
                      <td className={`py-4 pr-4 ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>{row.completed}</td>
                      <td className={`py-4 pr-4 ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>{row.effort}</td>
                      <td className={`py-4 pr-4 ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>{row.spentDollars}</td>
                      <td className={theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}>{row.completedPct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative Sprint Effort Section */}
      <div
        className={`rounded-[10px] p-5 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
        style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`font-medium text-[18px] ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`} style={{ fontFamily: 'Inter' }}>
            Cumulative Sprint Effort
          </h3>
          <div className="flex items-center gap-6 text-[16px]" style={{ fontFamily: 'Inter' }}>
            <span className={theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}>
              {isHoursBasedProject ? 'Total Hours:' : 'Total Story Points:'}{' '}
              <span className={`text-[24px] font-bold ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {formatNumber(isHoursBasedProject ? investmentProfile.totalCompletedHours : investmentProfile.totalCompletedStoryPoints)}
              </span>
            </span>
            <span className={theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}>
              Total Cost:{' '}
              <span className={`text-[24px] font-bold ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {formatCurrency(investmentProfile.totalCompletedCost)}
              </span>
            </span>
          </div>
        </div>

        {isSprintBreakdownExpanded ? (
          <div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={sprintBreakdownChartData}
                margin={{ top: 10, right: 10, bottom: 5, left: -10 }}
                barCategoryGap="20%"
                barSize={40}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1C2E42"
                  vertical={false}
                />
                <XAxis
                  dataKey="sprint"
                  tick={{ fill: '#5A7A97', fontSize: 11 }}
                  axisLine={{ stroke: '#1C2E42' }}
                  tickLine={false}
                  tickFormatter={shortenSprintLabel}
                />
                <YAxis
                  tick={{ fill: '#5A7A97', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, sprintYAxisMax]}
                  ticks={sprintYAxisTicks}
                />
                <Tooltip
                  content={<SprintBreakdownTooltip />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                {allIssueTypes.map((type, idx) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    stackId="sprint"
                    fill={issueTypeColorMap[type]}
                    radius={idx === allIssueTypes.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-2 flex items-center justify-center gap-5 text-xs text-[#8DA4BE]">
              {allIssueTypes.map((type) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className="inline-block rounded-full"
                    style={{ backgroundColor: issueTypeColorMap[type], width: 12, height: 12, opacity: 1 }}
                  />
                  <span style={{ fontSize: 14, color: '#99A1AF' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={24}>
                <BarChart
                  data={cumulativeBarData}
                  layout="vertical"
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  barCategoryGap={0}
                  barSize={24}
                >
                  <XAxis type="number" hide domain={[0, cumulativeBarTotal]} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    content={<CumulativeBarTooltip hoveredType={hoveredBarType} />}
                    cursor={false}
                  />
                  {allIssueTypes.map((type, idx) => (
                    <Bar
                      key={type}
                      dataKey={type}
                      stackId="effort"
                      fill={issueTypeColorMap[type]}
                      onMouseEnter={() => setHoveredBarType(type)}
                      onMouseLeave={() => setHoveredBarType(null)}
                      radius={
                        allIssueTypes.length === 1
                          ? [6, 6, 6, 6]
                          : idx === 0
                            ? [6, 0, 0, 6]
                            : idx === allIssueTypes.length - 1
                              ? [0, 6, 6, 0]
                              : 0
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-5 text-xs text-[#8DA4BE]">
              {allIssueTypes.map((type) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className="inline-block rounded-full"
                    style={{ backgroundColor: issueTypeColorMap[type], width: 12, height: 12, opacity: 1 }}
                  />
                  <span style={{ fontSize: 14, color: '#99A1AF' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expand / Collapse Sprint Breakdown */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setIsSprintBreakdownExpanded((prev) => !prev)}
            className="flex items-center gap-1 hover:text-[#5B9BF6] transition-colors bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 14, color: '#51A2FF' }}
          >
            {isSprintBreakdownExpanded ? 'Collapse Sprint Breakdown' : 'Expand Sprint Breakdown'}
            {isSprintBreakdownExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`rounded-[10px] p-5 flex items-center gap-4 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
          style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2B7FFF33]">
            <Users className="h-5 w-5 text-[#51A2FF]" />
          </div>
          <div>
            <div className={`text-[14px] font-medium ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>Total Contributors</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-[30px] font-bold leading-none ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {investmentProfile.totalContributors ?? 0}
              </span>
              <span className={`text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#6A7282]'}`}>People</span>
            </div>
          </div>
        </div>
        <div
          className={`rounded-[10px] p-5 flex items-center gap-4 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
          style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#AD46FF33]">
            <Clock className="h-5 w-5 text-[#C27AFF]" />
          </div>
          <div>
            <div className={`text-[14px] font-medium ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>{isHoursBasedProject ? 'Total Hours Logged' : 'Total Story Points'}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-[30px] font-bold leading-none ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {formatNumber(isHoursBasedProject ? investmentProfile.totalCompletedHours : investmentProfile.totalCompletedStoryPoints)}
              </span>
              <span className={`text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#6A7282]'}`}>{isHoursBasedProject ? 'Hours' : 'Points'}</span>
            </div>
          </div>
        </div>
        <div
          className={`rounded-[10px] p-5 flex items-center gap-4 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
          style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C95033]">
            <TrendingUp className="h-5 w-5 text-[#05DF72]" />
          </div>
          <div>
            <div className={`text-[14px] font-medium ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>FTE Equivalent</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-[30px] font-bold leading-none ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {investmentProfile.fteEquivalent ?? 0}
              </span>
              <span className={`text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#6A7282]'}`}>FTE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget & Cost Analysis */}
      <div
        className={`rounded-[10px] p-6 ${theme === 'light' ? '' : 'bg-[#182433]'}`}
        style={theme === 'light' ? { background: 'var(--N-LM-01, #FFFFFF)', border: '0.8px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '0.8px solid #1F2F41' }}
      >
        <h2 className={`font-medium text-[18px] mb-6 ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`} style={{ fontFamily: 'Inter' }}>Budget &amp; Cost Analysis</h2>
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-8">
          {/* Left - Budget summary */}
          <div
            className={`lg:w-[350px] shrink-0 rounded-[10px] p-5 space-y-5 ${theme === 'light' ? '' : 'bg-[#151F2C]'}`}
            style={theme === 'light' ? { background: 'var(--N-LM-GR01, #F8FAFC)', border: '1px solid var(--N-LM-Strk-1, #A6C3DC)' } : { border: '1px solid #1F2F41' }}
          >
            <div>
              <div className={`text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>Allocated Budget</div>
              <div className={`text-[24px] font-bold mt-1 leading-tight ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {formatCurrency(budgetCostAnalysis?.allocatedBudget)}
              </div>
            </div>
            <div>
              <div className={`text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>Actual Spend</div>
              <div className={`text-[24px] font-bold mt-1 leading-tight ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>
                {formatCurrency(budgetCostAnalysis?.actualSpend)}
              </div>
            </div>
            <div>
              <div className={`text-[14px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>Variance</div>
              <div className="text-[24px] font-bold mt-1 leading-tight" style={{ color: varianceColor }}>
                {formatCurrency(budgetCostAnalysis?.variance)}
                {variancePct !== 0 && (
                  <span className="text-sm font-semibold ml-1">{variancePct}%</span>
                )}
              </div>
            </div>
            <div className="pt-1">
              <span
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-1.5 text-[14px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: budgetStatusCfg.bg, color: budgetStatusCfg.color }}
              >
                <CircleCheckBig className="h-4 w-4" style={{ color: budgetStatusCfg.color }} />
                {budgetStatusCfg.label}
              </span>
            </div>
          </div>

          {/* Right - Budget vs Actual by Work Type */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className={`text-[11px] uppercase tracking-wider font-semibold mb-4 ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>
              Budget vs Actual by Work Type
            </div>
            <div className="space-y-10 flex-1">
              {budgetItems.map((item) => {
                const spendInBudget = Math.min(item.spend, item.budget);
                const remaining = Math.max(item.budget - item.spend, 0);
                const overspend = Math.max(item.spend - item.budget, 0);
                const isSpendInBudgetOnly = spendInBudget > 0 && remaining === 0 && overspend === 0;
                const isRemainingOnly = spendInBudget === 0 && remaining > 0 && overspend === 0;
                return (
                  <div key={item.label} className="relative" style={{ zIndex: budgetItems.length - budgetItems.indexOf(item) }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-medium ${theme === 'light' ? 'text-[#1A3A54]' : 'text-white'}`}>{item.label}</span>
                      <span className={`text-xs ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#99A1AF]'}`}>
                        Spend: {formatCurrency(item.spend)} / Budget: {formatCurrency(item.budget)}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={24}>
                      <BarChart
                        data={[{
                          SpendInBudget: spendInBudget,
                          Remaining: remaining,
                          Overspend: overspend,
                          name: item.label,
                          totalSpend: item.spend,
                          totalBudget: item.budget,
                          color: item.color,
                        }]}
                        layout="vertical"
                        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                        barSize={20}
                      >
                        <XAxis type="number" hide domain={[0, 'dataMax']} />
                        <YAxis type="category" hide />
                        <Tooltip content={<BudgetBarTooltip hoveredSegment={hoveredBudgetSegment} />} cursor={false} offset={10} isAnimationActive={false} />
                        <Bar
                          dataKey="SpendInBudget"
                          stackId="bar"
                          fill={item.color}
                          radius={isSpendInBudgetOnly ? [10, 10, 10, 10] : [10, 0, 0, 10]}
                          onMouseEnter={() => setHoveredBudgetSegment('SpendInBudget')}
                          onMouseLeave={() => setHoveredBudgetSegment(null)}
                        />
                        <Bar
                          dataKey="Remaining"
                          stackId="bar"
                          fill={theme === 'light' ? '#D1E2F0' : '#25384F'}
                          radius={isRemainingOnly ? [10, 10, 10, 10] : [0, 10, 10, 0]}
                          onMouseEnter={() => setHoveredBudgetSegment('Remaining')}
                          onMouseLeave={() => setHoveredBudgetSegment(null)}
                        />
                        <Bar
                          dataKey="Overspend"
                          stackId="bar"
                          fill={theme === 'light' ? '#A6C3DC' : '#1E3248'}
                          shape={<OverspendBarShape />}
                          onMouseEnter={() => setHoveredBudgetSegment('Overspend')}
                          onMouseLeave={() => setHoveredBudgetSegment(null)}
                        >
                          <LabelList
                            dataKey="Overspend"
                            position="center"
                            formatter={(value) => value > 0 ? `+ ${formatCompactCurrency(value)}` : ''}
                            style={{ fill: theme === 'light' ? '#1A3A54' : '#FFFFFF', fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-5 mt-5">
              <span className="flex items-center gap-0.5">
                {allIssueTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full"
                    style={{ width: 12, height: 12, opacity: 1, backgroundColor: issueTypeColorMap[type] }}
                  />
                ))}
                <span className="ml-1" style={{ fontSize: 12, color: theme === 'light' ? '#5580A6' : '#99A1AF' }}>Actual Spend</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded-full" style={{ width: 12, height: 12, opacity: 1, backgroundColor: theme === 'light' ? '#A6C3DC' : '#435064' }} />
                <span style={{ fontSize: 12, color: theme === 'light' ? '#5580A6' : '#99A1AF' }}>Allocated Budget</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

InvestmentProfile.propTypes = {
  isHoursBasedProject: PropTypes.bool,
};

export default InvestmentProfile;
