/* eslint-disable no-constant-condition */
import 'dotenv/config';
import { ProjectModel } from '../modules/project-management/jira/model';
import CryptoJS from 'crypto-js';
import axios from 'axios';

export const getStartAndEndDate = async (companyId, projectId, tenantConnection) => {
    try {
        const Project = ProjectModel(tenantConnection);
        const project = await Project.findOne({ companyId, _id: projectId }, { _id: 0, lastSynced: 1 });
        if (!project || !project.lastSynced) {
            return { startOfDay: null, endOfDay: null };
        }
        const lastSynced = project.lastSynced.split(',')[0];
        const [day, month, year] = lastSynced.split('/');
        const formattedDate = `${year}-${month}-${day}`;
        const startOfDay = new Date(`${formattedDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${formattedDate}T23:59:59.999Z`);
        return { startOfDay, endOfDay };
    } catch (error) {
        throw new Error(`Error in getStartAndEndDate: ${error.message}`);
    }
};

export function normalizeDeveloperQueryParam(dev) {
    if (dev === undefined) {
        return undefined;
    }
    if (dev === null) {
        return null;
    }
    if (typeof dev === 'string') {
        const trimmedDeveloper = dev.trim();
        if (trimmedDeveloper === 'null' || trimmedDeveloper === 'undefined') {
            return null;
        }
        if (
            trimmedDeveloper === 'UnAssigned' ||
            trimmedDeveloper === 'Unassigned' ||
            /^unassigned$/i.test(trimmedDeveloper)
        ) {
            return null;
        }
        return trimmedDeveloper;
    }
    return dev;
}

