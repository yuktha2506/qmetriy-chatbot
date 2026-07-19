/**
 * Developer Score Metrics:
 * - defectDensityScore: Measures bugs per thousand lines of code (KLOC)
 * - releaseCycleTimeScore: Time taken from development start to production deployment (in weeks)
 * - changeFailureRateScore: Percentage of deployments causing failures in production
 * - timeToFixScore: Average time taken to fix bugs (in days)
 * - reworkRatioScore: Percentage of code that needs to be reworked
 * - codeCoverageScore: Percentage of code covered by tests
 * - automationDoneScore: Percentage of tests that are automated
 * - staticCodeAnalysisScore: Number of issues found in static code analysis
 * - derScore: Defect Escape Ratio - number of defects that escape to production
 * - cycleTimeScore: Time taken to complete a development cycle (in days)
 *
 * Test Score Metrics:
 * - testCoverageScore: Percentage of code covered by tests
 * - testAutomationScore: Percentage of tests that are automated
 * - testCycleTimeScore: Time taken to complete test cycles (in days)
 * - traceabilityScore: Percentage of requirements traced to tests
 * - testingQualityScore: Number of bugs found during testing
 * - testingProductivityScore: Number of test cases completed per day
 * - automationTestingProductivityScore: Percentage of tests automated
 * - dlaScore: Defect Leakage Analysis - percentage of defects that escape testing
 *
 * Operation Score Metrics:
 * - deploymentFrequencyScore: Number of deployments per day
 * - meanTimeToRecoveryScore: Time taken to recover from failures (in hours)
 * - meanTimeBetweenFailuresScore: Average time between system failures (in days)
 * - averageDownTimeScore: Average system downtime (in hours)
 * - leadTimeForChangesScore: Time from code commit to deployment (in days)
 *
 * Release Readiness Metrics:
 * - tasksScore: Percentage of tasks completed
 * - epicsScore: Percentage of epics completed
 * - storiesScore: Percentage of stories completed
 * - bugsScore: Percentage of bugs fixed
 * - burndownScore: Percentage of work completed vs planned
 * - automationTestResultScore: Percentage of automated tests passing
 * - manualTestResultScore: Percentage of manual tests passing
 * - sprintIssuesReadinessScore: Overall readiness of sprint issues
 */

//developer score metrics

export const defectDensityScore = (value) => {
    if (value >= 0 && value <= 5) {
        return 100;
    } else if (value >= 6 && value <= 10) {
        return 50;
    } else if (value > 10) {
        return 0;
    } else {
        throw new Error('Invalid defect density value');
    }
};

export const releaseCycleTimeScore = (weeks) => {
    if (weeks < 2) {
        return 100;
    } else if (weeks > 2 && weeks <= 4) {
        return 75;
    } else if (weeks > 4 && weeks <= 6) {
        return 50;
    } else if (weeks > 6 && weeks <= 12) {
        return 25;
    } else if (weeks > 12) {
        return 0;
    } else {
        throw new Error('Invalid release cycle time value');
    }
};

export const changeFailureRateScore = (value) => {
    if (value < 5) {
        return 100;
    } else if (value >= 5 && value < 10) {
        return 75;
    } else if (value >= 10 && value < 20) {
        return 50;
    } else if (value >= 20 && value <= 30) {
        return 25;
    } else {
        return 0;
    }
};

export const timeToFixScore = (value) => {
    if (value >= 0 && value < 1) {
        return 100;
    } else if (value >= 1 && value < 2) {
        return 75;
    } else if (value >= 2 && value < 3) {
        return 50;
    } else if (value >= 3 && value <= 4) {
        return 25;
    } else {
        return 0;
    }
};

export const reworkRatioScore = (value) => {
    if (value < 5) {
        return 100;
    } else if (value >= 5 && value < 10) {
        return 75;
    } else if (value >= 10 && value < 15) {
        return 50;
    } else if (value >= 15 && value <= 20) {
        return 25;
    } else {
        return 0;
    }
};

export const codeCoverageScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};

export const automationDoneScore = (value) => {
    if (value >= 90) {
        return 100;
    } else if (value >= 70 && value < 90) {
        return 75;
    } else if (value >= 50 && value < 70) {
        return 50;
    } else if (value >= 30 && value < 50) {
        return 25;
    } else {
        return 0;
    }
};

export const staticCodeAnalysisScore = (value) => {
    if (value < 5) {
        return 100;
    } else if (value >= 5 && value < 10) {
        return 75;
    } else if (value >= 10 && value < 20) {
        return 50;
    } else if (value >= 20 && value <= 30) {
        return 25;
    } else {
        return 0;
    }
};

export const derScore = (value) => {
    if (value === 0) {
        return 100;
    } else if (value >= 1 && value <= 2) {
        return 50;
    } else if (value >= 3 && value <= 5) {
        return 25;
    } else if (value > 5) {
        return 0;
    } else {
        throw new Error('Invalid defect escape ratio value');
    }
};

