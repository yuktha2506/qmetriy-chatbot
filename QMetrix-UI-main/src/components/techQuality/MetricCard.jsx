import PropTypes from 'prop-types';
import TooltipIcon from '../../utils/TooltipIcon';
import { TrendUpArrowIcon, TrendDownArrowIcon } from './TrendArrows';
import BottomBanner from './BottomBanner';

const MetricCard = ({
  title,
  target,
  value,
  valueSuffix = '',
  delta,
  trendStatus = true,
  footerLeft = 'Current Year',
  footerMidLabel = 'Highest',
  footerMidValue = '4',
  footerRightLabel = 'Lowest',
  footerRightValue = '1',
  tooltipText = '',
  topControl = null,
  middleBadges = null,
  hideValueBanner = false,
  topControlWrapperClassName = 'mt-2',
  bottomBannerClassName = '',
  valueBannerWrapperClassName = 'mt-2.5',
  theme,
}) => {
  const trendDisplay = delta != null ? delta : (trendStatus === 'NA' ? '—' : '');
  const showUp = trendStatus === true;
  const showDown = trendStatus === false;
  const trendColorUp = theme === 'light' ? 'text-[#22AD38]' : 'text-[#2ad544]';
  const trendColorDown = theme === 'light' ? 'text-[#CC2018]' : 'text-[#FF6B6B]';

  return (
    <div
      className={`tq-card rounded-[10px] border shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md h-[180px] flex flex-col ${
        theme === 'light' ? 'bg-[#FFFFFF] border-[#D1E2F0]' : 'bg-[#182433] border-[#25384F]'
      }`}
    >
      <div className="px-4 pt-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`text-base ${theme === 'light' ? 'text-[#0A2342]' : 'text-white'}`}>{title}</div>
            <TooltipIcon title={title} tooltip={tooltipText} theme={theme} placement="top" />
          </div>

          <div className="flex items-center gap-2">
            <div className={`text-base ${theme === 'light' ? 'text-[#0A2342]' : 'text-white'}`}>Target</div>
            <div className={`text-base font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-[#48A7FF]'}`}>
              {target}
            </div>
          </div>
        </div>

        {!hideValueBanner && (
          <div className={`${valueBannerWrapperClassName} flex items-center justify-center`}>
            <div
              className={`px-1 py-0.5 rounded-lg flex items-center gap-1 border leading-none ${
                theme === 'light' ? 'text-[#0A2342] border-[#A6C3DC]' : 'text-white border-[#224F78]'
              }`}
              style={{
                background:
                  theme === 'light'
                    ? 'linear-gradient(180deg, #EFF8FE 0%, #BAE6FD 100%)'
                    : 'linear-gradient(180deg, #2E4F7A 0%, #18304E 100%)',
              }}
            >
              <span className="text-[22px] font-semibold">{value}</span>
              {valueSuffix ? <span className="text-base font-semibold">{valueSuffix}</span> : null}
              {trendStatus !== 'NA' && (trendDisplay !== '' || showUp || showDown) && (
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    showUp ? trendColorUp : showDown ? trendColorDown : theme === 'light' ? 'text-[#0A2342]' : 'text-white'
                  }`}
                >
                  {trendDisplay}
                  {showUp && <TrendUpArrowIcon className={`w-4 h-4 ${trendColorUp}`} />}
                  {showDown && <TrendDownArrowIcon className={`w-4 h-4 ${trendColorDown}`} />}
                </span>
              )}
              {trendStatus === 'NA' && trendDisplay && (
                <span className={`text-[11px] font-semibold ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#A3B1C9]'}`}>
                  {trendDisplay}
                </span>
              )}
            </div>
          </div>
        )}

        {middleBadges && (
          <div className="mt-2 w-fit mx-auto flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            {middleBadges}
          </div>
        )}

        {topControl && (
          <div className={`${topControlWrapperClassName} w-fit mx-auto`} onClick={(e) => e.stopPropagation()}>
            {topControl}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 mt-auto">
        <BottomBanner
          leftLabel={footerLeft}
          midLabel={footerMidLabel}
          midValue={footerMidValue}
          rightLabel={footerRightLabel}
          rightValue={footerRightValue}
          className={bottomBannerClassName}
          theme={theme}
        />
      </div>
    </div>
  );
};

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  target: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  valueSuffix: PropTypes.string,
  delta: PropTypes.string,
  trendStatus: PropTypes.oneOf([true, false, 'NA']),
  footerLeft: PropTypes.string,
  footerMidLabel: PropTypes.string,
  footerMidValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  footerRightLabel: PropTypes.string,
  footerRightValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tooltipText: PropTypes.string,
  topControl: PropTypes.node,
  middleBadges: PropTypes.node,
  hideValueBanner: PropTypes.bool,
  topControlWrapperClassName: PropTypes.string,
  bottomBannerClassName: PropTypes.string,
  valueBannerWrapperClassName: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

export default MetricCard;
