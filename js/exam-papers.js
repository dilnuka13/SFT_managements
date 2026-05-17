// js/exam-papers.js  v5

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) {
        showToast('Supabase client not initialized.', 'error');
        return;
    }

    const supabase = window.supabaseClient;
    let chartInstance = null;

    // ─── DOM References ─────────────────────────────────────
    const form              = document.getElementById('exam-paper-form');
    const alYearSelect      = document.getElementById('al-year');
    const categorySelect    = document.getElementById('paper-category');
    const categoryOtherInput= document.getElementById('category-other');
    const paperNumberInput  = document.getElementById('paper-number');
    const givenDateInput    = document.getElementById('given-date');
    const givenTimeInput    = document.getElementById('given-time');
    const refreshNumBtn     = document.getElementById('refresh-number-btn');
    const filterYearSelect  = document.getElementById('filter-year');
    const tableBody         = document.querySelector('#recent-papers-table tbody');

    const yearModal         = document.getElementById('year-selection-modal');
    const displayAlYearSpan = document.getElementById('display-al-year');
    const displayAlYearChart= document.getElementById('display-al-year-chart');
    const quickBtns         = document.querySelectorAll('.year-quick-btn');
    const changeYearBtn     = document.getElementById('change-year-btn');

    const statCategory      = document.getElementById('stat-last-category');
    const statNumber        = document.getElementById('stat-last-number');
    const statDate          = document.getElementById('stat-last-date');

    const allPapersModal    = document.getElementById('all-papers-modal');
    const closeAllPapersBtn = document.getElementById('close-all-papers-btn');
    const allPapersTbody    = document.getElementById('all-papers-tbody');
    const modalCategorySelect = document.getElementById('modal-category-select');
    const modalTableHead    = document.getElementById('modal-table-head');

    // ─── Init ────────────────────────────────────────────────
    function init() {
        // Auto-fill date + time to today/now
        const now = new Date();
        givenDateInput.value = now.toISOString().split('T')[0];
        givenTimeInput.value = now.toTimeString().substring(0, 5);
    }

    // ─── Year Selection ──────────────────────────────────────
    quickBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedYear = e.target.getAttribute('data-year');
            alYearSelect.value       = selectedYear;
            filterYearSelect.value   = selectedYear;
            displayAlYearSpan.textContent  = selectedYear;
            if (displayAlYearChart) displayAlYearChart.textContent = selectedYear;

            yearModal.classList.add('d-none');

            loadRecentPapers();
            loadAnalytics();
            updateLastStats();
        });
    });

    if (changeYearBtn) {
        changeYearBtn.addEventListener('click', () => yearModal.classList.remove('d-none'));
    }

    // ─── Category toggle ─────────────────────────────────────
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value === 'Other') {
            categoryOtherInput.classList.remove('d-none');
            categoryOtherInput.required = true;
        } else {
            categoryOtherInput.classList.add('d-none');
            categoryOtherInput.required = false;
        }
        fetchNextNumber();
    });

    alYearSelect.addEventListener('change', fetchNextNumber);
    refreshNumBtn.addEventListener('click', fetchNextNumber);
    filterYearSelect.addEventListener('change', () => {
        loadRecentPapers();
        loadAnalytics();
    });

    // ─── Auto-fill: fetch next paper number ──────────────────
    async function fetchNextNumber() {
        const year = alYearSelect.value;
        let category = categorySelect.value;
        if (category === 'Other') category = categoryOtherInput.value.trim();
        if (!year || !category) { paperNumberInput.value = ''; return; }

        try {
            const { data, error } = await supabase.rpc('get_next_exam_paper_number', {
                p_al_year: parseInt(year),
                p_category: category
            });

            if (error) {
                const { data: manualData, error: manualErr } = await supabase
                    .from('exam_papers')
                    .select('paper_number')
                    .eq('al_year', parseInt(year))
                    .eq('category', category)
                    .order('paper_number', { ascending: false })
                    .limit(1);
                if (!manualErr) {
                    paperNumberInput.value = manualData.length > 0 ? manualData[0].paper_number + 1 : 1;
                }
            } else {
                paperNumberInput.value = data || 1;
            }
        } catch (e) {
            console.error(e);
        }
    }

    // ─── Auto-fill: load last category & pre-fill form ───────
    async function autoFillFromLastEntry() {
        const year = alYearSelect.value;
        if (!year) return;

        try {
            const { data, error } = await supabase
                .from('exam_papers')
                .select('category, paper_number, given_date, given_time')
                .eq('al_year', parseInt(year))
                .order('created_at', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                const last = data[0];

                // Auto-fill category if not already chosen
                if (!categorySelect.value) {
                    if (categorySelect.querySelector(`option[value="${last.category}"]`)) {
                        categorySelect.value = last.category;
                    } else {
                        categorySelect.value = 'Other';
                        categoryOtherInput.classList.remove('d-none');
                        categoryOtherInput.value = last.category;
                    }
                    // Trigger next number fetch for this category
                    fetchNextNumber();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    // ─── Form Submit ─────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const year = parseInt(alYearSelect.value);
        let category = categorySelect.value;
        if (category === 'Other') category = categoryOtherInput.value.trim();
        const paperNumber = parseInt(paperNumberInput.value);
        const gDate = givenDateInput.value;
        const gTime = givenTimeInput.value;

        if (!year || !category || !paperNumber || !gDate || !gTime) {
            showToast('Please fill all required fields.', 'error');
            return;
        }

        try {
            const { error } = await supabase.from('exam_papers').insert([{
                al_year: year,
                category: category,
                paper_number: paperNumber,
                given_date: gDate,
                given_time: gTime
            }]);

            if (error) {
                if (error.code === '23505') {
                    showToast(`Paper #${paperNumber} for ${category} (${year}) already exists!`, 'error');
                } else {
                    showToast('Failed to save: ' + error.message, 'error');
                }
                return;
            }

            showToast('Paper record saved successfully!', 'success');
            loadRecentPapers();
            loadAnalytics();
            updateLastStats();

            // Auto-increment for next entry
            paperNumberInput.value = paperNumber + 1;

            // Reset date/time to now for next entry
            const now = new Date();
            givenDateInput.value = now.toISOString().split('T')[0];
            givenTimeInput.value = now.toTimeString().substring(0, 5);

        } catch (err) {
            console.error(err);
            showToast('An unexpected error occurred.', 'error');
        }
    });

    // ─── Load Recent Papers ───────────────────────────────────
    async function loadRecentPapers() {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Loading...</td></tr>`;

        let query = supabase.from('exam_papers').select('*').order('created_at', { ascending: false }).limit(20);
        const filterYear = filterYearSelect.value;
        if (filterYear !== 'all') query = query.eq('al_year', parseInt(filterYear));

        const { data, error } = await query;
        if (error) { console.error(error); return; }

        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No records found.</td></tr>`;
            return;
        }

        data.forEach(paper => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="cat-badge">${paper.category}</span></td>
                <td><span class="paper-num">#${paper.paper_number}</span></td>
                <td>${paper.given_date}</td>
                <td style="color:var(--text-dim);font-size:12px;">${paper.given_time}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ─── Update Last Stats ────────────────────────────────────
    async function updateLastStats() {
        let query = supabase
            .from('exam_papers')
            .select('category, paper_number, given_date, created_at')
            .order('created_at', { ascending: false })
            .limit(1);

        const filterYear = filterYearSelect.value || document.getElementById('display-al-year').textContent;
        if (filterYear && filterYear !== 'All' && filterYear !== 'all' && filterYear !== '-' && filterYear !== '–') {
            query = query.eq('al_year', parseInt(filterYear));
        }

        const { data, error } = await query;

        if (data && data.length > 0) {
            statCategory.textContent = data[0].category;
            statNumber.textContent   = '#' + data[0].paper_number;
            statDate.textContent     = data[0].given_date;
        } else {
            statCategory.textContent = '–';
            statNumber.textContent   = '–';
            statDate.textContent     = '–';
        }
    }

    // ─── All Papers Modal ─────────────────────────────────────
    const openModalTrigger = document.querySelector('.open-modal-trigger');

    if (openModalTrigger) {
        openModalTrigger.addEventListener('click', () => {
            const year = alYearSelect.value || displayAlYearSpan.textContent;
            if (!year || year === 'All' || year === '–' || year === '-') {
                showToast('Please select a year first.', 'error');
                return;
            }
            allPapersModal.classList.remove('d-none');
            modalCategorySelect.value = 'All';
            loadModalData();
        });
    }

    if (modalCategorySelect) {
        modalCategorySelect.addEventListener('change', loadModalData);
    }

    async function loadModalData() {
        const year = alYearSelect.value || displayAlYearSpan.textContent;
        const selectedCategory = modalCategorySelect.value;

        allPapersTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">Loading...</td></tr>`;

        if (selectedCategory === 'All') {
            modalTableHead.innerHTML = `
                <tr>
                    <th>Category</th>
                    <th>Last Paper No.</th>
                    <th>Date Given</th>
                </tr>`;

            const { data, error } = await supabase
                .from('exam_papers')
                .select('category, paper_number, given_date')
                .eq('al_year', year)
                .order('paper_number', { ascending: false });

            if (error || !data || data.length === 0) {
                allPapersTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">${error ? 'Error loading data' : 'No papers found'}</td></tr>`;
                return;
            }

            const categoryMap = new Map();
            data.forEach(p => { if (!categoryMap.has(p.category)) categoryMap.set(p.category, p); });

            allPapersTbody.innerHTML = '';
            Array.from(categoryMap.values()).forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="cat-badge">${p.category}</span></td>
                    <td><span class="paper-num">#${p.paper_number}</span></td>
                    <td>${p.given_date}</td>
                `;
                allPapersTbody.appendChild(tr);
            });

        } else {
            modalTableHead.innerHTML = `
                <tr>
                    <th>Paper No.</th>
                    <th>Date Given</th>
                    <th>Time Given</th>
                </tr>`;

            const { data, error } = await supabase
                .from('exam_papers')
                .select('paper_number, given_date, given_time')
                .eq('al_year', year)
                .eq('category', selectedCategory)
                .order('paper_number', { ascending: false });

            if (error || !data || data.length === 0) {
                allPapersTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">${error ? 'Error loading data' : 'No papers found for this category'}</td></tr>`;
                return;
            }

            allPapersTbody.innerHTML = '';
            data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="paper-num">#${p.paper_number}</span></td>
                    <td>${p.given_date}</td>
                    <td style="color:var(--text-dim);font-size:12px;">${p.given_time}</td>
                `;
                allPapersTbody.appendChild(tr);
            });
        }
    }

    if (closeAllPapersBtn) {
        closeAllPapersBtn.addEventListener('click', () => allPapersModal.classList.add('d-none'));
    }

    // Close modal on overlay click
    allPapersModal.addEventListener('click', (e) => {
        if (e.target === allPapersModal) allPapersModal.classList.add('d-none');
    });

    // ─── Analytics Chart ──────────────────────────────────────
    async function loadAnalytics() {
        let query = supabase.from('exam_papers').select('category, paper_number');
        const filterYear = filterYearSelect.value;
        if (filterYear !== 'all') query = query.eq('al_year', parseInt(filterYear));

        const { data, error } = await query;
        if (error) return;

        // Group by category and get max paper_number (shows progress per category)
        const counts = {};
        data.forEach(p => {
            counts[p.category] = (counts[p.category] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        const ctx = document.getElementById('analytics-chart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        // Use override config if available for gradient bars
        const override = window.__chartOverride || {};

        // Build gradient dataset
        const dataset = {
            label: 'Papers Count',
            data: values,
            borderRadius: { topLeft: 6, topRight: 6 },
            borderSkipped: false,
        };

        // Apply gradient after chart is created via plugin
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [dataset]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 900, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111',
                        borderColor: 'rgba(0,230,118,0.25)',
                        borderWidth: 1,
                        titleColor: '#00E676',
                        bodyColor: '#e0e0e0',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => `  ${ctx.parsed.y} paper${ctx.parsed.y !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#444',
                            font: { family: "'Space Mono', monospace", size: 11 }
                        },
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        border: { color: 'transparent' }
                    },
                    x: {
                        ticks: {
                            color: '#888',
                            font: { family: "'DM Sans', sans-serif", size: 12, weight: '600' }
                        },
                        grid: { display: false },
                        border: { color: 'rgba(255,255,255,0.06)' }
                    }
                }
            },
            plugins: [{
                id: 'gradientBars',
                beforeDatasetDraw(chart) {
                    const { ctx: c, chartArea: area } = chart;
                    if (!area) return;
                    const gradient = c.createLinearGradient(0, area.top, 0, area.bottom);
                    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.85)');
                    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.1)');
                    chart.data.datasets[0].backgroundColor = gradient;
                    chart.data.datasets[0].borderColor = '#00E676';
                    chart.data.datasets[0].borderWidth = 2;
                    chart.data.datasets[0].hoverBackgroundColor = 'rgba(51, 255, 142, 0.9)';
                }
            }]
        });
    }

    // ─── Toast ────────────────────────────────────────────────
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'check_circle' : 'error';
        toast.innerHTML = `<i class="material-symbols-rounded">${icon}</i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(110%)';
            setTimeout(() => toast.remove(), 350);
        }, 3200);
    }

    // ─── Boot ─────────────────────────────────────────────────
    init();

    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.error('SW failed:', err));
        });
    }
});
