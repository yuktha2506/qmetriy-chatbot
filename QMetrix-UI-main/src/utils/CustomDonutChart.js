import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip
} from 'recharts';

const CustomDonutChart = ({
    data,
    colors = ['#10B981', '#8B5CF6', '#06B6D4', '#EF4444', '#F59E0B', '#3B82F6'],
    innerRadius = 40,
    outerRadius = 70,
    showTooltip = true,
    showLegend = true,
    height = 200,
    valueFormatter
}) => {
    const theme = useSelector((state) => state.theme.theme);

    // Transform data to match Recharts format
    const chartData = data.map((item, index) => ({
        name: item.label || item.name,
        value: item.value || item.dataPoint,
        color: item.color || colors[index % colors.length]
    }));


    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div
                    style={{
                        backgroundColor: theme === 'light' ? '#202020' : '#173A5A',
                        border: theme === 'light' ? 'none' : '1px solid #224F78',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        color: '#ffffff',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <p style={{ margin: 0, fontWeight: 'bold' }}>
                        {data.name}: {valueFormatter ? valueFormatter(data.value) : data.value}
                    </p>
                </div>
            );
        }
        return null;
    };

    CustomTooltip.propTypes = {
        active: PropTypes.bool,
        payload: PropTypes.array
    };

    const CustomLegend = ({ payload }) => {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'nowrap',
                    gap: '12px',
                    marginTop: '16px',
                    padding: '0 16px'
                }}
            >
                {payload.map((entry, index) => (
                    <div
                        key={`item-${index}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            color: '#99A1AF'
                        }}
                    >
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: entry.color,
                                flexShrink: 0
                            }}
                        />
                        <span style={{ color: '#99A1AF' }}>{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    CustomLegend.propTypes = {
        payload: PropTypes.array
    };

    return (
        <div style={{ width: '100%', height: height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    {showTooltip && <Tooltip content={<CustomTooltip />} />}
                    {showLegend && <Legend content={<CustomLegend />} />}
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

CustomDonutChart.propTypes = {
    data: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string,
            name: PropTypes.string,
            value: PropTypes.number,
            dataPoint: PropTypes.number,
            color: PropTypes.string
        })
    ).isRequired,
    colors: PropTypes.arrayOf(PropTypes.string),
    innerRadius: PropTypes.number,
    outerRadius: PropTypes.number,
    showTooltip: PropTypes.bool,
    showLegend: PropTypes.bool,
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    valueFormatter: PropTypes.func
};

CustomDonutChart.defaultProps = {
    colors: ['#10B981', '#8B5CF6', '#06B6D4', '#EF4444', '#F59E0B', '#3B82F6'],
    innerRadius: 40,
    outerRadius: 70,
    showTooltip: true,
    showLegend: true,
    height: 200
};

export default CustomDonutChart;
