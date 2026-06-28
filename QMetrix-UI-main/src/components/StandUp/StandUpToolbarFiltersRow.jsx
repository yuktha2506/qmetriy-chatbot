import { memo } from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';
import DropdownButton from '../Common/DropDown';
import RepoCheckboxDropdown from '../Common/RepoCheckboxDropdown';
import DateRangePicker from '../Common/CustomDatePicker';
import { APP_STRINGS } from '../../constants';

function StandUpToolbarFiltersRow({
  getAllProjectList,
  projectBoardCount,
  handleProjectChange,
  handleProjectHover,
  handleProjectMouseLeave,
  selectedProjectDisplayName,
  isProjectOpen,
  setIsProjectOpen,
  projectRef,
  isBoardOpen,
  subMenuBoards,
  subMenuPosition,
  currentProjectForBoard,
  handleBoardChange,
  setIsBoardOpen,
  setSubMenuBoards,
  setCurrentProjectForBoard,
  repoList,
  handleRepoChange,
  selectedRepos,
  isRepoOpen,
  setIsRepoOpen,
  repoRef,
  sprintLabel,
  releaseLabel,
  handleValueChange,
  selectedValue,
  isValueOpen,
  setIsValueOpen,
  valueRef,
  getAllSprintList,
  handleSprintChange,
  selectedSprint,
  isSprintOpen,
  setIsSprintOpen,
  sprintRef,
  getAllReleaseList,
  handleReleaseChange,
  selectedRelease,
  handleDateChange,
  value1,
  theme,
  assigneeIsOpen,
  setAssigneeIsOpen,
  dropdownRef,
  selectedDeveloper,
  randomizeEnabled,
  toggleRandomize,
  searchTerm,
  setSearchTerm,
  displayedDevelopers,
  handleDeveloperSelect,
  handleTeamClick,
}) {
  return (
    <div className="flex space-x-2 flex-1 items-center pr-5 py-3">
      <div className="w-1/7 mt-1 relative">
        <DropdownButton
          buttonLabel="Select Project"
          options={getAllProjectList
            ?.filter((project) => project.isSelected && project.hideStatus === false)
            .map((project) => ({
              value: project._id,
              label: project.name,
              boardCount: projectBoardCount[project._id] || 0,
              hasMultipleBoards: (projectBoardCount[project._id] || 0) > 1,
            }))}
          onSelect={handleProjectChange}
          onOptionHover={handleProjectHover}
          onOptionMouseLeave={handleProjectMouseLeave}
          placeholder="Select Project"
          selectedOption={selectedProjectDisplayName}
          isOpen={isProjectOpen}
          setIsOpen={setIsProjectOpen}
          reference={projectRef}
          type="project"
          width="lg"
        />
      </div>

      {/* Board Sub-menu Overlay */}
      {isBoardOpen && subMenuBoards.length > 0 && (
        <div
          className="board-submenu fixed z-[9999] bg-white dark:bg-[#182433] rounded-lg shadow-lg border border-gray-200 dark:border-[#30445A] min-w-[200px]"
          style={{
            top: `${subMenuPosition.top}px`,
            left: `${subMenuPosition.left}px`,
          }}
          onMouseEnter={() => {}}
          onMouseLeave={() => {
            setTimeout(() => {
              const projectElement = document.querySelector(
                `[data-project-id="${currentProjectForBoard}"]`,
              );
              if (!projectElement || !projectElement.matches(':hover')) {
                setIsBoardOpen(false);
                setSubMenuBoards([]);
                setCurrentProjectForBoard(null);
              }
            }, 100);
          }}
        >
          <div className="py-2">
            {subMenuBoards.map((board, index) => (
              <div
                key={board.id || board._id || index}
                className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1E2B3A] transition-colors"
                onClick={() => {
                  handleBoardChange(board.id || board._id, currentProjectForBoard);
                }}
              >
                <span className="text-sm text-gray-700 dark:text-[#D9E4F1]">
                  {board.name || board.boardName} ({board.type || board.boardType})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-1 w-1/7 bg-[#182433] rounded ">
        <RepoCheckboxDropdown
          buttonLabel={APP_STRINGS.LABEL_SELECT_REPOSITORY}
          options={
            repoList?.map((project) => ({
              label: project,
              value: project,
            })) || []
          }
          onSelect={handleRepoChange}
          placeholder={APP_STRINGS.LABEL_SELECT_REPOSITORIES}
          selectedRepos={selectedRepos}
          isOpen={isRepoOpen}
          setIsOpen={setIsRepoOpen}
          reference={repoRef}
          width="md"
        />
      </div>
      <div className="mt-1">
        <DropdownButton
          options={[
            { value: APP_STRINGS.VALUE_SPRINT, label: sprintLabel },
            { value: APP_STRINGS.VALUE_DATE_RANGE, label: APP_STRINGS.VALUE_DATE_RANGE },
            { value: APP_STRINGS.VALUE_RELEASE, label: releaseLabel },
          ]}
          onSelect={handleValueChange}
          selectedOption={
            selectedValue?.value === APP_STRINGS.VALUE_SPRINT
              ? sprintLabel
              : selectedValue?.value === APP_STRINGS.VALUE_RELEASE
              ? releaseLabel
              : selectedValue?.value
          }
          isOpen={isValueOpen}
          setIsOpen={setIsValueOpen}
          reference={valueRef}
          width="sm"
        />
      </div>
      <div>
        {selectedValue.value === APP_STRINGS.VALUE_SPRINT && (
          <div className="w-1/7 mt-1">
            <DropdownButton
              buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${sprintLabel}`}
              options={getAllSprintList?.map((sprint) => ({
                value: sprint?._id,
                label: sprint?.name,
                state: sprint?.state,
              }))}
              onSelect={handleSprintChange}
              placeholder={APP_STRINGS.SELECT_AN_OPTION}
              selectedOption={selectedSprint?.name}
              isOpen={isSprintOpen}
              setIsOpen={setIsSprintOpen}
              reference={sprintRef}
              type={APP_STRINGS.API_SPRINT}
              width="lg"
            />
          </div>
        )}
        {selectedValue.value === APP_STRINGS.VALUE_RELEASE && (
          <div className="w-1/7 mt-1">
            <DropdownButton
              buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${releaseLabel}`}
              options={getAllReleaseList.map((sprint) => ({
                value: sprint?._id,
                label: sprint?.releaseName,
                status: sprint?.status,
              }))}
              onSelect={handleReleaseChange}
              placeholder={APP_STRINGS.LABEL_SELECT_RELEASE}
              selectedOption={selectedRelease.releaseName}
              isOpen={isSprintOpen}
              setIsOpen={setIsSprintOpen}
              reference={sprintRef}
              type={APP_STRINGS.API_RELEASE}
              width="lg"
            />
          </div>
        )}
        {selectedValue.value === APP_STRINGS.VALUE_DATE_RANGE && (
          <div className="mt-1">
            <DateRangePicker onChange={handleDateChange} value={value1} />
          </div>
        )}
      </div>

      <div className="flex-1 flex justify-end mt-1 ml-auto -mr-10">
        <div
          className={`flex items-center dark:bg-[#000000] bg-[#FCFBFB] rounded-full px-2 py-1 ${
            theme === 'light'
              ? `${
                  assigneeIsOpen
                    ? 'border border-[#7691CA] shadow-[0_0_4px_rgba(48,85,169,0.4)]'
                    : 'border border-[#A6C3DC] hover:border-[#A6C3DC]'
                }`
              : 'border border-[#066FD1]'
          } transition-all`}
          ref={dropdownRef}
        >
          <div className="relative">
            <button
              onClick={() => {
                const newState = !assigneeIsOpen;
                setAssigneeIsOpen(newState);
                if (newState) {
                  setSearchTerm('');
                }
              }}
              className={`flex items-center justify-between w-[180px] px-2 py-1 ${
                theme === 'light'
                  ? `${
                      selectedDeveloper
                        ? 'dark:bg-[#066FD1] bg-[#24527A] text-[#24527A]'
                        : 'bg-transparent text-[#24527A] hover:bg-[#F7F9FF]'
                    }`
                  : `text-[#D9E4F1] ${
                      selectedDeveloper ? 'bg-[#066FD1]' : 'bg-[#000000]'
                    }`
              } rounded-full transition-all`}
            >
              <span
                className={`truncate text-sm ${
                  theme === 'light' && selectedDeveloper ? 'text-[#FFFFFF]' : ''
                }`}
              >
                {selectedDeveloper ? selectedDeveloper : 'Select Developer'}
              </span>
              <svg
                className="w-2.5 h-2.5 ml-2"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 10 6"
                style={{
                  color: theme === 'light' ? 'rgba(63, 63, 63, 0.6)' : 'currentColor',
                }}
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 1 4 4 4-4"
                />
              </svg>
            </button>

            {assigneeIsOpen && (
              <div
                className={`absolute left-0 z-10 mt-2 w-full rounded-lg overflow-hidden max-h-60 shadow-[0_4px_16px_0_rgba(0,0,0,0.8)] ${
                  theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#182433]'
                }`}
              >
                <div
                  className={`border-b ${
                    theme === 'light'
                      ? 'bg-[#FFFFFF] border-[#E5E5E5]'
                      : 'bg-[#182433] border-[#1F2F41]'
                  }`}
                >
                  {/* Randomize Toggle */}
                  <div
                    className={`flex items-center justify-between p-1 ${
                      theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#182433]'
                    }`}
                  >
                    <button
                      onClick={toggleRandomize}
                      className={`relative inline-flex items-center h-5 rounded-full w-9 focus:outline-none border ${
                        theme === 'light' ? 'border-[#bfbfbf]' : 'border-[#000000]'
                      }`}
                    >
                      <span
                        className={`${
                          randomizeEnabled
                            ? 'bg-[#24527A]'
                            : theme === 'light'
                            ? 'bg-[#bfbfbf]'
                            : 'bg-[#2D3137]'
                        } absolute h-5 w-9 rounded-full transition-colors`}
                      ></span>
                      <span
                        className={`${
                          randomizeEnabled ? 'translate-x-5' : 'translate-x-1'
                        } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                      ></span>
                    </button>
                    <span
                      className={`text-sm ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-[#D9E4F1]'
                      }`}
                    >
                      Randomize
                    </span>
                  </div>
                  <div
                    className={`relative ${
                      theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#182433]'
                    }`}
                  >
                    <div className="absolute top-0 bottom-0 left-0 flex items-center justify-center w-6 pointer-events-none">
                      <Search
                        size={16}
                        className={
                          theme === 'light' ? 'text-[#24527A]' : 'text-[#CED5E3]'
                        }
                      />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search"
                      className={`w-full text-sm pr-3 focus:outline-none border-none ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-[#D9E4F199]'
                      }`}
                      style={{
                        textIndent: '1.75rem',
                        backgroundColor: theme === 'light' ? '#FFFFFF' : '#1e293b',
                      }}
                    />
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {displayedDevelopers.length > 0 ? (
                    displayedDevelopers?.map((developer, index) => (
                      <div
                        key={index}
                        className={`px-4 py-1 cursor-pointer transition-all ${
                          theme === 'light'
                            ? 'text-[#24527A] hover:bg-[#F7F9FF]'
                            : 'text-[#D9E4F1] hover:bg-[#1E2B3A]'
                        }`}
                        onClick={() => handleDeveloperSelect(developer)}
                      >
                        {developer}
                      </div>
                    ))
                  ) : (
                    <div
                      className={`px-4 py-2 text-sm text-center ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-white'
                      }`}
                    >
                      No developer found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleTeamClick}
            className={`ml-2 ${
              theme === 'light'
                ? `${
                    selectedDeveloper
                      ? 'bg-transparent text-[#24527A] hover:bg-[#F7F9FF]'
                      : 'dark:bg-[#066FD1] bg-[#24527A] text-[#FFFFFF]'
                  }`
                : `${
                    selectedDeveloper ? 'bg-[#000000]' : 'bg-[#066FD1]'
                  } text-[#D9E4F1]`
            } hover:bg-[#2563eb] text-sm px-2 py-1 rounded-full transition-all`}
          >
            Team
          </button>
        </div>
      </div>
    </div>
  );
}

StandUpToolbarFiltersRow.propTypes = {
  getAllProjectList: PropTypes.array,
  projectBoardCount: PropTypes.object,
  handleProjectChange: PropTypes.func.isRequired,
  handleProjectHover: PropTypes.func.isRequired,
  handleProjectMouseLeave: PropTypes.func.isRequired,
  selectedProjectDisplayName: PropTypes.string,
  isProjectOpen: PropTypes.bool.isRequired,
  setIsProjectOpen: PropTypes.func.isRequired,
  projectRef: PropTypes.object.isRequired,
  isBoardOpen: PropTypes.bool.isRequired,
  subMenuBoards: PropTypes.array.isRequired,
  subMenuPosition: PropTypes.shape({ top: PropTypes.number, left: PropTypes.number }).isRequired,
  currentProjectForBoard: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  handleBoardChange: PropTypes.func.isRequired,
  setIsBoardOpen: PropTypes.func.isRequired,
  setSubMenuBoards: PropTypes.func.isRequired,
  setCurrentProjectForBoard: PropTypes.func.isRequired,
  repoList: PropTypes.array,
  handleRepoChange: PropTypes.func.isRequired,
  selectedRepos: PropTypes.array,
  isRepoOpen: PropTypes.bool.isRequired,
  setIsRepoOpen: PropTypes.func.isRequired,
  repoRef: PropTypes.object.isRequired,
  sprintLabel: PropTypes.string.isRequired,
  releaseLabel: PropTypes.string.isRequired,
  handleValueChange: PropTypes.func.isRequired,
  selectedValue: PropTypes.object.isRequired,
  isValueOpen: PropTypes.bool.isRequired,
  setIsValueOpen: PropTypes.func.isRequired,
  valueRef: PropTypes.object.isRequired,
  getAllSprintList: PropTypes.array,
  handleSprintChange: PropTypes.func.isRequired,
  selectedSprint: PropTypes.object.isRequired,
  isSprintOpen: PropTypes.bool.isRequired,
  setIsSprintOpen: PropTypes.func.isRequired,
  sprintRef: PropTypes.object.isRequired,
  getAllReleaseList: PropTypes.array.isRequired,
  handleReleaseChange: PropTypes.func.isRequired,
  selectedRelease: PropTypes.object.isRequired,
  handleDateChange: PropTypes.func.isRequired,
  value1: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
  theme: PropTypes.string.isRequired,
  assigneeIsOpen: PropTypes.bool.isRequired,
  setAssigneeIsOpen: PropTypes.func.isRequired,
  dropdownRef: PropTypes.object.isRequired,
  selectedDeveloper: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.object]),
  randomizeEnabled: PropTypes.bool.isRequired,
  toggleRandomize: PropTypes.func.isRequired,
  searchTerm: PropTypes.string.isRequired,
  setSearchTerm: PropTypes.func.isRequired,
  displayedDevelopers: PropTypes.array.isRequired,
  handleDeveloperSelect: PropTypes.func.isRequired,
  handleTeamClick: PropTypes.func.isRequired,
};

export default memo(StandUpToolbarFiltersRow);
