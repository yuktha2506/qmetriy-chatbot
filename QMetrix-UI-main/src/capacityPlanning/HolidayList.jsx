import { useState, useEffect } from 'react';
import { Plus, Save, Trash } from 'lucide-react';
import CommonLayout from '../../layout/CommonLayout';
import Modal from '../Common/Modal';
import { getHolidayList, addHolidayList } from '../../constants';
import { useDispatch, useSelector } from 'react-redux';
import { setHolidayListForCompany } from '../../store/JiraSlices/jiraSlice';
import '../../assets/css/global.scss';

const HolidayList = () => {
  const [holidayData, setHolidayData] = useState([{ holiday: '', date: '' }]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const companyId = sessionStorage.getItem('companyId');
  const [saveStatus, setSaveStatus] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const theme = useSelector((state) => state.theme.theme);
  const cachedHolidays = useSelector(
    (state) => state.jira?.holidayListByCompanyId?.[companyId],
  );
  const dispatch = useDispatch();

useEffect(() => {
  const fetchHolidays = async () => {
    try {
      if (Array.isArray(cachedHolidays)) {
        setHolidayData(
          cachedHolidays.map((h) => ({
            holiday: h.name,
            date: h.date ? h.date.split("T")[0] : "",
          })),
        );
        return;
      }
      const data = await getHolidayList(companyId);
      const holidayList = Array.isArray(data?.holidayList) ? data.holidayList : [];
      dispatch(setHolidayListForCompany({ companyId, holidays: holidayList }));
      setHolidayData(
        holidayList.map((h) => ({
          holiday: h.name,
          date: h.date ? h.date.split("T")[0] : "",
        })),
      );
    } catch (error) {
      console.error("Error fetching holidays:", error);
      setHolidayData([]); 
    }
  };

  fetchHolidays();
}, [cachedHolidays, companyId, dispatch]);


  const handleInputChange = (index, field, value) => {
    const updatedData = [...holidayData];
    updatedData[index][field] = value;
    setHolidayData(updatedData);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedData = [...holidayData].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setHolidayData(sortedData);
  };

  const addRow = () => {
    setHolidayData([...holidayData, { holiday: '', date: '' }]);
  };

  const deleteRow = (index) => {
    const updatedData = holidayData.filter((_, i) => i !== index);
    setHolidayData(updatedData);
  };

const saveData = async () => {
  const errors = holidayData.map((item) => ({
    holiday: item.holiday.trim() === '' ? 'Required' : '',
    date: item.date.trim() === '' ? 'Required' : '',
  }));

  const hasErrors = errors.some((error) => error.holiday || error.date);
  setValidationErrors(errors);

  if (hasErrors) return;

  const formattedData = holidayData.map((item) => ({
    name: item.holiday,
    date: item.date, 
  }));

  try {
    await addHolidayList(formattedData);
    const updatedData = await getHolidayList(companyId);
    const holidayList = Array.isArray(updatedData?.holidayList) ? updatedData.holidayList : [];
    dispatch(setHolidayListForCompany({ companyId, holidays: holidayList }));
    setHolidayData(
      holidayList.length > 0
        ? holidayList.map((h) => ({
            holiday: h.name,
            date: h.date ? h.date.split("T")[0] : "" 
          }))
        : []
    );
    setSaveStatus(true);
    setIsModalOpen(true);
    setTimeout(() => setSaveStatus(false), 500);
  } catch (error) {
    console.error('Error saving holidays:', error);
  }
};

  return (
    <CommonLayout>
      <div className="mt-20 overflow-x-auto rounded-lg shadow-xl px-6">
        <table className="w-full bg-gray-200 text-custom-black dark:bg-gray-800 dark:text-custom-white border-collapse">
          <thead>
            <tr className="bg-primary-400 text-black dark:bg-[#066FD1] dark:text-white">
              <th
                className="p-3 text-left text-md cursor-pointer"
                onClick={() => handleSort('holiday')}
              >
                Holiday
                {sortConfig.key === 'holiday' && (
                  <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th
                className="p-3 text-left text-md cursor-pointer"
                onClick={() => handleSort('date')}
              >
                Date
                {sortConfig.key === 'date' && (
                  <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th className="p-3 text-center text-md">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidayData.map((item, index) => (
              <tr
                key={index}
                className={`${
                  index % 2 === 0 ? 'bg-purple-50 dark:bg-[#182433]' : 'bg-white dark:bg-[#182433]'
                } border-b transition-colors hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                <td className="p-3">
                  <input
                    type="text"
                    className={`border rounded-md p-1 w-full bg-white dark:bg-[#182433] focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-gray-300 ${
                      validationErrors[index]?.holiday ? 'border-red-500 placeholder-red-500' : ''
                    }`}
                    value={item.holiday}
                    onChange={(e) => handleInputChange(index, 'holiday', e.target.value)}
                    placeholder={validationErrors[index]?.holiday || 'Enter holiday name'}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="date"
                    className={`border rounded-md p-1 w-full bg-white dark:bg-[#182433] focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-gray-300 ${
                      validationErrors[index]?.date ? 'border-red-500 placeholder-red-500' : ''
                    }`}
                    value={item.date}
                    onChange={(e) => handleInputChange(index, 'date', e.target.value)}
                  />
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => deleteRow(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-4 space-x-4">
        <button
          onClick={addRow}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
        >
          <Plus size={16} className="mr-2" /> Add Row
        </button>
        <button
          onClick={saveData}
          className={`${
            saveStatus ? 'bg-[#182433] cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
          } text-white px-4 py-2 rounded flex items-center`}
          disabled={saveStatus}
        >
          {saveStatus ? (
            'Saved'
          ) : (
            <>
              <Save size={16} className="mr-2" /> Save
            </>
          )}
        </button>
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title=""
        className="max-w-sm"
        content={
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3">
              <div className="h-10 w-10 rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-semibold mb-1 dark:text-white text-[#0A2342]">Success</h2>
            <p className={`text-sm mb-4 ${theme === 'light' ? 'text-[#0A2342]' : 'text-gray-300'}`}>Data saved successfully!</p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-2 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              OK
            </button>
          </div>
        }
      />
    </CommonLayout>
  );
};

export default HolidayList;