export const cycleTimeScore = (value) => {
    if (value < 1) {
        return 100;
    } else if (value >= 1 && value < 2) {
        return 75;
    } else if (value >= 2 && value < 4) {
        return 50;
    } else if (value >= 4 && value <= 7) {
        return 25;
    } else {
        return 0;
    }
};

// Test Scores

export const testCoverageScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};

export const testAutomationScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};

export const testCycleTimeScore = (value) => {
    if (value < 1) {
        return 100;
    } else if (value >= 1 && value < 2) {
        return 75;
    } else if (value >= 2 && value < 3) {
        return 50;
    } else if (value >= 3 && value <= 4) {
        return 25;
    } else {
        return 0;
    }
};

export const traceabilityScore = (value) => {
    if (value >= 90) {
        return 100;
    } else if (value >= 75 && value < 90) {
        return 75;
    } else if (value >= 50 && value < 75) {
        return 50;
    } else if (value >= 25 && value < 50) {
        return 25;
    } else {
        return 0;
    }
};

export const testingQualityScore = (value) => {
    if (value < 5) {
        return 100;
    } else if (value >= 5 && value < 10) {
        return 75;
    } else if (value >= 10 && value < 15) {
        return 50;
    } else if (value >= 15 && value <= 20) {
        return 25;
    } else if (value >= 20) {
        return 0;
    } else {
        throw new Error('Invalid testingQuality value');
    }
};

export const testingProductivityScore = (value) => {
    if (value >= 90) {
        return 100;
    } else if (value >= 30 && value < 35) {
        return 75;
    } else if (value >= 20 && value < 25) {
        return 50;
    } else if (value >= 1 && value < 10) {
        return 25;
    } else {
        return 0;
    }
};

export const automationTestingProductivityScore = (percentage) => {
    if (percentage >= 90) {
        return 100;
    } else if (percentage >= 30 && percentage < 35) {
        return 75;
    } else if (percentage >= 20 && percentage < 25) {
        return 50;
    } else if (percentage >= 1 && percentage < 10) {
        return 25;
    } else {
        return 0;
    }
};

export const dlaScore = (leakage) => {
    if (leakage <= 2) {
        return 100;
    } else if (leakage > 2 && leakage <= 5) {
        return 75;
    } else if (leakage > 5 && leakage <= 8) {
        return 50;
    } else if (leakage > 8 && leakage <= 12) {
        return 25;
    } else if (leakage > 12) {
        return 0;
    } else {
        throw new Error('Invalid defect leakage value');
    }
};

// Operation Scores

export const deploymentFrequencyScore = (value) => {
    if (value >= 7) {
        return 100;
    } else if (value >= 5 && value < 7) {
        return 75;
    } else if (value >= 3 && value < 5) {
        return 50;
    } else if (value >= 1 && value < 3) {
        return 25;
    } else {
        return 0;
    }
};

export const meanTimeToRecoveryScore = (value) => {
    if (value < 1) {
        return 100;
    } else if (value >= 1 && value < 2) {
        return 75;
    } else if (value >= 2 && value < 5) {
        return 50;
    } else if (value >= 5 && value <= 10) {
        return 25;
    } else {
        return 0;
    }
};

export const meanTimeBetweenFailuresScore = (value) => {
    if (value >= 30) {
        return 100;
    } else if (value >= 20 && value < 30) {
        return 75;
    } else if (value >= 10 && value < 20) {
        return 50;
    } else if (value >= 5 && value < 10) {
        return 25;
    } else {
        return 0;
    }
};

export const averageDownTimeScore = (value) => {
    if (value < 1) {
        return 100;
    } else if (value >= 1 && value < 2) {
        return 75;
    } else if (value >= 2 && value < 5) {
        return 50;
    } else if (value >= 5 && value <= 10) {
        return 25;
    } else {
        return 0;
    }
};

export const leadTimeForChangesScore = (value) => {
    if (value < 1) {
        return 100;
    } else if (value >= 1 && value < 2) {
        return 75;
    } else if (value >= 2 && value < 5) {
        return 50;
    } else if (value >= 5 && value <= 10) {
        return 25;
    } else {
        return 0;
    }
};

//release readiness

export const tasksScore = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else if (value >= 1 && value < 20) {
        return 10;
    } else {
        return 0;
    }
};
export const epicsScore = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else if (value >= 1 && value < 20) {
        return 10;
    } else {
        return 0;
    }
};

export const storiesScore = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else if (value >= 1 && value < 20) {
        return 10;
    } else {
        return 0;
    }
};

export const bugsScore = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else if (value >= 1 && value < 20) {
        return 10;
    } else {
        return 0;
    }
};

export const burndownScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};

export const automationTestResultScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};

export const manualTestResultScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};

export const calculateEngineeringScore = (developerScore = 0, testScore = 0) => {
    const engineeringScore = developerScore * 0.5 + testScore * 0.5;
    return engineeringScore;
};

export const sprintIssuesReadinessScore = (value) => {
    if (value >= 80) {
        return 100;
    } else if (value >= 60 && value < 80) {
        return 75;
    } else if (value >= 40 && value < 60) {
        return 50;
    } else if (value >= 20 && value < 40) {
        return 25;
    } else {
        return 0;
    }
};
