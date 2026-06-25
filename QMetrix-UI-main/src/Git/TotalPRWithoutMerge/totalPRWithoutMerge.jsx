import { useSelector } from 'react-redux';
import { useState, useEffect, useMemo } from 'react';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tooltip as ReactTooltip } from 'react-tooltip';

const TotalOpenPRWithoutMerge = () => {
  const theme = useSelector((state) => state.theme.theme);
  const [selectedValue, setSelectedValue] = useState({ label: 'Select an option', value: '' });
  const [getAllMergedPRsWithoutReview, setGetAllMergedPRsWithoutReview] = useState([]);
  const [activeFilter, setActiveFilter] = useState('no_reviews');
  const [filteredPRs, setFilteredPRs] = useState([]);
  const jiraData = useSelector((state) => state.jira || {});
  const gitData = useSelector((state) => state.git || {});

  useEffect(() => {
    if (jiraData) {
      setSelectedValue({
        label: jiraData.selectedValueLabel || 'Select an option',
        value: jiraData.selectedValue || '',
      });
    }
  }, [jiraData]);

  useEffect(() => {
    if (gitData) {
      setGetAllMergedPRsWithoutReview(gitData.mergedWithoutReviewPRs || []);
    }
  }, [gitData]);

  const repoConnector = useSelector(
    (state) => state.jira?.repositoryProvider?.repositoryProvider ?? null,
  );

  const totalMergedPRs = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map(
            (item) => item.getMergedPRsWithoutReviews?.totalMergedPRs,
          )
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const mergedPRsWithReview = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map(
            (item) => item.getMergedPRsWithoutReviews?.mergedWithReviewPrs,
          )
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const mergedPRsWithoutReview = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map(
            (item) => item.getMergedPRsWithoutReviews?.mergedWithoutReview,
          )
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const mergedPRsWithoutReviewLastWeekPercentage = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map(
            (item) => item.getMergedPRsWithoutReviews?.lastWeekUnreviewedPercentage,
          )
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const percentageMergedPRsWithoutReview = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map((item) => item.getPercentageMergedPRsNoReviews)
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const averageTimeMergedPRsWithoutReview = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map((item) => item.getAvgTimeMergedPRsNoReviews)
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const averageTimeMergedPRsWithReview = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map(
            (item) => item.getAverageMergeTimeWithReview?.AverageTimeToMerge,
          )
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const unreviewedPRs = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.flatMap(
            (item) => item.getMergedPRsWithoutReviews?.unreviewedPRDetails || [],
          )
        : [],
    [getAllMergedPRsWithoutReview],
  );

  const allMergedPRs = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.flatMap((item) => item.getHighRiskPRs?.mergedPRDetails || [])
        : [],
    [getAllMergedPRsWithoutReview],
  );

  const highRiskPRs = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.map((item) => item.getHighRiskPRs?.highRiskCount)
        : 0,
    [getAllMergedPRsWithoutReview],
  );

  const highRiskFactors = useMemo(
    () =>
      getAllMergedPRsWithoutReview?.length
        ? getAllMergedPRsWithoutReview.find((item) => item.getHighRiskPRs)?.getHighRiskPRs
            ?.riskFactorCounts || {}
        : {},
    [getAllMergedPRsWithoutReview],
  );

  useEffect(() => {
    if (!activeFilter) {
      setActiveFilter('no_reviews');
      return;
    }

    const filtered = [];
    const highRiskData = getAllMergedPRsWithoutReview?.find(
      (item) => item.getHighRiskPRs,
    )?.getHighRiskPRs;

    if (activeFilter === 'all_merged' || activeFilter === 'total_merged') {
      if (allMergedPRs.length > 0) {
        const mergedPRWithData = allMergedPRs.map((pr) => {
          const riskFactors = [];

          if (highRiskData?.riskFactorPRs) {
            Object.entries(highRiskData.riskFactorPRs).forEach(([factor, prs]) => {
              if (prs && prs.some((riskPr) => riskPr.prNumber === pr.prNumber)) {
                riskFactors.push(factor);
              }
            });
          }

          let sensitiveFiles = null;
          if (highRiskData?.riskFactorPRs?.sensitive_changes) {
            const sensitiveChangePR = highRiskData.riskFactorPRs.sensitive_changes.find(
              (sensitivepr) => sensitivepr && sensitivepr.prNumber === pr.prNumber,
            );
            if (sensitiveChangePR?.sensitiveFiles) {
              sensitiveFiles = sensitiveChangePR.sensitiveFiles;
            }
          }

          return { ...pr, riskFactors, sensitiveFiles };
        });

        filtered.push(...mergedPRWithData);
      } else {
        console.warn('No merged PRs available to display');
      }
    } else if (activeFilter === 'all_high_risk') {
      if (highRiskData?.riskFactorPRs) {
        const uniquePRs = new Map();

        Object.entries(highRiskData.riskFactorPRs).forEach(([, prs]) => {
          if (prs && Array.isArray(prs)) {
            prs.forEach((pr) => {
              if (pr && !uniquePRs.has(pr.prNumber)) {
                const riskFactors = Object.entries(highRiskData.riskFactorPRs)
                  .filter(
                    ([, categoryPRs]) =>
                      categoryPRs &&
                      Array.isArray(categoryPRs) &&
                      categoryPRs.some(
                        (categoryPR) => categoryPR && categoryPR.prNumber === pr.prNumber,
                      ),
                  )
                  .map(([key]) => key);

                uniquePRs.set(pr.prNumber, { ...pr, riskFactors });
              }
            });
          }
        });

        filtered.push(...Array.from(uniquePRs.values()));
      }
    } else if (activeFilter === 'sensitive_changes') {
      if (highRiskData?.riskFactorPRs?.sensitive_changes) {
        const prs = highRiskData.riskFactorPRs.sensitive_changes || [];

        prs.forEach((pr) => {
          if (pr) {
            const riskFactors = Object.entries(highRiskData.riskFactorPRs)
              .filter(
                ([, categoryPRs]) =>
                  categoryPRs &&
                  Array.isArray(categoryPRs) &&
                  categoryPRs.some(
                    (categoryPR) => categoryPR && categoryPR.prNumber === pr.prNumber,
                  ),
              )
              .map(([key]) => key);

            filtered.push({ ...pr, riskFactors });
          }
        });
      }
    } else if (activeFilter === 'no_reviews') {
      if (highRiskData?.riskFactorPRs) {
        const prs = highRiskData.riskFactorPRs[activeFilter] || [];

        prs.forEach((pr) => {
          if (pr) {
            const riskFactors = Object.entries(highRiskData.riskFactorPRs)
              .filter(
                ([, categoryPRs]) =>
                  categoryPRs &&
                  Array.isArray(categoryPRs) &&
                  categoryPRs.some(
                    (categoryPR) => categoryPR && categoryPR.prNumber === pr.prNumber,
                  ),
              )
              .map(([key]) => key);

            filtered.push({ ...pr, riskFactors });
          }
        });
      }
    } else if (highRiskData?.riskFactorPRs && highRiskData.riskFactorPRs[activeFilter]) {
      const prs = highRiskData.riskFactorPRs[activeFilter] || [];

      prs.forEach((pr) => {
        if (pr) {
          const riskFactors = Object.entries(highRiskData.riskFactorPRs)
            .filter(
              ([, categoryPRs]) =>
                categoryPRs &&
                Array.isArray(categoryPRs) &&
                categoryPRs.some((categoryPR) => categoryPR && categoryPR.prNumber === pr.prNumber),
            )
            .map(([key]) => key);

          filtered.push({ ...pr, riskFactors });
        }
      });
    }

    setFilteredPRs(filtered);
  }, [activeFilter, getAllMergedPRsWithoutReview, unreviewedPRs, allMergedPRs]);

  const handleRiskFactorClick = (factor) => {
    setActiveFilter(factor);
  };

  const renderRiskFactorRow = (label, count, factor) => {
    return (
      <p
        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors ${
          activeFilter === factor ? 'bg-blue-100 dark:bg-blue-900' : ''
        }`}
        onClick={() => handleRiskFactorClick(factor)}
      >
        {`${label}: ${count || 0}`}
      </p>
    );
  };

  const getFilteredTitle = () => {
    const type = repoConnector === 'GitLab' ? 'MRs' : 'PRs';

    switch (activeFilter) {
      case 'all_merged':
        return `All Merged ${type}`;
      case 'all_high_risk':
        return `All High Risk ${type}`;
      case 'large_size':
        return `${type} with Large Modified LOC`;
      case 'many_files':
        return `${type} with Many Modified Files`;
      case 'self_merged':
        return `Self-Merged ${type}`;
      case 'sensitive_changes':
        return `${type} with Sensitive Module Changes`;
      case 'missing_tests':
        return `${type} Missing Tests`;
      default:
        return `${type} with No Reviews`;
    }
  };

  const getHighRiskTooltipContent = () => {
    return `
        <div class="p-2">
          <h4 class="font-bold mb-2">High Risk ${
            repoConnector === 'GitLab' ? 'MRs' : 'PRs'
          } Explanation</h4>
          <ul class="list-disc pl-4 text-sm leading-snug">
            <li><strong>Large Modified LOC:</strong> Over 200 lines changed (additions + deletions).</li>
            <li><strong>Large Modified Files:</strong> More than 20 files modified.</li>
            <li><strong>No Reviews:</strong> No reviews before merging.</li>
            <li><strong>Self Merged:</strong> Author merged their own changes.</li>
            <li><strong>Sensitive Module Changes:</strong> Modifies critical paths (e.g., <code>auth/</code>, <code>payments/</code>, <code>security/</code>, <code>infrastructure/</code>).</li>
            <li><strong>Missing Tests:</strong> No test files added or updated.</li>
          </ul>
        </div>
      `;
  };

  return (
    <>
      <div className="bg-white dark:bg-[#182433] p-4 shadow-md rounded-md mb-4 flex justify-between items-center">
        <p className="text-2xl text-black dark:text-gray-300">
          {`High number of unreviewed ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'} detected this ${
            selectedValue.value
          }.`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <h4 className="text-2xl text-blue-600">{mergedPRsWithoutReview}</h4>
          <p className="text-black dark:text-gray-300">{`Total ${
            repoConnector === 'GitLab' ? 'MRs' : 'PRs'
          } Merged Without Review`}</p>
          <p className="text-sm text-black dark:text-gray-300">
            {`${parseFloat(mergedPRsWithoutReviewLastWeekPercentage) > 0 ? '+' : ''}${Math.round(
              parseFloat(mergedPRsWithoutReviewLastWeekPercentage),
            )}% since last week`}
          </p>
        </div>

        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
          <h4 className="text-2xl text-blue-600">{percentageMergedPRsWithoutReview} %</h4>
          <p className="text-black dark:text-gray-300">{`Percentage of ${
            repoConnector === 'GitLab' ? 'MRs' : 'PRs'
          } Merged Without Review`}</p>
          <div className="flex gap-4 items-center text-sm text-black dark:text-gray-300">
            <p>
              {`Reviewed Merged ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`}:{' '}
              {mergedPRsWithReview}
            </p>
            <p className="cursor-pointer hover:underline">
              {`Total Merged ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`}: {totalMergedPRs}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md flex flex-col justify-center">
          <p className="text-black dark:text-gray-300 text-sm">
            Average Time to Merge Without Review:
            <span className="text-blue-600 ml-1 text-sm">{averageTimeMergedPRsWithoutReview}</span>
          </p>
          <p className="text-sm text-black dark:text-gray-300 mt-2">
            Average Time to Merge With Review: {averageTimeMergedPRsWithReview}
          </p>
        </div>

        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md">
          <div className="flex justify-between items-center w-full">
            <div className="flex justify-between items-center w-full">
              <h4 className="text-2xl text-red-600 cursor-pointer hover:underline">
                {highRiskPRs}
              </h4>
              <span
                data-tooltip-id="tooltip-high-risk-prs"
                data-tooltip-html={getHighRiskTooltipContent()}
                data-tooltip-place="top"
                className="cursor-pointer"
              >
                <FontAwesomeIcon icon={faInfoCircle} className="text-gray-500" />
              </span>
              <ReactTooltip
                id="tooltip-high-risk-prs"
                place="top"
                effect="solid"
                offset={15}
                float={false}
                allowHTML={true}
                arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                opacity={1}
                style={{
                  backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                  color: 'white',
                  zIndex: 9999,
                  padding: '8px',
                  borderRadius: '5px',
                  maxWidth: '500px',
                  whiteSpace: 'normal',
                  position: 'absolute',
                }}
              />
            </div>
          </div>
          <p className="text-black dark:text-gray-300 text-lg">{`High-Risk Merged ${
            repoConnector === 'GitLab' ? 'MRs' : 'PRs'
          }`}</p>
          <div className="flex mt-2 flex-col text-sm text-black dark:text-gray-300">
            <p
              className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors ${
                activeFilter === 'all_merged' ? 'bg-blue-100 dark:bg-blue-900' : ''
              }`}
              onClick={() => handleRiskFactorClick('all_merged')}
            >
              {`Total Merged ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`}: {totalMergedPRs}
            </p>
            {renderRiskFactorRow(
              `Large Modified LOC ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`,
              highRiskFactors.large_size,
              'large_size',
            )}
            {renderRiskFactorRow(
              `Large Modified Files ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`,
              highRiskFactors.many_files,
              'many_files',
            )}
            {renderRiskFactorRow(
              `No Reviewed Merged ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`,
              highRiskFactors.no_reviews,
              'no_reviews',
            )}
            {renderRiskFactorRow(
              `Self Merged ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`,
              highRiskFactors.self_merged,
              'self_merged',
            )}
            {renderRiskFactorRow(
              `Sensitive Module changes ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`,
              highRiskFactors.sensitive_changes,
              'sensitive_changes',
            )}
            {renderRiskFactorRow(
              `Missing Tests ${repoConnector === 'GitLab' ? 'MRs' : 'PRs'}`,
              highRiskFactors.missing_tests,
              'missing_tests',
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#182433] p-4 rounded-md shadow-md col-span-2">
          <div className="flex justify-between items-center mb-2">
            <h5 className="text-lg text-black dark:text-gray-300">{getFilteredTitle()} :</h5>
          </div>
          <ul className="text-blue-600 max-h-56 overflow-y-auto overflow-x-auto">
            {filteredPRs.length === 0 ? (
              <li className="text-black min-h-52 dark:text-gray-400 italic flex items-center justify-center h-full">
                No records to display...
              </li>
            ) : (
              filteredPRs.map((pr) => {
                const host =
                  getAllMergedPRsWithoutReview.find((item) => item.getMergedPRsWithoutReviews)
                    ?.getMergedPRsWithoutReviews?.host ?? '';
                const prUrl =
                  repoConnector === 'GitHub'
                    ? `https://github.com/${host}/${pr.repo}/pull/${pr.prNumber}`
                    : `https://gitlab.com/${host}/${pr.repo}/-/merge_requests/${pr.prNumber}`;

                const sensitiveFilesDisplay =
                  pr.sensitiveFiles &&
                  (activeFilter === 'sensitive_changes' || activeFilter === 'total_merged') ? (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      <span className="font-medium">Affected Files:</span>
                      <ul className="ml-4 list-disc">
                        {pr.sensitiveFiles.map((file, idx) => (
                          <li key={idx}>
                            {file.filename} ({file.status}) - {file.additions} additions,{' '}
                            {file.deletions} deletions
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null;

                return (
                  <li
                    key={`${pr.repo}-${pr.prNumber}`}
                    className="mb-2 border-b dark:border-gray-700 pb-2"
                  >
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {`${repoConnector === 'GitLab' ? 'MR' : 'PR'} #${pr.prNumber}: ${
                        pr.title
                      } ( Merged: ${pr.daysAgo === 0 ? 'Today' : `${pr.daysAgo} days ago`} )`}
                    </a>
                    {sensitiveFilesDisplay}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </>
  );
};

export default TotalOpenPRWithoutMerge;
