import { useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { isManuallyAddedCapacityRow } from '../../utils/capacityPlanningUtils';

const CustomEditableCellRenderer = (props) => {
  const [value, setValue] = useState(props.value);
  const [isEditing, setIsEditing] = useState(false);
  const theme = useSelector((state) => state.theme.theme);
  const colId = props.column.getColId();
  const isNumberColumn = props.colDef.cellDataType === 'number';
  const isRole = colId === 'role';
  const isAvailableHours = props.colDef.field === 'availableHours';
  const isAllocationType = colId === 'allocationType';
  const isLeaves = props.colDef.field === 'leaves';
  const isIssueType = colId === 'issueType';
  const isTeamMemberName = props.colDef.field === 'name';
  const canEditTeamMemberName =
    isTeamMemberName &&
    isManuallyAddedCapacityRow(props.data) &&
    !props.colDef.cellRendererParams?.disabled;

  const isEditable =
    isRole ||
    isAvailableHours ||
    isLeaves ||
    isAllocationType ||
    canEditTeamMemberName;

  useEffect(() => {
    setValue(props.value);
  }, [props.value]);

  const triggerUpdate = (newValue) => {
    const updatedRow = {
      ...props.data,
      [props.colDef.field]: newValue,
    };

    if (props.colDef.cellRendererParams?.handleInputChange) {
      props.colDef.cellRendererParams.handleInputChange(
        props.data.id,
        props.colDef.field,
        newValue,
      );
    }

    if (props.context?.onCellValueChanged) {
      props.context.onCellValueChanged({
        data: updatedRow,
        colDef: props.colDef,
        node: props.node,
        newValue,
        oldValue: props.value,
        field: props.colDef.field,
        api: props.api,
        column: props.column,
        rowIndex: props.rowIndex,
      });
    }
  };

  const handleChange = (e) => {
    const newValue = isNumberColumn ? Number(e.target.value) : e.target.value;
    setValue(newValue);
    triggerUpdate(newValue);
  };

  const handleBlur = () => {
    setIsEditing(false);
    triggerUpdate(value);
  };

  const handleClick = () => {
    if (isEditable) {
      setIsEditing(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditing(false);
      if (e.key === 'Enter') {
        triggerUpdate(value);
      }
    }
  };

  const cellStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '8px',
    fontSize: '13px',
    color: theme === 'light' ? '#202020' : 'white',
    backgroundColor: 'transparent',
    cursor: isEditable ? 'pointer' : 'default',
    border: 'none',
    outline: 'none',
    textAlign: isNumberColumn ? 'center' : 'left',
  };

  const inputStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: theme === 'light' ? '#202020' : 'white',
    fontSize: '13px',
    textAlign: isNumberColumn ? 'center' : 'left',
    padding: '0',
    WebkitAppearance: 'none',
    MozAppearance: 'textfield',
  };

  const selectStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    backgroundColor: theme === 'light' ? '#FFFFFF' : '#2c3e50',
    color: theme === 'light' ? '#202020' : 'white',
    fontSize: '13px',
    padding: '0 20px 0 0',
    cursor: 'pointer',
    backgroundImage: theme === 'light' 
      ? `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23202020' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`
      : `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 4px center',
    backgroundSize: '12px',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
  };

  if (canEditTeamMemberName) {
    if (isEditing) {
      return (
        <input
          type="text"
          value={value === null || value === undefined ? '' : value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          style={inputStyle}
          placeholder="Team member"
        />
      );
    }
    return (
      <div onClick={handleClick} style={{ ...cellStyle, cursor: 'pointer' }}>
        {value === null || value === undefined || value === '' ? (
          <span style={{ opacity: 0.6 }}>Enter name</span>
        ) : (
          value
        )}
      </div>
    );
  }

  if (isRole) {
    const roleOptions = props.colDef.cellRendererParams?.roles || [];
    if (isEditing) {
      return (
        <select
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          autoFocus
          style={selectStyle}
        >
          <option value="" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#2c3e50', color: theme === 'light' ? '#202020' : 'white' }}>
            Select Role
          </option>
          {roleOptions.map((role, idx) => (
            <option
              key={idx}
              value={role.role}
              style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#2c3e50', color: theme === 'light' ? '#202020' : 'white' }}
            >
              {role.role}
            </option>
          ))}
        </select>
      );
    }

    return (
      <div
        onClick={handleClick}
        style={{
          ...cellStyle,
          backgroundImage: theme === 'light' 
            ? `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23202020' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`
            : `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '12px',
          paddingRight: '24px',
        }}
      >
        {value || 'Select Role'}
      </div>
    );
  }
if (isIssueType) {
  const issueTypeOptions = props.colDef.cellRendererParams?.issueTypes || [];
  const handleIssueTypeChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (props.context?.onCellValueChanged) {
      props.context.onCellValueChanged({
        data: props.data,
        newValue,
        field: props.colDef.field,
        colDef: props.colDef,
        node: props.node,
        api: props.api,
        column: props.column,
        rowIndex: props.rowIndex,
      });
    }
  };

  const selectStyle = {
    height: '28px',
    backgroundImage: theme === 'light' 
      ? `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 6'%3e%3cpath stroke='%23202020' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 1 4 4 4-4'/%3e%3c/svg%3e")`
      : `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 6'%3e%3cpath stroke='%23D9E4F1' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 1 4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 8px center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '10px 6px',
    paddingRight: '24px'
  };

  return (
    <div className="relative inline-block w-full">
      <select
        value={value || ''}
        onChange={handleIssueTypeChange}
        className={`w-full px-2 py-1 text-sm rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none ${
          theme === 'light' 
            ? 'text-[#202020] bg-[#FFFFFF] border border-[#E5E5E5] hover:bg-[#F7F9FF]' 
            : 'text-[#D9E4F1] bg-[#182433] border border-[#1F2F41] hover:bg-[#1E2B3A]'
        }`}
        style={selectStyle}
      >
        {issueTypeOptions.map((type, idx) => (
          <option 
            key={idx} 
            value={type}
            className={theme === 'light' ? 'bg-[#FFFFFF] text-[#202020]' : 'bg-[#182433] text-[#D9E4F1]'}
          >
            {type}
          </option>
        ))}
      </select>
    </div>
  );
}

  if (isAvailableHours || isLeaves ) {
    if (isEditing) {
      return (
        <input
          type="number"
          min={0}
          value={value === null || value === undefined ? '' : value}
          onChange={(e) => setValue(Number(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          style={inputStyle}
        />
      );
    }

    return (
      <div onClick={handleClick} style={cellStyle}>
        {value === null || value === undefined ? '0' : value}
      </div>
    );
  }

  if (isAllocationType) {
    const options = [
      { value: 'Partial', label: 'Partial' },
      { value: 'Full', label: 'Full' },
    ];
    if (isEditing) {
      return (
        <select
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          autoFocus
          style={selectStyle}
        >
          <option value="" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#2c3e50', color: theme === 'light' ? '#202020' : 'white' }}>
            Select Option
          </option>
          {options.map((opt, idx) => {
            return (
              <option
                key={idx}
                value={opt.value}
                style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#2c3e50', color: theme === 'light' ? '#202020' : 'white' }}
              >
                {opt?.label}
              </option>
            );
          })}
        </select>
      );
    }

    return (
      <div
        onClick={handleClick}
        style={{
          ...cellStyle,
          backgroundImage: theme === 'light' 
            ? `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23202020' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`
            : `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '12px',
          paddingRight: '24px',
        }}
      >
        {value}
      </div>
    );
  }

  return <div style={cellStyle}>{value === null || value === undefined ? '' : value}</div>;
};

CustomEditableCellRenderer.propTypes = {
  value: PropTypes.any,
  node: PropTypes.object.isRequired,
  colDef: PropTypes.object.isRequired,
  column: PropTypes.object.isRequired,
  data: PropTypes.object,
  context: PropTypes.object,
  rowIndex: PropTypes.number,
  api: PropTypes.object,
};

export default CustomEditableCellRenderer;
