
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import AGrid from "../../../Common/AGgrid";
import NoDataPlaceholder from "../../../Common/NoDataPlaceholder";

const LeadTimeTable = () => {
  const [leadTimeData, setLeadTimeData] = useState([]);
  const gitData = useSelector((state) => state.git || {});
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    if (gitData.leadTime?.length) {
      setLeadTimeData(gitData.leadTime[0]?.result || []);
    }
  }, [gitData]);

  const columnDefs = [
    {
      field: "developer",
      headerName: "Developer",
      minWidth: 150,
      sortable: true,
      filter: false,
      floatingFilter: false,
    },
    {
      field: "totalPRs",
      headerName: "Total PRs",
      minWidth: 100,
      sortable: true,
      filter: false,
      floatingFilter: false,
    },
    {
      field: "avgLTC",
      headerName: "Average LTC (Days)",
      minWidth: 150,
      sortable: true,
      filter: false,
      floatingFilter: false,
      valueFormatter: (params) => {
        return typeof params.value === 'number' ? params.value.toFixed(1) : params.value;
      },
    },
    {
      field: "minLTC",
      headerName: "Minimum LTC (Days)",
      minWidth: 150,
      sortable: true,
      filter: false,
      floatingFilter: false,
      valueFormatter: (params) => {
        return typeof params.value === 'number' ? params.value.toFixed(1) : params.value;
      },
    },
    {
      field: "maxLTC",
      headerName: "Maximum LTC (Days)",
      minWidth: 150,
      sortable: true,
      filter: false,
      floatingFilter: false,
      valueFormatter: (params) => {
        return typeof params.value === 'number' ? params.value.toFixed(1) : params.value;
      },
    }
  ];

  const handleApiReady = (api) => {
    api.sizeColumnsToFit();
  };

  return (
    <div className="flex flex-wrap gap-4 items-stretch justify-between ">
      <div className="p-2 bg-white dark:bg-[#182433] text-[#202020] dark:text-[#C8C8C8] rounded-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] border border-[#D1E2F0] dark:border-[#25384F] w-full flex-1 h-[262px]">
        <h3 className="text-lg font-semibold text-[#0A2342] dark:text-[#e5e7eb] mr-4">
          LTC Based on Developer
        </h3>

        <div className="mt-4 ">
          {leadTimeData.length > 0 ? (
            <AGrid
              rowData={leadTimeData}
              columnDefs={columnDefs}
              height="200px"
              onApiReady={handleApiReady}
              theme={theme}
            />
          ) : (
            <div className="bg-white dark:bg-[#182433]">
              <NoDataPlaceholder height={200} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadTimeTable;
