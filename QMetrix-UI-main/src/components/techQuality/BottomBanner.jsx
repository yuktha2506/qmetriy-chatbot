import PropTypes from 'prop-types';

const BottomBanner = ({ leftLabel, midLabel, midValue, rightLabel, rightValue, className = '', theme }) => (
  <div
    className={`mt-4 w-full rounded-md px-4 py-2 ${className} ${
      theme === 'light'
        ? 'tq-dashed-border bg-[#EFF8FE]'
        : 'tq-dashed-border bg-[#162B46]'
    }`}
    style={{ '--dash-color': theme === 'light' ? '#D1E2F0' : '#2D5274' }}
  >
    <div className={`grid grid-cols-3 text-[13px] ${theme === 'light' ? 'text-[#5580A6]' : 'text-white'}`}>
      <div className="text-left">{leftLabel}</div>
      <div className="text-center">
        {midLabel}{' '}
        <span className={`font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-[#066FD1]'}`}>
          {midValue}
        </span>
      </div>
      <div className="text-right">
        {rightLabel}{' '}
        <span className={`font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-[#066FD1]'}`}>
          {rightValue}
        </span>
      </div>
    </div>
  </div>
);

BottomBanner.propTypes = {
  leftLabel: PropTypes.string.isRequired,
  midLabel: PropTypes.string.isRequired,
  midValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  rightLabel: PropTypes.string.isRequired,
  rightValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  className: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

export default BottomBanner;
