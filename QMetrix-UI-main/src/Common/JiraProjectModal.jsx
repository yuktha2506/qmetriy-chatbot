import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Folder, Search, Eye, EyeOff, Trash2, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { updateHideProject, updateSelectedProject } from '../../constants';

const ModalTooltip = ({ content, position = 'top', children, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [tooltipRef, setTooltipRef] = useState(null);
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    if (isHovered && tooltipRef) {
      const updatePosition = () => {
        const rect = tooltipRef.getBoundingClientRect();
        let top = 0;
        let left = 0;
        
        if (position === 'top') {
          top = rect.top - 4;
          left = rect.left + rect.width / 2;
        } else if (position === 'bottom') {
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2;
        } else if (position === 'left') {
          top = rect.top + rect.height / 2;
          left = rect.left - 8;
        } else {
          top = rect.top + rect.height / 2;
          left = rect.right + 8;
        }
        
        setTooltipPosition({ top, left });
      };
      
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isHovered, tooltipRef, position]);

  if (disabled) {
    return children;
  }

  const getArrowStyle = () => {
    const baseStyle = {
      position: 'absolute',
      width: 0,
      height: 0,
    };
    
    if (position === 'top') {
      return {
        ...baseStyle,
        bottom: '-6px',
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `6px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
      };
    } else if (position === 'bottom') {
      return {
        ...baseStyle,
        top: '-6px',
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: `6px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
      };
    } else if (position === 'left') {
      return {
        ...baseStyle,
        right: '-6px',
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: '6px solid transparent',
        borderBottom: '6px solid transparent',
        borderLeft: `6px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
      };
    } else {
      return {
        ...baseStyle,
        left: '-6px',
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: '6px solid transparent',
        borderBottom: '6px solid transparent',
        borderRight: `6px solid ${theme === 'light' ? '#0D1621' : '#173A5A'}`,
      };
    }
  };

  const tooltipContent = isHovered && (
    <div
      className="fixed z-[9999] px-2 py-[8px] text-[11px] font-medium rounded-[6px] shadow-lg pointer-events-none"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        transform: position === 'top' 
          ? 'translate(-50%, calc(-100% - 6px))' 
          : position === 'bottom'
          ? 'translate(-50%, 6px)'
          : position === 'left'
          ? 'translate(calc(-100% - 6px), -50%)'
          : 'translate(6px, -50%)',
        backgroundColor: theme === 'light' ? '#0D1621' : '#173A5A',
        border: theme === 'light' ? 'none' : '1px solid #224F78',
        color: '#FFFFFF',
        maxWidth: '200px',
        lineHeight: '1.4',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        textAlign: 'center',
      }}
    >
      {content}
      <div style={getArrowStyle()} />
    </div>
  );

  return (
    <>
      <div
        ref={setTooltipRef}
        className="relative inline-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </div>
      {isHovered && typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
};

ModalTooltip.propTypes = {
  content: PropTypes.string.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
};

const JiraProjectModal = ({
  isOpen,
  onClose,
  onApply,
  jiraProjects,
  loading,
  onBackToIntegration,
  onProjectUpdate,
}) => {
  const [selectedProjects, setSelectedProjects] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingProject, setUpdatingProject] = useState(null);
  const [localJiraProjects, setLocalJiraProjects] = useState([]);

  useEffect(() => {
    setLocalJiraProjects(jiraProjects);
  }, [jiraProjects]);

  useEffect(() => {
    if (isOpen && localJiraProjects.length > 0) {
      const initialSelection = localJiraProjects.reduce((acc, project) => {
        acc[project.key] = project.isSelected || false;
        return acc;
      }, {});
      setSelectedProjects(initialSelection);
      setShowProjects(false);
      const timer = setTimeout(() => {
        setShowProjects(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, localJiraProjects]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredProjects = localJiraProjects.filter((project) => {
    const matchesSearch =
      searchQuery === '' ||
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.key.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesVisibility = true;
    if (showAllProjects === 'synced') {
      const anyHardSyncPassed = project.hardSyncStatus &&
        Object.values(project.hardSyncStatus).some(Boolean);

      matchesVisibility = project.isSelected === true &&
        project.syncStatus === true &&
        anyHardSyncPassed;
    } else if (showAllProjects === 'hidden') {
      matchesVisibility = project.hideStatus === true;
    } else if (showAllProjects === 'all') {
      matchesVisibility = project.hideStatus !== true;
    }

    return matchesSearch && matchesVisibility;
  });

  const toggleProject = (projectKey) => {
    const project = localJiraProjects.find((p) => p.key === projectKey);

    if (project?.isSelected && selectedProjects[projectKey]) {
      toast.info('This project is already integrated and cannot be deselected.', {
        className: 'bg-blue-500 text-gray-100',
      });
      return;
    }

    setSelectedProjects((prev) => ({
      ...prev,
      [projectKey]: !prev[projectKey],
    }));
  };

  const handleSelectAll = () => {
    const toggleableProjects = filteredProjects.filter((project) => !project.isSelected);
    const toggleableProjectKeys = toggleableProjects.map((project) => project.key);

    if (toggleableProjectKeys.length === 0) {
      toast.info('No projects available to select/deselect.', {
        className: 'bg-blue-500 text-gray-100',
      });
      return;
    }

    const toggleableSelectedProjects = toggleableProjectKeys.filter((key) => selectedProjects[key]);
    const allToggleableSelected =
      toggleableSelectedProjects.length === toggleableProjectKeys.length;

    const newSelection = { ...selectedProjects };
    toggleableProjectKeys.forEach((key) => {
      newSelection[key] = !allToggleableSelected;
    });

    setSelectedProjects(newSelection);
  };

  const handleToggleHideProject = async (project, event) => {
    event.stopPropagation(); 
    
    setUpdatingProject(project.key);

    try {
      const newHideStatus = !project.hideStatus;
      const projectId = project._id || project.id;
      await updateHideProject({
        projectId: projectId,
        hideStatus: newHideStatus,
      });

      setTimeout(() => {
      setLocalJiraProjects((prevProjects) =>
        prevProjects.map((p) =>
          p.key === project.key ? { ...p, hideStatus: newHideStatus } : p
        )
      );

      if (onProjectUpdate) {
        onProjectUpdate(projectId, { hideStatus: newHideStatus });
      }

      toast.success(
        `Project ${newHideStatus ? 'hidden' : 'shown'} successfully!`,
        {
          className: 'bg-green-500 text-gray-100',
        }
      );

      setUpdatingProject(null); // move inside timeout
    }, 500);
    } catch (error) {
      console.error('Error updating project visibility:', error);
      toast.error('Failed to update project visibility. Please try again.', {
        className: 'bg-red-500 text-gray-100',
      });
    } finally {
      setUpdatingProject(null);
    }
  };

  const handleApplySelection = async () => {
    const selectedProjectKeys = Object.keys(selectedProjects).filter(
      (key) => selectedProjects[key],
    );

    if (selectedProjectKeys.length === 0) {
      toast.error('Please select at least one project.', {
        className: 'bg-red-500 text-gray-100',
      });
      return;
    }

    const selectedProjectData = selectedProjectKeys.map((key) => {
      const project = localJiraProjects.find((p) => p.key === key);
      return {
        key: project.key,
        name: project.name,
        id: project.id || project._id,
      };
    });

    setSubmitting(true);
    try {
      const selectedProjectIds = selectedProjectData.map((p) => p.id);
      await updateSelectedProject(selectedProjectIds);
      await onApply(selectedProjectData);

      toast.success(`${selectedProjectKeys.length} project(s) selected successfully!`, {
        className: 'bg-green-500 text-gray-100',
      });
      onClose();
    } catch (error) {
      toast.error('Failed to save project selection.', {
        className: 'bg-red-500 text-gray-100',
      });
      console.error('Error saving project selection:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToIntegration = () => {
    onClose();
    if (onBackToIntegration) {
      onBackToIntegration();
    }
  };

  const selectedCount = Object.values(selectedProjects).filter(Boolean).length;
  const toggleableVisibleProjects = filteredProjects.filter((project) => !project.isSelected);
  const toggleableVisibleProjectKeys = toggleableVisibleProjects.map((project) => project.key);
  const toggleableSelectedProjects = toggleableVisibleProjectKeys.filter(
    (key) => selectedProjects[key],
  );
  const allToggleableSelected =
    toggleableVisibleProjectKeys.length > 0 &&
    toggleableSelectedProjects.length === toggleableVisibleProjectKeys.length;

  // const totalProjects = localJiraProjects.length;
  const alreadySelectedProjects = localJiraProjects.filter((p) => p.isSelected).length;
  const hiddenProjects = localJiraProjects.filter((p) => p.hideStatus === true).length;
  const nonHiddenProjects = localJiraProjects.filter((p) => p.hideStatus !== true).length;
  
  // Counts for summary badges
  const summarySelectedCount = Object.values(selectedProjects).filter(Boolean).length;
  const summaryIntegratedCount = alreadySelectedProjects;
  const summaryHiddenCount = hiddenProjects;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      {/* Overlay with 30% opacity black background - closes modal on click */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30" 
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#FFFFFF] dark:bg-[#090C12] rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.16)] dark:shadow-lg p-3 sm:p-4 w-full max-w-lg relative mx-4 my-4 flex flex-col z-10"
        style={{ height: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-3 flex items-center justify-center p-[1px] rounded-md text-[#7C8FAE] dark:text-[#A3B1C9] hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg text-[#0A2342] dark:text-[#FFFFFF] ml-3">
            Project Details
          </h2>
          <ModalTooltip
            content="Choose the Jira projects you want to integrate with your application."
            position="bottom"
          >
            <Info
              className="w-4 h-4 text-[#24527A] dark:text-[#A3B1C9] cursor-pointer"
              strokeWidth={2}
            />
          </ModalTooltip>
        </div>

        {localJiraProjects.length > 0 && showProjects && (
          <div className="flex mb-2 border border-[#D1E2F0] dark:border-[#1F2F41] rounded-md overflow-hidden" style={{ borderWidth: '1px' }}>
            <button
              onClick={() => setShowAllProjects('all')}
              className={`py-2 px-3 text-sm font-medium transition-colors relative flex-1 whitespace-nowrap ${
                showAllProjects === 'all'
                  ? 'text-[#073C6A] dark:text-[#326AEB]'
                  : 'text-[#64748B] dark:text-[#7691CA] hover:text-[#095190] dark:hover:text-[#A5BDF1]'
              }`}
            >
              All Projects ({nonHiddenProjects})
              {showAllProjects === 'all' && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-1 bg-[#24527A] dark:bg-[#326AEB] rounded-t" style={{ width: 'calc(100% - 16px)' }}></span>
              )}
            </button>
            <button
              onClick={() => setShowAllProjects('synced')}
              className={`py-1.5 px-3 text-sm font-medium transition-colors relative flex-1 whitespace-nowrap ${
                showAllProjects === 'synced'
                  ? 'text-[#073C6A] dark:text-[#326AEB]'
                  : 'text-[#64748B] dark:text-[#7691CA] hover:text-[#095190] dark:hover:text-[#A5BDF1]'
              }`}
            >
              Synced Projects ({localJiraProjects.filter((p) => {
                const anyHardSyncPassed = p.hardSyncStatus && Object.values(p.hardSyncStatus).some(Boolean);
                return p.isSelected === true && p.syncStatus === true && anyHardSyncPassed;
              }).length})
              {showAllProjects === 'synced' && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-1 bg-[#24527A] dark:bg-[#326AEB] rounded-t" style={{ width: 'calc(100% - 16px)' }}></span>
              )}
            </button>
            <button
              onClick={() => setShowAllProjects('hidden')}
              className={`py-1.5 px-3 text-sm font-medium transition-colors relative flex-1 whitespace-nowrap ${
                showAllProjects === 'hidden'
                  ? 'text-[#073C6A] dark:text-[#326AEB]'
                  : 'text-[#64748B] dark:text-[#7691CA] hover:text-[#095190] dark:hover:text-[#A5BDF1]'
              }`}
            >
              Hidden Projects ({hiddenProjects})
              {showAllProjects === 'hidden' && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-1 bg-[#24527A] dark:bg-[#326AEB] rounded-t" style={{ width: 'calc(100% - 16px)' }}></span>
              )}
            </button>
          </div>
        )}

        {showAllProjects === 'all' && localJiraProjects.length > 0 && showProjects && (
          <>
            <div className="flex items-center justify-between px-3 py-1 mb-1 bg-[#DBECFF] dark:bg-[#0B2C48] rounded-md border-2 border-dashed border-[#8ABDEB] dark:border-[#073C6A]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#24527A] dark:text-[#7EA6CA]">Selected</span>
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#0072BB] dark:bg-[#7EA6CA] text-[#FFFFFF] dark:text-[#000C1A] text-xs font-semibold">
                  {summarySelectedCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#24527A] dark:text-[#7EA6CA]">Integrated</span>
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#0072BB] dark:bg-[#7EA6CA] text-[#FFFFFF] dark:text-[#000C1A] text-xs font-semibold">
                  {summaryIntegratedCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#24527A] dark:text-[#7EA6CA]">Hidden</span>
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#0072BB] dark:bg-[#7EA6CA] text-[#FFFFFF] dark:text-[#000C1A] text-xs font-semibold">
                  {summaryHiddenCount}
                </span>
              </div>
            </div>

            <div className="relative mb-2 mt-1">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#0A2342] dark:text-[#DCE1E7]" />
              </div>
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 py-2 border border-[#D1E2F0] dark:border-[#073C6A] rounded-md bg-white dark:bg-[#0D1421] text-[#0A2342] dark:text-[#DCE1E7] placeholder-[#0A2342] dark:placeholder-[#DCE1E7] focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                style={{ paddingLeft: '36px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="mb-1.5">
              <button
                onClick={handleSelectAll}
                disabled={toggleableVisibleProjectKeys.length === 0}
                className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 w-full ${
                  toggleableVisibleProjectKeys.length === 0
                    ? 'cursor-not-allowed bg-[#F0F4F8] dark:bg-[#132234]'
                    : 'cursor-pointer bg-[#F0F4F8] dark:bg-[#132234] hover:bg-[#EDF6FF] dark:hover:bg-[#1C2B3E]'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-all flex-shrink-0 ${
                    allToggleableSelected
                      ? 'border-2 border-[#066FD1] dark:border-0 bg-[#066FD1] dark:bg-[#326AEB]'
                      : 'border-2 border-gray-400 dark:border-[#4A5568] bg-transparent'
                  }`}>
                    {allToggleableSelected && (
                      <svg className="w-3.5 h-3.5 text-white dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-sm text-[#0A2342] dark:text-gray-100">
                    {allToggleableSelected ? 'Deselect All' : 'Select All'}
                  </span>
                </div>
              </button>
            </div>
          </>
        )}

        {showAllProjects === 'synced' && localJiraProjects.length > 0 && showProjects && (
          <div className="mb-2 p-3 bg-[#E3FFEE] dark:bg-[#122428] border-2 border-dashed border-[#A6E3BD] dark:border-[#166534] rounded-lg">
            <p className="text-[#2AA558] dark:text-[#64CC8B] text-sm flex items-start gap-2">
              <ModalTooltip content="These projects are already integrated & synced with your application." position="top">
                <Info className="w-4 h-4 text-[#64CC8B] dark:text-[#64CC8B] flex-shrink-0 mt-0.5" />
              </ModalTooltip>
              <span>These projects are already integrated & synced with your application.</span>
            </p>
          </div>
        )}

        {showAllProjects === 'hidden' && localJiraProjects.length > 0 && showProjects && (
          <div className="mb-2 p-3 bg-[#E3FFEE] dark:bg-[#122428] border-2 border-dashed border-[#A6E3BD] dark:border-[#166534] rounded-lg">
            <p className="text-[#2AA558] dark:text-[#64CC8B] text-sm flex items-start gap-2">
              <ModalTooltip content="These projects are hidden from the main view. Click the eye icon to unhide them." position="top">
                <Info className="w-4 h-4 text-[#64CC8B] dark:text-[#64CC8B] flex-shrink-0 mt-0.5" />
              </ModalTooltip>
              <span>These projects are hidden from the main view. Click the eye icon to unhide them.</span>
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
          {loading || !showProjects ? (
            <div className="flex justify-center items-center h-full py-2">
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className={`w-6 h-6 dark:text-container text-[#0A2342] ${
                    loading ? '' : 'animate-spin'
                  }`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <span className="text-[#0A2342] dark:text-gray-400 mt-2">
                  {loading ? 'Fetching projects...' : 'Loading projects...'}
                </span>
              </div>
            </div>
          ) : localJiraProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Folder size={48} className="mx-auto mb-3 opacity-50" />
              <p>No projects found in your Jira instance.</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Search size={48} className="mx-auto mb-3 opacity-50" />
              <p>No projects match your search criteria.</p>
              <p className="text-sm mt-1">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isAlreadySelected = project.isSelected;
              const isCurrentlySelected = selectedProjects[project.key];
              const isClickable =
                showAllProjects !== 'hidden' && showAllProjects !== 'synced' && !isAlreadySelected;
              const isHidden = project.hideStatus === true;

              return (
                <div
                  key={project.key}
                  className={`flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 ${
                    showAllProjects === 'synced' || showAllProjects === 'hidden'
                      ? 'cursor-default'
                      : isClickable
                      ? 'cursor-pointer'
                      : 'cursor-default'
                  } ${
                    showAllProjects === 'synced' || showAllProjects === 'hidden'
                      ? 'bg-[#F0F4F8] dark:bg-[#132234]'
                      : isAlreadySelected
                      ? 'bg-[#E4E4E4] dark:bg-[#2d3239]'
                      : isCurrentlySelected
                      ? 'bg-[#D1E2F0] dark:bg-[#22344B]'
                      : 'bg-[#F0F4F8] dark:bg-[#132234] hover:bg-[#EDF6FF] dark:hover:bg-[#1C2B3E]'
                  }`}
                  onClick={isClickable ? () => toggleProject(project.key) : undefined}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {showAllProjects !== 'hidden' && showAllProjects !== 'synced' && (
                      <div
                        onClick={(e) => {
                          if (isClickable) {
                            e.stopPropagation();
                            toggleProject(project.key);
                          }
                        }}
                        className="flex-shrink-0"
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                          isAlreadySelected || isCurrentlySelected
                            ? isAlreadySelected
                              ? 'border-2 border-[#969696] dark:border-[#6B6B6B] bg-[#ABABAB] dark:bg-[#606060]'
                              : 'border-2 border-[#066FD1] dark:border-0 bg-[#066FD1] dark:bg-[#326AEB]'
                            : 'border-2 border-gray-400 dark:border-[#4A5568] bg-transparent'
                        }`}>
                          {(isAlreadySelected || isCurrentlySelected) && (
                            <svg className={`w-3.5 h-3.5 ${isAlreadySelected ? 'text-white dark:text-[#9F9F9F]' : 'text-white dark:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#0A2342] dark:text-gray-100 truncate text-sm leading-5">
                        {project.name}
                      </div>
                      <div className="text-xs text-[#24527A] dark:text-gray-400 truncate mt-0.5 leading-4">
                        {project.key}
                        {showAllProjects === 'synced' && ' • Already Integrated • Synced'}
                        {showAllProjects === 'hidden' && isAlreadySelected && ' • Already Integrated • Synced'}
                        {showAllProjects === 'all' && isAlreadySelected && ' • Already Integrated'}
                        {showAllProjects === 'all' && isHidden && ' • Hidden'}
                        {showAllProjects === 'all' && isCurrentlySelected && !isAlreadySelected && ' • Selected'}
                      </div>
                    </div>

                    {showAllProjects === 'synced' ? null : showAllProjects === 'hidden' ? (
                      <div className="flex items-center flex-shrink-0 ml-2">
                        <ModalTooltip content="Show Project" position="top">
                          <button
                            onClick={(e) => handleToggleHideProject(project, e)}
                            disabled={updatingProject === project.key}
                            className="flex items-center justify-center p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            {updatingProject === project.key ? (
                              <div className="w-5 h-5 border-2 border-gray-400 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                              <Eye className="w-5 h-5 text-[#0072BB] dark:text-[#0EA5E9]" />
                            )}
                          </button>
                        </ModalTooltip>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                        <ModalTooltip content={isHidden ? 'Show Project' : 'Hide Project'} position="top">
                          <button
                            onClick={(e) => handleToggleHideProject(project, e)}
                            disabled={updatingProject === project.key}
                            className="flex items-center justify-center p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            {updatingProject === project.key ? (
                              <div className="w-5 h-5 border-2 border-gray-400 border-t-blue-600 rounded-full animate-spin" />
                            ) : isHidden ? (
                              <Eye className="w-5 h-5 text-[#0072BB] dark:text-[#0EA5E9]" />
                            ) : (
                              <EyeOff className="w-5 h-5 text-[#0072BB] dark:text-[#0EA5E9]" />
                            )}
                          </button>
                        </ModalTooltip>
                        <ModalTooltip content="Delete Project" position="top">
                          <button
                            className="flex items-center justify-center p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-5 h-5 text-[#E91515] dark:text-[#E91515]" />
                          </button>
                        </ModalTooltip>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className={`flex space-x-3 mt-2 ${showAllProjects === 'hidden' || showAllProjects === 'synced' ? 'justify-center' : ''}`}>
          <button
            onClick={handleBackToIntegration}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-opacity ${
              showAllProjects === 'hidden' || showAllProjects === 'synced'
                ? 'w-1/2 bg-[#24527A] dark:bg-[#326AEB] text-white hover:opacity-90'
                : 'flex-1 border border-[#24527A] dark:border-[#6291FF] bg-[#FFFFFF] dark:bg-[#132234] text-[#24527A] dark:text-[#6291FF] hover:opacity-80'
            }`}
          >
            Back To Integration
          </button>
          {showAllProjects === 'all' && (
            <button
              onClick={handleApplySelection}
              disabled={selectedCount === 0 || submitting || !showProjects}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition ${
                selectedCount === 0 || !showProjects
                  ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-[#24527A] dark:bg-[#326AEB] text-white hover:opacity-90'
              }`}
            >
              {submitting ? 'Saving...' : `Select Project${selectedCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </motion.div>
    </Dialog>
  );
};

JiraProjectModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  jiraProjects: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      projectTypeKey: PropTypes.string,
      hideStatus: PropTypes.bool,
      isSelected: PropTypes.bool,
    }),
  ).isRequired,
  loading: PropTypes.bool,
  onBackToIntegration: PropTypes.func,
  onProjectUpdate: PropTypes.func,
};

JiraProjectModal.defaultProps = {
  loading: false,
};

export default JiraProjectModal;
