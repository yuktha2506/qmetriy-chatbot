export const IST_OFFSET_MS = (parseFloat(process.env.IST_OFFSET_HOURS) || 5.5) * 60 * 60 * 1000;

export const jiraIssues = ['Story', 'Task', 'Bug', 'Epic', 'Sub-task'];
export const testerRoles = [
    'Tester',
    'QA',
    'QA Analyst',
    'Quality Analyst',
    'QA Lead',
    'QA Manager',
    'Test Engineer',
    'Test Lead',
    'Test Manager',
    'Test Architect',
    'Test Analyst',
    'Manual Tester',
    'Automation Engineer',
    'Test Automation Engineer',
    'SDET',
    'Software Tester',
    'Quality Assurance Engineer',
    'Quality Control Engineer',
    'Performance Tester',
    'Security Tester',
    'Functional Tester',
    'Regression Tester',
    'UAT Tester',
    'Quality Engineer',
    'Senior QA Engineer',
    'Lead QA Engineer',
    'QA Tester',
    'Testing Specialist',
    'Test Consultant',
    'Mobile Tester',
];
export const syncTypes = {
    HARD: 'hard',
    LIGHT: 'light',
};

export const boardTypes = {
    SCRUM: 'scrum',
    KANBAN: 'kanban',
    OTHER: 'other',
};

export const workTimeTypes = {
    WORK_STARTED: 'started',
    WORK_COMPLETED: 'completed',
};

export const promiseStatuses = {
    FULFILLED: 'fulfilled',
    REJECTED: 'rejected',
};

export const ASSIGNEE_UNASSIGNED_MATCH = {
    $or: [
        { assignee: null },
        { assignee: { $exists: false } },
        { assignee: '' },
        { assignee: 'Unassigned' },
        { assignee: 'UnAssigned' },
    ],
};
