// Status constants - normalized (lowercase)
// These represent completed/closed status values used across different providers (Jira, GitLab, etc.)

export const STATUS_ACTIVE = 'active';
export const STATUS_CLOSED = 'closed';
export const STATUS_DONE = 'done';
export const STATUS_UNRELEASED = 'Unreleased';

// Array of closed/completed statuses (normalized to lowercase)
export const CLOSED_STATUSES = [STATUS_CLOSED, STATUS_DONE];

// Milestone/Release status constants
export const MILESTONE_STATUS_ACTIVE = 'active';
export const MILESTONE_STATUS_CLOSED = 'closed';
export const MILESTONE_STATUS_FUTURE = 'future';
export const RELEASE_STATUS_RELEASED = 'Released';
export const RELEASE_STATUS_UNRELEASED = 'Unreleased';

// Array of milestone statuses (normalized to lowercase)
export const MILESTONE_STATUSES = [MILESTONE_STATUS_ACTIVE, MILESTONE_STATUS_CLOSED, MILESTONE_STATUS_FUTURE];

// Array of all release statuses (includes both GitLab milestone statuses and Jira release statuses)
export const ALL_RELEASE_STATUSES = [
    MILESTONE_STATUS_ACTIVE,
    MILESTONE_STATUS_CLOSED,
    MILESTONE_STATUS_FUTURE,
    RELEASE_STATUS_RELEASED,
    RELEASE_STATUS_UNRELEASED,
];
