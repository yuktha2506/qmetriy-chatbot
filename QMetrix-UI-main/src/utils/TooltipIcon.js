/* eslint-disable react/prop-types */
import { Tooltip as ReactTooltip } from "react-tooltip";
import { InfoIcon } from "./commonIcons";

const TooltipIcon = ({ title, tooltip, theme = "light", placement = "top" }) => {
    return (
        <div className="relative group">
            <span
                data-tooltip-id={`tooltip-${title}`}
                data-tooltip-html={tooltip}
                data-tooltip-place={placement}
                className="cursor-pointer"
            >
                <InfoIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#A3B1C9]'}`} />
            </span>
            <ReactTooltip
                id={`tooltip-${title}`}
                place={placement}
                effect="solid"
                float={false}
                allowHTML={true}
                arrowColor={theme === "dark" ? "#173A5A" : "#0D1621"}
                opacity={1}
                style={{
                    backgroundColor: theme === "dark" ? "#173A5A" : "#0D1621",
                    borderStyle: theme === "dark" ? "solid" : "none",
                    borderWidth: theme === "dark" ? "1px" : "0px",
                    borderColor: theme === "dark" ? "#224F78" : "transparent",
                    color: theme === "dark" ? "white" : "#FFFFFF",
                    zIndex: 9999,
                    padding: "8px",
                    borderRadius: "5px",
                    maxWidth: "500px",
                    whiteSpace: "normal",
                    position: "absolute",
                    fontSize: "12px",
                    lineHeight: 1.45,
                }}
            />
        </div>
    );
};

export default TooltipIcon;
