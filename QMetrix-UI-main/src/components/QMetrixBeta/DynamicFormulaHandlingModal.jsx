import { useState } from 'react';
import { useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Spinner from '../Common/Spinner';
import { updateWeightage } from '../../constants';
import PropTypes from 'prop-types';

const MetricsModal = ({ metricsData, isOpen, onClose, onApply, title }) => {
  const [loading, setLoading] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(
    metricsData.reduce((acc, metric) => ({ ...acc, [metric.name]: true }), {}),
  );

  useEffect(() => {
    setSelectedMetrics(
      metricsData.reduce((acc, metric) => ({ ...acc, [metric.name]: true }), {})
    );
    setMetricValues(
      metricsData.reduce((acc, metric) => ({ ...acc, [metric.name]: metric.percentage || 0 }), {})
    );
  }, [metricsData]);

  const [metricValues, setMetricValues] = useState(
    metricsData.reduce((acc, metric) => ({ ...acc, [metric.name]: metric.percentage || 0 }), {}),
  );
  const handleApplyChanges = async () => {
    const selectedMetricNames = Object.keys(selectedMetrics).filter(
      (name) => selectedMetrics[name],
    );
    const selectedMetricData = selectedMetricNames.map((name) => ({
      name,
      value: metricValues[name] || 0,
    }));

    setLoading(true);
    try {
      await updateWeightage(selectedMetricData, title);
      toast.success('Metrics contribution updated successfully!', {
        className: 'bg-secondary-500 text-gray-100',
      });

      onApply(selectedMetricNames);
    } catch (error) {
      toast.error('Failed to update metrics contribution.', {
        className: 'bg-red-500 text-gray-100',
      });
      console.error('Error updating metric contributions:', error);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const totalSum = Object.values(metricValues).reduce((sum, val) => sum + Number(val), 0);

  const toggleMetric = (name) => {
    setSelectedMetrics((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleInputChange = (name, value) => {
    let newValue = value.replace(/\D/g, '').replace(/^0+/, '');
    if (newValue === '') newValue = '0';

    const numValue = Number(newValue);
    const sumWithoutCurrent = totalSum - Number(metricValues[name]);

    if (sumWithoutCurrent + numValue > 100) {
      alert('Total sum cannot exceed 100!');
      return;
    }

    setMetricValues((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  const handleClear = () => {
    const clearedMetrics = {};
    const clearedValues = {};
    
    metricsData.forEach((metric) => {
      clearedMetrics[metric.name] = false;
      clearedValues[metric.name] = 0;
    });

    setSelectedMetrics(clearedMetrics);
    setMetricValues(clearedValues);
  };

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
            Select Metrics
          </h2>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 px-1">
            {metricsData.map(({ name }) => (
              <div
                key={name}
                className="flex items-center justify-between bg-[#F0F4F8] dark:bg-[#132234] p-1.5 rounded-lg"
              >
                <button
                  onClick={() => toggleMetric(name)}
                  className="flex items-center space-x-2.5 text-[#0A2342] dark:text-[#CED5E3]"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selectedMetrics[name] 
                        ? 'border-[#066FD1] dark:border-[#066FD1] bg-[#066FD1] dark:bg-[#066FD1]' 
                        : 'border-gray-400 dark:border-[#4A5568] bg-transparent'
                  }`}>
                    {selectedMetrics[name] && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium truncate max-w-[180px] sm:max-w-[220px] text-base">
                    {name}
                  </span>
                </button>
                <input
                  type="number"
                  value={metricValues[name]}
                  onChange={(e) => handleInputChange(name, e.target.value)}
                  className="bg-gray-100 dark:bg-[#182433] text-gray-900 dark:text-[#DCE1E2] rounded-md w-16 text-center border border-gray-300 dark:border-[#2A3A4E] focus:outline-none focus:ring-1 focus:ring-blue-500 text-base py-1.5"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-center bg-[#DBECFF] dark:bg-[#182433] px-4 py-2 rounded-md border-[1.5px] border-dashed border-[#8ABDEB] dark:border-[#053563]">
            <span className="text-[#24527A] dark:text-[#CED5E3] text-base">Total: {' '}</span>
            <span className={`text-base font-semibold ml-1 ${totalSum > 100 ? 'text-red-500' : 'text-[#24527A] dark:text-[#066FD1]'}`}>
              {totalSum} / 100
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
              disabled={totalSum > 100}
              className={`w-full py-2.5 rounded-md text-base font-semibold transition ${
                totalSum > 100
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-[#24527A] dark:bg-[#066FD1] text-white hover:opacity-90'
              }`}
            >
              Apply
            </button>
          </div>
        </motion.div>
      </Dialog>
    </>
  );
};

MetricsModal.propTypes = {
  metricsData: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      percentage: PropTypes.number,
      value: PropTypes.number,
    }),
  ).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};

export default MetricsModal;
