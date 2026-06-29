import { Plus } from 'lucide-react';
import PropTypes from 'prop-types';

const AddNewWidget = ({ onClick, theme }) => (
  <div
    className={`tq-dashed-border rounded-[10px] flex items-center justify-center h-[180px] ${
      theme === 'light'
        ? 'bg-[#FFFFFF] text-[#24527A] shadow-[0_1px_20px_rgba(0,0,0,0.1)]'
        : 'bg-[#182433] text-[#A3B1C9]'
    }`}
    style={{ '--dash-color': theme === 'light' ? '#D1E2F0' : '#25384F' }}
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onClick?.();
    }}
  >
    <div className="flex flex-col items-center justify-center py-8">
      <Plus className="w-8 h-8 mb-2" />
      <div className="text-[15px]">Add New Widget</div>
    </div>
  </div>
);

AddNewWidget.propTypes = {
  onClick: PropTypes.func,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

AddNewWidget.defaultProps = {
  onClick: null,
};

export default AddNewWidget;
