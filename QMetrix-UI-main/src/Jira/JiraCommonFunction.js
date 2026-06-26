import ReactDOMServer from 'react-dom/server';

const getNumericValue = (trendValue) => {
  if (typeof trendValue === 'string') {
    const match = trendValue.match(/^([0-9.-]+)/);
    return match ? parseFloat(match[1]) || 0 : 0;
  }
  return typeof trendValue === 'number' ? trendValue : 0;
};

export const getChangeColorForWidget = (widgetName, value) => {
  const rootStyles = getComputedStyle(document.documentElement);
  const fallbackColors = {
    primary: '#FF4C51',
    secondary: '#FF9F43',
    tertiary: '#28C76F'
  };
  
  const getColor = (colorType) => {
    const cssColor = rootStyles.getPropertyValue(`--trisoled-color-${colorType}`).trim();
    const result = cssColor || fallbackColors[colorType];
    console.log(`getChangeColorForWidget - ${widgetName} (${value}) -> ${colorType}: ${result}`);
    return result;
  };
  
  if (widgetName === 'Bug Classification') {
    if (value > 40) {
      return getColor('primary');
    } else if (value >= 21 && value <= 40) {
      return getColor('secondary');
    } else if (value <= 20) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Defect Leakage Analysis') {
    if (value > 12) {
      return getColor('primary');
    } else if (value >= 6 && value <= 12) {
      return getColor('secondary');
    } else if (value <= 5) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Defect Density') {
    if (value > 10) {
      return getColor('primary');
    } else if (value >= 6 && value <= 10) {
      return getColor('secondary');
    } else if (value <= 5) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Committed vs Completed') {
    if (value < 30) {
      return getColor('primary');
    }
    if (value >= 30 && value <= 74) {
      return getColor('secondary');
    }
    if (value >= 75 && value <= 100) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Issue Type') {
    if (value > 40) {
      return getColor('primary');
    } else if (value >= 21 && value <= 40) {
      return getColor('secondary');
    } else if (value < 20) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Cycle Time') {
    if (value > 15) {
      return getColor('primary');
    } else if (value >= 7 && value <= 15) {
      return getColor('secondary');
    } else if (value < 7) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Burndown') {
    if (value < 30) {
      return getColor('primary');
    } else if (value >= 30 && value <= 74) {
      return getColor('secondary');
    } else if (value >= 75) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Velocity') {
    if (value < 15) {
      return getColor('tertiary');
    } else if (value >= 15 && value <= 44) {
      return getColor('secondary');
    } else if (value >= 45) {
      return getColor('primary');
    }
  } else if (widgetName === 'Time To Fix Bug') {
    if (value >= 5) {
      return getColor('primary');
    } else if (value >= 3 && value <= 4) {
      return getColor('secondary');
    } else if (value <= 2) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Defect Removal Efficiency') {
    if (value <= 50) {
      return getColor('primary');
    } else if (value > 50 && value <= 84) {
      return getColor('secondary');
    } else if (value > 84) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Cost Of Fixing Defects') {
    if (value > 500) {
      return getColor('primary');
    } else if (value >= 50 && value <= 500) {
      return getColor('secondary');
    } else if (value < 50) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Jitter Time') {
    if (value > 40) {
      return getColor('primary');
    } else if (value >= 21 && value <= 40) {
      return getColor('secondary');
    } else if (value < 20) {
      return getColor('tertiary');
    }
  } else if (widgetName === 'Defect Rejection Ratio') {
    const trendValue = getNumericValue(value);
    if (trendValue > 20) {
      return getColor('primary');
    } else if (trendValue >= 11 && trendValue <= 20) {
      return getColor('secondary');
    } else if (trendValue < 11) {
      return getColor('tertiary');
    }
  } else {
    if (value >= 0 && value <= 59) {
      return getColor('tertiary');
    } else if (value >= 60 && value <= 75) {
      return getColor('secondary');
    } else {
      return getColor('primary');
    }
  }
  return getColor('tertiary');
};

