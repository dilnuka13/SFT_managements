// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('auth-page')) return;

    const supabase = window.supabaseClient;

    const startDateInput = document.getElementById('dash-start-date');
    const endDateInput = document.getElementById('dash-end-date');

    let batchChartInstance = null;
    let typeChartInstance = null;

    // --- Init Date Filter (15th to 15th) ---
    const initDateFilters = () => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        let startYear = currentYear;
        let startMonth = currentMonth - 1;
        let endYear = currentYear;
        let endMonth = currentMonth;

        if (today.getDate() < 15) {
            // we are in the early part of the month, so target the cycle ending on the 15th of THIS month
            // wait, cycle is "From the 15th of the previous month to the 15th of the current month"
            // if today is 10th March, cycle is 15th Feb to 15th March.
            startMonth = currentMonth - 1;
            endMonth = currentMonth;
        } else {
            // if today is 20th March, cycle is 15th March to 15th April
            startMonth = currentMonth;
            endMonth = currentMonth + 1;
        }

        if (startMonth < 0) { startMonth = 11; startYear--; }
        if (endMonth > 11) { endMonth = 0; endYear++; }

        const pad = n => n.toString().padStart(2, '0');

        startDateInput.value = `${startYear}-${pad(startMonth + 1)}-15`;
        endDateInput.value = `${endYear}-${pad(endMonth + 1)}-15`;
    };

    initDateFilters();

    let rawInstructorData = [];
    let rawPanelData = [];

    // --- Fetch and Process Data ---
    window.loadDashboardData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const start = startDateInput.value;
        const end = endDateInput.value;

        if (!start || !end) {
            window.showToast('Please select both start and end dates.', 'error');
            return;
        }

        window.showLoading(true);

        try {
            // 1. Fetch Instructor Data
            const { data: instData, error: instError } = await supabase
                .from('instructor_sessions')
                .select('id, date, start_time, end_time, instructor_classes(*)')
                .eq('user_id', user.id)
                .gte('date', start)
                .lte('date', end)
                .order('date', { ascending: true });

            if (instError) throw instError;
            rawInstructorData = instData;

            // 2. Fetch Paper Panel Data
            const { data: panelData, error: panelError } = await supabase
                .from('paper_panel_entries')
                .select('*')
                .eq('user_id', user.id)
                .gte('received_date', start)
                .lte('received_date', end)
                .order('received_date', { ascending: true });

            if (panelError) throw panelError;
            rawPanelData = panelData;

            processInstructorData(rawInstructorData);
            processPanelData(rawPanelData);

            window.showToast('Dashboard data updated.', 'success');
        } catch (error) {
            console.error(error);
            window.showToast('Failed to load dashboard data: ' + error.message, 'error');
        } finally {
            window.showLoading(false);
        }
    };

    const processInstructorData = (sessions) => {
        const uniqueDates = new Set();
        let batchCounts = {};
        let typeCounts = {};

        sessions.forEach(sess => {
            uniqueDates.add(sess.date);
            if (sess.instructor_classes) {
                sess.instructor_classes.forEach(cls => {
                    batchCounts[cls.batch] = (batchCounts[cls.batch] || 0) + 1;
                    typeCounts[cls.class_type] = (typeCounts[cls.class_type] || 0) + 1;
                });
            }
        });

        document.getElementById('dash-total-days').textContent = uniqueDates.size;
        renderBatchChart(batchCounts);
        renderTypeChart(typeCounts);
    };

    const processPanelData = (entries) => {
        let totalPapers = 0;
        const aggregated = {};

        entries.forEach(entry => {
            totalPapers += entry.paper_count;
            const key = `${entry.batch}|${entry.paper_type}|${entry.paper_number}`;
            if (!aggregated[key]) {
                aggregated[key] = { batch: entry.batch, type: entry.paper_type, no: entry.paper_number, count: 0 };
            }
            aggregated[key].count += entry.paper_count;
        });

        document.getElementById('dash-total-papers').textContent = totalPapers;
        const tbody = document.querySelector('#dash-paper-table tbody');
        tbody.innerHTML = '';

        if (Object.keys(aggregated).length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No paper data in this period</td></tr>';
            return;
        }

        let dashTableIndex = 1;
        const aggregatedArr = Object.values(aggregated).sort((a, b) => {
            if (a.batch === b.batch) return a.no - b.no;
            return a.batch.localeCompare(b.batch);
        });

        aggregatedArr.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${dashTableIndex++}</td><td>${item.batch}</td><td>${item.type}</td><td>${item.no}</td><td style="font-weight:bold;">${item.count}</td>`;
            tbody.appendChild(tr);
        });
    };

    // --- Charts rendering ---
    const chartColors = ['#D0BCFF', '#EADDFF', '#4F378B', '#381E72', '#21005D', '#E8DEF8'];

    const renderBatchChart = (dataObj) => {
        const ctx = document.getElementById('instructor-batch-chart');
        if (batchChartInstance) batchChartInstance.destroy();
        const labels = Object.keys(dataObj);
        const data = Object.values(dataObj);
        batchChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [{ label: 'Classes by Batch', data: data.length ? data : [1], backgroundColor: data.length ? chartColors : ['#E0E0E0'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: true, text: 'Classes breakdown by Batch' } } }
        });
    };

    const renderTypeChart = (dataObj) => {
        const ctx = document.getElementById('instructor-type-chart');
        if (typeChartInstance) typeChartInstance.destroy();
        const labels = Object.keys(dataObj);
        const data = Object.values(dataObj);
        typeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [{ label: '# of Classes', data: data.length ? data : [0], backgroundColor: '#D0BCFF', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false }, title: { display: true, text: 'Classes breakdown by Type' } } }
        });
    };

    // --- Action Listeners ---
    document.getElementById('apply-filter-btn').addEventListener('click', window.loadDashboardData);
    window.loadDashboardData();

    // --- EXPORTS & PDF MODAL ---
    const pdfModal = document.getElementById('pdf-modal');

    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        pdfModal.classList.remove('d-none');
    });

    document.getElementById('pdf-cancel-btn').addEventListener('click', () => {
        pdfModal.classList.add('d-none');
    });

    document.getElementById('pdf-confirm-btn').addEventListener('click', async () => {
        const year = parseInt(document.getElementById('pdf-year-select').value);
        const month = parseInt(document.getElementById('pdf-month-select').value); // 1-12

        // Calculate dates (15th to 15th)
        const pad = n => n.toString().padStart(2, '0');

        let startYear = year;
        let startMonth = month - 1; // logical month before the target
        if (startMonth === 0) { startMonth = 12; startYear--; }

        const startDate = `${startYear}-${pad(startMonth)}-15`;
        const endDate = `${year}-${pad(month)}-15`;

        // Update inputs
        startDateInput.value = startDate;
        endDateInput.value = endDate;

        // Load data
        await window.loadDashboardData();
        pdfModal.classList.add('d-none');

        // Generate PDF
        generateEnhancedPDF(startDate, endDate, document.getElementById('pdf-month-select').options[month - 1].text + ' ' + year);
    });

    const generateEnhancedPDF = async (start, end, reportMonthName) => {
        window.showLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
        const instructorName = profile ? profile.display_name : 'Instructor';

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.color = '#333';
        container.style.background = '#fff';
        container.style.fontFamily = "'Outfit', sans-serif";

        const headerHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #6750A4; padding-bottom:15px; margin-bottom: 30px;">
                <div style="display:flex; align-items:center;">
                    <img src="logo.png" style="height:60px; margin-right:15px; background: white; padding: 5px; border-radius: 10px;">
                    <div>
                        <h1 style="margin:0; font-size:24px; color:#121212;">SFT Performance Report</h1>
                        <p style="margin:0; font-size:14px; color:#666;">Malaka Sir's SFT Class Management System</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <p style="margin:0; font-weight:bold; font-size:18px;">${instructorName}</p>
                    <p style="margin:0; font-size:14px; color:#6750A4; font-weight:bold;">Report for: ${reportMonthName}</p>
                    <p style="margin:0; font-size:11px;">Cycle: ${window.formatDate(start)} to ${window.formatDate(end)}</p>
                </div>
            </div>
        `;

        // Attendance Table
        let attendanceRows = '';
        const uniqueDates = Array.from(new Set(rawInstructorData.map(s => s.date))).sort();
        let attIndex = 1;
        uniqueDates.forEach(date => {
            const sessionsOnDate = rawInstructorData.filter(s => s.date === date);
            sessionsOnDate.forEach(sess => {
                const classes = sess.instructor_classes.map(c => `${c.batch} ${c.class_type}`).join(', ');
                attendanceRows += `
                    <tr>
                        <td style="padding:10px; border:1px solid #eee; text-align:center;">${attIndex++}</td>
                        <td style="padding:10px; border:1px solid #eee;">${window.formatDate(date)}</td>
                        <td style="padding:10px; border:1px solid #eee;">${window.formatTime(sess.start_time)} - ${window.formatTime(sess.end_time)}</td>
                        <td style="padding:10px; border:1px solid #eee;">${classes}</td>
                    </tr>
                `;
            });
        });

        // Paper Panel Table
        let paperRows = '';
        let panelIndex = 1;
        let totalPaperCount = 0;
        if (rawPanelData.length > 0) {
            rawPanelData.forEach(entry => {
                totalPaperCount += entry.paper_count;
                paperRows += `
                    <tr>
                        <td style="padding:10px; border:1px solid #eee; text-align:center;">${panelIndex++}</td>
                        <td style="padding:10px; border:1px solid #eee;">${entry.batch}</td>
                        <td style="padding:10px; border:1px solid #eee;">${entry.paper_type} No: ${entry.paper_number}</td>
                        <td style="padding:10px; border:1px solid #eee; text-align:center; font-weight:bold;">${entry.paper_count}</td>
                        <td style="padding:10px; border:1px solid #eee;">${window.formatDate(entry.received_date)}</td>
                    </tr>
                `;
            });
        }

        const reportTemplate = `
            ${headerHtml}
            
            <h2 style="font-size:18px; color:#6750A4; border-bottom:1px solid #6750A4; display:inline-block; padding-bottom:5px;">1. Instructor Attendance Sheet</h2>
            <table style="width:100%; border-collapse:collapse; margin-top:10px; margin-bottom:10px;">
                <thead>
                    <tr style="background:#f1f5f9; color:#000; text-align:left;">
                        <th style="padding:10px; border:1px solid #cbd5e1; width:40px; text-align:center;">#</th>
                        <th style="padding:10px; border:1px solid #cbd5e1;">Date</th>
                        <th style="padding:10px; border:1px solid #cbd5e1;">Time Duration</th>
                        <th style="padding:10px; border:1px solid #cbd5e1;">Class Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendanceRows || '<tr><td colspan="4" style="padding:20px; text-align:center;">No attendance data found</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="3" style="padding:10px; border:1px solid #cbd5e1; text-align:right;">Total Days Attended:</td>
                        <td style="padding:10px; border:1px solid #cbd5e1; color:#6750A4; font-size:16px;">${uniqueDates.length} Days</td>
                    </tr>
                </tfoot>
            </table>

            <h2 style="font-size:18px; color:#6750A4; border-bottom:1px solid #6750A4; display:inline-block; padding-bottom:5px; margin-top:20px;">2. Paper Panel Evaluation Details</h2>
            <table style="width:100%; border-collapse:collapse; margin-top:10px;">
                <thead>
                    <tr style="background:#f1f5f9; color:#000; text-align:left;">
                        <th style="padding:10px; border:1px solid #cbd5e1; width:40px; text-align:center;">#</th>
                        <th style="padding:10px; border:1px solid #cbd5e1;">Batch</th>
                        <th style="padding:10px; border:1px solid #cbd5e1;">Paper Description</th>
                        <th style="padding:10px; border:1px solid #cbd5e1; text-align:center;">Count</th>
                        <th style="padding:10px; border:1px solid #cbd5e1;">Received Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${paperRows || '<tr><td colspan="5" style="padding:20px; text-align:center;">No paper panel data found</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="3" style="padding:10px; border:1px solid #cbd5e1; text-align:right;">Final Accumulated Count:</td>
                        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; color:#6750A4; font-size:16px;">${totalPaperCount}</td>
                        <td style="border:1px solid #cbd5e1;"></td>
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top:60px; display:flex; justify-content:space-between;">
                <div style="text-align:center; width:220px; border-top:1px solid #333; padding-top:10px;">
                    <p style="margin:0; font-size:13px; font-weight:bold;">${instructorName}</p>
                    <p style="margin:0; font-size:11px; color:#666;">Instructor Signature</p>
                </div>
                <div style="text-align:center; width:220px; border-top:1px solid #333; padding-top:10px;">
                    <p style="margin:0; font-size:11px; color:#666;">Academic Supervisor / Verified By</p>
                </div>
            </div>
            
            <p style="text-align:center; color:#94a3b8; font-size:10px; margin-top:80px;">Report ID: SFT-GEN-${Date.now()} | Generated on ${new Date().toLocaleString()} | Powered by SFT Admin System</p>
        `;

        container.innerHTML = reportTemplate;

        const opt = {
            margin: [10, 10],
            filename: `SFT_Performance_Report_${instructorName.replace(/\s+/g, '_')}_${reportMonthName.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().finally(() => {
            window.showLoading(false);
        });
    };

    document.getElementById('export-csv-btn').addEventListener('click', () => {
        const table = document.getElementById('dash-paper-table');
        let csv = [];
        const rows = table.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            let row = [], cols = rows[i].querySelectorAll('td, th');
            for (let j = 0; j < cols.length; j++) {
                let data = cols[j].innerText.replace(/"/g, '""');
                row.push('"' + data + '"');
            }
            csv.push(row.join(','));
        }
        const csvString = csv.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Paper_Panel_${startDateInput.value}_to_${endDateInput.value}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});