export const getToday = async () => {
    try {
        const new_date = new Date();
        const year = new_date.getUTCFullYear();
        const month = String(new_date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(new_date.getUTCDate()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day}`;
        const startOfDay = new Date(`${formattedDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${formattedDate}T23:59:59.999Z`);

        return { startOfDay, endOfDay };
    } catch (error) {
        throw new Error(`Error in get today's date: ${error.message}`);
    }
};

export const calculateMedian = (array) => {
    if (array.length === 0) {
        return 0;
    }

    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        return sorted[mid];
    }
};

export const cryptoHandler = (input, mode = 'encrypt') => {
    const ENCRYPTION_KEY = process.env.ENCRYPT_DECRYPT_SECRET_KEY;
    if (!ENCRYPTION_KEY) {
        throw new Error('ENCRYPT_DECRYPT_SECRET_KEY is missing in environment variables');
    }
    if (!input) {
        throw new Error(`Input for ${mode}ion is required`);
    }

    return mode === 'encrypt' ? CryptoJS.AES.encrypt(input, ENCRYPTION_KEY).toString() : CryptoJS.AES.decrypt(input, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
};

export const convertISTStringToUTCISOString = (dateStr) => {
    try {
        const [datePart, timePart] = dateStr.split(', ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [time, modifier] = timePart.split(' ');
        const [hoursPart, minutes, seconds] = time.split(':').map(Number);
        let hours = hoursPart;

        if (modifier.toLowerCase() === 'pm' && hours !== 12) {
            hours += 12;
        } else if (modifier.toLowerCase() === 'am' && hours === 12) {
            hours = 0;
        }
        const istDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
        const utcDate = new Date(istDate.getTime() - (5 * 60 + 30) * 60 * 1000);
        return utcDate.toISOString(); 
    } catch (error) {
        throw new Error(`Error in convertISTStringToUTCISOString: ${error.message}`);
    }
};

export const getCycleTimeFormate = (arg1, arg2) => {
    const startDate = arg1 ? new Date(arg1) : null;
    const endDate = arg2 ? new Date(arg2) : new Date();
    if (!startDate || !endDate || endDate < startDate) { return '0d'; }
    const milliSecPerDay = 1000 * 60 * 60 * 24;

    const addCalendarMonthsUTC = (date, months) => {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const day = date.getUTCDate();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const ms = date.getUTCMilliseconds();

        const base = new Date(Date.UTC(year, month, 1, hours, minutes, seconds, ms));
        base.setUTCMonth(base.getUTCMonth() + months);
        const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
        base.setUTCDate(Math.min(day, lastDay));
        return base;
    };

    let months = 0;
    let current = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        startDate.getUTCHours(),
        startDate.getUTCMinutes(),
        startDate.getUTCSeconds(),
        startDate.getUTCMilliseconds()
    ));

    while (true) {
        const next = addCalendarMonthsUTC(current, 1);
        if (next <= endDate) {
            months += 1;
            current = next;
        } else {
            break;
        }
    }
    const remainingDaysTotal = Math.floor((endDate - current) / milliSecPerDay);
    const weeks = Math.floor(remainingDaysTotal / 7);
    const days = remainingDaysTotal % 7;

    const parts = [];
    if (months > 0) { parts.push(`${months}m`); }
    if (weeks > 0) { parts.push(`${weeks}w`); }
    if (days > 0 || parts.length === 0) { parts.push(`${days}d`); }
    return parts.join(' ');
};

const buildStatusOrderMap = (workflowStatuses = []) => {
    const map = {};
    for (const step of workflowStatuses) {
        const order = step.order;
        map[step.name?.trim()] = order;
        for (const status of step.statuses || []) {
            map[status.trim()] = order;
        }
    }
    return map;
};

export const getWorkTimeline = (workFlowData, statusChangeLog) => {
    if (!workFlowData?.length || !statusChangeLog?.length) {
        return { workStartedAt: null, workCompletedAt: null };
    }
    const orderMap = buildStatusOrderMap(workFlowData);
    const finalStatus = Math.max(...workFlowData.map(w => w.order));
    const sorted = [...statusChangeLog].sort((a, b) => {
        const dateA = a.changedAt?.$date ?? a.changedAt;
        const dateB = b.changedAt?.$date ?? b.changedAt;
        return new Date(dateA) - new Date(dateB);
    });
    let workStartedAt = null;
    let workCompletedAt = null;
    for (const log of sorted) {
        const fromOrder = orderMap[log.from?.trim()];
        const toOrder = orderMap[log.to?.trim()];
        if (fromOrder === null || toOrder === null) { continue; };
        if (!workStartedAt && toOrder > fromOrder) {
            const changedAt = log.changedAt?.$date ?? log.changedAt;
            workStartedAt = changedAt ? new Date(changedAt) : null;
        }
        if (toOrder === finalStatus) {
            const changedAt = log.changedAt?.$date ?? log.changedAt;
            workCompletedAt = changedAt ? new Date(changedAt) : null;
        }
    }
    return { workStartedAt, workCompletedAt };
};

export const getMonthsRangeTillCurrentMonth = (startDateInput) => {
    const inputDate = new Date(startDateInput);
    const today = new Date();

    const threeYearsAgo = new Date(Date.UTC(
        today.getUTCFullYear() - 3,
        today.getUTCMonth(),
        1, 0, 0, 0, 0
    ));

    const start = inputDate > threeYearsAgo ? inputDate : threeYearsAgo;
    const end = today;

    const months = [];
    let current = new Date(Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        1, 0, 0, 0, 0
    ));

    while (current <= end) {
        const year = current.getUTCFullYear();
        const month = current.getUTCMonth();

        const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

        months.push({
            monthName: monthStart.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString(),
            year: year.toString(),
        });

        current = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
    }
    return months;
};

export const getQuartersRangeTillCurrentQuarter = (startDateInput) => {
    const inputDate = new Date(startDateInput);
    const today = new Date();
    const threeYearsAgo = new Date(Date.UTC(today.getUTCFullYear() - 3, 0, 1, 0, 0, 0, 0));

    const start = inputDate > threeYearsAgo ? inputDate : threeYearsAgo;
    const end = today; 

    const quarters = [];
    let current = new Date(Date.UTC(
        start.getUTCFullYear(),
        Math.floor(start.getUTCMonth() / 3) * 3,
        1, 0, 0, 0, 0
    ));

    while (current <= end) {
        const year = current.getUTCFullYear();
        const quarterMonth = current.getUTCMonth();
        const q = Math.floor(quarterMonth / 3) + 1;

        const quarterStart = new Date(Date.UTC(year, quarterMonth, 1, 0, 0, 0, 0));
        const quarterEnd = new Date(Date.UTC(year, quarterMonth + 3, 0, 23, 59, 59, 999));

        quarters.push({
            periodName: `Q${q}`,
            startDate: quarterStart.toISOString(),
            endDate: quarterEnd.toISOString(),
            year: year.toString(),
        });

        current = new Date(Date.UTC(year, quarterMonth + 3, 1, 0, 0, 0, 0));
    }
    return quarters;
};

