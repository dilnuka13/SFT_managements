// js/exam-papers.js

document.addEventListener('DOMContentLoaded', async () => {
    // Make sure supabase client is available
    if (!window.supabaseClient) {
        showToast('Supabase client not initialized.', 'error');
        return;
    }

    const supabase = window.supabaseClient;
    let currentUser = null;
    let chartInstance = null;

    // DOM Elements
    const form = document.getElementById('exam-paper-form');
    const alYearSelect = document.getElementById('al-year');
    const categorySelect = document.getElementById('paper-category');
    const categoryOtherInput = document.getElementById('category-other');
    const paperNumberInput = document.getElementById('paper-number');
    const givenDateInput = document.getElementById('given-date');
    const givenTimeInput = document.getElementById('given-time');
    const refreshNumBtn = document.getElementById('refresh-number-btn');
    const filterYearSelect = document.getElementById('filter-year');
    const tableBody = document.querySelector('#recent-papers-table tbody');

    // Modal Elements
    const yearModal = document.getElementById('year-selection-modal');
    const displayAlYearSpan = document.getElementById('display-al-year');
    const quickBtns = document.querySelectorAll('.year-quick-btn');
    const changeYearBtn = document.getElementById('change-year-btn');

    // Stat Elements
    const statCategory = document.getElementById('stat-last-category');
    const statNumber = document.getElementById('stat-last-number');
    const statDate = document.getElementById('stat-last-date');
    const statLastNumberCard = document.getElementById('stat-last-number-card');

    // All Papers Modal Elements
    const allPapersModal = document.getElementById('all-papers-modal');
    const closeAllPapersBtn = document.getElementById('close-all-papers-btn');
    const allPapersTbody = document.getElementById('all-papers-tbody');

    // Initialize
    async function init() {
        // No login required for this page
        // Set default date and time to today/now
        const now = new Date();
        givenDateInput.value = now.toISOString().split('T')[0];
        givenTimeInput.value = now.toTimeString().substring(0, 5);

        // We do not load data yet until the year is selected
    }

    // Handle Year Selection from Quick Buttons
    quickBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedYear = e.target.getAttribute('data-year');
            
            // Set the hidden forms/filters to this year
            alYearSelect.value = selectedYear;
            filterYearSelect.value = selectedYear;
            displayAlYearSpan.textContent = selectedYear;

            // Hide modal
            yearModal.classList.add('d-none');

            // Fetch initial data for this year
            loadRecentPapers();
            loadAnalytics();
            updateLastStats();
        });
    });

    // Handle Change Year Button
    if (changeYearBtn) {
        changeYearBtn.addEventListener('click', () => {
            yearModal.classList.remove('d-none');
        });
    }

    // Toggle "Other" category input
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

    // Fetch the next paper number automatically
    async function fetchNextNumber() {
        const year = alYearSelect.value;
        let category = categorySelect.value;
        if (category === 'Other') category = categoryOtherInput.value.trim();

        if (!year || !category) {
            paperNumberInput.value = '';
            return;
        }

        try {
            const { data, error } = await supabase.rpc('get_next_exam_paper_number', {
                p_al_year: parseInt(year),
                p_category: category
            });

            if (error) {
                console.error("Error fetching next number:", error);
                // Fallback to manual query
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

    // Submit Form
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
                if (error.code === '23505') { // Unique violation
                    showToast(`Paper number ${paperNumber} for ${category} (${year}) already exists!`, 'error');
                } else {
                    showToast('Failed to save record: ' + error.message, 'error');
                }
                return;
            }

            showToast('Paper record added successfully!', 'success');
            
            // Refresh Dashboard & Table
            loadRecentPapers();
            loadAnalytics();
            updateLastStats();

            // Prepare for next entry (auto-increment)
            paperNumberInput.value = paperNumber + 1;

        } catch (err) {
            console.error(err);
            showToast('An unexpected error occurred.', 'error');
        }
    });

    async function loadRecentPapers() {
        let query = supabase.from('exam_papers').select('*').order('created_at', { ascending: false }).limit(20);
        
        const filterYear = filterYearSelect.value;
        if (filterYear !== 'all') {
            query = query.eq('al_year', parseInt(filterYear));
        }

        const { data, error } = await query;
        if (error) {
            console.error("Error loading recent papers:", error);
            return;
        }

        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No records found.</td></tr>';
            return;
        }

        data.forEach(paper => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${paper.al_year}</td>
                <td><span style="background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${paper.category}</span></td>
                <td><strong>${paper.paper_number}</strong></td>
                <td>${paper.given_date}</td>
                <td>${paper.given_time}</td>
                <td style="color: var(--md-sys-color-outline); font-size: 12px;">${new Date(paper.created_at).toLocaleString()}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    async function updateLastStats() {
        const { data, error } = await supabase
            .from('exam_papers')
            .select('category, paper_number, given_date, created_at')
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            statCategory.textContent = data[0].category;
            statNumber.textContent = data[0].paper_number;
            statDate.textContent = data[0].given_date;
        } else {
            statCategory.textContent = '-';
            statNumber.textContent = '-';
            statDate.textContent = '-';
        }
    }

    // Handle "Last Paper Number" card click -> Show All Categories
    if (statLastNumberCard) {
        statLastNumberCard.addEventListener('click', async () => {
            const year = alYearSelect.value || document.getElementById('display-al-year').textContent;
            
            if (!year || year === 'All' || year === '-') {
                showToast('Please select a valid A/L Year first.', 'error');
                return;
            }

            // Show modal
            allPapersModal.classList.remove('d-none');
            allPapersTbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Loading...</td></tr>';

            const { data, error } = await supabase
                .from('exam_papers')
                .select('category, paper_number, given_date')
                .eq('al_year', year)
                .order('paper_number', { ascending: false });

            if (error) {
                console.error(error);
                allPapersTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Error loading data</td></tr>';
                return;
            }

            if (!data || data.length === 0) {
                allPapersTbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No papers found for this year</td></tr>';
                return;
            }

            // Get the max paper number for each category
            const categoryMap = new Map();
            data.forEach(paper => {
                if (!categoryMap.has(paper.category)) {
                    categoryMap.set(paper.category, paper);
                }
            });

            // Convert to array and render
            allPapersTbody.innerHTML = '';
            Array.from(categoryMap.values()).forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; color: var(--md-sys-color-primary);">${p.category}</td>
                    <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">${p.paper_number}</td>
                    <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">${p.given_date}</td>
                `;
                allPapersTbody.appendChild(tr);
            });
        });
    }

    if (closeAllPapersBtn) {
        closeAllPapersBtn.addEventListener('click', () => {
            allPapersModal.classList.add('d-none');
        });
    }

    async function loadAnalytics() {
        let query = supabase.from('exam_papers').select('category');
        
        const filterYear = filterYearSelect.value;
        if (filterYear !== 'all') {
            query = query.eq('al_year', parseInt(filterYear));
        }

        const { data, error } = await query;
        if (error) return;

        // Group by category
        const counts = {};
        data.forEach(p => {
            counts[p.category] = (counts[p.category] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        const ctx = document.getElementById('analytics-chart').getContext('2d');
        
        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Papers Count',
                    data: values,
                    backgroundColor: '#00E676',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: '#938F99' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#938F99' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Toast functionality
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check_circle' : 'error';
        toast.innerHTML = `<i class="material-symbols-rounded">${icon}</i><span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    init();

    // Register Service Worker for PWA / Production readiness
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.error('ServiceWorker registration failed: ', err);
            });
        });
    }
});
