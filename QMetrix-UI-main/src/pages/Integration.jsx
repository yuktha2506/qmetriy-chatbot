/* eslint-disable no-undef */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { object, string } from 'yup';
import { Formik, Form, Field } from 'formik';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CommonLayout from '../layout/CommonLayout';
import '../assets/css/global.scss';
import Button from '../components/Common/Button';
import FormInput from '../components/Common/FormInput';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { addJiraConnection } from '../store/jira/JiraConnectionSlice';
import { getId, integration } from '../constants';
import { addGitConnection } from '../store/git/gitConnectionSlice';
import { addTestrailConnection } from '../store/TestrailSlices/testrailConnectionSlice';
import JiraProjectModal from '../components/Common/JiraProjectModal';
import { getProjectList } from '../constants';
import { updateSelectedProject } from '../constants';
import { updateProjectList } from '../store/JiraSlices/jiraSlice';
import { addTrelloConnection } from '../store/trello/trelloSlice';
import { addAzureBoardConnection } from '../store/azureBoard/azureBoardConnectionSlice';
import { addGitlabIssuesConnection } from '../store/gitlabIssues/gitlabIssuesConnectionSlice';

const getErrorMessage = (error) => {
  const statusCodeMessages = {
    400: "Invalid request. Check your input.",
    401: "Unauthorized. Invalid username or password.",
    403: "Forbidden. Access denied.",
    404: "Host not found. Please check the host.",
    408: "Request timeout. Try again.",
    500: "Internal server error. Try again later.",
    502: "Bad gateway. Service unavailable.",
    503: "Service unavailable. Try again later.",
    504: "Gateway timeout. Server took too long to respond."
  };

  const statusCode = error?.response?.status || error?.status;
  return statusCodeMessages[statusCode] || error?.message || 'Connection failed. Please try again.';
};

const getHostValidationRegex = (platform) => {
  switch (platform?.toLowerCase()) {
    case 'jira':
      return /^https:\/\/([a-zA-Z0-9-]+\.)?(jira\.[a-zA-Z0-9.-]+|atlassian\.net)(\/.*)?$/;
    case 'azure':
      return /^https:\/\/(dev\.azure\.com|[a-zA-Z0-9-]+\.visualstudio\.com)(\/.*)?$/;
    case 'testrail':
      return /^https:\/\/([a-zA-Z0-9-]+\.)?testrail\.(io|com|net)(\/.*)?$/;
    case 'trello':
      return /^https:\/\/(api\.)?trello\.com(\/.*)?$/;  
    case 'gitlab':
      return /^https:\/\/([a-zA-Z0-9-]+\.)?gitlab\.(com|io|net)(\/.*)?$|^https:\/\/[a-zA-Z0-9.-]+(\/.*)?$/;
    default:
      return null;
  }
};

const validationSchema = object().shape({
  host: string()
    .required('Organisation host Name is required')
    .matches(
      getHostValidationRegex('jira'),
      'Enter valid host name'
    ),
  password: string().required('API Token is required'),
  username: string().email('Invalid email format').required('Email is required'),
});

const getGitValidationSchema = (selectedSource) => {
  const baseSchema = {
    password: string().required(`${selectedSource || 'Git'} API Token is required`),
  };
  
  if (selectedSource === 'Bitbucket') {
    baseSchema.username = string()
      .required('Username is required');
    baseSchema.host = string(); 
  } else {
    baseSchema.host = string().required(`${selectedSource || 'Git'} Organisation Name is required`);
  }
  
  return object().shape(baseSchema);
};

const azureValidationSchema = object().shape({
  host: string()
    .required('Organisation host Name is required')
    .matches(getHostValidationRegex('azure'), 'Enter valid host name'),
  password: string().required('API Token is required'),
  username: string().email('Invalid email format').required('Email is required'),
});

const gitlabIssuesValidationSchema = object().shape({
  host: string()
    .required('Organisation host Name is required')
    .matches(getHostValidationRegex('gitlab'), 'Enter valid GitLab host name'),
  password: string().required('API Token is required'),
  username: string().email('Invalid email format').required('Email is required'),
});

const trelloValidationSchema = object().shape({
  host: string()
    .required('Organisation name is required')
    .matches(
      getHostValidationRegex('trello'),
      'Enter valid host name'
    ),
  password: string().required('Trello API Token is required'),
  username: string().email('Invalid email address').required('Trello Email is required'),
});

const testRailValidationSchema = object().shape({
  host: string()
    .required('Organisation name is required')
    .matches(
      getHostValidationRegex('testrail'),
      'Enter valid host name'
    ),
  password: string().required('TestRail API Token is required'),
  username: string().email('Invalid email address').required('TestRail Email is required'),
});

const xrayValidationSchema = object().shape({
  clientId: string().required('Client ID is required'),
  clientSecret: string().required('Client Secret is required'),
  host: string().required('Host is required'),
});

const TailwindButton = ({ children, icon, onClick, ...props }) => {
  return (
    <button
      className="inline-flex items-center bg-transparent text-[#24527A] dark:text-[#F6F8FC] px-2 py-2 rounded-md hover:bg-[#E0EDF8] hover:text-[#24527A] dark:hover:bg-[#304872] dark:hover:text-white active:bg-[#24527A] active:text-white dark:active:bg-[#066FD1] dark:active:bg-opacity-20 dark:active:text-white transition-colors duration-300 max-w-full"
      onClick={onClick}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex gap-2 min-w-0 truncate">{children}</span>
    </button>
  );
};

TailwindButton.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.element,
  onClick: PropTypes.func,
};

