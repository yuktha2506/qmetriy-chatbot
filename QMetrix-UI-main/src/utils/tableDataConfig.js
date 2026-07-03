/* eslint-disable no-dupe-keys */
const tableDataConfig = {
  "Open Bugs": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% bugs" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% bugs" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% bugs" }
  ],
  "Open Task": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% tasks" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% tasks" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% tasks" }
  ],
  "Open Story": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% storys" },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% storys" },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% storys" }
  ],
  "Total Bugs": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "More than 2% bugs" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "More than 0% and up to 2% bugs" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "0% bugs" }
  ],
  "Total Task": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "-" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "-" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "-" }
  ],
  "Total Story": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "-" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "-" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "-" }
  ],
  "Test Coverage": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Low coverage (0-70%)" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Moderate coverage (71-85%)" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "High coverage (>85%)" }
  ],
  "Burndown Story Points": [
      { "label": "Red", "color": "var(--trisoled-color-primary)", "description": "Low progress (50% or less completed)" },
      { "label": "Orange", "color": "var(--trisoled-color-secondary)", "description": "Moderate progress (51% to 80% completed)" },
      { "label": "Green", "color": "var(--trisoled-color-tertiary)", "description": "High progress (81% or more completed)" }
  ],
  "Burndown Hours": [
      { "label": "Red", "color": "var(--trisoled-color-primary)", "description": "Low effort logged (50% or less completed)" },
      { "label": "Orange", "color": "var(--trisoled-color-secondary)", "description": "Moderate effort logged (51% to 80% completed)" },
      { "label": "Green", "color": "var(--trisoled-color-tertiary)", "description": "High effort logged (81% or more completed)" }
  ],

  "Automation Test Result": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Less than 50% passed" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "50% to 85% passed" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "More than 85% passed" }
  ],
  "Manual Test Result": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Less than 50% passed" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "50% to 85% passed" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "More than 85% passed" }
  ],
  "Effort Spent Story Points": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Low progress (50% or less completed)" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Moderate progress (51% to 80% completed)" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "High progress (81% or more completed)" }
  ], "Effort Spent Hours": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "Low progress (50% or less completed)" },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Moderate progress (51% to 80% completed)" },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "High progress (81% or more completed)" }
  ], "Original Estimate Story Points": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Low estimated effort (0-40 story points)" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Moderate estimated effort (41-80 story points)" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "High estimated effort (81+ story points)" }
  ], "Original Estimate Hours": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Low estimated effort (0-40 hours)" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Moderate estimated effort (41-100 hours)" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "High estimated effort (101+ hours)" }
  ],
  "Developer Score": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Score 0-40: Needs improvement." },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Score 41-70: Moderate performance." },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Score 71-100: Excellent performance." }
  ],
  "Test Score": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "Score 0-40: Needs improvement." },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Score 41-70: Moderate performance." },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Score 71-100: Excellent performance." }
  ],
  "Operation Score": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "Score 0-40: Needs improvement." },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Score 41-70: Moderate performance." },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Score 71-100: Excellent performance." }
  ],
  "Cycle Time": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "More than 6 weeks" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Between 2 to 6 weeks" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Less than 2 weeks" }
  ],
  "Defect Density": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "More than 10 defects per KLOC" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "6 to 10 defects per KLOC" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "0 to 5 defects per KLOC" }
  ],
  "Rework Ratio": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 20%" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "15-20%" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "< 5%" }
  ],
  "Change Failure Rate": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "> 6%" },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "2 - 6%" },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "<= 2%" }
  ],
  "Time To Fix Bug": [
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "<=2" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: ">=3 - <=4" },
      { label: "Red", color: "var(--trisoled-color-primary)", description: ">= 5" }
  ],
  "Code Coverage": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "0 - 70%" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "71 - 85%" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "> 85%" }
  ],
  "Automation Done": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Less than 50% passed" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "50% to 85% passed" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "More than 85% passed" }
  ],
  "Static Code Analysis": [
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Score: 90-100" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Score: 75-89" },
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Score: < 75" }
  ],
  "Test Automation": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "Less than 50%" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "50% to 75% " },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "More than 75%" }
  ],
  "Test Cycle Time": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: ">= 5 days" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "2 to 4 days" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "<= 2 days" }
  ],
  "Traceability": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "0 - 75%" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "75 - 90%" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "> 90%" }
  ],
  "Testing Quality": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 15% bugs" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "10-15% bugs" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "< 10% bugs" }
  ],
  "Testing Productivity": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "< 50 Tests per Tester" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "50 - 100 Tests per Tester" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "100 - 150 Tests per Tester" }
  ],
  "Automation Testing Productivity": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "<= 50%" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "50 - 75%" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: " 75%" }
  ],
  "DLA": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 20%" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "10 - 20%" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "<= 10%" }
  ],
  "Deployment Frequency": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 12 weeks" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "4 to 12 weeks" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: " <= 4 weeks" }
  ],
  "Lead Time For Changes": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: " > 4 weeks" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "1-4 weeks" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "< 1 weeks" }
  ],
  "Mean Time To Recovery": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 8 hours" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "4 - 8 hours" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "<= 4 hours" }
  ],
  "Bugs": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% bugs" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% bugs" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% bugs" }
  ],
    "Tasks": [
      { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% tasks" },
      { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% tasks" },
      { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% tasks" }
  ],
  "Stories": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% storys" },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% storys" },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% storys" }
  ],
    "Epics": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "> 50% storys" },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "20% - 50% storys" },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "≤ 20% storys" }
  ],
    "Release Readiness": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "Percentage less than 35: Needs improvement." },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Percentage between 35 and 70: Moderate performance." },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Percentage above 70: Excellent performance." }
  ],
      "Engineering Score": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "Score less than 35: Poor quality." },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Score between 35 and 70: Average quality." },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Score above 70: Good quality." }
  ],
      "Release Velocity": [
    { label: "Red", color: "var(--trisoled-color-primary)", description: "Score less than 35: Poor quality." },
    { label: "Orange", color: "var(--trisoled-color-secondary)", description: "Score between 35 and 70: Average quality." },
    { label: "Green", color: "var(--trisoled-color-tertiary)", description: "Score above 70: Good quality." }
  ],
};

export default tableDataConfig;
