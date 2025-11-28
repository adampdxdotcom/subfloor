export const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
        alert("No data to export");
        return;
    }

    // 1. Extract Headers from the first object
    const headers = Object.keys(data[0]);

    // 2. Convert Data to CSV Format
    const csvContent = [
        headers.join(','), // Header Row
        ...data.map(row => 
            headers.map(fieldName => {
                let value = row[fieldName];
                
                // Handle null/undefined
                if (value === null || value === undefined) return '';
                
                // Convert to string and handle special characters
                let stringValue = String(value);
                
                // Escape quotes and wrap in quotes if it contains comma or newline
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    stringValue = `"${stringValue.replace(/"/g, '""')}"`;
                }
                
                return stringValue;
            }).join(',')
        )
    ].join('\n');

    // 3. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};