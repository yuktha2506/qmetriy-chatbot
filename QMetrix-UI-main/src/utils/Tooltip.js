/* eslint-disable no-duplicate-case */
const getTooltipContent = (title, tableData = [], value) => {
    // Ensure tableData is always an array
    const safeTableData = Array.isArray(tableData) ? tableData : [];
    const tooltipDefinitions = {
        'Open Bugs': {
            main: 'Software defects or issues that have been reported, logged, and are yet to be resolved or closed by the development team.',
            'Issue Type':
                'Open Bugs are bugs that have been reported but not yet resolved, currently pending investigation or fixing.',
        },
        'Open Task': {
            main: 'A task that has been created and logged but is not yet completed or closed, remaining in an active or pending state.',
        },
        'Open Story': {
            main: 'A user story that has been created and logged but is not yet completed or closed, remaining in an active or pending state.',
        },
        'Total Bugs': {
            main: 'The total number of identified defects or issues reported in the system, which may affect functionality or performance.',
            RR: 'The total number of defects or issues reported in a software project, including both open and closed bugs.',
            DLA: 'Displays the total number of bugs identified in the system.',
            'Issue Type':
                'Total Bugs refers to the total number of identified defects or issues reported in the system, which may affect functionality or performance.',
        },
        'Total Task': {
            main: 'The total number of tasks created in a project, including both open and completed tasks.',
        },
        'Total Story': {
            main: 'The total number of user stories created in a project, including both open and completed stories.',
        },
        'Test Coverage': {
            main: "A metric that measures the extent to which the application's code, functionalities, or requirements are tested by a set of test cases.",
            'Number of Lines Executed': 'The count of lines of code that have been run during testing.',
            'Total Number of Lines':
                'The total number of lines of code written, including new, modified, and existing code.',
            'Average Test Coverage':
                'The percentage of code that has been tested out of the total codebase.',
        },
        'Burndown Story Points': {
            main: 'A metric that tracks the remaining story points over time in a sprint or project, helping teams visualize progress toward completion.',
        },
        'Burndown Hours': {
            main: 'A metric that tracks the remaining estimated work hours over time in a sprint or project, helping teams visualize progress toward completion.',
        },
        'Automation Test Result': {
            main: 'The outcome of a test case executed by an automated testing script or framework, used to validate the functionality, performance, or reliability of a software application.',
        },
        'Manual Test Result': {
            main: 'The outcome of a test case executed manually by a tester, based on predefined test steps and expected results, to validate the functionality, performance, or usability of a software application.',
        },
        'Original Estimate Story Points': {
            main: 'The initial, relative estimate of effort required to complete a task or user story, measured in story points, before any actual work begins.',
        },
        'Original Estimate Hours': {
            main: 'The initial estimated amount of time, measured in hours, required to complete a task or user story before any actual work begins.',
        },
        'Effort Spent Story Points': {
            main: 'The total number of story points representing the effort actually expended on a task or user story during its lifecycle, based on completed work.',
        },
        'Effort Spent Hours': {
            main: 'The total amount of time, measured in hours, that has been recorded as actual work completed on a task or user story.',
        },
        'Developer Score': {
            main: 'It helps in optimizing software development processes and ensuring the overall quality of the codebase.',
        },
        'Test Score': {
            main: 'It is a quantitative measure that assesses the quality of software testing efforts.',
        },
        'Operation Score': {
            main: 'It is a quantitative measure that assesses the efficiency and reliability of software operations and maintenance.',
        },
        'Cycle Time': {
            main: 'Cycle time is the time required to complete a task from start to finish.',
        },
        'Defect Density': {
            main: 'Defect density is a metric that measures the number of defects in a product or software component relative to its size.',
            'Total Defect':
                'Total defects represent the number of issues or bugs identified in the software during a specific period.',
            'Total Lines of code':
                'Total lines of code indicate the size of the codebase used to calculate defect density.',
            'Average Defect Density':
                'Average defect density represent the number of defects found in every 1000 lines of code. ',
        },
        'Rework Ratio': {
            main: 'Rework ratio is a metric that measures the amount of rework in a product or process relative to the total amount of work.',
        },
        'Change Failure Rate': {
            main: 'Change Failure Rate (CFR) represents the percentage of changes that result in failures requiring remediation. A lower CFR indicates a more stable and reliable deployment process.',
            'Total Success Count':
                'The number of successful deployments that did not lead to any post-deployment failures or require fixes.',
            'Failure Count':
                'The number of deployments that caused failures in production and required immediate remediation or rollback.',
            'Average Change Failure Rate':
                'How often deployments fail and need fixing. It’s the number of failed deployments out of the total, shown as a percentage.',
        },
        'Time To Fix Bug': {
            main: 'Time to Fix Bug is the duration between reporting and resolving a bug, influenced by severity, complexity, and team workload.',
            'Total Number of bugs':
                'The total number of bugs identified during the sprint or release cycle.',
            'Total Time Taken to Fix it':
                'The cumulative time spent resolving all reported bugs, used to calculate the average time to fix.',
        },
        'Code Coverage': {
            main: 'Code Coverage is a quantitative measure that assesses how much of the source code is executed during testing. Higher coverage generally implies better-tested and more reliable code.',
            'Lines of code tested': 'The number of lines of code that have been executed during testing.',
            'Total lines of code':
                'The number of failed code executions or uncovered test cases, indicating gaps in test coverage.',
            'Average Code Coverage': 'The mean coverage percentage across modules or test runs.',
        },
        'Automation Done': {
            main: 'The percentage or extent of tasks, processes, or test cases that have been automated to reduce manual effort and improve efficiency.',
        },
        'Static Code Analysis': {
            main: 'The process of examining source code without executing it to detect bugs, security vulnerabilities, and code quality issues.',
        },
        'Test Automation': {
            main: 'The percentage of test cases executed automatically using scripts or testing tools, improving efficiency, accuracy, and test coverage in the test score metric.',
            'Number of Automated Test Cases':
                'The count of test cases executed using automation tools instead of manual testing.',
            'Total Number of Test Cases':
                'The overall number of test cases, including both manual and automated tests.',
            'Average Test Automation':
                'The percentage of total tests that are run automatically instead of manually.',
        },
        'Test Cycle Time': {
            main: 'The total time taken to complete a full testing cycle, from the start of test planning to the final report, including test execution, defect identification, and resolution.',
        },
        Traceability: {
            main: 'The ability to track the relationship between requirements, test cases, and defects to ensure complete coverage and accountability.',
            'Number of Test Cases Created':
                'The total count of test cases designed to validate system functionality and requirements.',
            'Number of Functional Requirements to be Tested':
                'The total number of functional requirements that need to be validated through testing.',
            'Average Traceability':
                'It tells us how many test cases are written for each requirement. If the number is high, it means the requirements are well covered by tests.',
        },
        'Testing Quality': {
            main: 'The measure of how effectively tests identify defects, ensure coverage of requirements, and verify the functionality, reliability, and performance of the system.',
            'Invalid or Low Priority Bugs':
                'Bugs that are either not reproducible, irrelevant, or of minimal impact and do not require immediate attention.',
            'Total Bugs Logged':
                'The overall number of bugs recorded in the system, including both valid and invalid/low-priority issues.',
            'Average Testing Quality':
                ' Shows how good the overall testing was, based on things like bugs found and how much of the system was tested.',
        },
        'Testing Productivity': {
            main: 'A measure of the efficiency of the testing process, often calculated by the ratio of test cases executed or defects identified to the resources (time, effort, or cost) spent on testing.',
            'Number of Test Cases Executed':
                'The total count of test cases that have been run during the testing phase.',
            'Team Size':
                'The number of individuals involved in the testing process or on the testing team.',
            'Average Testing Productivity':
                'Shows how much testing work is done on average, compared to the time or effort spent.',
        },
        'Automation Testing Productivity': {
            main: 'The efficiency of automated testing, measured by the number of tests automated or executed within a given time or resource.',
            'Number Of Tests Executed':
                'The total count of test cases that have been run during the testing phase.',
            'Team Size':
                'The number of individuals involved in the testing process or on the testing team.',
            'Auto Testing Productivity':
                'Indicates how productive the automation effort is over a period or team size.',
            'Average Automation Testing Productivity':
                'Shows the average amount of automated testing work done compared to the time or team size used.',
        },
        DLA: {
            main: 'The process of identifying defects missed during testing and found after release, to improve testing effectiveness.',
            'Prod Bugs':
                'Bugs found in the production environment that impact the live system but may vary in severity.',
            'UAT Bugs':
                'Bugs found during User Acceptance Testing (UAT), regardless of priority, that need to be addressed before final approval.',
            'Escaped Bugs':
                'The number of issues or bugs found in a software product after it has been released into production, which were not detected during the pre-release testing phases.',
            'Total Bugs': 'Displays total number of bugs identified in the system.',
            'Average Defect Leakage Analysis':
                'Shows the average number of bugs that slipped through testing and were found after release.',
        },
        'Deployment Frequency': {
            main: 'Deployment Frequency measures how often code changes are deployed to production or staging. A higher frequency indicates an efficient CI/CD process and continuous delivery.',
            'Total Success Count':
                'The number of successful code deployments to production or staging environments.',
            'Total Days': 'The total number of days over which the deployment frequency is measured.',
            'Average Deployment Frequency':
                'How often code is deployed on average each day. It is calculated by dividing the total number of successful deployments by the number of days.',
        },
        'Lead Time For Changes': {
            main: 'Time between code commit and deployment to Production',
            'Total Success Count': 'The number of times a code commit successfully led to a deployment.',
            'Failure Count': 'The number of times a code commit failed to deploy to Production.',
            'Total PRs':
                'The total number of pull requests (PRs) created during the selected time period.',
            'Average LTC (Days)': 'The average time (in days) it took from code commit to deployment.',
            'Minimum LTC (Days)':
                'The shortest time (in days) it took for any code change to go from commit to deployment.',
            'Maximum LTC (Days)': 'The longest time (in days) it took for a code change to be deployed.',
        },
        'Mean Time To Recovery': {
            main: 'Mean Time to Recovery (MTTR) measures the average time taken to restore a system after a failure. A lower MTTR indicates a more resilient and efficient incident response process.',
            'Total Failures': 'The total count of system failures or incidents recorded.',
            'Total Recovery Time':
                'The cumulative time spent restoring the system after all recorded failures.',
            'Average Mean Time To Recovery':
                'The average time it takes to fix issues and bring the system back to normal. It is calculated by dividing the total recovery time by the number of failures.',
        },
        'Total Time Spent': {
            main: 'The total duration taken to complete all tasks or issues.',
        },
        'Total Stories Closed': {
            main: 'The total number of stories that have been completed and officially closed.',
        },
        'Total Defect': {
            main: 'The total number of identified defects in the software.',
        },
        'Total Lines of Code': {
            main: "The measurement of the software's scale or complexity.",
        },
        'Total Lines of Code Requiring Rework': {
            main: 'The number of lines of code that needed modifications or fixes after initial implementation.',
        },
        'Lines of Code Tested': {
            main: 'The number of lines of code that have been executed during testing.',
        },
        'Number of Lines Executed': {
            main: 'The count of lines of code that have been run during testing.',
        },
        'Total Number of Lines': {
            main: 'The overall number of lines in the codebase, including tested and untested code.',
        },
        'Number of Automated Test Cases': {
            main: 'The count of test cases executed using automation tools instead of manual testing.',
        },
        'Total Number of Test Cases': {
            main: 'The overall number of test cases, including both manual and automated tests.',
        },
        'Number of Test Cases Created': {
            main: 'The total count of test cases designed to validate system functionality and requirements.',
        },
        'Number of Functional Requirements to be Tested': {
            main: 'The total number of functional requirements that need to be validated through testing.',
        },
        'Invalid or Low Priority Bugs': {
            main: 'Bugs that are either not reproducible, irrelevant, or of minimal impact and do not require immediate attention.',
        },
        'Total Bugs Logged': {
            main: 'The overall number of bugs recorded in the system, including both valid and invalid/low-priority issues.',
        },
        'Number of Test Cases Executed': {
            main: 'The total count of test cases that have been run during the testing phase.',
        },
        'Team Size': {
            main: 'The number of individuals involved in the testing process or on the testing team.',
        },
        'Auto Testing Productivity': {
            main: 'Auto Testing Productivity measures the efficiency of automated tests in reducing effort, improving coverage, and speeding up execution.',
        },
        'Prod Bug': {
            main: 'Bugs found in the production environment that impact the live system but may vary in severity.',
        },
        'Prod Critical Bug': {
            main: 'High-priority bugs found in the production environment that significantly impact functionality or user experience.',
        },
        'UAT Bug': {
            main: 'Bugs found during User Acceptance Testing (UAT), regardless of priority, that need to be addressed before final approval.',
        },
        'UAT Critical Bug': {
            main: 'Critical issues discovered during User Acceptance Testing (UAT) that prevent the system from meeting business requirements or going live.',
        },
        'Total Number Of Resolved Bugs': {
            main: 'The total count of bugs that have been identified, fixed, and closed.',
        },
        'Total Effort Spent': {
            main: 'The cumulative time and resources invested in completing tasks, including development, debugging, and testing.',
        },
        'Duplicated Files': {
            main: 'Number of files with repeated code segments, indicating redundancy in the codebase.',
        },
        'Non-Commented Lines Of Code': {
            main: 'Total number of lines containing actual code, excluding comments and blank lines.',
        },
        Vulnerabilities: {
            main: 'Security weaknesses in the code that could be exploited by attackers.',
        },
        'Security Hotspots': {
            main: 'Sections of the code that may need manual review for potential security risks.',
        },
        'Duplicated Blocks': {
            main: 'Groups of code that are copied across different areas of the project, reducing maintainability.',
        },
        'Duplicated Lines': {
            main: 'Total number of lines that are repeated in the code, which can lead to inconsistencies during updates.',
        },
        'Code Smells': {
            main: 'Indicators of poor code practices that make the code harder to understand, maintain, or extend.',
        },
        'Coding Time': {
            main: 'Time spent actively writing and implementing code before it is ready for review.',
        },
        'Pick up Time': {
            main: 'Time taken from task assignment until the developer begins working on it.',
        },
        'Review Time': {
            main: 'Time taken for the code to be reviewed and approved after submission.',
        },
        'Time To Deploy': {
            main: 'Time elapsed from code approval to successful deployment in the production environment.',
        },
        'UAT Bugs': {
            main: 'UAT helps identify and resolve bugs, issues, or discrepancies that might have escaped earlier testing phases.',
        },
        'Escaped Bugs': {
            main: 'the number of issues or bugs found in a software product after it has been released into production, which were not detected during the pre-release testing phases.',
        },
        'Total Epics': {
            main: 'Total Epics refers to the total number of high-level work items or large bodies of work in a project, which can be broken down into smaller tasks or user stories.',
        },
        'Open Epics': {
            main: 'Open Epics are epics that are currently active or in progress, representing ongoing work that hasn’t been completed or closed yet.',
        },
        'Closed Epics': {
            main: 'Closed Epics are epics that have been completed, resolved, or marked as no longer active, indicating that all associated tasks or stories have been addressed.',
        },
        'Closed Bugs': {
            main: 'Closed Bugs are bugs that have been resolved, fixed, or marked as no longer valid after review.',
        },
        'Total Stories': {
            main: "The total number of user stories in the project, representing specific features or requirements from the user's perspective.",
        },
        'Open Stories': {
            main: 'User stories that are currently active, in progress, or yet to be started.',
        },
        'Closed Stories': {
            main: 'User stories that have been completed, implemented, and verified as done.',
        },
        'Total Sub-task': {
            main: 'The total number of sub-tasks, which break down larger tasks into more manageable, specific actions.',
        },
        'Open Sub-task': {
            main: 'Sub-tasks that are still pending or in progress.',
        },
        'Closed Sub-task': {
            main: 'Sub-tasks that have been completed or resolved.',
        },
        'Total Tasks': {
            main: 'The total number of tasks in the project, often representing smaller, actionable items within stories or epics.',
        },
        'Open Tasks': {
            main: 'Tasks that are pending, in progress, or not yet completed.',
        },
        'Closed Tasks': {
            main: 'Tasks that have been finished or marked as completed.',
        },
        'Total Others': {
            main: "The total number of work items that don't fall under standard categories like epics, stories, bugs, Sub-task, or tasks.",
        },
        'Open Others': {
            main: 'Miscellaneous work items that are still active or pending.',
        },
        'Closed Others': {
            main: 'Miscellaneous work items that have been completed or closed.',
        },
        Epics: {
            main: 'Epics in Jira are high-level issues that represent large initiatives or features. They serve as containers for related stories, tasks, or sub-tasks, helping organize and track work that spans multiple sprints, teams, or projects.',
        },
        Bugs: {
            main: 'Bugs in Jira are a specific issue type used to track problems affecting functionality or progress. Reported by users or developers, bugs follow a workflow from reporting and investigation to fixing and verification.',
        },
        Tasks: {
            main: 'Tasks in Jira represent individual pieces of work, often part of a larger story or feature. They are typically estimated in hours and help break down complex work into manageable units for tracking progress.',
        },
        Stories: {
            main: 'Stories in Jira capture user requirements in the form of user stories. As a core part of Agile development, they represent the smallest unit of work that delivers value to the end user.',
        },
        'Release Readiness': {
            main: 'Indicates the current software quality and readiness for market rollout. Measured as an aggregate of test coverage, bug status, Traceability, Automation done and static code analysis.',
        },
        'Engineering Score': {
            main: 'Provides a quality benchmark across Development, QE and Operation (DevOps) Functions.',
        },
        'Release Velocity': {
            main: 'Indicates the agility/speed of the business to react to market opportunities. Measured by number of releases per year.',
        },
        Trend: {
            main: 'Trend card displays key performance indicators and their averages over time break',
        },
        'Average Cycle Time Sprint Trend': {
            main: 'Average time from start to completion for work items across the last six sprints.',
        },
        'Average Cycle Time Release Trend': {
            main: 'Average time from start to completion for work items across the last six releases.',
        },
        'Average TTFB By Sprint': {
            main: 'Average time taken to identify, analyze, and resolve defects, calculated across the last six sprints.',
        },
        'Average TTFB By Release': {
            main: 'Average time taken to identify, analyze, and resolve defects, calculated across the last six releases.',
        },
        'Average Bug Rate By Sprint': {
            main: 'Represents the average of bug rate per sprint over the last six sprints, helping assess overall defect trends.',
        },
        'Average Bug Rate By Release': {
            main: 'Represents the average number of bugs identified per release over the last six releases, helping assess overall defect trends.',
        },
        'Average Defect Density By Sprint': {
            main: 'Represents the average defect density across the last six sprints, helping to assess overall code quality and stability trends over time.',
        },
        'Average Defect Density By Release': {
            main: 'Represents the average defect density across the last six releases, helping to assess overall code quality and stability trends over time.',
        },
        'Average Planned': {
            main: 'Represents the average amount of work planned at the beginning of each of the last six sprints/releases.',
        },
        'Average Incompleted': {
            main: 'Indicates the average amount of planned work that was not completed across the last six sprints/releases.',
        },
        'Average Completed': {
            main: 'Shows the average amount of work successfully completed during the last six sprints/releases.',
        },
        'Average Completed Late': {
            main: 'Represents the average amount of work completed after the sprint deadline across the last six sprints/releases.',
        },
        'Average Velocity': {
            main: 'Average velocity is the mean of the team’s completed work across past sprints/releases.',
        },
        'Average Team Member Velocity': {
            main: 'Average velocity is calculated by taking the mean of each team members individual velocity in this sprint/release.',
        },
        'Bug Rate By LOC': {
            main: '( Total Bugs / Number of lines of code ) * 100',
        },
        'Average Effort Of Fixing Defect': {
            main: 'Represents the average time to resolve all defects, highlighting how early detection can reduce overall resolution effort.',
        },
        'Average Cost Of Fixing Defect': {
            main: 'Represents the average cost of fixing all defects, helping evaluate how defect timing and resolution efficiency affect development expenses.',
        },
        'Average DRE By Sprint': {
            main: 'Shows the mean DRE over the last six sprints, measuring how effectively defects were caught and fixed before release.',
        },
        'Average DRE By Release': {
            main: 'Shows the mean DRE over the last six releases, measuring how effectively defects were caught and fixed before release.',
        },
        'Average DLA By Sprint': {
            main: 'Analyzes the average number of defects that escaped to production over the last six sprints, helping identify gaps in development and testing processes to improve future quality.',
        },
        'Average DLA By Release': {
            main: 'Analyzes the average number of defects that escaped to production over the last six releases, helping identify gaps in development and testing processes to improve future quality.',
        },
        'Average DRR By Sprint': {
            main: 'Shows the average defect rejection rate across the last six sprints.',
        },
        'Average DRR By Release': {
            main: 'Shows the average defect rejection rate across the last six releases.',
        },
        'Average DRR By Team Member': {
            main: 'Represents the average defect rejection by each team member within the current sprint, helping evaluate individual patterns in reporting invalid, non-reproducible, or duplicate defects.',
        },
        'Average DRR By Classification': {
            main: 'Represents the average defect rejection by classification within the current sprint, helping identify defect types prone to being marked invalid, non-reproducible, or duplicates.',
        },
        'Currently Blocked Story Points': {
            main: 'Represents the currently blocked story points.',
        },
        'Total Blocked Story Points': {
            main: 'Represents the total blocked story points.',
        },
        'Average Duration Of Blocked Story Points': {
            main: 'Represents the average duration of blocked story points across the last six sprints/releases.',
        },
        'Average Blocked Story Points Multiple Sprint Trend': {
            main: 'Represents the average of blocked story points across the last six sprints.',
        },
        'Average Blocked Story Points Multiple Release Trend': {
            main: 'Represents the average of blocked story points across the last six releases.',
        },
        'Deviation Between C & C Story Points': {
            main: 'Represents the deviation between committed and completed story points',
        },
        'Average Deviation Trend Over multiple Sprint': {
            main: 'Represents the average of deviation between committed and completed across the last six sprints.',
        },
        'Average Deviation Trend Over multiple Release': {
            main: 'Represents the average of deviation between committed and completed across the last six releases.',
        },
        'Average Of Total Story Points Committed': {
            main: 'Represents the average of total story points committed.',
        },
        'Average Of Total Story Points Completed': {
            main: 'Represents the average of total story points completed.',
        },
        'Average Committed': {
            main: 'Represents the average of total story points committed across the last six sprints/releases.',
        },
        'Average Gap': {
            main: 'Represents the gap average committed and average completed across the last six sprints/releases.',
        },
        'Average Initially Committed': {
            main: 'Represents the average of initially story points committed across the last six sprints/releases.',
        },
        'Average Finally Committed': {
            main: 'Represents the average of finally story points committed across the last six sprints/releases.',
        },
        'Average Done': {
            main: 'Represents the average of story points completed across the last six sprints/releases.',
        },
        'Pull Requests': {
            main: 'Pull requests track changes before merging into the main branch. This metric shows the total number of pull requests in the system.',
            'Total PRs': 'The total number of pull requests in the system.',
            'Total Open PRs': 'A pending pull request awaiting review and approval before merging.',
            'Total Closed PRs': 'The number of pull requests that have been closed, either by merging or manual closure.',
        },
        'Total Pull Requests': {
            main: 'Pull requests track changes before merging into the main branch. This metric shows the total number of pull requests in the system.',
            'Total PRs': 'The total number of pull requests in the system.',
            'Total Open PRs': 'A pending pull request awaiting review and approval before merging.',
            'Total Closed PRs': 'The number of pull requests that have been closed, either by merging or manual closure.',
        },
        'Total Open Pull Requests': {
            main: 'A pending pull request awaiting review and approval before merging.',
        },
        'Total Closed Pull Requests': {
            main: 'The number of pull requests that have been closed, either by merging or manual closure.',
        },
        'Total Merge Requests': {
            main: 'Merge requests track changes before merging into the main branch. This metric shows the total number of merge requests in the system.',
        },
        'Total Open Merge Requests': {
            main: 'A pending merge request awaiting review and approval before merging.',
        },
        'Total Closed Merge Requests': {
            main: 'The number of merge requests that have been closed, either by merging or manual closure.',
        },
        'Pull Requests Approval Rate': {
            main: 'The percentage of approved pull requests out of the total submitted.',
            'Average PR Approval Rate By Sprint': 'The percentage of approved pull requests per sprint, showing team performance over time.',
            'Average PR Approval Rate By Dev': 'The percentage of approved pull requests by individual developers, indicating reviewer efficiency.',
        },
        'Merge Requests Approval Rate': {
            main: 'The percentage of approved merge requests out of the total submitted.',
        },
        'Average PRs Iteration Time': {
            main: "The average time from a pull request's creation to its approval or closure, including review cycles.",
            'Total Average PR Iteration Time': 'The overall average time for all pull requests from creation to completion.',
            'Avg PR Iteration Time Per Sprint': 'The average time for pull requests to be completed within each sprint.',
            'Avg PR Iteration Time By Dev': 'The average time for pull requests to be completed by individual developers.',
        },
        'Average MRs Iteration Time': {
            main: "The average time from a merge request's creation to its approval or closure, including review cycles.",
        },
        'Total Merged PRs Without Review': {
            main: 'The number of pull requests merged without formal code review or approval.',
            'Total PRs Merged Without Review': 'The total count of pull requests that bypassed the review process.',
            'Percentage Of PRs Merged Without Review': 'The percentage of pull requests that were merged without proper code review.',
            'Average Time To Merge Without Review': 'The average time taken to merge pull requests that skipped the review process.',
            'High-Risk Pull Requests': 'Pull requests that were merged without review and may contain potential issues or bugs.',
        },
        'Total Merged MRs Without Review': {
            main: 'The number of merge requests merged without formal code review or approval.',
        },
        'Pull Requests Size': {
            main: 'The number of lines of code added, modified, or deleted in a pull request, indicating its complexity and review effort.',
            'Average PR Size Per Sprint': 'The average size of pull requests within each sprint, showing code change patterns.',
            'Average PR Size By Developer': 'The average size of pull requests created by individual developers.',
        },
        'Merge Requests Size': {
            main: 'The number of lines of code added, modified, or deleted in a merge request, indicating its complexity and review effort.',
        },
        'Total Cycle Time': {
            main: 'The total duration from the creation of a pull or merge request to its final merge or closure, including all review and iteration phases.',
            'Average Cycle Time By Sprint': 'The average time for pull requests to complete their lifecycle within each sprint.',
            'Average Cycle Time By Dev': 'The average time for pull requests to complete their lifecycle by individual developers.',
            'Coding Time': 'Time spent actively writing and implementing code before it is ready for review.',
            'Pick Up Time': 'Time taken from task assignment until the developer begins working on it.',
            'Review Time': 'Time taken for the code to be reviewed and approved after submission.',
        },
        Manual: {
            main: 'Count of manual test cases for new & executed and the pass percentage for manual testing',
        },
        Automation: {
            main: 'Count of automated test cases for new & executed and the pass percentage for automation testing',
        },
        Coverage: {
            main: 'The number of automated test cases & regression tests available in the test suite',
        },
    };

    let displayTitle = '';
    let description = '';

    if (value && tooltipDefinitions[title] && tooltipDefinitions[title][value]) {
        displayTitle = value;
        description = tooltipDefinitions[title][value];
    } else if (tooltipDefinitions[title] && tooltipDefinitions[title].main) {
        displayTitle = title;
        description = tooltipDefinitions[title].main;
    } else {
        return <p>No tooltip available.</p>;
    }

    const hideTitleFor = new Set(['Manual', 'Automation', 'Coverage']);
    const showTitle = displayTitle && !hideTitleFor.has(displayTitle);
    const descriptionFontSize = hideTitleFor.has(displayTitle) ? '12px' : '14px';

    return (
        <div style={{ textAlign: 'left', maxWidth: '500px' }}>
            {showTitle && (
                <p
                    style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                        marginBottom: '6px',
                    }}
                >
                    {displayTitle}
                </p>
            )}
            <p style={{ fontSize: descriptionFontSize, color: '#ddd', marginBottom: '10px' }}>{description}</p>
            {safeTableData.length > 0 && (
                <div
                    style={{
                        borderBottom: '3px solid rgba(255, 255, 255, 0.3)',
                        margin: '8px 0',
                    }}
                ></div>
            )}
            {safeTableData.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '8px',
                        flexWrap: 'wrap',
                    }}
                >
                    {safeTableData.map((row, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flex: '1 1 auto',
                                minWidth: '120px',
                            }}
                        >
                            <div
                                style={{
                                    backgroundColor: row.color,
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255, 255, 255, 0.5)',
                                    boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
                                }}
                            ></div>
                            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{row.description}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
export default getTooltipContent;
