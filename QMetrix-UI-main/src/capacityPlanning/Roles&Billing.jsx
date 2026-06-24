import { useState, useEffect } from "react";
import { Plus, Save, Trash } from 'lucide-react';
import CommonLayout from "../../layout/CommonLayout";
import Modal from '../Common/Modal';
import { getRoleRatesAndStoryPoints, addRoleRates } from '../../constants';
import { useDispatch, useSelector } from 'react-redux';
import { setRoleRates, setStoryPointRatio } from '../../store/JiraSlices/jiraSlice';

const RolesBillingTable = () => {
  const [roleData, setRoleData] = useState([{ role: "", rate: "" }]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const companyId = sessionStorage.getItem('companyId')
  const [saveStatus, setSaveStatus] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const theme = useSelector((state) => state.theme.theme);
  const cachedRoleRates = useSelector((state) => state.jira?.roleRates);
  const cachedStoryPointRatio = useSelector((state) => state.jira?.storyPointRatio);
  const dispatch = useDispatch();

  useEffect(() => {
    let isCurrent = true;
    const fetchRoleRates = async () => {
      try {
        if (isDirty) {
          return;
        }
        if (Array.isArray(cachedRoleRates) && cachedRoleRates.length > 0) {
          if (!isCurrent) {
            return;
          }
          setRoleData(cachedRoleRates);
          return;
        }
        const data = await getRoleRatesAndStoryPoints(companyId);
        if (!isCurrent || isDirty) {
          return;
        }
        const roleRates = data?.roleRates || [];
        setRoleData(roleRates);
        dispatch(setRoleRates(roleRates));
        if (typeof data?.storyPoints === 'number') {
          dispatch(setStoryPointRatio(data.storyPoints));
        } else if (typeof cachedStoryPointRatio === 'number') {
          dispatch(setStoryPointRatio(cachedStoryPointRatio));
        }
      } catch (error) {
        console.error("Error fetching role rates:", error);
      }
    };

    fetchRoleRates();
    return () => {
      isCurrent = false;
    };
  }, [cachedRoleRates, cachedStoryPointRatio, companyId, dispatch, isDirty]);

  const handleInputChange = (index, field, value) => {
    setIsDirty(true);
    setRoleData((prev) => prev.map((item, i) => (
      i === index ? { ...item, [field]: value } : item
    )));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedData = [...roleData].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setRoleData(sortedData);
  };

  const addRow = () => {
    setIsDirty(true);
    setRoleData([...roleData, { role: "", rate: "" }]);
  };

  const deleteRow = (index) => {
    setIsDirty(true);
    const updatedRoleData = roleData.filter((_, i) => i !== index);
    setRoleData(updatedRoleData);
  };

  const saveData = async () => {
    const errors = roleData.map((item) => ({
      role: item.role.trim() === "" ? "Required" : "",
      rate: String(item.rate).trim() === "" ? "Required" : "",
    }));
  
    const hasErrors = errors.some((error) => error.role || error.rate);
  
    setValidationErrors(errors);
  
    if (hasErrors) {
      return;
    }
  
    const formattedData = roleData.map((item) => ({
      role: item.role,
      rate: parseFloat(item.rate) || 0,
    }));

    try {
      await addRoleRates(formattedData);
      const updatedData = await getRoleRatesAndStoryPoints(companyId);
      const roleRates = updatedData?.roleRates || [];
      setRoleData(roleRates);
      setIsDirty(false);
      dispatch(setRoleRates(roleRates));
      if (typeof updatedData?.storyPoints === 'number') {
        dispatch(setStoryPointRatio(updatedData.storyPoints));
      }
      setSaveStatus(true);
      setIsModalOpen(true);
      setTimeout(() => setSaveStatus(false), 500);
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  return (
    <CommonLayout>
      <div className="mt-20 overflow-x-auto rounded-lg shadow-xl">
        <table className="w-full bg-gray-200 text-custom-black dark:bg-gray-800 dark:text-custom-white border-collapse">
          <thead>
            <tr className="bg-primary-400 text-black dark:bg-[#066FD1] dark:text-white">
              <th
                className="p-3 text-left text-md cursor-pointer"
                onClick={() => handleSort('role')}
              >
                Role
                {sortConfig.key === 'role' && (
                  <span>{sortConfig.direction === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
                )}
              </th>
              <th
                className="p-3 text-left text-md cursor-pointer"
                onClick={() => handleSort('rate')}
              >
                Billing Rate
                {sortConfig.key === 'rate' && (
                  <span>{sortConfig.direction === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
                )}
              </th>
              <th className="p-3 text-center text-md">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roleData.map((item, index) => (
              <tr
                key={index}
                className={`${
                  index % 2 === 0 ? "bg-purple-50 dark:bg-[#182433]" : "bg-white dark:bg-[#182433]"
                } border-b transition-colors hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                <td className="p-3">
                  <input
                    type="text"
                    className={`border rounded-md p-1 w-full bg-white dark:bg-[#182433] focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-gray-300 ${
                      validationErrors[index]?.role ? "border-red-500 placeholder-red-500" : ""
                    }`}
                    value={item.role}
                    onChange={(e) => handleInputChange(index, "role", e.target.value)}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/[^a-zA-Z\s-/]/g, "");
                    }}
                    placeholder={validationErrors[index]?.role || "Enter role"}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`border rounded-md p-1 w-full bg-white dark:bg-[#182433] focus:outline-none focus:ring-2 focus:ring-purple-400 dark:text-gray-300 ${
                      validationErrors[index]?.rate ? "border-red-500 placeholder-red-500" : ""
                    }`}
                    value={item.rate}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "" || raw === ".") {
                        handleInputChange(index, "rate", raw);
                        return;
                      }
                      const allowed = raw.replace(/[^0-9.]/g, "");
                      const value = allowed.includes(".")
                        ? allowed.replace(/(\..*)\./g, "$1")
                        : allowed;
                      handleInputChange(index, "rate", value);
                    }}
                    placeholder={validationErrors[index]?.rate || "Enter billing rate"}
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
            saveStatus ? "bg-[#182433] cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          } text-white px-4 py-2 rounded flex items-center`}
          disabled={saveStatus}
        >
          {saveStatus ? "Saved" : (
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

export default RolesBillingTable;