export const getYearsRangeTillCurrentYear = (startDateInput) => {
    const inputDate = new Date(startDateInput);
    const today = new Date();
    const threeYearsAgo = new Date(Date.UTC(today.getUTCFullYear() - 3, 0, 1, 0, 0, 0, 0));

    const startYear = inputDate > threeYearsAgo 
        ? inputDate.getUTCFullYear() 
        : threeYearsAgo.getUTCFullYear();

    const endYear = today.getUTCFullYear(); // include current year

    const years = [];
    for (let y = startYear; y <= endYear; y++) {
        const yearStart = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
        const yearEnd = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));

        years.push({
            periodName: String(y),
            startDate: yearStart.toISOString(),
            endDate: yearEnd.toISOString(),
            year: y.toString(),
        });
    }
    return years;
};

export const getProjectStartDateFromJira = async (jiraConfig, projectKey) => {
    const response = await axios.get(`${jiraConfig.host}/rest/api/3/search/jql`, {
        auth: {
            username: jiraConfig.username,
            password: jiraConfig.password,
        },
        params: {
            jql: `project = ${projectKey} ORDER BY created ASC`,
            maxResults: 1,
            fields: 'created,key',
        },
    });
    const createdStr = response?.data?.issues?.[0]?.fields?.created;
    return createdStr ? new Date(createdStr) : null;
};

export const getProjectStartDateFromAzure = async (organization, headers, projectName) => {
    try {
        // Use WIQL to find the oldest work item in the project
        const wiqlUrl = `https://dev.azure.com/${organization}/${encodeURIComponent(projectName)}/_apis/wit/wiql`;
        const wiqlQuery = {
            query: `SELECT [System.Id], [System.CreatedDate] FROM WorkItems WHERE [System.TeamProject] = '${projectName}' ORDER BY [System.CreatedDate] ASC`
        };
        
        const wiqlResponse = await axios.post(wiqlUrl, wiqlQuery, {
            headers,
            params: { 'api-version': '7.0', '$top': 1 }
        });
        
        const workItems = wiqlResponse.data?.workItems || [];
        if (!workItems.length) {
            return null;
        }
        
        // WIQL only returns IDs, so fetch the actual work item to get CreatedDate
        const workItemId = workItems[0].id;
        const detailUrl = `https://dev.azure.com/${organization}/_apis/wit/workitems/${workItemId}`;
        
        const detailResponse = await axios.get(detailUrl, {
            headers,
            params: { 'api-version': '7.0', 'fields': 'System.CreatedDate' }
        });
        
        const createdDate = detailResponse.data?.fields?.['System.CreatedDate'];
        return createdDate ? new Date(createdDate) : null;
    } catch (error) {
        console.error('Error fetching project start date from Azure:', error.message);
        return null;
    }
};

/**
 * Helper: Extract plain text from Atlassian Document Format (ADF)
 */
export const extractTextFromADF = (adfBody) => {
    if (!adfBody || !adfBody.content) {
        return '';
    }
    
    const extractText = (node) => {
        if (typeof node === 'string') {
            return node;
        }
        if (node.text) {
            return node.text;
        }
        if (node.content && Array.isArray(node.content)) {
            return node.content.map(extractText).join(' ');
        }
        return '';
    };
    
    return adfBody.content.map(extractText).join(' ');
};

/**
 * Helper: Get rejected labels from label array
 */
export const getRejectedLabels = (labels) => {
    if (!Array.isArray(labels) || labels.length === 0) {
        return [];
    }
    
    const rejectionLabels = [
        'non-reproducible',
        'non_reproducible',
        'not-reproducible',
        'not_reproducible',
        'not-valid',
        'not_valid',
        'invalid',
        'duplicate',
        'wont-fix',
        'wont_fix',
        'works-as-designed',
        'works_as_designed',
        'wad'
    ];
    
    const normalizedLabels = labels.map(label => 
        String(label).toLowerCase().trim().replace(/[_\s-]/g, '-')
    );
    
    const foundRejectedLabels = [];
    rejectionLabels.forEach(rejectionLabel => {
        normalizedLabels.forEach((label, index) => {
            // Use exact match only to avoid false positives (e.g., "PROD" matching "non-reproducible")
            if (label === rejectionLabel) {
                foundRejectedLabels.push(labels[index]); // Return original label case
            }
        });
    });
    
    return [...new Set(foundRejectedLabels)]; // Remove duplicates
};

