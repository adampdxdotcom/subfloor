import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface ReportChartsProps {
    data: any[];
    type: 'products' | 'jobs' | 'installers';
}

const formatMoney = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0, // Simplify for charts
    }).format(value);
};

const ReportCharts: React.FC<ReportChartsProps> = ({ data, type }) => {
    
    // Transform Data based on Report Type
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        if (type === 'jobs') {
            // Aggregate Revenue by Month
            const grouped = data.reduce((acc: any, curr: any) => {
                const date = new Date(curr.created_at);
                // Format: "Jan 2024"
                const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                // Sort key: "2024-01" (Hidden logic to sort correctly)
                const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!acc[sortKey]) {
                    acc[sortKey] = { name: key, value: 0, sortKey };
                }
                acc[sortKey].value += Number(curr.total_value || 0);
                return acc;
            }, {});

            // Convert to array and sort chronologically
            return Object.values(grouped).sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey));
        }

        if (type === 'installers') {
            // Data is already aggregated per installer, just filter out zero-value ones
            return data
                .filter((r: any) => Number(r.total_labor_value) > 0)
                .map((r: any) => ({
                    name: r.installer_name,
                    value: Number(r.total_labor_value),
                    color: r.color || '#4f46e5'
                }))
                .sort((a: any, b: any) => b.value - a.value); // Sort highest first
        }

        if (type === 'products') {
            // Count variants per Manufacturer
            const grouped = data.reduce((acc: any, curr: any) => {
                const key = curr.manufacturer_name || 'Unknown';
                if (!acc[key]) {
                    acc[key] = { name: key, value: 0 };
                }
                acc[key].value += 1;
                return acc;
            }, {});

            return Object.values(grouped)
                .sort((a: any, b: any) => b.value - a.value) // Sort highest count first
                .slice(0, 15); // Top 15 only to prevent overcrowding
        }

        return [];
    }, [data, type]);

    if (chartData.length === 0) return null;

    // Dynamic Label Logic
    const yAxisLabel = type === 'products' ? 'Count' : 'Value';
    const barColor = '#4f46e5'; // Indigo 600

    return (
        <div className="h-80 w-full bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 print:break-inside-avoid">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">
                {type === 'jobs' && 'Revenue Trend (Based on Filters)'}
                {type === 'installers' && 'Labor Value Distribution'}
                {type === 'products' && 'Variants by Manufacturer (Top 15)'}
            </h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }} 
                        interval={0} 
                        angle={chartData.length > 10 ? -45 : 0} // Tilt labels if crowded
                        textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                        height={chartData.length > 10 ? 60 : 30}
                    />
                    <YAxis 
                        tickFormatter={(val) => type === 'products' ? val : `$${val / 1000}k`} 
                        tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                        formatter={(value: number) => [
                            type === 'products' ? value : formatMoney(value), 
                            yAxisLabel
                        ]}
                    />
                    <Bar dataKey="value" fill={barColor} radius={[4, 4, 0, 0]}>
                        {/* Use custom colors for Installers if available */}
                        {type === 'installers' && chartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color || barColor} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ReportCharts;