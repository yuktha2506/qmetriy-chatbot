import PropTypes from 'prop-types';
import '../../assets/css/level2.scss';
import '../../assets/css/commonColors.scss';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TooltipIcon from "../../utils/TooltipIcon";
import { useSelector } from 'react-redux';

const DataCard = ({
  title,
  trendValue,
  toolTip,
  showDetails = false,
  index = 0,
  isSelected = false,
  onSelectCard,
  color = '#00800000',
  isBurndown = false,
  isStoryPoints = true,
  onToggleMetric,
  unit
}) => {
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();
  const toggleDetails = () => {
    onSelectCard(index);
  };
  const getTooltipPlacement = (index) => {
    if ((index % 3) === 0) return "bottom-end";
    if ((index % 3) === 1) return "bottom-start";
    return "bottom";
  };

  const getClassName = () => {
    if (index % 3 === 0) return 'data-card open-bugs';
    if (index % 3 === 1) return 'data-card open-task';
    return 'data-card open-story';
  };

  return (
      <div
        className={`${getClassName()} ${
          isSelected
            ? 'selected bg-white dark:bg-gray-700'
            : 'bg-white dark:bg-[#182433]'
        } ${
          isSelected === false ? 'w-[32%]' : isSelected === true ? 'w-1/3' : 'hidden'
        } rounded-lg p-4 w-full min-h-28 shadow-lg flex flex-col justify-between transition-all duration-300 ease-in-out`}
        style={{
          borderBottom: `solid 0.5vh ${color}`,
        }}
      >
      <div className="text-black dark:text-custom-white text-md flex justify-between items-center mb-3">
        <div className="flex items-center">
          {title}
        </div>
        
        {isBurndown && (
          <div className="ml-10 inline-flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-0.5">
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                isStoryPoints
                  ? 'bg-primary-400 dark:bg-primary-500 text-black dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => onToggleMetric(true)}
            >
              Story Points
            </button>
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                !isStoryPoints
                  ? 'bg-primary-400 dark:bg-primary-500 text-black dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => onToggleMetric(false)}
            >
              Hours
            </button>
          </div>
        )}
        <div className="relative group ml-1">
          <TooltipIcon title={title} tooltip={toolTip} theme={theme} placement={getTooltipPlacement(index + 1)} />
        </div>
      </div>
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="mt-1 flex text-3xl text-custom-black dark:text-custom-white items-baseline">
            {(() => {
              if (typeof trendValue === 'string') {
                if (trendValue.includes('%') || trendValue.includes('d')) {
                  const numericValue = parseFloat(trendValue.replace(/[^0-9.-]/g, ''));
                  if (title === 'Time To Fix' && trendValue.includes('d')) {
                    return `${numericValue > 0 ? numericValue : 0} d`;
                  }
                  return numericValue > 0 ? numericValue : 0;
                }
              }
              return trendValue > 0 ? trendValue : 0;
            })()}
            {isBurndown && (
              <span className="text-lg ml-2 text-custom-black dark:text-custom-white">%</span>
            )}
            {unit && (
              <span className="text-sm ml-2 text-gray-600 dark:text-gray-300">
                {unit}
              </span>
            )}
          </span>
        </div>
          {title !== "Static Code Analysis" && showDetails && (
            <span
              className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
              onClick={toggleDetails}
              style={{
                color: 'var(--link-color-primary)',
              }}
            >
              {isSelected ? 'Hide Details' : 'View Details'}
              {isSelected ? <FiChevronUp /> : <FiChevronDown />}
            </span>
          )}
          {title === "Static Code Analysis" && (
            <span
              className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
              onClick={() => navigate("/gitDashboard")}
              style={{
                color: 'var(--link-color-primary)',
              }}
            >
              View Details
            </span>
          )}
          {title === 'Time To Fix' && (
            <span
              className="mt-5 self-end font-semibold cursor-pointer text-sm flex items-center gap-1"
              onClick={() => navigate("/jiraDashboard")}
              style={{
                color: 'var(--link-color-primary)',
              }}
            >
              View Details
            </span>
          )}
        </div>
      </div>
  );
};

DataCard.propTypes = {
  title: PropTypes.string.isRequired,
  trendValue: PropTypes.any.isRequired,
  toolTip: PropTypes.string.isRequired,
  showDetails: PropTypes.bool,
  index: PropTypes.number,
  isSelected: PropTypes.bool,
  onSelectCard: PropTypes.func.isRequired,
  color: PropTypes.string,
  isBurndown: PropTypes.bool,
  isStoryPoints: PropTypes.bool,
  onToggleMetric: PropTypes.func,
  unit: PropTypes.string,
};

export default DataCard;
