import { memo } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';
import TooltipIcon from '../../utils/TooltipIcon';

function StandUpCapacitySection({
  theme,
  selectedDeveloper,
  handleViewCapacityDetails,
  capacityGaugeGeom,
  capacityGaugeUtilization,
  availableCapacity,
  pointsSourceType,
  isHoursBasedProject,
  allocatedCapacity,
  isRemainingNegative,
  capacityBarSegments,
  overloadCount,
  underloadCount,
  remainingCapacity,
}) {
  return (
    <div
      className={`pt-[8px] px-6 pb-2.5 basis-[280px] flex-grow rounded-[10px] shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md border flex flex-col min-w-[320px] min-h-[260px] ${
        theme === 'light'
          ? 'bg-[#FFFFFF] border-[#D1E2F0] text-[#24527A]'
          : 'bg-[#182433] border-[#25384F] text-[#C8C8C8]'
      }`}
    >
      <div className="flex shrink-0 justify-between w-full items-center mb-2">
        <div className="flex items-center gap-1">
          <h3 className="text-dark text-lg text-[#0A2342] dark:text-white mb-0">Capacity</h3>
          <div className="relative group">
            <TooltipIcon
              title="StandupCapacity"
              tooltip="Team available capacity vs. allocated work for the selected SPRINT / RELEASE"
              theme={theme}
              placement="top-start"
            />
          </div>
        </div>
        {!selectedDeveloper && (
          <button
            type="button"
            className={`dark:bg-[#066FD1] bg-[#24527A] text-white px-3 py-1 text-sm rounded-full transition-all duration-300 ease-in-out transform ${
              selectedDeveloper
                ? 'opacity-0 scale-50 pointer-events-none'
                : 'opacity-100 scale-100'
            }`}
            onClick={handleViewCapacityDetails}
          >
            Details
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-row items-stretch gap-4 mb-3">
        <div className="flex flex-col items-center justify-center shrink-0 w-[80px]">
          <div className="relative w-[74px] h-[74px] flex items-center justify-center">
            <svg
              viewBox="0 0 104 104"
              className="absolute inset-0 w-full h-full -rotate-90"
              aria-hidden
            >
              <circle
                cx="52"
                cy="52"
                r={capacityGaugeGeom.r}
                fill="none"
                stroke={theme === 'light' ? '#E5E7EB' : '#334155'}
                strokeWidth="9"
              />
              {capacityGaugeGeom.isOverloaded ? (
                <circle
                  cx="52"
                  cy="52"
                  r={capacityGaugeGeom.r}
                  fill="none"
                  stroke="#14A64A"
                  strokeWidth="9"
                />
              ) : Number(capacityGaugeUtilization) > 0 && capacityGaugeGeom.greenLen > 0 ? (
                <circle
                  cx="52"
                  cy="52"
                  r={capacityGaugeGeom.r}
                  fill="none"
                  stroke="#14A64A"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${capacityGaugeGeom.greenLen} ${capacityGaugeGeom.circumference}`}
                />
              ) : null}
            </svg>
            {capacityGaugeGeom.isOverloaded && capacityGaugeGeom.gradientRing && (() => {
              const g = capacityGaugeGeom.gradientRing;
              const c = capacityGaugeGeom.circumference;
              const endArcLen = ((g.totalDeg % 360) / 360) * c;
              return (
                <>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(from ${g.transStartDeg}deg, #14A64A 0deg, #6D6932 ${g.midOffset}deg, #F40000 ${g.spanDeg}deg, transparent ${g.spanDeg}deg, transparent 360deg)`,
                      WebkitMask: `radial-gradient(circle closest-side at center, transparent ${g.maskInner}%, black ${g.maskInnerSoft}%, black ${g.maskOuterSoft}%, transparent ${g.maskOuter}%)`,
                      mask: `radial-gradient(circle closest-side at center, transparent ${g.maskInner}%, black ${g.maskInnerSoft}%, black ${g.maskOuterSoft}%, transparent ${g.maskOuter}%)`,
                    }}
                  />
                  <svg
                    viewBox="0 0 104 104"
                    className="absolute inset-0 w-full h-full -rotate-90"
                    style={{ zIndex: 2 }}
                  >
                    <circle
                      cx="52"
                      cy="52"
                      r={capacityGaugeGeom.r}
                      fill="none"
                      stroke="#F40000"
                      strokeWidth="8.5"
                      strokeLinecap="round"
                      strokeDasharray={`0.1 ${c}`}
                      strokeDashoffset={-endArcLen}
                    />
                  </svg>
                </>
              );
            })()}
            <div
              className={`relative z-10 text-center leading-tight ${
                theme === 'light' ? 'text-[#0A2342]' : 'text-white'
              }`}
            >
              <span className="text-lg font-normal tabular-nums">{capacityGaugeUtilization}%</span>
            </div>
          </div>
          <span
            className={`mt-1.5 text-[9px] font-medium tracking-[0.1em] uppercase ${
              theme === 'light' ? 'text-[#0A2342]' : 'text-white'
            }`}
          >
            Utilization
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-2 min-w-0">
          <div>
            <div
              className={`text-2xl font-semibold tracking-tight tabular-nums ${
                theme === 'light' ? 'text-[#0A2342]' : 'text-white'
              }`}
            >
              {(() => {
                const n = Number(availableCapacity);
                const t = Number.isFinite(n)
                  ? Math.abs(n % 1) < 0.01
                    ? Math.round(n)
                    : Number(n.toFixed(2))
                  : 0;
                const u =
                  pointsSourceType === 'effort'
                    ? ' Effort'
                    : isHoursBasedProject
                    ? ' Hrs'
                    : ' SP';
                return `${t}${u}`;
              })()}
            </div>
            <div
              className={`mt-0.5 text-xs ${theme === 'light' ? 'text-[#073C6A]' : 'text-white'}`}
            >
              Total Capacity
            </div>
          </div>
          {(() => {
            const availN = Number(availableCapacity);
            const allocN = Number(allocatedCapacity);
            if (availN === 0 && allocN === 0) {
              return (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 w-fit max-w-full ${
                    theme === 'light'
                      ? 'bg-slate-100'
                      : 'bg-[#1F2F41]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#4394E0] -translate-y-px" />
                  <span className="text-xs font-medium text-[#4394E0] translate-y-px">No Data</span>
                </div>
              );
            }
            if (availN === 0 && allocN !== 0) {
              return (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 w-fit max-w-full ${
                    theme === 'light'
                      ? 'bg-slate-100'
                      : 'bg-[#1F2F41]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#4394E0] -translate-y-px" />
                  <span className="text-xs font-medium text-[#4394E0] translate-y-px">
                    Add Available Capacity
                  </span>
                </div>
              );
            }
            const capOver =
              isRemainingNegative || Number(capacityGaugeUtilization) > 100;
            const capUnder =
              !capOver &&
              (Number(remainingCapacity) > 0 || Number(capacityGaugeUtilization) < 100);
            if (capOver) {
              return (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 w-fit max-w-full ${
                    theme === 'light'
                      ? 'bg-red-50'
                      : 'bg-[#433434]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#FF4C4C] -translate-y-px" />
                  <span className="text-xs font-medium text-[#FF4C4C] translate-y-px">Overloaded</span>
                </div>
              );
            }
            if (capUnder) {
              return (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 w-fit max-w-full ${
                    theme === 'light'
                      ? 'bg-amber-50'
                      : 'bg-[#3f3110]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#F59E0B] -translate-y-px" />
                  <span className="text-xs font-medium text-[#F59E0B] translate-y-px">Under Utilized</span>
                </div>
              );
            }
            return (
              <div
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 w-fit max-w-full ${
                  theme === 'light'
                    ? 'bg-emerald-50'
                    : 'bg-[#0f291e]'
                }`}
              >
                <span className="text-xs font-medium text-[#10B981]">At Capacity</span>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="mt-3.5 mb-0 shrink-0">
        <div
          className={`relative h-2.5 w-full rounded-full ${
            theme === 'light' ? 'bg-[#E5E7EB]' : 'bg-[#2d3e52]'
          }`}
        >
          {(capacityBarSegments.greenPct > 0 || capacityBarSegments.redPct > 0) ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#16A34A] transition-all"
              style={{
                width: capacityBarSegments.redPct > 0
                  ? '100%'
                  : `${capacityBarSegments.greenPct}%`,
              }}
            />
          ) : null}
          {capacityBarSegments.redPct > 0 ? (
            <div
              className="absolute top-[1px] bottom-[1px] right-[1px] rounded-full bg-[#EF4444] transition-all"
              style={{ width: `calc(${capacityBarSegments.redPct}% - 2px)` }}
            />
          ) : null}
        </div>
        <div className="mt-1.5 flex justify-between items-start gap-2 text-sm font-normal leading-tight no-underline">
          <span
            className="tabular-nums no-underline text-[#788D9D]"
          >
            USED:{' '}
            <span className={theme === 'light' ? 'text-[#0A2342]' : 'text-white'}>
              {(() => {
                const maskZero = Number(availableCapacity) === 0;
                const n = maskZero ? 0 : Number(allocatedCapacity);
                const t = Number.isFinite(n)
                  ? Math.abs(n % 1) < 0.01
                    ? Math.round(n)
                    : Number(n.toFixed(2))
                  : 0;
                const tight =
                  pointsSourceType === 'effort'
                    ? 'Effort'
                    : isHoursBasedProject
                    ? 'Hrs'
                    : 'SP';
                return `${t}${tight}`;
              })()}
            </span>
          </span>
          <span
            className="tabular-nums text-right no-underline text-[#788D9D]"
          >
            {isRemainingNegative || Number(capacityGaugeUtilization) > 100
              ? 'OVERLOADED BY: '
              : 'AVAILABLE: '}
            <span
              className={
                Number(availableCapacity) === 0
                  ? theme === 'light'
                    ? 'text-[#6B7280]'
                    : 'text-[#9CA3AF]'
                  : isRemainingNegative || Number(capacityGaugeUtilization) > 100
                  ? 'text-[#EF4444]'
                  : 'text-[#10B981]'
              }
            >
              {(() => {
                const maskZero = Number(availableCapacity) === 0;
                const n = maskZero ? 0 : Number(remainingCapacity);
                const raw = Number.isFinite(n)
                  ? Math.abs(n % 1) < 0.01
                    ? Math.round(n)
                    : Number(n.toFixed(2))
                  : 0;
                const t = Math.abs(raw);
                const tight =
                  pointsSourceType === 'effort'
                    ? 'Effort'
                    : isHoursBasedProject
                    ? 'Hrs'
                    : 'SP';
                return `${t}${tight}`;
              })()}
            </span>
          </span>
        </div>
      </div>

      {!selectedDeveloper && <div className="mt-auto mb-0 grid w-full grid-cols-3 gap-2">
        <div
          className={`rounded-md px-2 py-1 text-left ${
            theme === 'light' ? 'bg-[#E3EBF3]' : 'bg-[#253449]'
          }`}
        >
          <div
            className={`text-lg font-normal tabular-nums leading-none ${
              Number(availableCapacity) === 0
                ? theme === 'light'
                  ? 'text-[#6B7280]'
                  : 'text-[#9CA3AF]'
                : 'text-[#EF4444]'
            }`}
          >
            {Number(availableCapacity) === 0 ? 0 : overloadCount}
          </div>
          <div
            className={`mt-0 text-xs font-medium leading-tight text-left ${
              theme === 'light' ? 'text-[#406A90]' : 'text-[#A3B1C9]'
            }`}
          >
            Over Loaded
          </div>
        </div>
        <div
          className={`rounded-md px-2 py-1 text-left ${
            theme === 'light' ? 'bg-[#E3EBF3]' : 'bg-[#253449]'
          }`}
        >
          <div
            className={`text-lg font-normal tabular-nums leading-none ${
              Number(availableCapacity) === 0
                ? theme === 'light'
                  ? 'text-[#6B7280]'
                  : 'text-[#9CA3AF]'
                : 'text-[#F59E0B]'
            }`}
          >
            {Number(availableCapacity) === 0 ? 0 : underloadCount}
          </div>
          <div
            className={`mt-0 text-xs font-medium leading-tight text-left ${
              theme === 'light' ? 'text-[#406A90]' : 'text-[#A3B1C9]'
            }`}
          >
            Under Utilized
          </div>
        </div>
        <div
          className={`rounded-md px-2 py-1 text-left ${
            theme === 'light' ? 'bg-[#E3EBF3]' : 'bg-[#253449]'
          }`}
        >
          <div
            className={`text-lg font-normal tabular-nums leading-none ${
              Number(availableCapacity) === 0
                ? theme === 'light'
                  ? 'text-[#6B7280]'
                  : 'text-[#9CA3AF]'
                : Number(remainingCapacity) < 0
                ? 'text-[#EF4444]'
                : 'text-[#10B981]'
            }`}
          >
            {(() => {
              if (Number(availableCapacity) === 0) {
                return '0';
              }
              const n = Number(remainingCapacity);
              if (!Number.isFinite(n)) return '0';
              return Math.abs(n % 1) < 0.01 ? Math.round(n) : Number(n.toFixed(2));
            })()}
          </div>
          <div
            className={`mt-0 text-xs font-medium leading-tight text-left ${
              theme === 'light' ? 'text-[#406A90]' : 'text-[#A3B1C9]'
            }`}
          >
            Remaining
          </div>
        </div>
      </div>}
    </div>
  );
}

StandUpCapacitySection.propTypes = {
  theme: PropTypes.string.isRequired,
  selectedDeveloper: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.object]),
  handleViewCapacityDetails: PropTypes.func.isRequired,
  capacityGaugeGeom: PropTypes.object.isRequired,
  capacityGaugeUtilization: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  availableCapacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  pointsSourceType: PropTypes.string,
  isHoursBasedProject: PropTypes.bool.isRequired,
  allocatedCapacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  isRemainingNegative: PropTypes.bool.isRequired,
  capacityBarSegments: PropTypes.shape({
    greenPct: PropTypes.number,
    redPct: PropTypes.number,
  }).isRequired,
  overloadCount: PropTypes.number.isRequired,
  underloadCount: PropTypes.number.isRequired,
  remainingCapacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};

export default memo(StandUpCapacitySection);
