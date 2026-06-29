import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { TECH_QUALITY_DND_TYPE } from './techConstants';

const WidgetShell = ({
  id,
  index,
  isActive,
  onActivate,
  onAddClick,
  onDeleteClick,
  moveWidget,
  children,
  theme,
}) => {
  const containerRef = useRef(null);

  const [, drop] = useDrop({
    accept: TECH_QUALITY_DND_TYPE,
    drop: (item) => {
      if (!containerRef.current) return;
      const dragIndex = item.index;
      const dropIndex = index;
      if (dragIndex === dropIndex) return;
      moveWidget(dragIndex, dropIndex);
      item.index = dropIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: TECH_QUALITY_DND_TYPE,
    item: () => ({ id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  preview(drop(containerRef));
  drag(containerRef);

  return (
    <div
      ref={containerRef}
      data-widget-id={id}
      className={`relative ${isDragging ? 'opacity-60' : 'opacity-100'} ${
        isActive && theme === 'light' ? 'tq-selected-light' : ''
      }`}
      onClick={() => onActivate((prev) => (prev === id ? null : id))}
      style={{ cursor: 'pointer' }}
    >
      <div className={`${isActive ? `${theme === 'light' ? '' : 'tq-active-glow'} rounded-[10px]` : ''}`}>
        {children}
      </div>

      {isActive && (
        <div
          className={`absolute left-1 right-1 h-10 rounded-t-none rounded-b-[10px] flex items-center justify-between px-4 ${
            theme === 'light' ? '' : 'tq-active-glow'
          } z-20 border border-t-0 ${
            theme === 'light'
              ? 'bg-[#EFF8FE] border-[#A6C3DC] shadow-[0_0_8px_rgba(117,147,174,1)]'
              : 'bg-[#162B46] border-[#25384F]'
          }`}
          style={{ top: '100%' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`cursor-move flex items-center ${theme === 'light' ? 'text-[#066FD1]' : 'text-[#48A7FF]'}`}>
            <GripVertical className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group">
              <button
                type="button"
                aria-label="Add Widget"
                className={`${theme === 'light' ? 'text-[#066FD1] hover:text-[#0A2342]' : 'text-[#48A7FF] hover:text-white'}`}
                onClick={() => onAddClick(id)}
              >
                <Plus className="w-5 h-5" />
              </button>
              <div
                className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${
                  theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'
                }`}
              >
                Add Widget
              </div>
            </div>

            <div className="relative group">
              <button
                type="button"
                aria-label="Delete Widget"
                className={`${theme === 'light' ? 'text-[#066FD1] hover:text-[#0A2342]' : 'text-[#48A7FF] hover:text-white'}`}
                onClick={() => onDeleteClick(id)}
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <div
                className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${
                  theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'
                }`}
              >
                Delete Widget
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

WidgetShell.propTypes = {
  id: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  onActivate: PropTypes.func.isRequired,
  onAddClick: PropTypes.func.isRequired,
  onDeleteClick: PropTypes.func.isRequired,
  moveWidget: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

export default WidgetShell;
