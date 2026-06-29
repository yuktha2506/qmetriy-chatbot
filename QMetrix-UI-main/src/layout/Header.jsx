import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import Tooltip from '../components/Common/ToolTip';
import { useEffect, useState, useRef } from 'react';
import '../assets/css/tailwind.css';
import '../assets/css/animations.scss';
import { setTheme } from '../store/theme/themeSlice';
import { useDispatch, useSelector } from 'react-redux';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axiosInstance from '../axiosInstance';
import { useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { getId, APP_STRINGS } from '../constants';
import { reset as resetGit } from '../store/GitSlices/gitSlices';
import { bumpRefreshToken, reset as resetJira, setLastSyncedForProject } from '../store/JiraSlices/jiraSlice';
import { reset as resetCXO } from '../store/CXOSlices/cxoSlice';
import store from '../store/store';
import Modal from '../components/Common/Modal';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronUp, User, Settings, HelpCircle, LogOut } from 'lucide-react';
import userImage from '../assets/images/profileBlue.jpg';

function Header() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const currentTheme = useSelector((state) => state.theme.theme);
  const lastSyncedByProjectId = useSelector((state) => state.jira?.lastSyncedByProjectId || {});
  const isLoading = useIsMutating({ mutationKey: ['sync'] }) > 0;
  const [syncMessage, setSyncMessage] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [userData, setUserData] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncFailedMessage, setFailedSyncMessage] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [companyId, setCompanyId] = useState(getId().companyId);
  const [projectId, setProjectId] = useState(getId().projectId);
  const dropdownRef = useRef(null);
  const lastSyncedFetchRef = useRef({});
  const [activeSync, setActiveSync] = useState(null);

  useEffect(() => {
    const storedActiveSync = sessionStorage.getItem('activeSync');
    if (storedActiveSync) {
      setActiveSync(storedActiveSync);
    }
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useSelector((state) => state.login);
  const jiraData = useSelector((state) => state.jira);

  const selectedValue = jiraData?.selectedValue;
  const sprintList = jiraData?.sprintList;
  const selectedSprintId = jiraData?.selectedSprintId;
  const isOnStandUpWithSprint =
    location.pathname === '/standUp' &&
    (selectedValue === APP_STRINGS.VALUE_SPRINT || selectedValue?.value === APP_STRINGS.VALUE_SPRINT);
  const selectedSprint = isOnStandUpWithSprint && sprintList?.length && selectedSprintId
    ? sprintList.find((s) => s._id === selectedSprintId)
    : null;
  const isClosedSprint = (() => {
    if (!selectedSprint?.state) return false;
    const state = String(selectedSprint.state).toLowerCase();
    return state === 'closed' || state === 'done' || state === 'completed';
  })();
  const isSyncDisabledForClosedSprint = isOnStandUpWithSprint && !!selectedSprint && isClosedSprint;

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'companyId') {
        const newCompanyId = e.newValue;
        if (newCompanyId && newCompanyId !== companyId) {
          setCompanyId(newCompanyId);
          setProjectId(null);
                }
      } else if (e.key === 'projectId') {
        const newProjectId = e.newValue;
        if (newProjectId && newProjectId !== projectId) {
          setProjectId(newProjectId);
          const currentCompanyId = getId().companyId;
          if (newProjectId) {
            if (!lastSyncedFetchRef.current?.[newProjectId]) {
              lastSyncedFetchRef.current[newProjectId] = true;
              getTimeStamp({ companyId: currentCompanyId, projectId: newProjectId });
            }
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [companyId, projectId]);

  useEffect(() => {
    const checkIdChanges = () => {
      const currentCompanyId = getId().companyId;
      const currentProjectId = getId().projectId;
      
      if (currentCompanyId !== companyId) {
        setCompanyId(currentCompanyId);
        setProjectId(null);   
      } else if (currentProjectId !== projectId) {
        setProjectId(currentProjectId);
        if (currentProjectId) {
          if (!lastSyncedFetchRef.current?.[currentProjectId]) {
            lastSyncedFetchRef.current[currentProjectId] = true;
            getTimeStamp({ companyId: currentCompanyId, projectId: currentProjectId });
          }
        }
      }
    };

    const interval = setInterval(checkIdChanges, 200); 
    return () => clearInterval(interval);
  }, [companyId, projectId]);

  useEffect(() => {
    const storedUserData = sessionStorage.getItem('userData');
    if (storedUserData) {
      setUserData(JSON.parse(storedUserData));
    }
    if (data?.data) {
      const userInfo = {
        name: data.data.name,
        email: data.data.email,
      };
      sessionStorage.setItem('userData', JSON.stringify(userInfo));
      setUserData(userInfo);
    }
  }, [data?.data]);

  useEffect(() => {
    const currentCompanyId = getId().companyId;
    const currentProjectId = getId().projectId;    
    if (currentCompanyId && currentProjectId) {
      const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
      const timeKey = `lastSyncTime_${currentCompanyId}_${currentProjectId}`;  
      const storedSyncStatus = sessionStorage.getItem(syncKey);
      const storedLastSyncTime = sessionStorage.getItem(timeKey);
      if (storedSyncStatus === 'success' && storedLastSyncTime) {
        setSyncMessage('');
        setLastSyncTime(storedLastSyncTime);
      } else if (storedSyncStatus === 'failed') {
        setSyncMessage('');
        setLastSyncTime('');
      }
    } else {
      setSyncMessage('');
      setLastSyncTime('');
      setSyncStatus(null);
    }
  }, [projectId, companyId]);

  useEffect(() => {
    if (!projectId) {
      setSyncMessage('');
      setLastSyncTime('');
      setSyncStatus(null);
      setFailedSyncMessage('');
    }
  }, [projectId]);

  const syncJira = async ({ companyId, failedOnly = false }) => {
    const endpoint = failedOnly
      ? `/api/company/syncCompanyData/${companyId}?failedOnly=true`
      : `/api/company/syncCompanyData/${companyId}`;
    const response = await axiosInstance.get(endpoint);
    if (response.status !== 201) {
      throw new Error('Sync failed');
    } else {
      const currentProjectId = getId().projectId;
      setProjectId(currentProjectId);
      if (currentProjectId) {
        getTimeStamp({ companyId, projectId: currentProjectId });
      }
    }
  };

  const syncCurrentProject = async ({ companyId, projectId }) => {
    const endpoint = `/api/company/syncCompanyData/${companyId}?projectId=${projectId}`;
    const response = await axiosInstance.get(endpoint);
    if (response.status !== 201) {
      throw new Error('Sync failed');
    } else {
      getTimeStamp({ companyId, projectId });
    }
  };

  useEffect(() => {
    setFailedSyncMessage(syncStatus === false ? 'Sync failed, please try again' : '');
  }, [syncStatus]);

  const { mutate: getTimeStamp } = useMutation({
    mutationFn: async ({ companyId, projectId }) => {
      const response = await axiosInstance.get(`/api/jira/getLastSynced/${companyId}/${projectId}`);
      return response;
    },

    onSuccess: (response, variables) => {
      const projectKey = variables?.projectId;
      if (projectKey && lastSyncedFetchRef.current?.[projectKey]) {
        delete lastSyncedFetchRef.current[projectKey];
      }
      if (response.status === 200) {
        const lastSynced = response.data.lastSynced || '';
        const syncStatus = response.data.syncStatus;
        setLastSyncTime(lastSynced);
        setSyncStatus(syncStatus);
        if (projectId) {
          dispatch(setLastSyncedForProject({ projectId, lastSynced, syncStatus }));
        }
        if (syncStatus === true) {
          dispatch(bumpRefreshToken());
        }
        const currentCompanyId = getId().companyId;
        const currentProjectId = getId().projectId;
        if (currentCompanyId && currentProjectId) {
          const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
          const timeKey = `lastSyncTime_${currentCompanyId}_${currentProjectId}`;
          sessionStorage.setItem(timeKey, lastSynced);
          sessionStorage.setItem(syncKey, syncStatus ? 'success' : 'failed');
        }
      } else {
        setTimeout(() => {
          navigate('/auth/login');
        }, 2000);
      }
    },
    onError: (error, variables) => {
      const projectKey = variables?.projectId;
      if (projectKey && lastSyncedFetchRef.current?.[projectKey]) {
        delete lastSyncedFetchRef.current[projectKey];
      }
      const currentCompanyId = getId().companyId;
      const currentProjectId = getId().projectId;
      if (currentCompanyId && currentProjectId) {
        const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
        sessionStorage.setItem(syncKey, 'failed');
      }
      setSyncStatus(false);
    },
  });

  useEffect(() => {
    if (companyId && projectId) {
      const cachedFromStore = lastSyncedByProjectId?.[projectId];
      if (cachedFromStore) {
        if (cachedFromStore.lastSynced != null) {
          setLastSyncTime(cachedFromStore.lastSynced);
        }
        if (cachedFromStore.syncStatus != null) {
          setSyncStatus(cachedFromStore.syncStatus);
        }
        return;
      }
      const syncKey = `syncStatus_${companyId}_${projectId}`;
      const timeKey = `lastSyncTime_${companyId}_${projectId}`;
      const cachedStatus = sessionStorage.getItem(syncKey);
      const cachedTime = sessionStorage.getItem(timeKey);
      if (cachedStatus && cachedTime) {
        setLastSyncTime(cachedTime);
        setSyncStatus(cachedStatus === 'success');
      } else {
        if (!lastSyncedFetchRef.current?.[projectId]) {
          lastSyncedFetchRef.current[projectId] = true;
          getTimeStamp({ companyId, projectId });
        }
      }
    }
  }, [getTimeStamp, companyId, projectId, lastSyncedByProjectId]);

  useEffect(() => {
    const storedUserData = sessionStorage.getItem('userData');
    if (storedUserData) {
      setUserData(JSON.parse(storedUserData));
    }
    if (data?.data) {
      const userInfo = {
        name: data.data.name,
        email: data.data.email,
      };
      sessionStorage.setItem('userData', JSON.stringify(userInfo));
      setUserData(userInfo);
    }
  }, [data?.data]);

  const handleLogout = () => {
    sessionStorage.removeItem('companyId');
    sessionStorage.removeItem('sprintId');
    sessionStorage.removeItem('projectId');
    sessionStorage.removeItem('releaseId');
    sessionStorage.removeItem('qmetrix-token');
    sessionStorage.removeItem('projectKeyId');
    sessionStorage.removeItem('companyName');
    sessionStorage.removeItem('projectName');
    sessionStorage.removeItem('repo');
    sessionStorage.removeItem('sprintEndDate');
    sessionStorage.removeItem('releaseDate');
    sessionStorage.removeItem('sprintName');
    sessionStorage.removeItem('releaseName');
    sessionStorage.removeItem('typeValue');
    sessionStorage.removeItem('typeValueLabel');
    sessionStorage.removeItem('developer');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('velocityToggleType');
    sessionStorage.removeItem('velocityToggleTypeManual');
    sessionStorage.removeItem('releaseDashboardActiveTab');
    store.dispatch(resetGit());
    store.dispatch(resetJira());
    store.dispatch(resetCXO());
    setUserData(null);
    navigate('/');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mutateAsync = useMutation({
    mutationKey: ['sync'],
    mutationFn: syncJira,
    onSuccess: () => {
      queryClient.invalidateQueries(['syncJira']);
      sessionStorage.removeItem('activeSync');
      setActiveSync(null);

      if (syncStatus === false) {
        const currentCompanyId = getId().companyId;
        const currentProjectId = getId().projectId;
        if (currentCompanyId && currentProjectId) {
          const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
          sessionStorage.setItem(syncKey, 'failed');
        }
        setSyncMessage('');
      } else {
        toast.success('Projects synced successfully', {
          className: 'bg-secondary-500 text-white',
        });
        setSyncMessage('');
      }
    },
    onError: (error) => {
      toast.error(error.message);
      setSyncMessage('');
      setSyncStatus(false);
      sessionStorage.removeItem('activeSync');
      setActiveSync(null);
    },
    onSettled: () => {
      dispatch(bumpRefreshToken());
    },
  });

  const mutateCurrentProjectAsync = useMutation({
    mutationKey: ['sync'],
    mutationFn: syncCurrentProject,
    onSuccess: () => {
      queryClient.invalidateQueries(['syncCurrentProject']);
      sessionStorage.removeItem('activeSync');
      setActiveSync(null);
      if (syncStatus === false) {
        const currentCompanyId = getId().companyId;
        const currentProjectId = getId().projectId;
        if (currentCompanyId && currentProjectId) {
          const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
          sessionStorage.setItem(syncKey, 'failed');
        }
        setSyncMessage('');
      } else {
        toast.success('Current project synced successfully', {
          className: 'bg-secondary-500 text-white',
        });
        setSyncMessage('');
      }
    },
    onError: (error) => {
      toast.error(error.message);
      setSyncMessage('');
      setSyncStatus(false);
      sessionStorage.removeItem('activeSync');
      setActiveSync(null);
    },
    onSettled: () => {
      dispatch(bumpRefreshToken());
    },
  });

  const handleSyncData = async () => {
    setActiveSync('all');
    sessionStorage.setItem('activeSync', 'all');
    setSyncMessage('Sync in progress');
    try {
      const companyId = getId().companyId;
      mutateAsync.mutate({ companyId, failedOnly: false });
    } catch (error) {
      setSyncMessage('');
      const currentCompanyId = getId().companyId;
      const currentProjectId = getId().projectId;
      if (currentCompanyId && currentProjectId) {
        const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
        sessionStorage.setItem(syncKey, 'failed');
      }
      sessionStorage.removeItem('activeSync');
    }
  };

  const handleFailedSyncData = async () => {
    setActiveSync('failed');
    sessionStorage.setItem('activeSync', 'failed');
    setSyncMessage('Sync in progress');
    try {
      const companyId = getId().companyId;
      mutateAsync.mutate({ companyId, failedOnly: true });
    } catch (error) {
      setSyncMessage('');
      const currentCompanyId = getId().companyId;
      const currentProjectId = getId().projectId;
      if (currentCompanyId && currentProjectId) {
        const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
        sessionStorage.setItem(syncKey, 'failed');
      }
      sessionStorage.removeItem('activeSync');
    }
  };

  const handleSyncCurrentProject = async () => {
    const companyId = getId().companyId;
    const projectId = getId().projectId;
        if (!projectId) {
      setSyncMessage('Please select a project first');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }
    setActiveSync('current');
    sessionStorage.setItem('activeSync', 'current');
    setSyncMessage('Sync in progress');
    try {
      mutateCurrentProjectAsync.mutate({ companyId, projectId });
    } catch (error) {
      setSyncMessage('');
      const currentCompanyId = getId().companyId;
      const currentProjectId = getId().projectId;
      if (currentCompanyId && currentProjectId) {
        const syncKey = `syncStatus_${currentCompanyId}_${currentProjectId}`;
        sessionStorage.setItem(syncKey, 'failed');
      }
      sessionStorage.removeItem('activeSync');
    }
  };

  const isSyncEnabled = () => {
    if (projectId) {
      return true;
    }
    return true;
  };

  const canSync = isSyncEnabled() && !isSyncDisabledForClosedSprint;

  const toggleTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleThemeChange = (newTheme) => {
  if (userData?.email) {
    localStorage.setItem(`theme_${userData.email}`, newTheme);
  }
  dispatch(setTheme(newTheme));
  toggleTheme(newTheme);
};

  useEffect(() => {
  if (userData?.email) {
    const savedTheme = localStorage.getItem(`theme_${userData.email}`) || 'dark';
    dispatch(setTheme(savedTheme));
    toggleTheme(savedTheme);
  }
}, [userData]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const setToggle = () => {
    setIsModalOpen(!isModalOpen);
  };

  const CollapsibleList = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleList = () => {
      setIsOpen((prevState) => !prevState);
    };

    return (
      <li className="text-gray-900 dark:text-gray-100">
        <div onClick={toggleList}>
          <span className="flex items-center gap-1 text-black dark:text-gray-100 cursor-pointer">
            {title} {isOpen ? <ChevronUp size="1em" /> : <ChevronDown size="1em" />}
          </span>
        </div>
        {isOpen && <ul className="list-disc pl-4">{children}</ul>}
      </li>
    );
  };
  CollapsibleList.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
  };

  return (
    <>
      <header className="dark:bg-[#182433] bg-[#FFFFFF] dark:text-white text-black flex items-center w-full h-[60px] fixed top-0 left-0 right-0 z-50 p-2 shadow-[0_1px_4px_rgba(0,0,0,0.08)] border-b dark:border-[#263951]">
        <div className="flex flex-col items-start mr-2">
          <span className="text-[#24527A] dark:text-[#48A7FF] font-medium text-[20px] leading-tight">QMetry360</span>
          <span
            className="text-[#6B7280] dark:text-[#FFFFFF]"
            style={{
              fontFamily: 'Inter',
              fontWeight: 400,
              fontSize: '10px',
              lineHeight: '100%',
              letterSpacing: '0%',
            }}
          >
            Quality Quantified
          </span>
        </div>
        <div className="flex-grow flex ml-[85px] header-search-wrapper">
          <div className="search-bar-container relative dark:bg-[#151F2C] bg-[#FFFFFF] dark:border-[#25384F] border border-[#A6C3DC] hover:border-[#326AEB66] focus-within:border-[#326AEB] focus-within:shadow-[0_0_6px_0_rgba(50,106,235,0.8)] w-[484px] h-[34px] flex items-center px-2 rounded-md transition-all duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-5 dark:text-[#DCE1E7] text-[#24527A]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              className="bg-transparent dark:text-[#DCE1E7] text-[#24527A] dark:placeholder-[#DCE1E7] placeholder-[#24527A] w-full pl-2 
         outline-none focus:outline-none focus:ring-0 border-none"
              placeholder="Search"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 2xl:space-x-4 relative">
          <div className="flex items-center space-x-2 2xl:space-x-4 relative">
            <div
              className="flex items-center justify-center gap-[1px] rounded-full dark:bg-black bg-[#FFFFFF] dark:border-0 border border-[#A6C3DC] p-0.5 transition-all duration-300"
              ref={dropdownRef}
            >
              <div className="relative flex items-center justify-center w-[60%]">
                <Tooltip
                  content={(() => {
                    const persisted = sessionStorage.getItem('activeSync');
                    const syncType = activeSync || persisted;
                    const loadingText =
                      syncType === 'current'
                        ? 'Syncing Current Project..'
                        : syncType === 'failed'
                        ? 'Syncing Failed Projects..'
                        : syncType === 'all'
                        ? 'Syncing All Selected Projects..'
                        : 'Syncing..';
                    const idleText = isSyncDisabledForClosedSprint
                      ? 'Sync disabled for closed sprint'
                      : isSyncEnabled()
                        ? 'Sync Current Project'
                        : 'No projects available to sync';
                    return isLoading ? loadingText : idleText;
                  })()}
                  position="bottom"
                >
                  <button
                    onClick={() => {
                      if (canSync && !isLoading) {
                        handleSyncCurrentProject();
                        setIsDropdownOpen(false);
                      }
                    }}
                    className={`flex items-center justify-center py-0.5 px-1 rounded-l-full ${
                      !canSync || isLoading
                        ? 'cursor-not-allowed dark:bg-[#172E44] bg-[#066FD1]/20 text-[#4b5563] dark:text-gray-500'
                        : 'dark:hover:bg-[#1E2124] hover:bg-[#F5F5F5]'
                    }`}
                    disabled={!canSync || isLoading}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.3"
                      stroke="currentColor"
                      className={`w-7 h-7 ${!canSync || isLoading ? 'text-[#4b5563] dark:text-gray-500' : 'text-[#24527A] dark:text-[#066FD1]'} ${isLoading ? 'animate-spin' : ''}`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                      />
                    </svg>
                  </button>
                </Tooltip>

                {isDropdownOpen && canSync && (
                  <div
                    className="absolute top-full -left-16 w-56 dark:bg-[#182433] bg-[#FFFFFF] rounded-lg dark:shadow-[0_4px_16px_0_rgba(0,0,0,0.8)] shadow-[0_4px_10px_0_rgba(0,0,0,0.1)] dark:text-[#ffffff] text-[#202020] p-0.5 dark:border-[#415061] border border-[#D9D9D9] z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      onClick={() => {
                        if (!isLoading) handleFailedSyncData();
                        setIsDropdownOpen(false);
                      }}
                      className={`px-4 py-2 cursor-pointer text-sm dark:text-[#D9E4F1] text-[#202020] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] rounded-lg ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Sync Failed Projects
                    </div>
                    <div
                      onClick={() => {
                        if (!isLoading) handleSyncData();
                        setIsDropdownOpen(false);
                      }}
                      className={`px-4 py-2 cursor-pointer text-sm dark:text-[#D9E4F1] text-[#202020] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] rounded-lg ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Sync All Selected Projects
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation(); // prevent document click from firing
                  if (!isLoading && canSync) setIsDropdownOpen(!isDropdownOpen);
                }}
                className={`flex items-center justify-center w-[40%] px-1 py-1.5 h-full rounded-r-full transition-colors ${
                  !canSync || isLoading
                    ? 'cursor-not-allowed opacity-50'
                    : isDropdownOpen
                      ? 'dark:bg-[#172E44] bg-[#066FD1]/20'
                      : 'dark:hover:bg-[#1E2124] hover:bg-[#F5F5F5]'
                }`}
              >
                <ChevronDown
                  size="1em"
                  className={`text-lg ${!canSync || isLoading ? 'text-[#4b5563] dark:text-gray-500' : 'text-[#24527A] dark:text-[#066FD1] hover:text-[#338EE2]'} ${
                    isDropdownOpen ? 'rotate-180' : ''
                  } transition-transform duration-200`}
                  strokeWidth={3}
                />
              </button>
            </div>

            {isSyncEnabled() && syncMessage && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium dark:text-container text-black">
                  {isLoading ? 'Sync in progress' : syncMessage}
                </span>
                {isLoading && (
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                )}
              </div>
            )}

            {isSyncEnabled() && syncFailedMessage && (
              <div className="flex items-center space-x-1 2xl:space-x-2">
                <span className="text-xs xl:text-sm font-medium text-red-500 whitespace-nowrap">{syncFailedMessage}</span>
              </div>
            )}

            {projectId && lastSyncTime && (
              <div className="flex items-center">
                <span className="text-xs xl:text-sm font-medium dark:text-container text-[#24527A] whitespace-nowrap">
                  Last synced: {lastSyncTime}
                </span>
              </div>
            )}
          </div>

          <Menu as="div" className="relative inline-block text-left">
            <div className="flex items-center gap-2 rounded-full dark:bg-black bg-[#FFFFFF] dark:border-0 border border-[#A6C3DC] p-1 transition-all duration-300">
              <button
                className={`p-1 rounded-full transition-all duration-300 ${
                  currentTheme === 'light' ? 'bg-[#066FD1]/20 text-[#066FD1]' : 'text-[#8076A8]/100'
                }`}
                onClick={() => handleThemeChange('light')}
                aria-label="Light Mode"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                  />
                </svg>
              </button>

              <button
                className={`p-1 rounded-full transition-all duration-300 ${
                  currentTheme === 'dark' ? 'bg-[#1F2D40] text-[#48A7FF]' : 'text-[#8076A8]/60'
                }`}
                onClick={() => handleThemeChange('dark')}
                aria-label="Dark Mode"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                  />
                </svg>
              </button>
            </div>
          </Menu>

          <Menu as="div" className="relative inline-block text-left">
            {({ open }) => (
              <>
                <Tooltip content="Notifications" position="bottom" disabled={open}>
                  <MenuButton 
                    className={`flex items-center p-2 rounded-full transition-all duration-200 hover:shadow-lg dark:hover:bg-[#213045] hover:bg-[#EAF5FF] text-container ${
                      open ? (currentTheme === 'light' ? 'bg-[#D9ECFF]' : 'bg-[#213045]') : ''
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`lucide lucide-bell dark:text-container ${
                        open ? (currentTheme === 'light' ? 'text-[#066FD1]' : 'text-[#48A7FF]') : 'text-[#24527A]'
                      }`}
                    >
                      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                    </svg>
                  </MenuButton>
                </Tooltip>
                <MenuItems className="absolute right-0 z-10 mt-4 w-80 max-h-96 origin-top-right rounded-lg dark:bg-[#0D131A] bg-[#ffffff] text-white dark:shadow-[0_4px_16px_0_rgba(0,0,0,0.8)] shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] overflow-hidden">
                  <div className="sticky top-0 px-4 py-3 border-b dark:border-gray-700 border-[#D9D9D9]">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-medium dark:text-[#CED5E3] text-[#202020]">
                        Notifications{' '}
                        <span className="ml-1 text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          04
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    <MenuItem>
                      <div className="flex items-start p-3 border-b dark:border-gray-700 border-[#D9D9D9] hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="flex-shrink-0 mr-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#E6EEFF] dark:bg-[#1F2D40]">
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#066FD1"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Test Course 56
                          </p>
                          <p className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            course will expire tomorrow
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            02/04/2025 02:37
                          </p>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex items-start p-3 border-b dark:border-gray-700 border-[#D9D9D9] hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="flex-shrink-0 mr-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#E6EEFF] dark:bg-[#1F2D40]">
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#066FD1"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <p className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                              Gowtham submitted React_UI_Course55Course approval
                            </p>
                            <button className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                              <svg
                                className="h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex items-start p-3 border-b dark:border-gray-700 border-[#D9D9D9] hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="flex-shrink-0 mr-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#E6EEFF] dark:bg-[#1F2D40]">
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#066FD1"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Gowtham submitted React_UI_Course55
                          </p>
                          <p className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            course approval
                          </p>
                        </div>
                      </div>
                    </MenuItem>
                  </div>
                </MenuItems>
              </>
            )}
          </Menu>
          <Menu as="div" className="relative inline-block text-left">
            {({ open }) => (
              <>
                <Tooltip content="Shortcut" position="bottom" disabled={open}>
                  <MenuButton 
                    className={`flex items-center text-xl p-2 rounded-full transition-all duration-200 hover:shadow-lg dark:hover:bg-[#213045] hover:bg-[#EAF5FF] text-container ${
                      open ? (currentTheme === 'light' ? 'bg-[#D9ECFF]' : 'bg-[#213045]') : ''
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`lucide lucide-file-symlink dark:text-container ${
                        open ? (currentTheme === 'light' ? 'text-[#066FD1]' : 'text-[#48A7FF]') : 'text-[#24527A]'
                      }`}
                    >
                      <path d="m10 18 3-3-3-3" />
                      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      <path d="M4 11V4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7" />
                    </svg>
                  </MenuButton>
                </Tooltip>
                <MenuItems className="absolute flex flex-col right-0 z-10 mt-4 w-[320px] origin-top-right rounded-lg dark:bg-[#0D131A] bg-[#ffffff] text-white dark:shadow-[0_4px_16px_rgba(0,0,0,0.8)] shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] dark:border-[#2D3055] border-[#D9D9D9] ">
                  <div className="flex flex-col rounded-lg">
                    <MenuItem onClick={setToggle}>
                      <div className="flex py-3 px-4 items-center hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="bg-[#E6EEFF]  dark:bg-[#1F2D40] h-8 w-8 rounded-full flex items-center justify-center mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="#066FD1"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                            />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            About QMetry360
                          </span>

                          <span className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            Version 2026.1.2
                          </span>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex py-3 px-4 items-center hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="bg-[#E6EEFF]  dark:bg-[#1F2D40] h-8 w-8 rounded-full flex items-center justify-center mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="#066FD1"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Invoice App
                          </span>
                          <span className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            Manage Accounts
                          </span>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex py-3 px-4 items-center hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="bg-[#E6EEFF]  dark:bg-[#1F2D40] h-8 w-8 rounded-full flex items-center justify-center mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="#066FD1"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Users
                          </span>
                          <span className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            Manage Users
                          </span>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex py-3 px-4 items-center hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="bg-[#E6EEFF]  dark:bg-[#1F2D40] h-8 w-8 rounded-full flex items-center justify-center mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="#066FD1"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                            />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Role Management
                          </span>
                          <span className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            Permissions
                          </span>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex py-3 px-4 items-center hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="bg-[#E6EEFF]  dark:bg-[#1F2D40] h-8 w-8 rounded-full flex items-center justify-center mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="#066FD1"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                            />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Dashboard
                          </span>
                          <span className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            User Dashboard
                          </span>
                        </div>
                      </div>
                    </MenuItem>

                    <MenuItem>
                      <div className="flex py-3 px-4 items-center hover:bg-[#F5F5F5] dark:hover:bg-[#17212E]">
                        <div className="bg-[#E6EEFF]  dark:bg-[#1F2D40] h-8 w-8 rounded-full flex items-center justify-center mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="#066FD1"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-[#CED5E3] text-[#202020]">
                            Settings
                          </span>
                          <span className="text-xs dark:text-[#A3B1C9] text-[#3F3F3F]">
                            Account Settings
                          </span>
                        </div>
                      </div>
                    </MenuItem>
                  </div>

                  <div className="p-3 mt-2">
                    <button className="bg-[#066FD1] text-[#CED5E3] w-full py-2 rounded-md font-medium flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5 mr-1"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      Add Shortcut
                    </button>
                  </div>
                </MenuItems>
              </>
            )}
          </Menu>
          <Menu as="div" className="relative inline-block text-left">
            {({ open }) => (
              <>
                <Tooltip
                  content={(userData?.name || data?.data?.name || 'Profile').toLowerCase()}
                  position="bottom"
                  disabled={open}
                >
                  <Menu.Button className="flex items-center space-x-1 2xl:space-x-2 dark:bg-black bg-[#FFFFFF] px-2 2xl:px-3 py-1.5 dark:text-white text-[#24527A] rounded-full dark:hover:bg-[#17212E] hover:bg-gray-100 dark:border-2 dark:border-[#066FD1] border border-[#A6C3DC] transition-all duration-300 flex-shrink-0">
                    <img src={userImage} alt="User" className="w-7 h-7 2xl:w-8 2xl:h-8 rounded-full flex-shrink-0" />
                    <span className="text-xs xl:text-sm font-medium whitespace-nowrap hidden sm:block">
                      {(userData?.name || data?.data?.name || 'profile').toLowerCase()}
                    </span>
                    <ChevronDown className="w-3 h-3 2xl:w-4 2xl:h-4 text-[#24527A] dark:text-white flex-shrink-0" />
                  </Menu.Button>
                </Tooltip>
                <Menu.Items className="absolute right-0 mt-2 w-48 dark:bg-[#0D131A] bg-[#FFFFFF] dark:text-[#CED5E3] text-[#202020] dark:shadow-[0_4px_20px_0_rgba(0,0,0,0.8)] shadow-[0_4px_10px_0_rgba(0,0,0,0.1)] dark:border-0 border border-[#D9D9D9] rounded-lg focus:outline-none">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'dark:bg-[#17212E] bg-[#EAF5FF]' : 'dark:bg-[#0D131A] bg-[#FFFFFF]'
                        } flex items-center w-full px-4 py-2 text-sm rounded-t-lg`}
                      >
                        <User className="w-5 h-5 mr-2 dark:text-[#CED5E3] text-[#202020]" />
                        My Profile
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'dark:bg-[#17212E] bg-[#EAF5FF]' : 'dark:bg-[#0D131A] bg-[#FFFFFF]'
                        } flex items-center w-full px-4 py-2 text-sm`}
                      >
                        <Settings className="w-5 h-5 mr-2 dark:text-[#CED5E3] text-[#202020]" />
                        Settings
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'dark:bg-[#17212E] bg-[#EAF5FF]' : 'dark:bg-[#0D131A] bg-[#FFFFFF]'
                        } flex items-center w-full px-4 py-2 text-sm`}
                      >
                        <HelpCircle className="w-5 h-5 mr-2 dark:text-[#CED5E3] text-[#202020]" />
                        FAQ
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        className={`${
                          active ? 'bg-[#066FD1] text-white' : 'dark:bg-[#04437D] bg-[#066FD1] text-white'
                        } flex items-center w-full px-4 py-2 text-sm rounded-b-lg`}
                      >
                        <LogOut className="w-5 h-5 mr-2 text-white" />
                        Logout
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
                {isModalOpen && (
                  <Modal
                    isOpen={isModalOpen}
                    onClose={setToggle}
                    title="About QMetry360"
                    content={
                      <>
                        <div className="grid grid-cols-1 overflow-x-auto rounded-lg shadow-xl w-full p-0.5">
                          <div className="w-full">
                            <div className="text-sm text-gray-900 dark:text-gray-100 p-2">
                              All Version History
                            </div>
                            <table className="bg-gray-200 dark:bg-gray-800 w-full rounded-md text-gray-900 dark:text-gray-100">
                              <thead>
                                <tr className="bg-primary-400 dark:bg-primary-500 text-white">
                                  <th className="p-3 text-center text-md border-r rounded-tl-md">
                                    Version
                                  </th>
                                  <th className="p-3 text-center text-md border-r">Release Date</th>
                                  <th className="p-3 text-center text-md items-center rounded-tr-md">
                                    Feature List
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-purple-100 dark:bg-gray-600 relative overflow-hidden">
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100 font-medium">
                                    2026.1.3
                                  </td>
                                  <td className="p-3 border-b border-r text-center">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase
                                      bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 border border-violet-200/80
                                      dark:from-violet-900/40 dark:to-indigo-900/40 dark:text-violet-300 dark:border-violet-700/50
                                      shadow-sm animate-pulse"
                                      style={{ animationDuration: '2.5s' }}>
                                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 inline-block"></span>
                                      Coming Soon
                                    </span>
                                  </td>
                                  <td className="p-3 border-b">
                                    <span className="text-sm text-gray-600 dark:text-gray-300 italic">
                                      Features will be announced shortly…
                                    </span>
                                  </td>
                                </tr>
                                <tr className="bg-purple-50 dark:bg-[#17212E]">
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2026.1.2
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    16-02-2026
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Tech Quality Page (Bug Rate, TTR, DER & DAR)
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Churn updates Based On Bug include/exclude selection
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Integrated Xray Cloud Source Management
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Burnup & Burndown Enhancement
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Backlog Ticket Details
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Bug Fixes & Improvements
                                      </li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className="bg-purple-100 dark:bg-gray-600">
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2026.1.1
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    20-01-2026
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Integrated GitLab-Issue Source Management
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Release Burndown
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Added Sprint Outcome To Jira Table View
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Implemented Burnup Chart
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Bug Fixes & Improvements
                                      </li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.4.4
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    22-12-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Integrated Azure Board Source Management
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Avoid Repetative Board Calls
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Integration Modal Redesign
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Burndown Supports All Issue Types
                                      </li>
                                      <li>Bug Fixes & Improvements</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.4.3
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    21-11-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        QA Insights Dashboard (Bug Metrics, Test & Reference Coverage)
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Light Mode For All Screens
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Combined Velocity & Burndown Widget Implementation
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Bug Fixes & Improvements
                                      </li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.4.2
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    23-10-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Support Multi-Company Login Across Multiple Browser Tabs
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Added Committed VS completed For Kanban Board
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Integrated Bitbucket Source Management
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Implement Search For All Columns In AG Grid
                                      </li>
                                      <li>Bug Fixes & Improvements</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.4.1
                                  </td>

                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    13-10-2025
                                  </td>

                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Multi-Board Handling
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        CXO Light Mode Support
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Support for Grid View in Jira Dashboard
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Bug Fixes & Improvements
                                      </li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.3.6
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    26-09-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Sync Current Project And Multi Repo Selection
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Light Mode For Standup Page
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Jira Custom Fields & Column Filtering In Standup Jira Table
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Credential Validation On Integration Page
                                      </li>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.3.5
                                  </td>

                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    12-09-2025
                                  </td>

                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Pulling Issues for Simple Board Type
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Handling Recently Closed Release Data
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Integrate Azure DevOps Source Management
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Bug Fixes
                                      </li>
                                    </ol>
                                  </td>
                                </tr>

                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.3.4
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    02-09-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Fetching Holidays For Capacity
                                      </li>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Incremental Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Sync Recently Closed Previous Sprint One Time
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Display as hidden/password field (•••••• masking)
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Capacity Enhancement
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Jira Workflow Graph Enhancement
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.3.3
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    15-08-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Incremental Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            API-Fallback For Missing Release Date
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Sync Data For All Latest Unreleased
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Capacity Planning Enhancement
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Sprint/Release Churn Enhancement
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.3.2
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    01-08-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Implement Sprint And Release Churn
                                      </li>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Incremental Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            PR Table And Label Column Issue
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Updated Metrics Modal
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Capacity Values Persistence
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Handle Back Date Effort Logging In Burndown
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            WTB Data Issue.
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.3.1
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    21-07-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Project-Level Sync Implementation
                                      </li>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Incremental Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Handle All Issue Types
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            New UI For Developer And Test Score [List View] In CXO
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Handle Sprint Success And Velocity For Hour
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.8
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    04-07-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Valkey Cache Implementation For Better Performance
                                      </li>
                                      <li className="mt-1 text-gray-900 dark:text-gray-100">
                                        Track Committed VS Completed Hours In Scrum Board
                                      </li>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.7
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    20-06-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Minor Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Sprint Wise Capacity
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Stand Up Page PR Table
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Handle Original Estimate Hrs In Capacity
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Added Email Notification For QA Status Transition
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Testing Productivity
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Release Start/End Date Display With Overdue & Days
                                            Remaining (Standup Page)
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Render Manual And Automation Test Results (Without
                                            Re-render)
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            UI - Support All Jira Issue Types
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Operation Score
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.6
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    10-06-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Minor Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Include Original Estimate Hrs In Capacity Planning
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Fetching 30-Day PR/MR Data In Hard Sync
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.5
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    30-05-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Minor Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Filter Enhancement
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Committed VS Completed Chart
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.4
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    27-05-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Minor Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Hyperlinks On CXO Dashboard Cards
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Implement Organization Dropdown
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Implementing All Chart Related To Git
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Light Sync Stale Tickets Deletion
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Jira API Optimization
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.3
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    16-05-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'QMetry360 Dashboard (CXO) Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Dynamic Formula Handling
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Eng Metrics Dashboard Feature Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Jira Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Cycle Time Chart
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <li>Code Optimization</li>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.2
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    25-04-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <li>MongoDB To AWS DocumentDB Migration</li>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.2.1
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    15-04-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Comprehensive Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Forgot Password Implementation
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'QMetry360 Dashboard (CXO) Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Engineering Score Feature Upgrade'}
                                        >
                                          <CollapsibleList
                                            className="mb-2"
                                            title={'Operation Score ( Dora Metrics )'}
                                          >
                                            <ul className="list-disc pl-2">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Deployment Frequency
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Change Failure Rate
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Lead Time To Changes
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Mean Time To Recovery
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Eng Metrics Dashboard Feature Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Jira Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Defect Leakage Analysis
                                            </li>
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Cost Of Fixing Defects
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Stand Up Dashboard'}
                                      >
                                        <ul className="list-disc pl-4">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Story Churn
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Capacity
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            BrunDown
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Sprint Goal Success
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            PRs Details
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Jira Ticket Details
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Integration Dashboard Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Code Sources Upgrade'}
                                        >
                                          <ul className="list-disc pl-4">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              GitLab
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.1.4
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    11-03-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Some Comprehensive Feature Upgrade'}
                                      >
                                        <ul className="list-disc pl-2">
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Sync Optimization
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Google SSO Support
                                          </li>
                                          <li className="mt-1 text-gray-900 dark:text-gray-100">
                                            Kanban Board Support
                                          </li>
                                        </ul>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Eng Metrics Dashboard Feature Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Jira Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Defect Removal Efficiency
                                            </li>
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Time To Fix Bug
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Git Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Pull Request Approval Rate
                                            </li>
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Pull Request Iteration Time
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Integration Dashboard Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Test Case Management'}
                                        >
                                          <ul className="list-disc pl-4">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              TestRail
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.1.3
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    10-02-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'QMetry360 Dashboard (CXO) Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Release Readiness'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Burndown
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Eng Metrics Dashboard Feature Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Jira Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Cycle Time
                                            </li>
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Defect Rejection Ratio
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Git Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Total Cycle Time
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <li className="text-gray-900 dark:text-gray-100">
                                        Bug Fixes
                                      </li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-50 dark:bg-[#17212E]'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.1.2
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    08-01-2025
                                  </td>
                                  <td className="p-3 border-b">
                                    <ol className="list-decimal pl-6">
                                      <CollapsibleList
                                        className="mb-2"
                                        title={'Eng Metrics Dashboard Feature Upgrade'}
                                      >
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Jira Dashboard Feature Upgrade'}
                                        >
                                          <ul className="list-disc pl-2">
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Bug Classification
                                            </li>
                                            <li className="mt-1 text-gray-900 dark:text-gray-100">
                                              Defect Density
                                            </li>
                                          </ul>
                                        </CollapsibleList>
                                      </CollapsibleList>
                                      <li>Bug Fixes</li>
                                    </ol>
                                  </td>
                                </tr>
                                <tr className={'bg-purple-100 dark:bg-gray-600'}>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    2025.1.1
                                  </td>
                                  <td className="p-3 border-b border-r text-center text-gray-900 dark:text-gray-100">
                                    01-01-2025
                                  </td>
                                  <td className="p-3 border-b overflow-x-auto overflow-y-auto">
                                    <div className="list-decimal">
                                      <ol className="list-decimal pl-6">
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'QMetry360 Dashboard (CXO)'}
                                        >
                                          <CollapsibleList
                                            className="mb-2"
                                            title={'Release Readiness'}
                                          >
                                            <ul className="list-disc pl-2">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Open Bugs
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Open Task
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Open Story
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Bugs
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Task
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Story
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Manual Test Result
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Automation Test Result
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                          <CollapsibleList
                                            className="mb-2"
                                            title={'Engineering Score'}
                                          >
                                            <ul className="list-disc pl-2">
                                              <CollapsibleList
                                                className="mt-1"
                                                title={'Developer Score'}
                                              >
                                                <ul className="list-disc pl-4">
                                                  <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                    Release Cycle Time
                                                  </li>
                                                  <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                    Time To Fix
                                                  </li>
                                                </ul>
                                              </CollapsibleList>
                                              <CollapsibleList
                                                className="mt-1"
                                                title={'Test Score'}
                                              >
                                                <ul className="list-disc pl-4">
                                                  <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                    Defect Escape Ratio
                                                  </li>
                                                  <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                    Testing Quality
                                                  </li>
                                                  <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                    DLA
                                                  </li>
                                                </ul>
                                              </CollapsibleList>
                                            </ul>
                                          </CollapsibleList>
                                        </CollapsibleList>
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Eng Metrics Dashboard'}
                                        >
                                          <CollapsibleList
                                            className="mb-2"
                                            title={'Jira Dashboard'}
                                          >
                                            <ul className="list-disc pl-2">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Committed VS Completed
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Issue Type
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Velocity
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                          <CollapsibleList className="mb-2" title={'Git Dashboard'}>
                                            <ul className="list-disc pl-2">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Closed Pull Request
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Open Pull Request
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Merged PR Without Review
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Pull Request Size
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Total Pull Request
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Static Code Analysis
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                        </CollapsibleList>
                                        <CollapsibleList
                                          className="mb-2"
                                          title={'Integration Dashboard'}
                                        >
                                          <CollapsibleList className="mb-2" title={'Code Sources'}>
                                            <ul className="list-disc pl-4">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Github
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                          <CollapsibleList
                                            className="mb-2"
                                            title={'Ticket Sources'}
                                          >
                                            <ul className="list-disc pl-4">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Jira
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                          <CollapsibleList
                                            className="mb-2"
                                            title={'Capacity Planning'}
                                          >
                                            <ul className="list-disc pl-4">
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Roles and Rate Card
                                              </li>
                                              <li className="mt-1 text-gray-900 dark:text-gray-100">
                                                Capacity Planning
                                              </li>
                                            </ul>
                                          </CollapsibleList>
                                        </CollapsibleList>
                                      </ol>
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    }
                    size="large"
                  />
                )}
              </>
            )}
          </Menu>
        </div>
      </header>
      <ToastContainer />
    </>
  );
}

export default Header;