const getTooltipContent = (title, tableData = []) => {
  let description = '';

  switch (title) {
    case 'Committed vs Completed':
      description =
        'Measures how much work was planned (committed) versus what was actually delivered (completed) within a sprint or release.';
      break;
    case 'Issue Type':
      description =
        'Classifies work items such as bugs, stories, and tasks to help track different types of work in the development process.';
      break;
    case 'Cycle Time':
      description =
        'Represents the total time taken for a work item to move from start to completion, indicating process efficiency.';
      break;
    case 'Defect Removal Efficiency':
      description =
        'Shows the percentage of defects identified and fixed before release, measuring the effectiveness of the testing process.';
      break;
    case 'Defect Leakage Analysis':
      description =
        'Analyzes defects that were not detected during development and testing but were found in production, helping to improve testing strategies.';
      break;
    case 'Bug Classification':
      description =
        'Categorizes defects based on severity, priority, root cause, or affected module to improve defect management and resolution strategies.';
      break;
    case 'Defect Density':
      description =
        'Calculates the number of defects found per unit of code or functionality, helping to assess code quality and stability.';
      break;
    case 'Defect Rejection Ratio':
      description =
        'Indicates the percentage of reported defects that were rejected due to invalid issues, misclassification, or non-reproducibility.';
      break;
    case 'Time To Fix Bug':
      description =
        'Represents the average time taken to identify, analyze, and resolve a defect after it has been reported.';
      break;
    case 'Cost Of Fixing Defects':
      description =
        'Estimates the effort, time, and resources required to fix defects at different stages of development, highlighting the impact of early defect detection.';
      break;
    case 'Jitter Time':
      description =
        'Measures the inconsistency or variation in system response time, often used to evaluate performance stability in real-time systems.';
      break;
    case 'Burndown':
      description =
        'Visualizes the remaining work in a sprint or project over time, helping teams track progress and predict completion.';
      break;
    case 'Velocity':
      description =
        'A metric that measures the amount of work a team completes within a specific timeframe, typically a sprint, and is used to forecast future sprint performance and project timelines.';
      break;
    case 'Total Time Spent':
      description = 'The total duration taken to complete all tasks or issues.';
      break;

    case 'Total Stories Closed':
      description = 'The total number of stories that have been completed and officially closed.';
      break;
    default:
      return <p>No tooltip available.</p>;
  }

  return (
    <div style={{ textAlign: 'left', maxWidth: '500px' }}>
      <p
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: '6px',
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: '14px', color: '#ddd', marginBottom: '10px' }}>{description}</p>
      <div
        style={{
          borderBottom: '3px solid rgba(255, 255, 255, 0.3)',
          margin: '8px 0',
        }}
      ></div>
      {tableData.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
            flexWrap: 'wrap',
          }}
        >
          {tableData.map((row, index) => (
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

const tableDataConfig = {
  'Committed vs Completed': [
    {
      label: 'Red',
      color: 'var(--trisoled-color-primary)',
      description: 'Less than 30% completed',
    },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: '30% - 74% completed',
    },
    {
      label: 'Green',
      color: 'var(--trisoled-color-tertiary)',
      description: '75% - 100% completed',
    },
  ],
  'Issue Type': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: '> 40% Bugs' },
    { label: 'Amber', color: 'var(--trisoled-color-secondary)', description: '21 - 40% Bugs' },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '< 20% Bugs' },
  ],
  'Cycle Time': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: '> 15 Days' },
    { label: 'Amber', color: 'var(--trisoled-color-secondary)', description: '7 - 15 Days' },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '< 7 Days' },
  ],
  'Defect Removal Efficiency': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: '50% or below' },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 51% and 84%',
    },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '85% to 100%' },
  ],
  'Defect Leakage Analysis': [
    {
      label: 'Red',
      color: 'var(--trisoled-color-primary)',
      description: 'More than 12% leakage',
    },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 6% and 12% leakage',
    },
    {
      label: 'Green',
      color: 'var(--trisoled-color-tertiary)',
      description: '5% or less leakage',
    },
  ],
  'Bug Classification': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: 'More than 40%' },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 21% and 40%',
    },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '20% or less' },
  ],
  'Defect Density': [
    {
      label: 'Red',
      color: 'var(--trisoled-color-primary)',
      description: 'More than 10 defects per KLOC',
    },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: '6-10 defects per KLOC',
    },
    {
      label: 'Green',
      color: 'var(--trisoled-color-tertiary)',
      description: '0-5 defects per KLOC',
    },
  ],
  'Defect Rejection Ratio': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: 'More than 20%' },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 11% and 20%',
    },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '10% or less' },
  ],
  'Time To Fix Bug': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: '5 days or more' },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 2 and 4 days',
    },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '2 days or less' },
  ],
  'Cost Of Fixing Defects': [
    {
      label: 'Red',
      color: 'var(--trisoled-color-primary)',
      description: 'Very High Cost (More than $500)',
    },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Moderate Cost ($50 - $500)',
    },
    {
      label: 'Green',
      color: 'var(--trisoled-color-tertiary)',
      description: 'Low Cost (Less than $50)',
    },
  ],
  'Jitter Time': [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: '> 40 Sec' },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 21 and 40 Sec',
    },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '20 Sec or less' },
  ],
  Burndown: [
    { label: 'Red', color: 'var(--trisoled-color-primary)', description: 'Less than 30%' },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 30% and 74%',
    },
    { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '75% or more' },
  ],
  Velocity: [
    {
      label: 'Red',
      color: 'var(--trisoled-color-primary)',
      description: 'Less than 15 (Story Points)',
    },
    {
      label: 'Amber',
      color: 'var(--trisoled-color-secondary)',
      description: 'Between 15 and 44 (Story Points)',
    },
    {
      label: 'Green',
      color: 'var(--trisoled-color-tertiary)',
      description: '45 or more (Story Points)',
    },
  ],
};

export const getTooltipContentByName = (widgetName) => {
  const tableData = tableDataConfig[widgetName] || [];
  const tooltipComponent = getTooltipContent(widgetName, tableData);
  return ReactDOMServer.renderToStaticMarkup(tooltipComponent);
};
