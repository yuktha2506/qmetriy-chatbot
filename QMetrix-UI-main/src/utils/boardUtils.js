import { getId, APP_STRINGS } from '../constants';

export const storeBoardInSession = (boardId, boardName, boardType) => {
  try {
    sessionStorage.setItem(APP_STRINGS.SESSION_BOARD_ID, boardId || '');
    sessionStorage.setItem(APP_STRINGS.SESSION_BOARD_NAME, boardName || '');
    sessionStorage.setItem(APP_STRINGS.SESSION_BOARD_TYPE, boardType || '');
    sessionStorage.setItem(
      APP_STRINGS.SESSION_SELECTED_BOARD,
      JSON.stringify({
        id: boardId || '',
        name: boardName || '',
        type: boardType || '',
      }),
    );
  } catch (error) {
    console.error(' Error storing board in sessionStorage:', error);
  }
};

export const restoreBoardFromSession = () => {
  try {
    const storedBoard = sessionStorage.getItem(APP_STRINGS.SESSION_SELECTED_BOARD);
    if (storedBoard) {
      const boardData = JSON.parse(storedBoard);
      return {
        id: boardData.id || '',
        name: boardData.name || '',
        type: boardData.type || '',
      };
    }
    return null;
  } catch (error) {
    console.error(' Error parsing stored board data:', error);
    return null;
  }
};

export const clearBoardFromSession = () => {
  try {
    sessionStorage.removeItem(APP_STRINGS.SESSION_BOARD_ID);
    sessionStorage.removeItem(APP_STRINGS.SESSION_SELECTED_BOARD);
  } catch (error) {
    console.error(' Error clearing board from sessionStorage:', error);
  }
};

export const getBoardIdFromSession = () => {
  try {
    return sessionStorage.getItem(APP_STRINGS.SESSION_BOARD_ID) || '';
  } catch (error) {
    console.error('Error getting boardId from sessionStorage:', error);
    return '';
  }
};

export const computeProjectDisplayName = (selectedProject, selectedBoard) => {
  if (selectedBoard?.name && selectedProject?.name) {
    return `${selectedProject.name} - ${selectedBoard.name}`;
  }
  return selectedProject?.name || APP_STRINGS.LABEL_SELECT_PROJECT;
};

export const handleBoardSelection = async (
  boardId,
  projectId,
  subMenuBoards,
  setSelectedBoard,
  setSelectedProject,
  getAllProjectList,
  handleProject,
  dispatch,
  setSubMenuBoards,
  setCurrentProjectForBoard,
  setIsBoardOpen,
) => {
  try {
    const selectedBoardData = subMenuBoards.find((board) => (board.id || board._id) === boardId);
    if (selectedBoardData) {
      const boardName = selectedBoardData.name || selectedBoardData.boardName || '';
      const boardType = selectedBoardData.type || selectedBoardData.boardType || '';
      setSelectedBoard({
        id: boardId,
        name: boardName,
        type: boardType,
      });
      storeBoardInSession(boardId, boardName, boardType);
      await handleProject(projectId, boardType, dispatch);
      const project = getAllProjectList.find((p) => p._id === projectId);
      if (project) {
        setSelectedProject({
          id: projectId,
          name: project.name,
        });
      }
      setSubMenuBoards([]);
      setCurrentProjectForBoard('');
      setIsBoardOpen(false);
    }
  } catch (error) {
    console.error(' Error handling board selection:', error);
  }
};

export const handleProjectHover = async (
  projectId,
  fetchBoardList,
  setIsBoardOpen,
  setSubMenuBoards,
  setCurrentProjectForBoard,
  setSubMenuPosition,
) => {
  try {
    setIsBoardOpen(false);
    setSubMenuBoards([]);
    setCurrentProjectForBoard('');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const companyId = getId().companyId;
    const boards = await fetchBoardList(companyId, projectId);

    if (boards.length > 1) {
      const hoveredElement = document.querySelector(
        `[${APP_STRINGS.ATTR_DATA_PROJECT_ID}="${projectId}"]`,
      );
      if (hoveredElement) {
        const rect = hoveredElement.getBoundingClientRect();
        setSubMenuPosition({
          top: rect.top,
          left: rect.right, // Reduced gap to match the second image spacing
        });
      } else {
        setSubMenuPosition({
          top: 100,
          left: 420,
        });
      }

      setSubMenuBoards(boards);
      setCurrentProjectForBoard(projectId);
      setIsBoardOpen(true);
    } else {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard('');
    }
  } catch (error) {
    console.error('Error in handleProjectHover:', error);
    setIsBoardOpen(false);
    setSubMenuBoards([]);
    setCurrentProjectForBoard('');
  }
};

