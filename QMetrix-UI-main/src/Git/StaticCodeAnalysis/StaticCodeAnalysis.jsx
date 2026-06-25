import { useSelector } from 'react-redux';
import DataCard from '../../Common/DataCard';
import getTooltipContent from '../../../utils/Tooltip';
import tableDataConfig  from '../../../utils/tableDataConfig';
import ReactDOMServer from "react-dom/server";
export function StaticCodeAnalysis() {
    const {sonarQubeGitData} = useSelector((state) => state.sonarQubeGit || {});
    const sonarQubedata = [
        {
            title: 'Duplicated Files',
            hrsValue: sonarQubeGitData?.duplicated_files,
            percentageValue: sonarQubeGitData?.duplicated_files,
            toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Duplicated Files`,tableDataConfig[`Duplicated Files`])),
        },
        {
            title: 'Non-Commented Lines of Code',
            hrsValue: sonarQubeGitData?.ncloc,
            percentageValue: sonarQubeGitData?.ncloc,
             toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Non-Commented Lines of Code`,tableDataConfig[`Non-Commented Lines of Code`])),
        },
        {
            title: 'Vulnerabilities',
            hrsValue: sonarQubeGitData?.vulnerabilities,
            percentageValue: sonarQubeGitData?.vulnerabilities,
            toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Vulnerabilities`,tableDataConfig[`Vulnerabilities`])),
        },
        {
            title: 'Security Hotspots',
            hrsValue: sonarQubeGitData?.security_hotspots,
            percentageValue: sonarQubeGitData?.security_hotspots,
            toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Security Hotspots`,tableDataConfig[`Security Hotspots`])),
        },
        {
            title: 'Duplicated Blocks',
            hrsValue: sonarQubeGitData?.duplicated_blocks,
            percentageValue: sonarQubeGitData?.duplicated_blocks,
            toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Duplicated Blocks`,tableDataConfig[`Duplicated Blocks`])),
        },
        {
            title: 'Duplicated Lines',
            hrsValue: sonarQubeGitData?.duplicated_lines,
            percentageValue:sonarQubeGitData?.duplicated_lines,
            toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Duplicated Lines`,tableDataConfig[`Duplicated Lines`])),
        },
        {
            title: 'Code Smells',
            hrsValue: sonarQubeGitData?.code_smells,
            percentageValue: sonarQubeGitData?.code_smells,
            toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent(`Code Smells`,tableDataConfig[`Code Smells`])),
        },
    ];
    
    
  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-4 mt-4 w-full">
        {sonarQubedata?.map((item, index) => (
          <DataCard
            key={index}
            title={item.title}
            trendValue={item.percentageValue}
            toolTip={item.toolTip}
            index={index}
            color='#08000000'
          />
        ))}
      </div>
    </div>
  );
}
