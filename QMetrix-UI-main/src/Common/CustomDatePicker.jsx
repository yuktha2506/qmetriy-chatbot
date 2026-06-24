import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../../assets/css/calendar.css'


// eslint-disable-next-line react/prop-types
const DateRangePicker = ({ onChange }) => {
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  const handleDateChange = (update) => {
    setDateRange(update);
    if (onChange) onChange(update);
  };

  return (
    <DatePicker
      selectsRange
      startDate={startDate}
      endDate={endDate}
      onChange={handleDateChange}
      isClearable
      placeholderText="Select Date Range  &#11167;"
      className="inline-flex items-center w-60 px-4 py-2 justify-between h-9 text-center bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#066FD1] focus:border-[#066FD1] sm:text-sm"
    />
  );
};

export default DateRangePicker;
