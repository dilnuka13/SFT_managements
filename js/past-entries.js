// js/past-entries.js

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('auth-page')) return;

    const supabase = window.supabaseClient;

    window.loadPastEntries = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Instructor Sessions with nested Classes
        const { data: instructorData, error: instError } = await supabase
            .from('instructor_sessions')
            .select('*, instructor_classes(*)')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(50);

        if (!instError && instructorData) {
            renderInstructorTable(instructorData);
        }

        // Fetch Paper Panel Entries
        const { data: panelData, error: panelError } = await supabase
            .from('paper_panel_entries')
            .select('*')
            .eq('user_id', user.id)
            .order('received_date', { ascending: false })
            .limit(50);

        if (!panelError && panelData) {
            renderPanelTable(panelData);
        }
    };

    const renderInstructorTable = (data) => {
        const tbody = document.querySelector('#past-instructor-table tbody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No past entries found.</td></tr>';
            return;
        }

        let instIndex = 1;
        data.forEach(session => {
            const tr = document.createElement('tr');

            let classesList = '<ul style="margin:0; padding-left:1.2rem;">';
            if (session.instructor_classes && session.instructor_classes.length > 0) {
                // Sort by class index
                const sortedClasses = session.instructor_classes.sort((a, b) => a.class_index - b.class_index);
                sortedClasses.forEach(c => {
                    let details = `${c.batch} - ${c.class_type}`;
                    if (c.class_type.toLowerCase() === 'paper class') {
                        details += ` (${c.paper_type} #${c.paper_number})`;
                    }
                    classesList += `<li>${details}</li>`;
                });
            } else {
                classesList += '<li>No classes recorded</li>';
            }
            classesList += '</ul>';

            tr.innerHTML = `
                <td>${instIndex++}</td>
                <td>${window.formatDate(session.date)}</td>
                <td>${window.formatTime(session.start_time)} - ${window.formatTime(session.end_time)}</td>
                <td>${classesList}</td>
                <td>
                    <button class="btn btn-small btn-danger" onclick="deleteInstructorSession('${session.id}')">
                        <i class="material-symbols-rounded" style="font-size: 16px;">delete</i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    const renderPanelTable = (data) => {
        const tbody = document.querySelector('#past-panel-table tbody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No past entries found.</td></tr>';
            return;
        }

        let panelIndex = 1;
        data.forEach(entry => {
            const tr = document.createElement('tr');
            const datesStr = `Rcvd: ${window.formatDate(entry.received_date)}<br>` +
                (entry.returned_date ? `Reth: ${window.formatDate(entry.returned_date)}` : 'Rtn: Pending');

            tr.innerHTML = `
                <td>${panelIndex++}</td>
                <td>${entry.batch}</td>
                <td>${entry.paper_type} #${entry.paper_number}</td>
                <td>${entry.paper_count}</td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${datesStr}</td>
                <td>
                    <button class="btn btn-small btn-outline" onclick="editPanelCount('${entry.id}', ${entry.paper_count})" title="Edit Count">
                        <i class="material-symbols-rounded" style="font-size: 16px;">edit</i>
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deletePanelEntry('${entry.id}')">
                        <i class="material-symbols-rounded" style="font-size: 16px;">delete</i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // --- UI Helpers for Modals ---
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-entry-form');
    const editContainer = document.getElementById('edit-form-container');
    const editTitle = document.getElementById('edit-modal-title');

    document.getElementById('edit-cancel-btn').addEventListener('click', () => {
        editModal.classList.add('d-none');
    });

    // --- Global deletion and edit functions ---
    window.deleteInstructorSession = async (id) => {
        const confirmed = confirm('Are you sure you want to delete this session? This cannot be undone.');
        if (!confirmed) return;

        window.showLoading(true);
        const { error } = await supabase.from('instructor_sessions').delete().eq('id', id);
        window.showLoading(false);

        if (error) {
            window.showToast('Failed to delete session.', 'error');
        } else {
            window.showToast('Session deleted.', 'success');
            window.loadPastEntries();
            if (window.loadDashboardData) window.loadDashboardData();
        }
    };

    window.deletePanelEntry = async (id) => {
        const confirmed = confirm('Are you sure you want to delete this panel entry?');
        if (!confirmed) return;

        window.showLoading(true);
        const { error } = await supabase.from('paper_panel_entries').delete().eq('id', id);
        window.showLoading(false);

        if (error) {
            window.showToast('Failed to delete entry.', 'error');
        } else {
            window.showToast('Entry deleted.', 'success');
            window.loadPastEntries();
            if (window.loadDashboardData) window.loadDashboardData();
        }
    };

    window.editPanelCount = async (id, currentCount) => {
        editTitle.textContent = 'Edit Paper Count';
        editContainer.innerHTML = `
            <div class="form-group">
                <label>New Paper Count</label>
                <input type="number" id="edit-paper-count" value="${currentCount}" required>
            </div>
        `;

        editModal.classList.remove('d-none');

        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const newCount = parseInt(document.getElementById('edit-paper-count').value);

            window.showLoading(true);
            const { error } = await supabase.from('paper_panel_entries').update({ paper_count: newCount }).eq('id', id);
            window.showLoading(false);

            if (!error) {
                window.showToast('Count updated successfully.', 'success');
                editModal.classList.add('d-none');
                window.loadPastEntries();
                if (window.loadDashboardData) window.loadDashboardData();
            } else {
                window.showToast('Failed to update: ' + error.message, 'error');
            }
        };
    };

    // Note: We can expand this to edit more fields if needed.
});