/**
 * Helper: Get custom field validation (rejection or acceptance)
 * Returns object with type: 'rejected' or 'accepted', or null if neither
 */
export const getCustomFieldValidation = (customFieldsByName) => {
    if (!customFieldsByName || typeof customFieldsByName !== 'object') {
        return null;
    }
    
    const validityFieldPatterns = [
        'is the bug valid',
        'is bug valid',
        'bug valid',
        'valid bug',
        'valid issue',
        'issue valid',
        'is valid',
        'valid',
        'isvalid',
        'validity',
        'defect valid',
        'accepted',
        'is accepted',
        'bug accepted',
        'issue accepted'
    ];
    
    for (const [fieldName, fieldValue] of Object.entries(customFieldsByName)) {
        if (fieldValue === null || fieldValue === undefined) {
            continue;
        }
        
        const normalizedFieldName = String(fieldName).toLowerCase().trim();
        const isValidityField = validityFieldPatterns.some(pattern => 
            normalizedFieldName === pattern || 
            normalizedFieldName.includes(pattern) || 
            pattern.includes(normalizedFieldName)
        );
        
        if (isValidityField) {
            let normalizedValue;
            let originalValue;
            if (typeof fieldValue === 'boolean') {
                normalizedValue = fieldValue ? 'yes' : 'no';
                originalValue = fieldValue;
            } else if (typeof fieldValue === 'number') {
                normalizedValue = fieldValue === 0 ? 'no' : 'yes';
                originalValue = fieldValue;
            } else {
                let stringValue = fieldValue;
                if (typeof fieldValue === 'object') {
                    stringValue = fieldValue.value || fieldValue.name || fieldValue.id || String(fieldValue);
                }
                originalValue = stringValue;
                normalizedValue = String(stringValue).toLowerCase().trim();
            }
            
            // Check for NA values - treat as rejected
            const naValues = ['na', 'n/a', 'n.a', 'not applicable', 'not available'];
            if (naValues.some(naValue => normalizedValue === naValue)) {
                return {
                    type: 'rejected',
                    fieldName: fieldName,
                    fieldValue: originalValue
                };
            }
            
            // Check for rejection values first
            const rejectionValues = [
                'no', 'false', '0', 'n', 'invalid', 'rejected', 
                'not valid', 'not-valid', 'not_valid', 'unvalid', 
                'declined', 'denied'
            ];
            
            if (rejectionValues.some(rejectionValue => 
                normalizedValue === rejectionValue || 
                normalizedValue.includes(rejectionValue)
            )) {
                return {
                    type: 'rejected',
                    fieldName: fieldName,
                    fieldValue: originalValue
                };
            }
            
            // Check for acceptance values
            const acceptanceValues = [
                'yes', 'true', '1', 'y', 'valid', 'accepted', 'approved'
            ];
            
            if (acceptanceValues.some(acceptValue => 
                normalizedValue === acceptValue || 
                normalizedValue.includes(acceptValue)
            )) {
                return {
                    type: 'accepted',
                    fieldName: fieldName,
                    fieldValue: originalValue
                };
            }
        }
    }
    return null;
};

/**
 * SCENARIO 1: Status-Based Rejection
 * Determines if a bug is rejected based on explicit Jira status
 */
export const isBugRejectedByStatus = (statusName) => {
    if (!statusName) {
        return false;
    }
    const statusLower = String(statusName).toLowerCase().trim();
    const rejectionStatuses = [
        'cancelled',
        'rejected',
        'invalid',
        'not_reproducible',
        'not reproducible',
        'non-reproducible',
        'non_reproducible',
        'duplicate'
    ];
    return rejectionStatuses.includes(statusLower);
};

/**
 * SCENARIO 2a: Labels-Based Rejection
 */
export const isBugRejectedByLabels = (labels) => {
    if (!Array.isArray(labels) || labels.length === 0) {
        return false;
    }
    
    const rejectionLabels = [
        'non-reproducible',
        'non_reproducible',
        'not-reproducible',
        'not_reproducible',
        'not-valid',
        'not_valid',
        'invalid',
        'duplicate',
        'wont-fix',
        'wont_fix',
        'works-as-designed',
        'works_as_designed',
        'wad'
    ];
    
    const normalizedLabels = labels.map(label => 
        String(label).toLowerCase().trim().replace(/[_\s-]/g, '-')
    );
    
    // Use exact match only to avoid false positives (e.g., "PROD" matching "non-reproducible")
    return rejectionLabels.some(rejectionLabel => 
        normalizedLabels.includes(rejectionLabel)
    );
};