export default function Integration() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useSelector((state) => state?.theme?.theme || 'light');
  const queryClient = useQueryClient();
  const [ModalOpen, setModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testRailModalOpen, setTestRailModalOpen] = useState(false);
  const [xrayModalOpen, setXrayModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [jiraProjects, setJiraProjects] = useState([]);
  const [projectsLoading] = useState(false);
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [shouldOpenProjectModal, setShouldOpenProjectModal] = useState(false);
  const [trelloModalOpen, setTrelloModalOpen] = useState(false);
  const [azureModalOpen, setAzureModalOpen] = useState(false);
  const [gitlabIssuesModalOpen, setGitlabIssuesModalOpen] = useState(false);
  const [projectModalSource, setProjectModalSource] = useState(null);
  const isTicketSourceIntegrated = getAllProjectList.length > 0;
  const handleOpenModal = (source) => {
    if (!isTicketSourceIntegrated) {
      toast.warning('Please complete Ticket Source integration first!', {
        toastId: 'ticket-source-warning',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' }
      });
      return;
    }
    setSelectedSource(source);
    setIsModalOpen(!isModalOpen);
  };
  const companyId = getId().companyId;

  const handClose = () => {
    setModalOpen(!ModalOpen);
  };

  const handleOpen = () => {
    if (!isTicketSourceIntegrated) {
      toast.warning('Please complete Ticket Source integration first!', {
        toastId: 'ticket-source-warning',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' }
      });
      return;
    }
    navigate('/capacityPlanning');
  };

  const handleRolesBilling = () => {
    if (!isTicketSourceIntegrated) {
      toast.warning('Please complete Ticket Source integration first!', {
        toastId: 'ticket-source-warning',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' }
      });
      return;
    }
    navigate('/Roles&Billing');
  };
    const handleHolidayList = () => {
    if (!isTicketSourceIntegrated) {
      toast.warning('Please complete Ticket Source integration first!', {
        toastId: 'ticket-source-warning',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' }
      });
      return;
    }
    navigate('/HolidayList');
  };

  const handleBackToIntegrationFromProjects = () => {
    if (projectModalSource === 'azure') {
      setAzureModalOpen(true);
    } else if (projectModalSource === 'gitlab-issues') {
      setGitlabIssuesModalOpen(true);
    } else {
      setModalOpen(true);
    }
  };

  const handleClickTrello = () => {
    setTrelloModalOpen(!trelloModalOpen);
  };

  const handleCloseTrello = () => {
    setTrelloModalOpen(!trelloModalOpen);
  };

  const handleClickAzureBoards = () => {
    setProjectModalSource('azure');
    const azureProjects = (getAllProjectList || []).filter((p) => p?.boardType === 'azure-board');
    if (azureProjects.length > 0) {
      setJiraProjects(azureProjects);
      setProjectModalOpen(true);
    } else {
      setAzureModalOpen(true);
    }
  };

  const handleCloseAzure = () => {
    setAzureModalOpen(false);
  };

  const handleClickGitlabIssues = () => {
    setProjectModalSource('gitlab-issues');
    const gitlabProjects = (getAllProjectList || []).filter((p) => p?.boardType === 'gitlab-board');
    if (gitlabProjects.length > 0) {
      setJiraProjects(gitlabProjects);
      setProjectModalOpen(true);
    } else {
      // If no projects with boardType, check for projects without boardType (GitLab Issues doesn't have boards)
      const projectsWithoutBoard = (getAllProjectList || []).filter((p) => !p?.boardType || p?.boardType === 'gitlab-issues');
      if (projectsWithoutBoard.length > 0) {
        setJiraProjects(projectsWithoutBoard);
        setProjectModalOpen(true);
      } else {
        setGitlabIssuesModalOpen(true);
      }
    }
  };

  const handleCloseGitlabIssues = () => {
    setGitlabIssuesModalOpen(false);
  };

  const {
    data: projectListData,
    isLoading,
    isSuccess,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['getProjectList'],
    queryFn: getProjectList,
  });

  const handleProjectModalClose = () => {
    setProjectModalOpen(false);
    queryClient.invalidateQueries(['getProjectList']);
  };

  useEffect(() => {
    if (isSuccess && projectListData?.data && !isLoading) {
      setGetAllProjectList(projectListData.data);
      dispatch(updateProjectList(projectListData.data));
    }
  }, [projectListData, isSuccess, isLoading, dataUpdatedAt, dispatch]);
  const handleClick = () => {
    setProjectModalSource('jira');
    const nonAzureProjects = (getAllProjectList || []).filter(
      (p) => p?.boardType !== 'azure-board' && p?.boardType !== 'gitlab-board',
    );
    if (nonAzureProjects.length > 0) {
      setJiraProjects(nonAzureProjects);
      setProjectModalOpen(true);
    } else {
      setModalOpen(!ModalOpen);
    }
  };
  const handleClickTestRail = () => {
    if (!isTicketSourceIntegrated) {
      toast.warning('Please complete Ticket Source integration first!', {
        toastId: 'ticket-source-warning',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' }
      });
      return;
    }
    setTestRailModalOpen(!testRailModalOpen);
  };

  const handleClickXray = () => {
    if (!isTicketSourceIntegrated) {
      toast.warning('Please complete Ticket Source integration first!', {
        toastId: 'ticket-source-warning',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' },
      });
      return;
    }
    setXrayModalOpen(!xrayModalOpen);
  };

  const jiraMutation = useMutation({
    mutationFn: integration,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['jiraConnection']);
      dispatch(addJiraConnection(data));
  
      toast.dismiss();
      toast.success('Jira Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'jira-success',
        autoClose: 2000,
        closeButton: false
      });
      
      setTimeout(() => {
        setModalOpen(false);
      }, 1000);  
      setShouldOpenProjectModal(true);
      queryClient.invalidateQueries(['getProjectList']);
    },
      onError: (error) => {
        toast.dismiss();
        toast.error(getErrorMessage(error), {
          toastId: 'jira-error',
          autoClose: 5000,
          closeButton: false,
          closeOnClick: false,
          draggable: false,
          style: { cursor: 'default', pointerEvents: 'none' }
        });
      },
  });

  const trelloMutation = useMutation({
    mutationFn: integration,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['trelloConnection']);
      dispatch(addTrelloConnection(data));
  
      toast.dismiss();
      toast.success('Trello Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'trello-success',
        autoClose: 2000,
        closeButton: false
      });
  
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(getErrorMessage(error), {
        toastId: 'trello-error',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' },
      });
    },
  });

  const azureMutation = useMutation({
    mutationFn: integration,
    onSuccess: (data) => {
      dispatch(addAzureBoardConnection(data));
      queryClient.invalidateQueries(['azureBoardConnection']);

      toast.dismiss();
      toast.success('Azure Boards Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'azure-success',
        autoClose: 2000,
        closeButton: false,
      });

      setTimeout(() => {
        setAzureModalOpen(false);
      }, 1000);
      setProjectModalSource('azure');
      setShouldOpenProjectModal(true);
      queryClient.invalidateQueries(['getProjectList']);
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(getErrorMessage(error), {
        toastId: 'azure-error',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' },
      });
    },
  });

  const gitlabIssuesMutation = useMutation({
    mutationFn: integration,
    onSuccess: (data) => {
      dispatch(addGitlabIssuesConnection(data));
      queryClient.invalidateQueries(['gitlabIssuesConnection']);

      toast.dismiss();
      toast.success('GitLab Issues Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'gitlab-issues-success',
        autoClose: 2000,
        closeButton: false,
      });

      setTimeout(() => {
        setGitlabIssuesModalOpen(false);
      }, 1000);
      setProjectModalSource('gitlab-issues');
      setShouldOpenProjectModal(true);
      queryClient.invalidateQueries(['getProjectList']);
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(getErrorMessage(error), {
        toastId: 'gitlab-issues-error',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' },
      });
    },
  });

  useEffect(() => {
    if (isSuccess && projectListData?.data && !isLoading) {
      setGetAllProjectList(projectListData.data);
      dispatch(updateProjectList(projectListData.data));

      if (shouldOpenProjectModal && projectListData.data.length > 0) {
        const allProjects = projectListData.data;
        const filtered =
          projectModalSource === 'azure'
            ? allProjects.filter((p) => p?.boardType === 'azure-board')
            : projectModalSource === 'gitlab-issues'
            ? allProjects.filter((p) => p?.boardType === 'gitlab-board')
            : allProjects.filter((p) => p?.boardType !== 'azure-board' && p?.boardType !== 'gitlab-board');
        if (filtered.length > 0) {
          setJiraProjects(filtered);
          setProjectModalOpen(true);
        } else if (projectModalSource === 'gitlab-issues') {
          // For GitLab Issues, if no filtered projects found, show all projects without boardType
          const gitlabProjects = allProjects.filter((p) => !p?.boardType || p?.boardType === 'gitlab-board');
          if (gitlabProjects.length > 0) {
            setJiraProjects(gitlabProjects);
            setProjectModalOpen(true);
          }
        }
        setShouldOpenProjectModal(false);
      }
    }
  }, [
    projectListData,
    isSuccess,
    isLoading,
    dataUpdatedAt,
    shouldOpenProjectModal,
    projectModalSource,
    dispatch,
  ]);

  const gitMutation = useMutation({
    mutationFn: integration,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['gitConnection']);
      dispatch(addGitConnection(data));
  
      toast.dismiss();
      toast.success('Git Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'git-success',
        autoClose: 2000,
        closeButton: false
      });
  
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
      onError: (error) => {
        toast.dismiss();
        toast.error(getErrorMessage(error), {
          toastId: 'git-error',
          autoClose: 5000,
          closeButton: false,
          closeOnClick: false,
          draggable: false,
          style: { cursor: 'default', pointerEvents: 'none' }
        });
      },
  });

  const testrailMutation = useMutation({
    mutationFn: integration,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['testrailConnection']);
      dispatch(addTestrailConnection(data));
  
      toast.dismiss();
      toast.success('TestRail Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'testrail-success',
        autoClose: 2000,
        closeButton: false
      });
  
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
      onError: (error) => {
        toast.dismiss();
        toast.error(getErrorMessage(error), {
          toastId: 'testrail-error',
          autoClose: 5000,
          closeButton: false,
          closeOnClick: false,
          draggable: false,
          style: { cursor: 'default', pointerEvents: 'none' }
        });
      },
  });

  const xrayMutation = useMutation({
    mutationFn: integration,
    onSuccess: () => {
      toast.dismiss();
      toast.success('Xray Cloud Connected successfully!', {
        className: 'bg-secondary-500 text-gray-100',
        toastId: 'xray-success',
        autoClose: 2000,
        closeButton: false,
      });
      setTimeout(() => {
        setXrayModalOpen(false);
        navigate('/dashboard');
      }, 2000);
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(getErrorMessage(error), {
        toastId: 'xray-error',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' },
      });
    },
  });

  const handleProjectUpdate = (projectKey, updates) => {
    setGetAllProjectList((prevList) =>
      prevList.map((project) =>
        project.key === projectKey ? { ...project, ...updates } : project,
      ),
    );
  };

  const handleProjectSelection = async (selectedProjects) => {
    try {
      const selectedProjectIds = selectedProjects.map((project) => project._id || project.id);
      await updateSelectedProject(selectedProjectIds);
      setGetAllProjectList((prevList) =>
        prevList.map((project) => ({
          ...project,
          isSelected: selectedProjectIds.includes(project._id || project.id),
        })),
      );
      setTimeout(() => {
        setProjectModalOpen(false);
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error updating project selection:', error);
      toast.error('Failed to update project selection. Please try again.', {
        toastId: 'project-update-error',
        autoClose: 5000,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        style: { cursor: 'default', pointerEvents: 'none' }
      });
    }
  };

  return (
    <>
      <CommonLayout>
        <div className="flex flex-col items-center min-h-screen bg-[#F0F4F8] dark:bg-[#151F2C] p-0 pb-2">
          <div className="w-full px-[18px] py-6">
            <div className="font-bold text-3xl text-black mb-1 dark:text-gray-100 ">
              Integration
            </div>
          </div>
          <div
            className="relative max-w-8xl h-[130px] overflow-hidden shadow-custom-md text-text-primary transition-shadow duration-300 ease-custom bg-[#FFFFFF] dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#1F2F41]"
            style={{ width: '98%', marginBottom: '18px', borderRadius: '8px' }}
          >
            <div className="py-4">
              <div className="text-xl font-semibold text-[#0A2342] dark:text-[#FFFFFF] mb-1 px-3 py-2 mx-3">Ticket Sources</div>
              <div className="w-[calc(100%-4rem)] border-t border-[#D1E2F0] dark:border-[#25384F] mx-6"></div>
              <div className="px-6 py-2 flex flex-wrap gap-4">
                <TailwindButton onClick={handleClick}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10.12 21.55a.76.76 0 01-.68.45c-.15 0-.29-.05-.42-.14L1.22 15.44a.74.74 0 010-1.29l9.45-6.02c.24-.15.55-.15.8 0L21.15 14.5a.74.74 0 010 1.29l-8.45 5.97a.76.76 0 01-.68.16c-.09 0-.18-.03-.27-.07L12 19.68l-1.88 1.87z"
                      fill="#0052CC"
                    />
                  </svg>
                  Jira
                </TailwindButton>
                <TailwindButton onClick={handleClickTrello}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 3C3 2.44772 3.44772 2 4 2H20C20.5523 2 21 2.44772 21 3V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V3Z"
                      fill="#0079BF"
                    />
                    <path
                      d="M7 6C6.44772 6 6 6.44772 6 7V14C6 14.5523 6.44772 15 7 15H10C10.5523 15 11 14.5523 11 14V7C11 6.44772 10.5523 6 10 6H7Z"
                      fill="white"
                    />
                    <path
                      d="M14 6C13.4477 6 13 6.44772 13 7V11C13 11.5523 13.4477 12 14 12H17C17.5523 12 18 11.5523 18 11V7C18 6.44772 17.5523 6 17 6H14Z"
                      fill="white"
                    />
                  </svg>
                  Trello
                </TailwindButton>
                <TailwindButton>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.165 6.84 9.489.5.092.682-.217.682-.481v-1.856c-2.785.604-3.37-1.337-3.37-1.337-.455-1.157-1.11-1.466-1.11-1.466-.908-.622.07-.61.07-.61 1.004.07 1.53 1.031 1.53 1.031.893 1.531 2.341 1.088 2.915.832.092-.647.35-1.088.636-1.338-2.221-.252-4.555-1.11-4.555-4.945 0-1.092.39-1.988 1.03-2.685-.103-.253-.446-1.27.097-2.647 0 0 .84-.268 2.75 1.02a9.56 9.56 0 012.5-.336c.847 0 1.7.114 2.5.336 1.91-1.288 2.75-1.02 2.75-1.02.543 1.377.2 2.394.098 2.647.641.697 1.03 1.593 1.03 2.685 0 3.842-2.336 4.688-4.566 4.938.361.311.68.927.68 1.868v2.775c0 .267.182.577.688.48C19.14 20.163 22 16.42 22 12c0-5.52-4.48-10-10-10z"
                      fill="#5C6BC0"
                    />
                  </svg>
                  Github Issues
                </TailwindButton>
                <TailwindButton onClick={handleClickAzureBoards}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14.333 3L5.429 21h3.286l.714-2h8.286l.714 2H20.57l-5.142-15.857L14.333 3zm-3.095 3.428L9.381 9.571l1.857-3.143 1.857-2.857h3.238l-4.524 4.857zM5.286 18l2.286-5.286L7.286 18H5.286z"
                      fill="#066FD1"
                    />
                  </svg>
                  Azure Boards
                </TailwindButton>
                <TailwindButton onClick={handleClickGitlabIssues}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2L5.429 21h3.286l.714-2h8.286l.714 2H20.57l-5.142-15.857L12 2zm-3.095 3.428L9.381 9.571l1.857-3.143 1.857-2.857h3.238l-4.524 4.857zM5.286 18l2.286-5.286L7.286 18H5.286z"
                      fill="#FC6D26"
                    />
                  </svg>
                  GitLab Issues
                </TailwindButton>
              </div>
            </div>
          </div>
          <div
            className={`relative max-w-8xl h-[130px] overflow-hidden shadow-custom-md text-text-primary transition-shadow duration-300 ease-custom bg-[#FFFFFF] dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#1F2F41] ${
              !isTicketSourceIntegrated ? 'opacity-40 pointer-events-none cursor-default' : ''
            }`}
            style={{ width: '98%', marginBottom: '18px', borderRadius: '8px' }}
          >
            <div className="py-4">
              <div className="text-xl font-semibold text-[#0A2342] dark:text-[#FFFFFF] mb-1 px-3 py-2 mx-3">Code Sources</div>
              <div className="w-[calc(100%-4rem)] border-t border-[#D1E2F0] dark:border-[#25384F] mx-6"></div>
              <div className="px-6 py-2 flex gap-4 overflow-y-hidden overflow-x-auto max-w-[95%]">
                <TailwindButton onClick={() => handleOpenModal('Github')}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.165 6.84 9.489.5.092.682-.217.682-.481v-1.856c-2.785.604-3.37-1.337-3.37-1.337-.455-1.157-1.11-1.466-1.11-1.466-.908-.622.07-.61.07-.61 1.004.07 1.53 1.031 1.53 1.031.893 1.531 2.341 1.088 2.915.832.092-.647.35-1.088.636-1.338-2.221-.252-4.555-1.11-4.555-4.945 0-1.092.39-1.988 1.03-2.685-.103-.253-.446-1.27.097-2.647 0 0 .84-.268 2.75 1.02a9.56 9.56 0 012.5-.336c.847 0 1.7.114 2.5.336 1.91-1.288 2.75-1.02 2.75-1.02.543 1.377.2 2.394.098 2.647.641.697 1.03 1.593 1.03 2.685 0 3.842-2.336 4.688-4.566 4.938.361.311.68.927.68 1.868v2.775c0 .267.182.577.688.48C19.14 20.163 22 16.42 22 12c0-5.52-4.48-10-10-10z"
                      fill="#5C6BC0"
                    />
                  </svg>
                  Github
                </TailwindButton>
                <TailwindButton onClick={() => handleOpenModal('GitLab')}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2L5.429 21h3.286l.714-2h8.286l.714 2H20.57l-5.142-15.857L12 2zm-3.095 3.428L9.381 9.571l1.857-3.143 1.857-2.857h3.238l-4.524 4.857zM5.286 18l2.286-5.286L7.286 18H5.286z"
                      fill="#FC6D26"
                    />
                  </svg>
                  Gitlab
                </TailwindButton>
                <TailwindButton onClick={() => handleOpenModal('Azure DevOps')}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.7498 0.877898L23.1227 9.87498C23.4926 10.179 23.4926 10.8185 23.1227 11.1225L12.7498 20.1196C12.3799 20.4236 11.8801 20.4236 11.5102 20.1196L1.13731 11.1225C0.767361 10.8185 0.767361 10.179 1.13731 9.87498L11.5102 0.877898C11.8801 0.573911 12.3799 0.573911 12.7498 0.877898Z"
                      fill="#0089D6"
                    />
                  </svg>
                  Azure DevOps
                </TailwindButton>
                <TailwindButton onClick={() => handleOpenModal('Bitbucket')}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.11 7.72l7.06 11.69c.06.1.15.16.26.16h.12c.11 0 .2-.06.26-.16l7.06-11.69c.05-.08.07-.18.05-.28a.48.48 0 00-.15-.28.46.46 0 00-.28-.11h-14.1c-.1 0-.21.04-.28.11a.48.48 0 00-.15.28.47.47 0 00.05.28zm6.55-.36l-1.5-2.5A.48.48 0 019.56 4H14.4a.48.48 0 01.42.22l1.5 2.5a.47.47 0 01-.41.7H11.07a.47.47 0 01-.41-.7z"
                      fill="#0052CC"
                    />
                  </svg>
                  Bit Bucket
                </TailwindButton>
                <TailwindButton>SourceForge</TailwindButton>
                <TailwindButton>AWS CodeCommit</TailwindButton>
              </div>
            </div>
          </div>
          <div
            className={`relative max-w-8xl h-[130px] overflow-hidden shadow-custom-md text-text-primary transition-shadow duration-300 ease-custom bg-[#FFFFFF] dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#1F2F41] ${
              !isTicketSourceIntegrated ? 'opacity-40 pointer-events-none cursor-default' : ''
            }`}
            style={{ width: '98%', marginBottom: '18px', borderRadius: '8px' }}
          >
            <div className="py-4">
              <div className="text-xl font-semibold text-[#0A2342] dark:text-[#FFFFFF] mb-1 px-3 py-2 mx-3">
                Capacity Planning
              </div>
              <div className="w-[calc(100%-4rem)] border-t border-[#D1E2F0] dark:border-[#25384F] mx-6"></div>
              <div className="px-6 py-2 flex flex-wrap gap-4">
                <TailwindButton onClick={handleOpen}>Capacity Planning</TailwindButton>
                <TailwindButton onClick={handleRolesBilling}>Roles & Rate Card</TailwindButton>
              </div>
            </div>
          </div>
          <div
            className={`relative max-w-8xl h-[130px] overflow-hidden shadow-custom-md text-text-primary transition-shadow duration-300 ease-custom bg-[#FFFFFF] dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#1F2F41] ${
              !isTicketSourceIntegrated ? 'opacity-40 pointer-events-none cursor-default' : ''
            }`}
            style={{ width: '98%', marginBottom: '18px', borderRadius: '8px' }}
          >
            <div className="py-4">
              <div className="text-xl font-semibold text-[#0A2342] dark:text-[#FFFFFF] mb-1 px-3 py-2 mx-3">
                Test Case Management
              </div>
              <div className="w-[calc(100%-4rem)] border-t border-[#D1E2F0] dark:border-[#25384F] mx-6"></div>
              <div className="px-6 py-2 flex flex-wrap gap-4">
                <TailwindButton onClick={handleClickTestRail}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="#58f962"
                      d="M7.27 23.896L4.5 21.124a.35.35 0 0 1 0-.5l2.772-2.77a.35.35 0 0 1 .5 0l2.772 2.772a.35.35 0 0 1 0 .5l-2.772 2.77a.35.35 0 0 1-.5 0zm4.48-4.48l-2.772-2.772a.35.35 0 0 1 0-.498l2.772-2.772a.35.35 0 0 1 .5 0l2.77 2.772a.35.35 0 0 1 0 .5l-2.77 2.77a.35.35 0 0 1-.499 0zm4.48-4.48l-2.77-2.772a.35.35 0 0 1 0-.498l2.771-2.772a.35.35 0 0 1 .5 0l2.77 2.772a.35.35 0 0 1 0 .498l-2.772 2.772a.35.35 0 0 1-.5 0h.002zm-8.876.084l-2.772-2.77a.35.35 0 0 1 0-.499l2.772-2.773a.35.35 0 0 1 .5 0l2.772 2.772a.35.35 0 0 1 0 .498l-2.772 2.774a.35.35 0 0 1-.5 0zm4.48-4.48L9.062 7.77a.35.35 0 0 1 0-.5l2.772-2.772a.35.35 0 0 1 .5 0l2.77 2.772a.35.35 0 0 1 0 .498l-2.77 2.772a.35.35 0 0 1-.499 0v-.002v.001zM7.44 6.15L4.666 3.37a.35.35 0 0 1 0-.5L7.44.104a.35.35 0 0 1 .5 0l2.772 2.772a.35.35 0 0 1 0 .5L7.938 6.142a.35.35 0 0 1-.5 0l.002.006z"
                    />
                  </svg>
                  TestRail
                </TailwindButton>
                <TailwindButton onClick={handleClickXray}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    {/* Top Part */}
                    <path d="M15 8L7.5 8L15 1L15 8Z" fill="#4CAF50" />
                    <path d="M7.5 8L7.5 14.5L12.5 10.5L15 8L7.5 8Z" fill="#4CAF50" />

                    {/* Middle Fold */}
                    <path d="M7.5 14.5L12.5 10.5L17.5 12L13.5 15L7.5 14.5Z" fill="#66BB6A" />

                    {/* Bottom Tail */}
                    <path d="M17.5 12L13.5 15L10 23L17.5 12Z" fill="#98E1AA" />
                  </svg>
                  Xray Cloud
                </TailwindButton>
              </div>
            </div>
          </div>
          <div
            className={`relative max-w-8xl h-[130px] overflow-hidden shadow-custom-md text-text-primary transition-shadow duration-300 ease-custom bg-[#FFFFFF] dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#1F2F41] ${
              !isTicketSourceIntegrated ? 'opacity-40 pointer-events-none cursor-default' : ''
            }`}
            style={{ width: '98%', marginBottom: '18px', borderRadius: '8px' }}
          >
            <div className="py-4">
              <div className="text-xl font-semibold text-[#0A2342] dark:text-[#FFFFFF] mb-1 px-3 py-2 mx-3">
                Calendar Sources
              </div>
              <div className="w-[calc(100%-4rem)] border-t border-[#D1E2F0] dark:border-[#25384F] mx-6"></div>
              <div className="px-6 py-2 flex flex-wrap gap-4">
                <TailwindButton>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h10V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1V2zm2 2v1h2V4H5zM4 8v13h16V8H4zm6 2h4v3h-4v-3zm0 5h4v3h-4v-3zm6 0h4v3h-4v-3zm0-5h4v3h-4v-3zm-6 5H5v3h4v-3zm0-5H5v3h4v-3z"
                      fill="#34A853"
                    />
                  </svg>
                  Google Calendar
                </TailwindButton>
                <TailwindButton>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21.52 2H2.48A2.48 2.48 0 0 0 0 4.48v15.04A2.48 2.48 0 0 0 2.48 22h19.04A2.48 2.48 0 0 0 24 19.52V4.48A2.48 2.48 0 0 0 21.52 2zm-1.8 3l-2.52.95V8.27L19.72 8c1.3.01 2.35.57 3.05 1.5.39.56.55 1.15.55 1.75v4.52c0 1.16-.47 2.1-1.13 2.69-.65.59-1.5.94-2.52.94-1.05 0-1.89-.37-2.56-.89l-1.18-.94-1.52 1.21a6.85 6.85 0 0 0 4.19 1.44c1.58 0 2.9-.55 3.95-1.56 1.05-1 1.57-2.3 1.57-3.93v-4.54c0-1.16-.47-2.1-1.13-2.69-.65-.59-1.5-.94-2.52-.94-1.05 0-1.89.37-2.56.89L12.48 8h-6V5.95L14.78 2.74a5.8 5.8 0 0 1 3.94-1.44c1.58 0 2.9.55 3.95 1.56 1.05 1 1.57 2.3 1.57 3.93v4.54c0 1.16-.47 2.1-1.13 2.69-.65.59-1.5.94-2.52.94-1.05 0-1.89-.37-2.56-.89L11.6 16.26h6.92c1.59 0 2.9-.56 3.94-1.56 1.05-1 1.57-2.3 1.57-3.93v-4.54c0-1.16-.47-2.1-1.13-2.69-.65-.59-1.5-.94-2.52-.94-1.05 0-1.89.37-2.56.89L11.56 4.27H12v2h5v2h-1.02l-2.94-1.95c-.39-.26-.84-.39-1.34-.39-1.01 0-1.9.33-2.68 1.01s-1.17 1.58-1.17 2.58v6.47c0 1.01.38 1.82 1.13 2.45.76.62 1.68.94 2.74.94h3.53c1.57 0 2.9-.56 3.94-1.56 1.05-1 1.57-2.3 1.57-3.93v-4.54c0-1.16-.47-2.1-1.13-2.69-.65-.59-1.5-.94-2.52-.94-1.05 0-1.89.37-2.56.89L10.1 4.8H10V5.95l1.53.48V8h-1.11L8.34 6.95H8V2z"
                      fill="#0078D4"
                    />
                  </svg>
                  Outlook Calendar
                </TailwindButton>
                     <TailwindButton onClick={handleHolidayList}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14.93V17a1 1 0 1 1-2 0v-.07A8.001 8.001 0 0 1 4.07 13H5a1 1 0 1 1 0-2h-.93A8.001 8.001 0 0 1 11 4.07V5a1 1 0 1 1 2 0v-.93A8.001 8.001 0 0 1 19.93 11H19a1 1 0 1 1 0 2h.93A8.001 8.001 0 0 1 13 16.93z"
                      fill="#F59E0B"
                    />
                    <circle cx="12" cy="12" r="3" fill="#FBBF24" />
                  </svg>
                  Holiday List
                </TailwindButton>
              </div>
            </div>
          </div>
          <div
            className={`relative max-w-8xl h-[130px] overflow-hidden shadow-custom-md text-text-primary transition-shadow duration-300 ease-custom bg-[#FFFFFF] dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#1F2F41] ${
              !isTicketSourceIntegrated ? 'opacity-40 pointer-events-none cursor-default' : ''
            }`}
            style={{ width: '98%', marginBottom: '8px', borderRadius: '8px' }}
          >
            <div className="py-4">
              <div className="text-xl font-semibold text-[#0A2342] dark:text-[#FFFFFF] mb-1 px-3 py-2 mx-3">Team Sources</div>
              <div className="w-[calc(100%-4rem)] border-t border-[#D1E2F0] dark:border-[#25384F] mx-6"></div>
              <div className="px-6 py-2 flex flex-wrap gap-4">
                <TailwindButton>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.694 2C9.086 6.066 5.986 11.897 3.538 16.7c-.66 1.215-1.322 2.458-1.88 3.78a.293.293 0 0 0 .235.415h4.688c.13 0 .248-.084.287-.208l.776-2.383 4.19-13.534c.022-.068.037-.137.045-.209a.293.293 0 0 0-.092-.205C10.922 3.34 10.496 2 9.615 2H2.053a.294.294 0 0 0-.23.362c1.223 4.122 4.82 10.87 9.475 15.83a.293.293 0 0 0 .493-.08l1.744-5.68a.293.293 0 0 0-.092-.305c-1.557-1.341-3.445-3.08-5.554-4.812L8.503 7.9h8.907c1.636 0 2.946 1.31 2.946 2.946v1.95a.293.293 0 0 0 .273.291 4.017 4.017 0 0 1 2.917 3.13c.252 1.57-.088 3.225-1.014 4.533-.924 1.306-2.32 2.236-3.899 2.519l-4.585.003c-.21 0-.382-.118-.457-.301L11.694 2z"
                      fill="#0052CC"
                    />
                  </svg>
                  Atlasian Teams
                </TailwindButton>
              </div>
            </div>
          </div>
        </div>
      </CommonLayout>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        pauseOnHover={false}
        pauseOnFocusLoss={false}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        draggable={false}
        theme="light"
        limit={1}
        enableMultiContainer={false}
      />
      {ModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: 'Jira',
                host: '',
                username: '',
                password: '',
                sourceType: 'ticket_source',
              }}
              validationSchema={validationSchema}
              onSubmit={async (values) => {
                toast.dismiss();
                jiraMutation.mutate(values);
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]" style={{
                    boxShadow: theme === 'dark' 
                      ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)' 
                      : '0 4px 10px rgba(0, 0, 0, 0.2)',
                  }}>
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-white">
                        Jira Integration
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                        onClick={handClose}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="px-4 md:px-5 pb-4 space-y-3">
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Jira Organisation Name
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Get your Jira sitename from your Jira url (e.g.
                          https://[sitename].atlassian.net) and only enter the [sitename] portion
                        </p>
                        <Field
                          name="host"
                          type="text"
                          placeholder="Enter host name"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          API Token
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Create an API token (See instructions here) and enter it here.
                        </p>
                        <Field
                          name="password"
                          type="password"
                          placeholder="Enter API Token"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Jira Login Email
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter the email address that you use to login into Jira
                        </p>
                        <Field
                          name="username"
                          type="text"
                          placeholder="Enter Username"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-2 md:p-3 gap-3">
                      <Button onClick={handClose} variant="secondary" className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border">
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={jiraMutation.isPending}
                        disabled={jiraMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {jiraMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Please wait, connecting...</span>
                          </div>
                        ) : (
                          'Connect Jira'
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
      {trelloModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: 'Trello',
                host: '',
                username: '',
                password: '',
                sourceType: 'ticket_source',
              }}
              validationSchema={trelloValidationSchema}
              onSubmit={async (values) => {
                toast.dismiss();
                trelloMutation.mutate(values);
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]" style={{
                    boxShadow: theme === 'dark' 
                      ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)' 
                      : '0 4px 10px rgba(0, 0, 0, 0.2)',
                  }}>
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-gray-100">
                        Trello Integration
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-gray-100"
                        onClick={handleCloseTrello}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="px-4 md:px-5 pb-4 space-y-3">
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Trello Organisation Name
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Get your Trello sitename from your Trello url (e.g.
                          https://[sitename].atlassian.net) and only enter the [sitename] portion
                        </p>
                        <Field
                          name="host"
                          type="text"
                          placeholder="Enter host name"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          API Token
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Create an API token (See instructions here) and enter it here.
                        </p>
                        <Field
                          name="password"
                          type="password"
                          placeholder="Enter API Token"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Trello Login Email
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter the email address that you use to login into Trello
                        </p>
                        <Field
                          name="username"
                          type="text"
                          placeholder="Enter Username"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-2 md:p-3 gap-3">
                      <Button onClick={handleCloseTrello} variant="secondary" className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border">
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={trelloMutation.isPending}
                        disabled={trelloMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {trelloMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Please wait, connecting...</span>
                          </div>
                        ) : (
                          'Connect Trello'
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* <ToastContainer /> */}
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
      <JiraProjectModal
        isOpen={projectModalOpen}
        onClose={handleProjectModalClose}
        onApply={handleProjectSelection}
        jiraProjects={jiraProjects}
        loading={projectsLoading}
        onBackToIntegration={handleBackToIntegrationFromProjects}
        onProjectUpdate={handleProjectUpdate}
      />
      {azureModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: 'Azure Boards',
                host: '',
                username: '',
                password: '',
                sourceType: 'ticket_source',
              }}
              validationSchema={azureValidationSchema}
              onSubmit={async (values) => {
                toast.dismiss();
                setProjectModalSource('azure');
                azureMutation.mutate(values);
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div
                    className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]"
                    style={{
                      boxShadow:
                        theme === 'dark'
                          ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)'
                          : '0 4px 10px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-white">
                        Azure Boards Integration
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                        onClick={handleCloseAzure}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="px-4 md:px-5 pb-4 space-y-3">
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Azure Organisation Name
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Get your Azure organisation from your Azure DevOps URL (e.g.
                          https://dev.azure.com/[organisation]) and only enter the [organisation]
                          portion
                        </p>
                        <Field
                          name="host"
                          type="text"
                          placeholder="Enter host name"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          API Token
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Create a Personal Access Token and enter it here.
                        </p>
                        <Field
                          name="password"
                          type="password"
                          placeholder="Enter API Token"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Azure Login Email
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter the email address that you use to login into Azure DevOps
                        </p>
                        <Field
                          name="username"
                          type="text"
                          placeholder="Enter Username"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-2 md:p-3 gap-3">
                      <Button
                        onClick={handleCloseAzure}
                        variant="secondary"
                        className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border"
                      >
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={azureMutation.isPending}
                        disabled={azureMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {azureMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Please wait, connecting...</span>
                          </div>
                        ) : (
                          'Connect Azure Boards'
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
      {gitlabIssuesModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: 'GitLab Issues',
                host: '',
                username: '',
                password: '',
                sourceType: 'ticket_source',
              }}
              validationSchema={gitlabIssuesValidationSchema}
              onSubmit={async (values) => {
                toast.dismiss();
                setProjectModalSource('gitlab-issues');
                gitlabIssuesMutation.mutate(values);
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div
                    className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]"
                    style={{
                      boxShadow:
                        theme === 'dark'
                          ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)'
                          : '0 4px 10px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-white">
                        GitLab Issues Integration
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                        onClick={handleCloseGitlabIssues}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="px-4 md:px-5 pb-4 space-y-3">
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          GitLab Organisation Name
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Get your GitLab organisation from your GitLab URL (e.g.
                          https://gitlab.com/[organisation]) and only enter the [organisation]
                          portion
                        </p>
                        <Field
                          name="host"
                          type="text"
                          placeholder="Enter host name"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          API Token
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Create a Personal Access Token and enter it here.
                        </p>
                        <Field
                          name="password"
                          type="password"
                          placeholder="Enter API Token"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          GitLab Login Email
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter the email address that you use to login into GitLab
                        </p>
                        <Field
                          name="username"
                          type="text"
                          placeholder="Enter Username"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-2 md:p-3 gap-3">
                      <Button
                        onClick={handleCloseGitlabIssues}
                        variant="secondary"
                        className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border"
                      >
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={gitlabIssuesMutation.isPending}
                        disabled={gitlabIssuesMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {gitlabIssuesMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Please wait, connecting...</span>
                          </div>
                        ) : (
                          'Connect GitLab Issues'
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: selectedSource || 'Github',
                host: selectedSource === 'Bitbucket' ? '' : '',
                username: selectedSource === 'Bitbucket' ? '' : undefined,
                password: '',
                sourceType: 'code_source',
              }}
              validationSchema={getGitValidationSchema(selectedSource)}
              onSubmit={async (values) => {
                try {
                  gitMutation.mutate(values);
                } catch (error) {
                  toast.error(error);
                }
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]" style={{
                    boxShadow: theme === 'dark' 
                      ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)' 
                      : '0 4px 10px rgba(0, 0, 0, 0.2)',
                  }}>
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-white">
                        {selectedSource ? `${selectedSource} Integration` : 'Git Integration'}
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-gray-100"
                        onClick={() => handleOpenModal(null)}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="p-4 md:p-5 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
                      {selectedSource === 'Bitbucket' ? (
                        <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                          <div className="text-lg font-normal text-[#24527A] dark:text-gray-100 mb-1">Bitbucket Username</div>
                          <p className="text-sm text-[#24527A] dark:text-gray-400 mb-2">Enter your Bitbucket email address that you use to login.</p>
                          <Field name="username" type="text" placeholder="Enter your Bitbucket email" component={FormInput} variant="secondary" />
                        </div>
                      ) : (
                        <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                          <div className="text-lg font-normal text-[#24527A] dark:text-gray-100 mb-1">Organisation Name</div>
                          <p className="text-sm text-[#24527A] dark:text-gray-400 mb-2">
                            Get your {selectedSource || 'Git'} {selectedSource === 'Azure DevOps' ? 'Organisation name' : 'sitename'} from your {selectedSource || 'Git'} URL and only
                            enter the [{selectedSource === 'Azure DevOps' ? 'Organisation name' : 'sitename'}] portion.
                          </p>
                          <Field name="host" type="text" placeholder="Enter your organisation name" component={FormInput} variant="secondary" />
                        </div>
                      )}
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-gray-100 mb-1">API Token</div>
                        <p className="text-sm text-[#24527A] dark:text-gray-400 mb-2">Create an API token (See instructions here) and enter it here.</p>
                        <Field name="password" type="password" placeholder="Enter API Token" component={FormInput} variant="secondary" />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-4 md:p-5 gap-3 border-t border-gray-200 rounded-b dark:border-gray-600">
                      <Button onClick={() => handleOpenModal(null)} variant="secondary" className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border">
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={gitMutation.isPending}
                        disabled={gitMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {gitMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Please wait, connecting...</span>
                          </div>
                        ) : (
                          `Connect ${selectedSource || 'Git'}`
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
      {xrayModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: 'Xray Cloud',
                clientId: '',
                clientSecret: '',
                host: 'https://xray.cloud.getxray.app',
              }}
              validationSchema={xrayValidationSchema}
              onSubmit={({ clientId, clientSecret, host }) => {
                toast.dismiss();
                xrayMutation.mutate({
                  companyId,
                  name: 'Xray Cloud',
                  username: clientId,
                  password: clientSecret,
                  host,
                });
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div
                    className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]"
                    style={{
                      boxShadow:
                        theme === 'dark'
                          ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)'
                          : '0 4px 10px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-white">
                        Xray Cloud Integration
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                        onClick={handleClickXray}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="px-4 md:px-5 pb-4 space-y-3">
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Host
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter your Xray Cloud host (e.g. https://xray.cloud.getxray.app).
                        </p>
                        <Field
                          name="host"
                          type="text"
                          placeholder="https://xray.cloud.getxray.app"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Client ID
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter your Xray Cloud Client ID.
                        </p>
                        <Field
                          name="clientId"
                          type="text"
                          placeholder="Enter Client ID"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          Client Secret
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter your Xray Cloud Client Secret.
                        </p>
                        <Field
                          name="clientSecret"
                          type="password"
                          placeholder="Enter Client Secret"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-2 md:p-3 gap-3">
                      <Button
                        onClick={handleClickXray}
                        variant="secondary"
                        className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border"
                      >
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={xrayMutation.isPending}
                        disabled={xrayMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {xrayMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Please wait, connecting...</span>
                          </div>
                        ) : (
                          'Connect Xray Cloud'
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
      {testRailModalOpen && (
        <div
          className="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-[#182433] bg-opacity-50  border border-[#1F2F41]"
          tabIndex="-1"
          aria-hidden="true"
        >
          <div className="relative p-4 w-full max-w-2xl max-h-full">
            <Formik
              initialValues={{
                companyId: companyId,
                name: 'Testrail',
                host: '',
                username: '',
                password: '',
                sourceType: 'test_source',
              }}
              validationSchema={testRailValidationSchema}
              onSubmit={async (values) => {
                try {
                  testrailMutation.mutate(values);
                } catch (error) {
                  toast.error(error);
                }
              }}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit}>
                  <div className="relative bg-[#FFFFFF] dark:bg-[#182433] rounded-xl overflow-hidden border border-[#D1E2F0] dark:border-[#1F2F41]" style={{
                    boxShadow: theme === 'dark' 
                      ? '0 5.25px 21.02px rgba(0, 0, 0, 0.6)' 
                      : '0 4px 10px rgba(0, 0, 0, 0.2)',
                  }}>
                    <div className="flex items-center justify-between p-4 md:p-5">
                      <h3 className="text-2xl font-semibold text-[#24527A] dark:text-white">
                        TestRail Integration
                      </h3>
                      <button
                        type="button"
                        className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-gray-100"
                        onClick={handleClickTestRail}
                      >
                        <svg
                          className="w-3 h-3"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 14 14"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                          />
                        </svg>
                        <span className="sr-only">Close modal</span>
                      </button>
                    </div>
                    <div className="px-4 md:px-5 pb-4 space-y-3">
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          TestRail Organisation Name
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Get your TestRail sitename from your TestRail url (e.g.
                          https://[sitename].testrail.com) and only enter the [sitename] portion
                        </p>
                        <Field
                          name="host"
                          type="text"
                          placeholder="Enter host name"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          API Token
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Create an API token (See instructions here) and enter it here.
                        </p>
                        <Field
                          name="password"
                          type="password"
                          placeholder="Enter API Token"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                      <div className="bg-[#F6F8FC] dark:bg-[#151F2C] rounded-lg p-3 border border-[#D1E2F0] dark:border-[#1F2F41]">
                        <div className="text-lg font-normal text-[#24527A] dark:text-white mb-1">
                          TestRail Login Email
                        </div>
                        <p className="text-sm text-[#24527A] dark:text-[#92A5BC] mb-2">
                          Enter the email address that you use to login into TestRail
                        </p>
                        <Field
                          name="username"
                          type="text"
                          placeholder="Enter Username"
                          component={FormInput}
                          variant="secondary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end p-2 md:p-3 gap-3">
                      <Button onClick={handleClickTestRail} variant="secondary" className="!px-4 !py-2 !border-[#24527A] !text-[#24527A] !bg-transparent hover:!bg-[#E6EEFF] dark:hover:!bg-[#1E2B3A] hover:!text-[#24527A] !border">
                        Close
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={testrailMutation.isPending}
                        disabled={testrailMutation.isPending}
                        className="px-4 py-2 !bg-[#24527A] hover:!bg-[#5580A6] active:!bg-[#073C6A] !text-white dark:!bg-[#066FD1]"
                      >
                        {testrailMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Connecting to TestRail...</span>
                          </div>
                        ) : (
                          'Connect TestRail'
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}
    </>
  );
}
