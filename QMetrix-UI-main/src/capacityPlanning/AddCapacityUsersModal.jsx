import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import Modal from '../Common/Modal';
import {
  isBucketAssigneeName,
  isManuallyAddedCapacityRow,
  isSprintOrReleaseLockedRow,
  shouldShowUnassignedCapacityApiAssignee,
} from '../../utils/capacityPlanningUtils';

const normName = (n) => String(n || '').trim().toLowerCase();

const getUniqueId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const ManualDeleteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

export default function AddCapacityUsersModal({
  isOpen,
  onClose,
  onApply,
  isPersistAllowed = true,
  recalledOffPlan = [],
  purgedManualNormKeys = [],
  teamData = [],
  sprintReleaseAssignees = [],
  isHoursBasedProject,
  storyPointToHourRatio,
  calculateDependentValues,
  roles = [],
  onRequestRemoveManualUser,
}) {
  const theme = useSelector((state) => state.theme.theme);
  const [applySaving, setApplySaving] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [optionalChecked, setOptionalChecked] = useState({});
  const [manualChecked, setManualChecked] = useState({});
  const [pendingManualNames, setPendingManualNames] = useState([]);
  const [newUserName, setNewUserName] = useState('');
  const wasModalOpenRef = useRef(false);

  const defaultHoliday = teamData[0]?.holiday ?? 0;

  const purgedNormSet = useMemo(
    () => new Set((purgedManualNormKeys || []).map((k) => normName(k))),
    [purgedManualNormKeys],
  );

  const { lockedRows, optionalCandidates } = useMemo(() => {
    const lockedNorm = new Set();
    const locked = [];

    for (const r of teamData) {
      if (!isSprintOrReleaseLockedRow(r) || !r.name?.trim()) continue;
      if (isBucketAssigneeName(r.name)) continue;
      locked.push(r);
      lockedNorm.add(normName(r.name));
    }

    for (const a of sprintReleaseAssignees) {
      const nm = (a?.assignee || '').trim();
      if (!nm) continue;
      if (!shouldShowUnassignedCapacityApiAssignee(a)) continue;
      const bucket = isBucketAssigneeName(nm);
      const apiLocked = a.sprintOrReleaseUser === 'yes' || a.sprintOrReleaseUser === true;
      if (!bucket && !apiLocked) continue;
      if (lockedNorm.has(normName(nm))) continue;
      lockedNorm.add(normName(nm));
      locked.push({
        id: a._id != null ? String(a._id) : getUniqueId(),
        name: nm,
        sprintOrReleaseUser: 'yes',
        assigneeRow: a,
      });
    }

    locked.sort((a, b) => a.name.localeCompare(b.name));

    const manualNorm = new Set(
      teamData.filter((r) => isManuallyAddedCapacityRow(r) && r.name?.trim()).map((r) => normName(r.name)),
    );
    const seen = new Set();
    const candidates = [];

    for (const a of sprintReleaseAssignees) {
      const name = (a?.assignee || '').trim();
      if (!name || isBucketAssigneeName(name)) continue;
      if (a.addedManually === 'yes' || a.addedManually === true) continue;
      const key = normName(name);
      if (lockedNorm.has(key) || manualNorm.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ type: 'sprintAssignee', assigneeRow: a, name });
    }

    candidates.sort((a, b) => a.name.localeCompare(b.name));

    let candNorm = new Set(candidates.map((c) => normName(c.name)));
    for (const r of teamData) {
      if (!r.name?.trim()) continue;
      if (isBucketAssigneeName(r.name)) continue;
      if (isManuallyAddedCapacityRow(r)) continue;
      if (isSprintOrReleaseLockedRow(r)) continue;
      const nk = normName(r.name);
      if (lockedNorm.has(nk)) continue;
      if (candNorm.has(nk)) continue;
      candNorm.add(nk);
      candidates.push({
        type: 'teamOnly',
        name: r.name.trim(),
        teamRow: r,
      });
    }

    for (const a of sprintReleaseAssignees) {
      const name = (a?.assignee || '').trim();
      if (!name || isBucketAssigneeName(name)) continue;
      if (a.addedManually !== 'yes' && a.addedManually !== true) continue;
      if (a.presentInPlan !== 'no' && a.presentInPlan !== false) continue;
      const key = normName(name);
      if (purgedNormSet.has(key)) continue;
      if (lockedNorm.has(key)) continue;
      if (teamData.some((r) => r.name?.trim() && normName(r.name) === key)) continue;
      if (candNorm.has(key)) continue;
      candNorm.add(key);
      candidates.push({ type: 'manualStoredOffPlan', assigneeRow: a, name });
    }

    for (const ent of recalledOffPlan) {
      if (!ent?.name?.trim()) continue;
      const key = normName(ent.name);
      if (!key || isBucketAssigneeName(ent.name)) continue;
      if (ent.manual && purgedNormSet.has(key)) continue;
      if (lockedNorm.has(key)) continue;
      if (teamData.some((r) => r.name?.trim() && normName(r.name) === key)) continue;
      /**
       * Manual users removed from the table still need a recalled row even when the same name
       * exists on sprint/project roster (otherwise the duplicate sprint candidate hides recall).
       */
      if (ent.manual) {
        const filtered = candidates.filter((c) => normName(c.name) !== key);
        candidates.length = 0;
        candidates.push(...filtered);
        candNorm = new Set(candidates.map((c) => normName(c.name)));
      } else if (candNorm.has(key)) {
        continue;
      }
      candNorm.add(key);
      candidates.push({
        type: ent.manual ? 'recalledManual' : 'recalledJira',
        name: ent.name.trim(),
        assigneeRow: null,
      });
    }

    candidates.sort((a, b) => a.name.localeCompare(b.name));

    return { lockedRows: locked, optionalCandidates: candidates };
  }, [teamData, sprintReleaseAssignees, recalledOffPlan, purgedNormSet]);

  useEffect(() => {
    const justOpened = isOpen && !wasModalOpenRef.current;
    wasModalOpenRef.current = isOpen;
    if (!justOpened) return;
    const init = {};
    for (const c of optionalCandidates) {
      const inTeam = teamData.some((r) => normName(r.name) === normName(c.name));
      init[c.name] = inTeam;
    }
    setOptionalChecked(init);
    const initManual = {};
    for (const r of teamData) {
      if (!isManuallyAddedCapacityRow(r) || !r.name?.trim()) continue;
      initManual[normName(r.name)] = true;
    }
    setManualChecked(initManual);
    setPendingManualNames([]);
    setNewUserName('');
    setApplyError('');
  }, [isOpen, optionalCandidates, teamData]);

  const toggleOptional = useCallback((displayName) => {
    setOptionalChecked((prev) => ({ ...prev, [displayName]: !prev[displayName] }));
  }, []);

  const toggleManual = useCallback((normKey) => {
    setManualChecked((prev) => {
      const cur = prev[normKey] !== false;
      return { ...prev, [normKey]: !cur };
    });
  }, []);

  const addPendingManual = useCallback(() => {
    const trimmed = newUserName.trim();
    if (!trimmed) return;
    if (isBucketAssigneeName(trimmed)) return;
    const exists =
      teamData.some((r) => normName(r.name) === normName(trimmed)) ||
      pendingManualNames.some((n) => normName(n) === normName(trimmed));
    if (exists) return;
    const k = normName(trimmed);
    setPendingManualNames((p) => [...p, trimmed]);
    setManualChecked((prev) => ({ ...prev, [k]: true }));
    setNewUserName('');
  }, [newUserName, teamData, pendingManualNames]);

  const removePendingManual = useCallback((name) => {
    const k = normName(name);
    setPendingManualNames((p) => p.filter((n) => normName(n) !== k));
    setManualChecked((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const buildRowFromSprintAssignee = useCallback(
    (a) => {
      const role = a.role || '';
      const latestRole = roles.find((rr) => rr.role === role);
      const billingRate =
        latestRole != null ? latestRole.rate : Number(a.billingRate || 0);
      const manual = a.addedManually === 'yes' || a.addedManually === true;
      const sr =
        a.sprintOrReleaseUser === 'yes' || a.sprintOrReleaseUser === true ? 'yes' : 'no';
      const base = {
        id: a._id != null ? String(a._id) : getUniqueId(),
        name: (a.assignee || '').trim(),
        role,
        allocationType: a.allocationType || '',
        availableHours: Number(a.availableHours || 0),
        netAvailableCapacity: 0,
        previousAvailableDays: 0,
        previousStoryPointRatio: storyPointToHourRatio,
        allocatedStoryPoints: isHoursBasedProject ? 0 : Number(a.allocatedHours || 0),
        allocatedHours: isHoursBasedProject ? Number(a.allocatedHours || 0) : 0,
        billingRate,
        leaves: Number(a.leaves || 0),
        holiday: Number.isFinite(Number(a.holiday)) ? Number(a.holiday) : defaultHoliday,
        availableDays: 0,
        isNew: false,
        manuallyAdded: manual,
        addedManually: manual ? 'yes' : 'no',
        sprintOrReleaseUser: sr,
      };
      const calculated = calculateDependentValues(base, isHoursBasedProject);
      const plan =
        a.presentInPlan === 'no' || a.presentInPlan === false ? 'no' : 'yes';
      return { ...calculated, presentInPlan: plan };
    },
    [roles, storyPointToHourRatio, defaultHoliday, calculateDependentValues, isHoursBasedProject],
  );

  const buildManualRow = useCallback(
    (name) => {
      const base = {
        id: getUniqueId(),
        name,
        role: '',
        allocationType: '',
        availableHours: 0,
        netAvailableCapacity: 0,
        previousAvailableDays: 0,
        previousStoryPointRatio: storyPointToHourRatio,
        allocatedStoryPoints: 0,
        allocatedHours: 0,
        billingRate: 0,
        leaves: 0,
        holiday: defaultHoliday,
        availableDays: 0,
        isNew: true,
        manuallyAdded: true,
        addedManually: 'yes',
        sprintOrReleaseUser: 'no',
      };
      const calculated = calculateDependentValues(base, isHoursBasedProject);
      return {
        ...calculated,
        manuallyAdded: true,
        addedManually: 'yes',
        sprintOrReleaseUser: 'no',
        presentInPlan: 'yes',
      };
    },
    [storyPointToHourRatio, defaultHoliday, calculateDependentValues, isHoursBasedProject],
  );

  const buildRecalledOptionalRow = useCallback(
    (name) => {
      const base = {
        id: getUniqueId(),
        name,
        role: '',
        allocationType: '',
        availableHours: 0,
        netAvailableCapacity: 0,
        previousAvailableDays: 0,
        previousStoryPointRatio: storyPointToHourRatio,
        allocatedStoryPoints: 0,
        allocatedHours: 0,
        billingRate: 0,
        leaves: 0,
        holiday: defaultHoliday,
        availableDays: 0,
        isNew: true,
        manuallyAdded: false,
        addedManually: 'no',
        sprintOrReleaseUser: 'no',
      };
      return calculateDependentValues(base, isHoursBasedProject);
    },
    [storyPointToHourRatio, defaultHoliday, calculateDependentValues, isHoursBasedProject],
  );

  const sortedListItems = useMemo(() => {
    const lockedItems = [];
    const optionalItems = [];
    const manualItems = [];

    for (const r of lockedRows) {
      lockedItems.push({
        key: `locked-${r.id}`,
        kind: 'locked',
        name: r.name,
        row: r,
        isChecked: true,
      });
    }
    lockedItems.sort((a, b) => a.name.localeCompare(b.name));

    const recalledManualFromPlan = optionalCandidates.filter((c) => c.type === 'recalledManual');
    const manualStoredOffPlan = optionalCandidates.filter((c) => c.type === 'manualStoredOffPlan');
    const otherOptional = optionalCandidates.filter(
      (c) => c.type !== 'recalledManual' && c.type !== 'manualStoredOffPlan',
    );

    for (const c of otherOptional) {
      optionalItems.push({
        key: `opt-${normName(c.name)}`,
        kind: 'optional',
        name: c.name,
        candidate: c,
        isChecked: !!optionalChecked[c.name],
        checkboxDisabled: false,
      });
    }
    optionalItems.sort((a, b) => {
      const ca = a.isChecked ? 0 : 1;
      const cb = b.isChecked ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });

    const manualSeen = new Set();
    for (const n of pendingManualNames) {
      const nk = normName(n);
      manualSeen.add(nk);
      manualItems.push({
        key: `pend-${nk}`,
        kind: 'pending',
        name: n,
        normKey: nk,
        isChecked: manualChecked[nk] !== false,
      });
    }
    for (const r of teamData) {
      if (!isManuallyAddedCapacityRow(r) || !r.name?.trim()) continue;
      if (isBucketAssigneeName(r.name)) continue;
      const n = normName(r.name);
      if (manualSeen.has(n)) continue;
      manualSeen.add(n);
      manualItems.push({
        key: `em-${r.id}`,
        kind: 'existingManual',
        name: r.name,
        row: r,
        normKey: n,
        isChecked: manualChecked[n] !== false,
      });
    }
    manualItems.sort((a, b) => a.name.localeCompare(b.name));

    for (const c of [...recalledManualFromPlan, ...manualStoredOffPlan].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      let optionalManualDeleteId = null;
      if (c.type === 'manualStoredOffPlan' && c.assigneeRow) {
        const ar = c.assigneeRow;
        optionalManualDeleteId =
          ar._id != null && ar._id !== ''
            ? String(ar._id)
            : `offplan:${normName(c.name)}`;
      } else if (c.type === 'recalledManual') {
        optionalManualDeleteId = `recall:${normName(c.name)}`;
      }
      manualItems.push({
        key: `${c.type}-${normName(c.name)}`,
        kind: 'optional',
        name: c.name,
        candidate: c,
        isChecked: !!optionalChecked[c.name],
        checkboxDisabled: false,
        optionalManualDeleteId,
      });
    }

    return [...lockedItems, ...optionalItems, ...manualItems];
  }, [
    lockedRows,
    optionalCandidates,
    optionalChecked,
    pendingManualNames,
    teamData,
    manualChecked,
  ]);

  const computeMergedOutput = useCallback(
    () => {
      const out = [];
      const usedNorm = new Set();
      const inputTrimmed = newUserName.trim();
      const allPendingManual = [...pendingManualNames];
      if (inputTrimmed && !isBucketAssigneeName(inputTrimmed)) {
        const dup =
          teamData.some((r) => normName(r.name) === normName(inputTrimmed)) ||
          allPendingManual.some((n) => normName(n) === normName(inputTrimmed));
        if (!dup) {
          allPendingManual.push(inputTrimmed);
        }
      }

      for (const r of lockedRows) {
        const fromTeam =
          teamData.find((t) => t.id === r.id) ||
          teamData.find((t) => normName(t.name) === normName(r.name));
        const latest =
          fromTeam || (r.assigneeRow ? buildRowFromSprintAssignee(r.assigneeRow) : r);
        out.push(latest);
        if (latest.name) usedNorm.add(normName(latest.name));
      }

      for (const c of optionalCandidates) {
        if (c.type === 'manualStoredOffPlan' && c.assigneeRow) {
          const built = buildRowFromSprintAssignee({
            ...c.assigneeRow,
            presentInPlan: optionalChecked[c.name] ? 'yes' : 'no',
          });
          out.push({
            ...built,
            presentInPlan: optionalChecked[c.name] ? 'yes' : 'no',
            manuallyAdded: true,
            addedManually: 'yes',
          });
          usedNorm.add(normName(c.name));
          continue;
        }
        if (!optionalChecked[c.name]) continue;
        if (c.type === 'teamOnly' && c.teamRow) {
          const row =
            teamData.find((t) => t.id === c.teamRow.id) ||
            teamData.find((t) => normName(t.name) === normName(c.name)) ||
            c.teamRow;
          out.push(row);
          usedNorm.add(normName(c.name));
          continue;
        }
        if (c.type === 'recalledManual') {
          out.push(buildManualRow(c.name.trim()));
          usedNorm.add(normName(c.name));
          continue;
        }
        if (c.type === 'recalledJira') {
          out.push(buildRecalledOptionalRow(c.name.trim()));
          usedNorm.add(normName(c.name));
          continue;
        }
        const existing = teamData.find((t) => normName(t.name) === normName(c.name));
        if (existing) {
          out.push(teamData.find((t) => t.id === existing.id) || existing);
        } else if (c.type === 'sprintAssignee' && c.assigneeRow) {
          out.push(buildRowFromSprintAssignee(c.assigneeRow));
        }
        usedNorm.add(normName(c.name));
      }

      for (const r of teamData.filter((row) => isManuallyAddedCapacityRow(row))) {
        if (!r.name?.trim()) continue;
        if (isBucketAssigneeName(r.name)) continue;
        const nk = normName(r.name);
        if (usedNorm.has(nk)) continue;
        const row = teamData.find((t) => t.id === r.id) || r;
        if (manualChecked[nk] === false) {
          out.push({
            ...row,
            presentInPlan: 'no',
            manuallyAdded: true,
            addedManually: 'yes',
          });
        } else {
          out.push({
            ...row,
            presentInPlan: 'yes',
          });
        }
        usedNorm.add(nk);
      }

      for (const name of allPendingManual) {
        const nk = normName(name);
        if (usedNorm.has(nk)) continue;
        if (manualChecked[nk] === false) continue;
        out.push(buildManualRow(name.trim()));
        usedNorm.add(nk);
      }

      const jiraPart = out.filter((r) => !isManuallyAddedCapacityRow(r));
      const manualPart = out.filter((r) => isManuallyAddedCapacityRow(r));
      return [...jiraPart, ...manualPart];
    },
    [
      newUserName,
      pendingManualNames,
      teamData,
      lockedRows,
      optionalCandidates,
      optionalChecked,
      manualChecked,
      buildRowFromSprintAssignee,
      buildManualRow,
      buildRecalledOptionalRow,
    ],
  );

  const handleApply = useCallback(async () => {
    if (!isPersistAllowed || applySaving) return;
    const merged = computeMergedOutput();

    setApplySaving(true);
    setApplyError('');
    try {
      const result = onApply(merged, teamData);
      if (result != null && typeof result.then === 'function') {
        await result;
      }
      setNewUserName('');
      onClose();
    } catch (err) {
      setApplyError(err?.message || 'Could not save changes. Try again.');
    } finally {
      setApplySaving(false);
    }
  }, [
    isPersistAllowed,
    applySaving,
    computeMergedOutput,
    teamData,
    onApply,
    onClose,
  ]);

  const labelCls =
    theme === 'light' ? 'text-[#0A2342]' : 'text-[#FFFFFF]';
  const subCls =
    theme === 'light' ? 'text-gray-600' : 'text-gray-400';
  const boxCls =
    theme === 'light'
      ? 'border border-[#DFE0EF] bg-[#F8FAFC]'
      : 'border border-[#25384F] bg-[#1a2636]';

  const content = (
    <div className="px-3 py-2 space-y-2">
      <ul
        className={`rounded-lg p-2 max-h-[min(52vh,420px)] overflow-y-auto space-y-0 text-sm ${boxCls} divide-y ${
          theme === 'light' ? 'divide-[#E8EDF4]' : 'divide-[#25384F]'
        }`}
      >
        {sortedListItems.length === 0 ? (
          <li className={`py-2 ${subCls}`}>No members</li>
        ) : (
          sortedListItems.map((item) => (
            <li key={item.key} className="flex items-center gap-2.5 py-1.5 min-h-0">
              {item.kind === 'locked' && (
                <>
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    disabled
                    className="rounded shrink-0 opacity-70 cursor-not-allowed"
                    aria-label={`${item.name} (always on plan)`}
                  />
                  <span className={`flex-1 ${labelCls}`}>{item.name}</span>
                </>
              )}
              {item.kind === 'optional' && (
                <>
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    readOnly={!!item.checkboxDisabled}
                    disabled={!!item.checkboxDisabled}
                    onChange={() => {
                      if (!item.checkboxDisabled) toggleOptional(item.name);
                    }}
                    className={`rounded shrink-0 ${
                      item.checkboxDisabled ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                    aria-label={
                      item.checkboxDisabled
                        ? `${item.name} (required while work is allocated)`
                        : item.name
                    }
                  />
                  <span className={`flex-1 ${labelCls}`}>{item.name}</span>
                  {item.optionalManualDeleteId ? (
                    <button
                      type="button"
                      onClick={() => onRequestRemoveManualUser?.(item.optionalManualDeleteId)}
                      disabled={!isPersistAllowed}
                      title="Remove from capacity plan"
                      aria-label={`Remove ${item.name} from capacity plan`}
                      className="p-1.5 rounded inline-flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                    >
                      <ManualDeleteIcon />
                    </button>
                  ) : null}
                </>
              )}
              {item.kind === 'pending' && (
                <>
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    onChange={() => toggleManual(item.normKey)}
                    className="rounded shrink-0"
                    aria-label={item.name}
                  />
                  <span className={`flex-1 ${labelCls}`}>{item.name}</span>
                  <button
                    type="button"
                    onClick={() => removePendingManual(item.name)}
                    disabled={!isPersistAllowed}
                    title="Remove from list"
                    aria-label={`Remove ${item.name}`}
                    className="p-1.5 rounded inline-flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                  >
                    <ManualDeleteIcon />
                  </button>
                </>
              )}
              {item.kind === 'existingManual' && (
                <>
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    onChange={() => toggleManual(item.normKey)}
                    className="rounded shrink-0"
                    aria-label={item.name}
                  />
                  <span className={`flex-1 ${labelCls}`}>{item.name}</span>
                  <button
                    type="button"
                    onClick={() => onRequestRemoveManualUser?.(item.row.id)}
                    disabled={!isPersistAllowed}
                    title="Remove from capacity plan"
                    aria-label={`Remove ${item.name} from capacity plan`}
                    className="p-1.5 rounded inline-flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                  >
                    <ManualDeleteIcon />
                  </button>
                </>
              )}
            </li>
          ))
        )}
      </ul>

      <div className={`pt-2 border-t ${theme === 'light' ? 'border-[#DFE0EF]' : 'border-[#25384F]'}`}>
        <div className="flex flex-wrap gap-2 items-stretch sm:items-center">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPendingManual())}
            placeholder="Type name"
            className={`flex-1 min-w-[8rem] min-h-[2.25rem] px-2.5 py-1.5 rounded-md text-sm border outline-none transition-colors ${
              theme === 'light'
                ? 'bg-[#F8FAFC] border-[#DFE0EF] text-[#202020] placeholder:text-gray-500 focus:border-[#24527A] focus:ring-2 focus:ring-[#24527A]/25'
                : '!bg-[#1a2636] border-[#25384F] text-[#FFFFFF] placeholder:text-gray-500 [color-scheme:dark] focus:border-[#3d5a73] focus:ring-2 focus:ring-[#066FD1]/35'
            }`}
          />
          <button
            type="button"
            onClick={addPendingManual}
            className={`px-3 py-1.5 rounded-md text-sm font-medium text-white shrink-0 ${
              theme === 'light'
                ? 'bg-[#24527A] hover:bg-[#5580A6]'
                : 'bg-[#066FD1] hover:bg-[#2B8AE3]'
            }`}
          >
            Add new user
          </button>
        </div>
      </div>
      {applyError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {applyError}
        </p>
      ) : null}
    </div>
  );

  const requestClose = useCallback(() => {
    if (applySaving) return;
    onClose();
  }, [applySaving, onClose]);

  const actions = (
    <div className="flex justify-end gap-2 w-full">
      <button
        type="button"
        onClick={requestClose}
        disabled={applySaving}
        className={`px-3 py-1.5 rounded-md text-sm font-medium ${
          theme === 'light'
            ? 'bg-gray-200 text-[#202020] hover:bg-gray-300'
            : 'bg-[#25384F] text-[#D9E4F1] hover:bg-[#2f4a63]'
        } ${applySaving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleApply()}
        disabled={applySaving || !isPersistAllowed}
        className={`px-3 py-1.5 rounded-md text-sm font-medium bg-[#24527A] text-white hover:bg-[#5580A6] dark:bg-[#066FD1] dark:hover:bg-[#2B8AE3] ${
          applySaving || !isPersistAllowed ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {applySaving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title="Add users to capacity"
      size="small"
      content={content}
      actions={actions}
    />
  );
}

AddCapacityUsersModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  /** Opens parent confirm; on confirm, row is removed from table and modal list (same as legacy grid delete). */
  onRequestRemoveManualUser: PropTypes.func,
  isPersistAllowed: PropTypes.bool,
  recalledOffPlan: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      manual: PropTypes.bool,
    }),
  ),
  purgedManualNormKeys: PropTypes.arrayOf(PropTypes.string),
  teamData: PropTypes.arrayOf(PropTypes.object),
  sprintReleaseAssignees: PropTypes.arrayOf(PropTypes.object),
  isHoursBasedProject: PropTypes.bool.isRequired,
  storyPointToHourRatio: PropTypes.number.isRequired,
  calculateDependentValues: PropTypes.func.isRequired,
  roles: PropTypes.arrayOf(PropTypes.object),
};

AddCapacityUsersModal.defaultProps = {
  isPersistAllowed: true,
  recalledOffPlan: [],
  purgedManualNormKeys: [],
  teamData: [],
  sprintReleaseAssignees: [],
  roles: [],
  onRequestRemoveManualUser: undefined,
};