/**
 * SCENARIO 2b: Custom Field-Based Rejection
 */
export const isBugRejectedByCustomField = (customFieldsByName) => {
    if (!customFieldsByName || typeof customFieldsByName !== 'object') {
        return false;
    }
    
    const validityFieldPatterns = [
        'is the bug valid',
        'is bug valid',
        'bug valid',
        'valid bug',
        'valid issue',
        'issue valid',
        'is valid',
        'valid',
        'isvalid',
        'validity',
        'defect valid',
        'accepted',
        'is accepted',
        'bug accepted',
        'issue accepted'
    ];
    
    for (const [fieldName, fieldValue] of Object.entries(customFieldsByName)) {
        if (fieldValue === null || fieldValue === undefined) {
            continue;
        }
        
        const normalizedFieldName = String(fieldName).toLowerCase().trim();
        const isValidityField = validityFieldPatterns.some(pattern => 
            normalizedFieldName === pattern || 
            normalizedFieldName.includes(pattern) || 
            pattern.includes(normalizedFieldName)
        );
        
        if (isValidityField) {
            let normalizedValue;
            if (typeof fieldValue === 'boolean') {
                normalizedValue = fieldValue ? 'yes' : 'no';
            } else if (typeof fieldValue === 'number') {
                normalizedValue = fieldValue === 0 ? 'no' : 'yes';
            } else {
                let stringValue = fieldValue;
                if (typeof fieldValue === 'object') {
                    stringValue = fieldValue.value || fieldValue.name || fieldValue.id || String(fieldValue);
                }
                normalizedValue = String(stringValue).toLowerCase().trim();
            }
            
            const rejectionValues = [
                'no', 'false', '0', 'n', 'invalid', 'rejected', 
                'not valid', 'not-valid', 'not_valid', 'unvalid', 
                'declined', 'denied'
            ];
            
            if (rejectionValues.some(rejectionValue => 
                normalizedValue === rejectionValue || 
                normalizedValue.includes(rejectionValue)
            )) {
                return true;
            }
        }
    }
    return false;
};

/**
 * SCENARIO 3: Comments-Based Rejection
 */
export const isBugRejectedByComments = (comments) => {
    if (!Array.isArray(comments) || comments.length === 0) {
        return false;
    }
    
    const rejectionKeywords = [
        'non-reproducible', 'non_reproducible', 'not reproducible',
        'cannot reproduce', 'can\'t reproduce', 'cant reproduce',
        'unable to reproduce', 'duplicate', 'this is a duplicate',
        'duplicate of', 'not valid', 'invalid', 'not a bug',
        'not a valid bug', 'environment issue',
        'environment problem', 'user error',
        'user mistake', 'user issue', 'out of scope', 'not in scope',
        'wont fix', 'won\'t fix', 'will not fix', 'rejected', 'cancelled'
    ];
    
    const allCommentText = comments
        .map(comment => {
            if (typeof comment === 'string') {
                return comment;
            }
            if (comment.body) {
                if (typeof comment.body === 'string') {
                    return comment.body;
                }
                if (comment.body.content && Array.isArray(comment.body.content)) {
                    return extractTextFromADF(comment.body);
                }
            }
            if (comment.text) {
                return comment.text;
            }
            return '';
        })
        .filter(text => text && text.trim().length > 0)
        .join(' ')
        .toLowerCase();
    
    if (!allCommentText) {
        return false;
    }
    
    return rejectionKeywords.some(keyword => {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(allCommentText);
    });
};

/**
 * Helper: Get rejected comment keywords
 */
