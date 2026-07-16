const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(str) {
    return str.replace(RE_ESCAPE, '\\$&');
}

function normalizeIssueKey(projectLetters, digits) {
    return `${projectLetters.toUpperCase()}-${digits}`;
}

/**
 * Jira-style key at start of title or immediately after "[" (e.g. KAN-1185, KAN 1165, KAN-1155 - rest of title, [PROJ-1]).
 * Returns canonical KEY-NUMBER or null.
 */
export function extractLeadingJiraIssueKeyFromPrTitle(title) {
    if (!title || typeof title !== 'string') {
        return null;
    }
    const m = title.match(/(?:^|\[)\s*([A-Za-z]+)[\s-]+(\d+)\b/i);
    return m ? normalizeIssueKey(m[1], m[2]) : null;
}

/**
 * First Jira-style key anywhere in the title (word-boundary delimited).
 */
export function extractJiraIssueKeyFromPrTitleWordBoundary(title) {
    if (!title || typeof title !== 'string') {
        return null;
    }
    const m = title.match(/\b([A-Za-z]+)[\s-]+(\d+)\b/i);
    return m ? normalizeIssueKey(m[1], m[2]) : null;
}

/**
 * Regex to match a stored Jira issue key in a PR title, allowing hyphen or whitespace between project and number.
 */
export function buildPrTitleIssueKeyPattern(issueKey) {
    if (!issueKey || typeof issueKey !== 'string') {
        return /\b$/;
    }
    const trimmed = issueKey.trim();
    const split = trimmed.match(/^([A-Za-z]+)-(\d+)$/);
    if (split) {
        const proj = escapeRegExp(split[1]);
        const num = escapeRegExp(split[2]);
        return new RegExp(`\\b${proj}(?:-|\\s+)${num}(?!\\d)([a-zA-Z]*)\\b`, 'i');
    }
    return new RegExp(`\\b${escapeRegExp(trimmed)}(?!\\d)([a-zA-Z]*)\\b`, 'i');
}