export const handleProjectMouseLeave = (
  setIsBoardOpen,
  setSubMenuBoards,
  setCurrentProjectForBoard,
) => {
  setTimeout(() => {
    const submenuElement = document.querySelector('.board-submenu');
    const allProjectElements = document.querySelectorAll(APP_STRINGS.QUERY_DATA_PROJECT_ID);

    let isHoveringOverProject = false;
    allProjectElements.forEach((element) => {
      if (element.matches(':hover')) {
        isHoveringOverProject = true;
      }
    });

    if (submenuElement && !submenuElement.matches(':hover') && !isHoveringOverProject) {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard('');
    }
  }, 150); // Slightly increased delay for better UX
};

export const handleProjectArrowClick = async (
  projectId,
  event,
  fetchBoardList,
  setIsBoardOpen,
  setSubMenuBoards,
  setCurrentProjectForBoard,
  setSubMenuPosition,
) => {
  try {
    const companyId = getId().companyId;
    const boards = await fetchBoardList(companyId, projectId);

    if (boards.length > 1) {
      if (event && event.target) {
        const rect = event.target.getBoundingClientRect();
        setSubMenuPosition({
          top: rect.top,
          left: rect.right + 20,
        });
      } else {
        setSubMenuPosition({
          top: 100,
          left: 420,
        });
      }

      setSubMenuBoards(boards);
      setCurrentProjectForBoard(projectId);
      setIsBoardOpen(true);
    } else {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard('');
    }
  } catch (error) {
    console.error('Error in handleProjectArrowClick:', error);
    setIsBoardOpen(false);
    setSubMenuBoards([]);
    setCurrentProjectForBoard('');
  }
};

export const fetchBoardList = async (companyId, projectId, getBoardList) => {
  try {
    const response = await getBoardList(companyId, projectId);
    let boards = [];
    if (response && response.data) {
      if (Array.isArray(response.data)) {
        boards = response.data;
      } else if (response.data.boards && Array.isArray(response.data.boards)) {
        boards = response.data.boards;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        boards = response.data.data;
      }
    }

    return boards;
  } catch (error) {
    console.error('Error fetching board list:', error);
    return [];
  }
};

export const createBoardSubmenuProps = (
  isBoardOpen,
  subMenuBoards,
  subMenuPosition,
  currentProjectForBoard,
  handleBoardChange,
) => {
  return {
    isVisible: isBoardOpen && subMenuBoards.length > 0,
    style: {
      top: `${subMenuPosition.top}px`,
      left: `${subMenuPosition.left}px`,
    },
    onMouseEnter: () => {
    },
    onMouseLeave: () => {
    },
    boards: subMenuBoards,
    onBoardClick: handleBoardChange,
    currentProjectId: currentProjectForBoard,
  };
};

export function getBoardLabels(options = {}) {
  const fromArg = String(options.boardType || options.selectedBoard?.type || '').toLowerCase();
  const fromSelected = (() => {
    try {
      const sel = JSON.parse(sessionStorage.getItem(APP_STRINGS.SESSION_SELECTED_BOARD) || 'null');
      return String(sel?.type || '').toLowerCase();
    } catch {
      return '';
    }
  })();
  const fromSession = String(sessionStorage.getItem(APP_STRINGS.SESSION_BOARD_TYPE) || '').toLowerCase();

  const guessFromProjects = (() => {
    const list = options.projectList || [];
    const hasAzure = Array.isArray(list) && list.some((p) => {
      const t = String(p?.boardType || p?.type || '').toLowerCase();
      return (
        t === APP_STRINGS.AZURE_BOARD ||
        t === APP_STRINGS.AZURE_BOARD_KEBAB ||
        t.includes(APP_STRINGS.AZURE)
      );
    });
    return hasAzure ? APP_STRINGS.AZURE_BOARD_KEBAB : '';
  })();

  const t = fromArg || fromSelected || fromSession || guessFromProjects;

  const isAzure =
    t === APP_STRINGS.AZURE_BOARD ||
    t === APP_STRINGS.AZURE_BOARD_KEBAB ||
    t.includes(APP_STRINGS.AZURE);

  const isGitLab =
    t === APP_STRINGS.GITLAB_BOARD_KEBAB ||
    t === APP_STRINGS.GITLAB_BOARD ||
    t.includes(APP_STRINGS.GITLAB);

  return {
    isAzure,
    isGitLab,
    sprintLabel: isGitLab
      ? APP_STRINGS.LABEL_ITERATION
      : isAzure
        ? APP_STRINGS.LABEL_ITERATION
        : APP_STRINGS.VALUE_SPRINT,
    releaseLabel: isGitLab
      ? APP_STRINGS.LABEL_MILESTONE
      : isAzure
        ? APP_STRINGS.LABEL_EPIC
        : APP_STRINGS.VALUE_RELEASE,
  };
}
