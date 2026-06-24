import PropTypes from 'prop-types';

export default function NoDataPlaceholder({ height = 220, message = 'No data available for this view', subtext = 'Try selecting different filters or check back later' }) {
  return (
    <div className="flex items-center justify-center" style={{ height: `${height}px`, width: '100%' }}>
      <div className="text-center">
        <div className="text-gray-400 dark:text-gray-500 mb-3 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" className="w-10 h-10">
            <path d="M6.5 4.5C6.77614 4.5 7 4.27614 7 4C7 3.72386 6.77614 3.5 6.5 3.5C6.22386 3.5 6 3.72386 6 4C6 4.27614 6.22386 4.5 6.5 4.5Z" fill="currentColor" />
            <path d="M6.5 8.5C6.77614 8.5 7 8.27614 7 8C7 7.72386 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.72386 6 8C6 8.27614 6.22386 8.5 6.5 8.5Z" fill="currentColor" />
            <path d="M6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.7239 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.7239 6 12C6 12.2761 6.22386 12.5 6.5 12.5Z" fill="currentColor" />
            <path d="M12 1.5H2C1.73478 1.5 1.48043 1.60536 1.29289 1.79289C1.10536 1.98043 1 2.23478 1 2.5V13.5C1 13.7652 1.10536 14.0196 1.29289 14.2071C1.48043 14.3946 1.73478 14.5 2 14.5H9V13.5H2V10.5H13V2.5C13 2.23478 12.8946 1.98043 12.7071 1.79289C12.5196 1.60536 12.2652 1.5 12 1.5ZM12 9.5H2V6.5H12V9.5ZM12 5.5H2V2.5H12V5.5Z" fill="currentColor" />
            <path d="M12.9157 12.5312L11.5273 13.9196M11.5273 12.5312L12.9157 13.9196" stroke="currentColor" strokeWidth="0.79955" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.2214 15.4429C13.4483 15.4429 14.4429 14.4483 14.4429 13.2214C14.4429 11.9946 13.4483 11 12.2214 11C10.9946 11 10 11.9946 10 13.2214C10 14.4483 10.9946 15.4429 12.2214 15.4429Z" stroke="currentColor" strokeWidth="0.79955" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.9948 15.9987L13.8008 14.8047" stroke="currentColor" strokeWidth="0.79955" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{message}</p>
        {subtext && <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
NoDataPlaceholder.propTypes = {
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  message: PropTypes.string,
  subtext: PropTypes.string,
};