export const getRejectedCommentKeywords = (comments) => {
    if (!Array.isArray(comments) || comments.length === 0) {
        return [];
    }
    
    const rejectionKeywords = [
        'non-reproducible', 'non_reproducible', 'not reproducible',
        'cannot reproduce', 'can\'t reproduce', 'cant reproduce',
        'unable to reproduce', 'duplicate', 'this is a duplicate',
        'duplicate of', 'not valid', 'invalid', 'not a bug',
        'not a valid bug', 'working as designed', 'works as designed',
        'wad', 'works as expected', 'by design', 'environment issue',
        'environment problem', 'test environment', 'test data issue',
        'test data problem', 'incorrect test data', 'user error',
        'user mistake', 'user issue', 'out of scope', 'not in scope',
        'wont fix', 'won\'t fix', 'will not fix', 'rejected', 'cancelled'
    ];
    
    const allCommentText = comments
        .map(comment => {
            if (typeof comment === 'string') {
                return comment;
            }
            if (comment.body) {
                if (typeof comment.body === 'string') {
                    return comment.body;
                }
                if (comment.body.content && Array.isArray(comment.body.content)) {
                    return extractTextFromADF(comment.body);
                }
            }
            if (comment.text) {
                return comment.text;
            }
            return '';
        })
        .filter(text => text && text.trim().length > 0)
        .join(' ')
        .toLowerCase();
    
    if (!allCommentText) {
        return [];
    }
    
    const foundKeywords = [];
    rejectionKeywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(allCommentText)) {
            foundKeywords.push(keyword);
        }
    });
    
    return foundKeywords;
};

/**
 * Main method: Calculate isAccepted flag for a bug
 * Only calculates for Bug-type issues, returns null for others
 * Returns object with result and rejection scenario details if rejected
 */
export const calculateIsAccepted = (issueType, status, labels = [], customFieldsByName = {}, comments = []) => {
    // Only calculate for bugs
    if (!issueType || !issueType.name) {
        return null;
    }
    
    const issueTypeName = String(issueType.name).toLowerCase().trim();
    
    // Support multiple bug type names across platforms (Jira, Azure Boards, GitLab)
    const bugTypeNames = ['bug', 'defect', 'error', 'issue']; // Common bug type variations
    const isBug = bugTypeNames.includes(issueTypeName);
    
    if (!isBug) {
        return null;
    }
    
    // SCENARIO 1: Status-Based (HIGHEST PRIORITY)
    if (status && status.name && isBugRejectedByStatus(status.name)) {
        return {
            isAccepted: false,
            scenario: 'STATUS',
            details: {
                statusName: status.name,
                reason: `Bug rejected due to status: "${status.name}"`
            }
        };
    }
    
    // SCENARIO 2a: Labels-Based Rejection
    const rejectedLabels = getRejectedLabels(labels);
    if (rejectedLabels.length > 0) {
        return {
            isAccepted: false,
            scenario: 'LABELS',
            details: {
                rejectedLabels: rejectedLabels,
                allLabels: labels,
                reason: `Bug rejected due to label(s): ${rejectedLabels.join(', ')}`
            }
        };
    }
    
    // SCENARIO 2: Custom Field-Based Validation (rejection or acceptance)
    const customFieldValidation = getCustomFieldValidation(customFieldsByName);
    if (customFieldValidation) {
        if (customFieldValidation.type === 'rejected') {
            return {
                isAccepted: false,
                scenario: 'CUSTOM_FIELD',
                details: {
                    fieldName: customFieldValidation.fieldName,
                    fieldValue: customFieldValidation.fieldValue,
                    reason: `Bug rejected due to custom field "${customFieldValidation.fieldName}" = "${customFieldValidation.fieldValue}"`
                }
            };
        } else if (customFieldValidation.type === 'accepted') {
            return {
                isAccepted: true,
                scenario: 'CUSTOM_FIELD_ACCEPTED',
                details: {
                    fieldName: customFieldValidation.fieldName,
                    fieldValue: customFieldValidation.fieldValue,
                    reason: `Bug explicitly accepted due to custom field "${customFieldValidation.fieldName}" = "${customFieldValidation.fieldValue}"`
                }
            };
        }
    }
    
    // SCENARIO 3: Comments-Based Rejection
    const rejectedCommentKeywords = getRejectedCommentKeywords(comments);
    if (rejectedCommentKeywords.length > 0) {
        return {
            isAccepted: false,
            scenario: 'COMMENTS',
            details: {
                keywords: rejectedCommentKeywords,
                reason: `Bug rejected due to comment keyword(s): ${rejectedCommentKeywords.join(', ')}`
            }
        };
    }
    
    // If none of the rejection scenarios match, bug is accepted
    return {
        isAccepted: true,
        scenario: 'ACCEPTED',
        details: {
            reason: 'Bug passed all rejection criteria'
        }
    };
};
