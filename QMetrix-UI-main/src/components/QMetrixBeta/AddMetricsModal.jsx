import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Spinner from '../Common/Spinner';
import PropTypes from 'prop-types';

const CustomAlertModal = ({ isOpen, onClose, message }) => (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 flex items-center justify-center z-[100]">
        <div className="fixed inset-0 bg-black bg-opacity-50" />
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-900 dark:text-gray-300 rounded-xl shadow-lg p-6 w-full max-w-sm relative text-center"
        >
            <h3 className="text-lg font-semibold mb-4">Alert</h3>
            <p className="mb-6">{message}</p>
            <button
                onClick={onClose}
                className="bg-[#7367F0] hover:bg-[#6355f7] text-gray-100 py-2 px-4 rounded-md text-base font-semibold transition w-full"
            >
                OK
            </button>
        </motion.div>
    </Dialog>
);

CustomAlertModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    message: PropTypes.string.isRequired,
};

const AddMetricsModal = ({ metricsData, isOpen, onClose, onApply, title }) => {
    const initialTab = title.replace('Score', '').replace(/([A-Z])/g, ' $1').trim();
    const [activeTab, setActiveTab] = useState(initialTab || Object.keys(metricsData)[0]);
    const [loading, setLoading] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState({});
    const [metricValues, setMetricValues] = useState({});
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
  
    useEffect(() => {
        const storedSelectedMetricsAllTabs = JSON.parse(sessionStorage.getItem('selectedMetrics') || '{}');
        const storedMetricValuesAllTabs = JSON.parse(sessionStorage.getItem('metricValues') || '{}');
        const currentTabMetrics = metricsData[activeTab];
        setSelectedMetrics((prevSelected) => {
            const newSelectedForActiveTab = {};
            if (currentTabMetrics && currentTabMetrics.length > 0) {
                currentTabMetrics.forEach((metric) => {
                    const wasStoredSelected = storedSelectedMetricsAllTabs?.[activeTab]?.[metric.name];
                    newSelectedForActiveTab[metric.name] = wasStoredSelected ?? (metric.value > 0);
                });
            }
            return {
                ...prevSelected, 
                [activeTab]: newSelectedForActiveTab, 
            };
        });

        setMetricValues((prevValues) => {
            const newValuesForActiveTab = {};
            if (currentTabMetrics && currentTabMetrics.length > 0) {
                currentTabMetrics.forEach((metric) => {
                    const storedValue = storedMetricValuesAllTabs?.[activeTab]?.[metric.name];
                    newValuesForActiveTab[metric.name] = storedValue ?? (metric.value || 0);
                });
            }
            return {
                ...prevValues, 
                [activeTab]: newValuesForActiveTab, 
            };
        });

    }, [metricsData, activeTab]); 
    const currentTabTotalSum = Object.values(metricValues[activeTab] || {}).reduce((sum, val) => sum + Number(val), 0);

    const toggleMetric = (name) => {
        const isChecked = selectedMetrics?.[activeTab]?.[name] || false;

        const updatedSelectedMetrics = {
            ...selectedMetrics,
            [activeTab]: {
                ...selectedMetrics[activeTab],
                [name]: !isChecked,
            },
        };
        setSelectedMetrics(updatedSelectedMetrics);
        sessionStorage.setItem('selectedMetrics', JSON.stringify(updatedSelectedMetrics));

        const updatedMetricValues = {
            ...metricValues,
            [activeTab]: {
                ...metricValues[activeTab],
                [name]: isChecked ? 0 : (metricValues[activeTab]?.[name] || 0),
            },
        };
        setMetricValues(updatedMetricValues);
        sessionStorage.setItem('metricValues', JSON.stringify(updatedMetricValues));
    };

    const handleInputChange = (name, value) => {
        let newValue = value.replace(/\D/g, '').replace(/^0+/, '');
        if (newValue === '') newValue = '0';

        const numValue = Number(newValue);
        const sumWithoutCurrent = (metricValues[activeTab] ? Object.values(metricValues[activeTab]).reduce((sum, val) => sum + Number(val), 0) : 0) - Number(metricValues[activeTab]?.[name] || 0);

        const updated = {
            ...metricValues,
            [activeTab]: {
                ...metricValues[activeTab],
                [name]: numValue
            }
        };

        if (sumWithoutCurrent + numValue > 100) {
            setAlertMessage('Total sum for this tab cannot exceed 100!');
            setIsAlertOpen(true);
            return;
        }

        setMetricValues(updated);
        sessionStorage.setItem('metricValues', JSON.stringify(updated));
    };


    const handleClear = () => {
        const updatedSelectedMetrics = { ...selectedMetrics };
        const updatedMetricValues = { ...metricValues };
        if (metricsData[activeTab]) {
            updatedSelectedMetrics[activeTab] = metricsData[activeTab].reduce((acc, metric) => ({
                ...acc,
                [metric.name]: false,
            }), {});
            updatedMetricValues[activeTab] = metricsData[activeTab].reduce((acc, metric) => ({
                ...acc,
                [metric.name]: 0,
            }), {});
        }

        setSelectedMetrics(updatedSelectedMetrics);
        setMetricValues(updatedMetricValues);
        const storedSelectedMetrics = JSON.parse(sessionStorage.getItem('selectedMetrics') || '{}');
        storedSelectedMetrics[activeTab] = updatedSelectedMetrics[activeTab];
        sessionStorage.setItem('selectedMetrics', JSON.stringify(storedSelectedMetrics));

        const storedMetricValues = JSON.parse(sessionStorage.getItem('metricValues') || '{}');
        storedMetricValues[activeTab] = updatedMetricValues[activeTab];
        sessionStorage.setItem('metricValues', JSON.stringify(storedMetricValues));
    };

    const handleApplyChanges = async () => {
        setLoading(true);
        const selectedMetricNames = Object.keys(selectedMetrics[activeTab] || {}).filter(
            (name) => selectedMetrics[activeTab][name]
        );

        const values = selectedMetricNames.map((name) => ({
            name,
            value: metricValues[activeTab][name],
        }));

        let backendTitle = '';
        if (activeTab === 'Engineering') {
            backendTitle = 'engineeringScore';
        } else if (activeTab === 'Developer') {
            backendTitle = 'developerScore';
        } else if (activeTab === 'Test') {
            backendTitle = 'testScore';
        } else if (activeTab === 'Operation') {
            backendTitle = 'operationScore';
        }

        if (currentTabTotalSum > 100) {
            setAlertMessage('Total sum of metrics for this tab cannot exceed 100!');
            setIsAlertOpen(true);
            setLoading(false);
            return;
        }

        try {
            await onApply(values, backendTitle);
            onClose();
        } catch (error) {
            toast.error('Failed to update metrics contribution.', {
                className: 'bg-red-500 text-gray-100',
            });
            console.error('Error updating metric contributions:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentMetrics = metricsData[activeTab] || [];

    return (
        <>
            <Dialog
                open={isOpen}
                onClose={onClose}
                className="fixed inset-0 flex items-center justify-center z-50"
            >
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 dark:bg-black bg-opacity-50">
                        <Spinner />
                    </div>
                )}
                <div className="fixed inset-0 bg-[#1F2F41] bg-opacity-50" />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#FFFFFF] dark:bg-gray-900 dark:text-gray-300 rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.16)] dark:shadow-lg p-4 w-full max-w-xl relative h-[600px] flex flex-col"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-3 flex items-center justify-center p-[1px] rounded-md text-[#7C8FAE] dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors z-10"
                    >
                        <X size={20} />
                    </button>

                    <h2 className="text-xl font-semibold mb-3 text-[#0A2342] dark:text-[#FFFFFF] pl-1">
                        Add Metrics
                    </h2>

                    {/* Tab navigation */}
                    <div className="border-[1.25px] border-[#D1E2F0] dark:border-[#1F2F41] rounded-lg mb-3 p-1">
                        <div className="flex justify-around">
                            {Object.keys(metricsData).map((tabName) => (
                                <button
                                    key={tabName}
                                    onClick={() => setActiveTab(tabName)}
                                    className={`px-3 py-1.5 text-base font-medium focus:outline-none flex-1 border-b-[3px] ${
                                        activeTab === tabName
                                            ? 'border-[#24527A] dark:border-[#326AEB] text-[#073C6A] dark:text-[#326AEB]'
                                            : 'border-transparent text-[#64748B] dark:text-[#7691CA] hover:text-[#095190] dark:hover:text-[#8EA5D1]'
                                    }`}
                                >
                                    {tabName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 px-1">
                        {currentMetrics.map(({ name }) => (
                            <div
                                key={name}
                                className="flex items-center justify-between bg-[#F0F4F8] dark:bg-[#132234] p-1.5 rounded-lg"
                            >
                                <button
                                    onClick={() => toggleMetric(name)}
                                    className="flex items-center space-x-2.5 text-[#0A2342] dark:text-[#CED5E3]"
                                >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                        selectedMetrics[activeTab]?.[name] 
                                            ? 'border-[#066FD1] dark:border-[#066FD1] bg-[#066FD1] dark:bg-[#066FD1]' 
                                            : 'border-gray-400 dark:border-[#4A5568] bg-transparent'
                                    }`}>
                                        {selectedMetrics[activeTab]?.[name] && (
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="font-medium text-base whitespace-normal break-words">
                                        {name}
                                    </span>
                                </button>
                                <input
                                    type="number"
                                    value={
                                        selectedMetrics[activeTab]?.[name]
                                            ? metricValues[activeTab]?.[name] ?? 0
                                            : 0
                                    }
                                    onChange={(e) => handleInputChange(name, e.target.value)}
                                    className="bg-gray-100 dark:bg-[#182433] text-gray-900 dark:text-[#DCE1E2] rounded-md w-16 text-center border border-gray-300 dark:border-[#2A3A4E] focus:outline-none focus:ring-1 focus:ring-blue-500 text-base py-1.5"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex justify-center bg-[#DBECFF] dark:bg-[#182433] px-4 py-2 rounded-md border-[1.5px] border-dashed border-[#8ABDEB] dark:border-[#053563]">
                        <span className="text-[#24527A] dark:text-[#CED5E3] text-base">Total: {' '}</span>
                        <span className={`text-base font-semibold ml-1 ${currentTabTotalSum > 100 ? 'text-red-500' : 'text-[#24527A] dark:text-[#066FD1]'}`}>
                            {currentTabTotalSum} / 100
                        </span>
                    </div>

                    <div className="mt-3 flex justify-between gap-3">
                        <button
                            onClick={handleClear}
                            className="w-full py-2.5 rounded-md text-base font-semibold transition border border-[#24527A] dark:border-[#066FD1] bg-[#FFFFFF] dark:bg-[#132234] text-[#24527A] dark:text-[#066FD1] hover:opacity-80"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleApplyChanges}
                            disabled={currentTabTotalSum > 100}
                            className={`w-full py-2.5 rounded-md text-base font-semibold transition ${
                                currentTabTotalSum > 100
                                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    : 'bg-[#24527A] dark:bg-[#066FD1] text-white hover:opacity-90'
                            }`}
                        >
                            Apply
                        </button>
                    </div>
                </motion.div>
            </Dialog>
            <CustomAlertModal
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                message={alertMessage}
            />
        </>
    );
};

AddMetricsModal.propTypes = {
    metricsData: PropTypes.objectOf(
        PropTypes.arrayOf(
            PropTypes.shape({
                name: PropTypes.string.isRequired,
                percentage: PropTypes.number,
                value: PropTypes.number,
            })
        )
    ).isRequired,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onApply: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
};

export default AddMetricsModal;
