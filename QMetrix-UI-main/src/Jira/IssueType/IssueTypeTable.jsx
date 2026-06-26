import PropTypes from 'prop-types';
const TableComponent = ({ getTaskCountValue }) => {
  const issesTypes = getTaskCountValue.find((item) => item.openIssuesPerTeamMember)?.openIssuesPerTeamMember || [];
  const totalIssues = getTaskCountValue?.find((item) => item.getPriorityWise)||0;

  return (
    <div className="rounded-md flex flex-col justify-between py-4 dark:bg-[#182433] bg-[#ffffff] dark:text-container text-black custom-scrollbar overflow-x-auto overflow-y-auto max-h-[320px]">
      <h2 className="text-base font-semibold mb-4 dark:text-container text-black">
        Total Issues : {totalIssues.openIssues?.total}
      </h2>{' '}
      <table className="w-full max-w-4xl table-auto border-separate border-spacing-0">
        <thead className="text-sm font-semibold ">
          <tr>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600 ">
              Assignee
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Bugbib
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Task
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Story
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Epic
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Sub-task
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Others
            </th>
            <th className="py-2 px-4 border-b-0 text-left dark:border-neutral-400 border-neutral-600">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {issesTypes &&
            issesTypes.map((row, index) => {
              const totalCount = ['Bug', 'Task', 'Story', 'Epic', 'Sub-task'].reduce(
                (total, issueTypes) => {
                  const foundType = row.types.find((type) => type.name === issueTypes);
                  const count = foundType ? foundType.count : 0;
                  return total + count;
                },
                0,
              );
              return (
                <tr
                  key={index}
                  className="text-sm font-normal dark:hover:bg-neutral-700 hover:bg-neutral-100 "
                >
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left ">
                    {row.assignee}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {row.types.find((type) => type.name === 'Bug')?.count || 0}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {row.types.find((type) => type.name === 'Task')?.count || 0}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {row.types.find((type) => type.name === 'Story')?.count || 0}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {row.types.find((type) => type.name === 'Epic')?.count || 0}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {row.types.find((type) => type.name === 'Sub-task')?.count || 0}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {0}
                  </td>
                  <td className="py-2 px-4 border-t border-b-0 dark:border-neutral-400 border-neutral-600 text-left">
                    {totalCount}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};
TableComponent.propTypes = {
  getTaskCountValue: PropTypes.array.isRequired,
};
export default TableComponent;
