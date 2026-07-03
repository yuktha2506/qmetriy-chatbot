export function isBucketAssigneeName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase();
  return !n || n === 'unassigned' || n === 'none' || n === 'n/a';
}

export function isUnassignedBucketName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase();
  return n === 'unassigned';
}

export function shouldShowUnassignedCapacityApiAssignee(assignee) {
  if (!isUnassignedBucketName(assignee?.assignee)) return true;
  return Number(assignee?.allocatedHours ?? 0) > 0;
}

export function shouldShowUnassignedCapacityGridRow(row, isHoursBased) {
  if (!isUnassignedBucketName(row?.name)) return true;
  const alloc = isHoursBased
    ? Number(row.allocatedHours ?? 0)
    : Number(row.allocatedStoryPoints ?? 0);
  return alloc > 0;
}

/** True / 'yes' / 'true' / case-insensitive 'yes' — used for API string flags. */
function isAffirmativeFlag(value) {
  return (
    value === true ||
    value === 'yes' ||
    value === 'true' ||
    (typeof value === 'string' && value.toLowerCase() === 'yes')
  );
}

export function isManuallyAddedCapacityRow(row) {
  if (!row || typeof row !== 'object') return false;
  return row.manuallyAdded === true || isAffirmativeFlag(row.addedManually);
}

export function isSprintOrReleaseLockedRow(row) {
  if (!row || typeof row !== 'object') return false;
  return isAffirmativeFlag(row.sprintOrReleaseUser);
}
