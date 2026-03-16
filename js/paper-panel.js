// js/paper-panel.js

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('auth-page')) return;

    const supabase = window.supabaseClient;
    const form = document.getElementById('paper-panel-form');

    // Default dates
    document.getElementById('panel-received-date').valueAsDate = new Date();

    const batchSelect = document.getElementById('panel-batch');
    const batchOther = document.getElementById('panel-batch-other');
    const typeSelect = document.getElementById('panel-type');
    const typeOther = document.getElementById('panel-type-other');
    const fetchNextBtn = document.getElementById('fetch-panel-next-btn');
    const numberInput = document.getElementById('panel-number');

    // Toggles
    batchSelect.addEventListener('change', () => {
        batchOther.classList.toggle('d-none', batchSelect.value !== 'Other');
        if (batchSelect.value !== 'Other') batchOther.value = '';
    });

    typeSelect.addEventListener('change', () => {
        typeOther.classList.toggle('d-none', typeSelect.value !== 'other');
        if (typeSelect.value !== 'other') typeOther.value = '';
    });

    // Auto-fetch logic
    fetchNextBtn.addEventListener('click', async () => {
        const targetBatch = batchSelect.value === 'Other' ? batchOther.value.trim() : batchSelect.value;
        const targetType = typeSelect.value === 'other' ? typeOther.value.trim() : typeSelect.value;

        if (!targetBatch || !targetType) {
            window.showToast('Please select Batch and Paper Type first.', 'error');
            return;
        }

        window.showLoading(true);
        const { data, error } = await supabase.rpc('get_next_panel_paper_number', {
            p_batch: targetBatch,
            p_paper_type: targetType
        });
        window.showLoading(false);

        if (error) {
            window.showToast('Error fetching next number: ' + error.message, 'error');
        } else {
            if (data > 80) {
                window.showToast('Maximum paper number (80) exceeded for this type.', 'error');
            } else {
                numberInput.value = data;
                window.showToast(`Fetched next number: ${data}`, 'success');
            }
        }
    });

    // Submit logic
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const user = session.user;

        const batchVal = batchSelect.value;
        const finalBatch = batchVal === 'Other' ? batchOther.value.trim() : batchVal;

        const typeVal = typeSelect.value;
        const finalType = typeVal === 'other' ? typeOther.value.trim() : typeVal;

        const paperNumber = parseInt(numberInput.value, 10);
        const paperCount = parseInt(document.getElementById('panel-count').value, 10);
        const receivedDate = document.getElementById('panel-received-date').value;
        const returnedDate = document.getElementById('panel-returned-date').value || null;

        if (!finalBatch || !finalType) {
            window.showToast('Batch and Paper Type are required.', 'error');
            return;
        }

        if (paperNumber > 80) {
            window.showToast('Paper Number cannot exceed 80.', 'error');
            return;
        }

        const entryData = {
            user_id: user.id,
            batch: finalBatch,
            paper_type: finalType,
            paper_number: paperNumber,
            paper_count: paperCount,
            received_date: receivedDate,
            returned_date: returnedDate
        };

        window.showLoading(true);
        const { error } = await supabase
            .from('paper_panel_entries')
            .insert(entryData);
        window.showLoading(false);

        if (error) {
            window.showToast('Failed to save paper panel entry: ' + error.message, 'error');
        } else {
            window.showToast('Paper panel entry saved successfully!', 'success');

            // Reset numerical inputs but keep dates
            numberInput.value = '';
            document.getElementById('panel-count').value = '';

            if (window.loadDashboardData) window.loadDashboardData();
            if (window.loadPastEntries) window.loadPastEntries();
        }
    });
});