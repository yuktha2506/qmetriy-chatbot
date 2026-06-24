import { useEffect, useState } from 'react';

const SprintProgressCard = () => {
  const [daysLeft, setDaysLeft] = useState(13);
  const [isMoreDetailsVisible, setMoreDetailsVisible] = useState(false);

  const toggleMoreDetails = () => {
    setMoreDetailsVisible(!isMoreDetailsVisible);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setDaysLeft((prevDaysLeft) => prevDaysLeft - 1);
    }, 86400000); 
  
    return () => clearInterval(interval);
  }, []);
  

  return (
    <div className="max-w-sm w-full p-4 md:p-6 mb-0">

      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
        <div className="grid grid-cols-3 gap-3 mb-2">
          <dl className="bg-orange-50 dark:bg-gray-600 rounded-lg flex flex-col items-center justify-center h-[78px]">
            <dt className="w-8 h-8 rounded-full bg-orange-100 dark:bg-gray-500 text-orange-600 dark:text-orange-300 text-sm font-medium flex items-center justify-center mb-1">12</dt>
            <dd className="text-orange-600 dark:text-orange-300 text-sm font-medium">PR with Conflicts</dd>
          </dl>
          <dl className="bg-teal-50 dark:bg-gray-600 rounded-lg flex flex-col items-center justify-center h-[78px]">
            <dt className="w-8 h-8 rounded-full bg-teal-100 dark:bg-gray-500 text-teal-600 dark:text-teal-300 text-sm font-medium flex items-center justify-center mb-1">23</dt>
            <dd className="text-teal-600 dark:text-teal-300 text-sm font-medium">In progress PR</dd>
          </dl>
          <dl className="bg-blue-50 dark:bg-gray-600 rounded-lg flex flex-col items-center justify-center h-[78px]">
            <dt className="w-8 h-8 rounded-full bg-blue-100 dark:bg-gray-500 text-blue-600 dark:text-blue-300 text-sm font-medium flex items-center justify-center mb-1">64</dt>
            <dd className="text-blue-600 dark:text-blue-300 text-sm font-medium">PR Rejected</dd>
          </dl>
        </div>

        <button onClick={toggleMoreDetails} className="hover:underline text-xs text-gray-500 dark:text-gray-400 font-medium inline-flex items-center">
          Show more details <svg className="w-2 h-2 ms-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/>
          </svg>
        </button>

        {isMoreDetailsVisible && (
          <div className="border-gray-200 border-t dark:border-gray-600 pt-3 mt-3 space-y-2">
            <dl className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400 text-sm font-normal">Average task completion rate:</dt>
              <dd className="bg-green-100 text-green-800 text-xs font-medium inline-flex items-center px-2.5 py-1 rounded-md dark:bg-green-900 dark:text-green-300">
                <svg className="w-2.5 h-2.5 me-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 14">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13V1m0 0L1 5m4-4 4 4"/>
                </svg> 57%
              </dd>
            </dl>
            <dl className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400 text-sm font-normal">Days until sprint ends:</dt>
              <dd className="bg-gray-100 text-gray-800 text-xs font-medium inline-flex items-center px-2.5 py-1 rounded-md dark:bg-gray-600 dark:text-gray-300">{daysLeft} days</dd>
            </dl>
            <dl className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400 text-sm font-normal">Next Release:</dt>
              <dd className="bg-gray-100 text-gray-800 text-xs font-medium inline-flex items-center px-2.5 py-1 rounded-md dark:bg-gray-600 dark:text-gray-300">Thursday</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};

export default SprintProgressCard;
