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
            window.pastInstructorSessions = instructorData;
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
                    <button class="btn btn-small btn-outline" onclick="editInstructorSession('${session.id}')" style="margin-right: 6px;">
                        <i class="material-symbols-rounded" style="font-size: 16px;">edit</i> Edit
                    </button>
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

    window.editInstructorSession = async (id) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const session = window.pastInstructorSessions.find(s => s.id === id);
        if (!session) return;

        editTitle.textContent = 'Edit Instructor Session';
        
        let classesHTML = '';
        if (session.instructor_classes && session.instructor_classes.length > 0) {
            const sortedClasses = session.instructor_classes.sort((a, b) => a.class_index - b.class_index);
            sortedClasses.forEach(cls => {
                const isPaper = cls.class_type === 'Paper class';
                const standardBatches = ['2026', '2027', '2028'];
                const isOtherBatch = !standardBatches.includes(cls.batch);
                
                const standardTypes = ['Theory', 'Revision', 'Paper class', 'Special Class'];
                const isOtherType = !standardTypes.includes(cls.class_type);

                const standardPaperTypes = ['wave', 'black', 'ranking', 'special'];
                const isOtherPaperType = cls.paper_type && !standardPaperTypes.includes(cls.paper_type);

                classesHTML += `
                    <div class="modal-class-item" data-index="${cls.class_index}" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); padding: 12px; border-radius: 12px; margin-bottom: 12px;">
                        <h5 style="margin-top:0; margin-bottom: 8px; color: var(--primary);">Class ${cls.class_index}</h5>
                        <div class="form-row" style="margin-bottom: 0; display: flex; gap: 12px;">
                            <div class="form-group" style="margin-bottom: 8px; flex: 1;">
                                <label>Batch</label>
                                <select class="modal-class-batch" style="padding: 10px;" required>
                                    <option value="2026" ${cls.batch === '2026' ? 'selected' : ''}>2026</option>
                                    <option value="2027" ${cls.batch === '2027' ? 'selected' : ''}>2027</option>
                                    <option value="2028" ${cls.batch === '2028' ? 'selected' : ''}>2028</option>
                                    <option value="Other" ${isOtherBatch ? 'selected' : ''}>Other</option>
                                </select>
                                <input type="text" class="modal-class-batch-other ${isOtherBatch ? '' : 'd-none'}" value="${isOtherBatch ? cls.batch : ''}" placeholder="Specify Batch" style="padding: 10px; margin-top: 4px; width: 100%;">
                            </div>
                            <div class="form-group" style="margin-bottom: 8px; flex: 1;">
                                <label>Class Type</label>
                                <select class="modal-class-type" style="padding: 10px;" required>
                                    <option value="Theory" ${cls.class_type === 'Theory' ? 'selected' : ''}>Theory</option>
                                    <option value="Revision" ${cls.class_type === 'Revision' ? 'selected' : ''}>Revision</option>
                                    <option value="Paper class" ${cls.class_type === 'Paper class' ? 'selected' : ''}>Paper class</option>
                                    <option value="Special Class" ${cls.class_type === 'Special Class' ? 'selected' : ''}>Special Class</option>
                                    <option value="Other Class" ${isOtherType ? 'selected' : ''}>Other Class</option>
                                </select>
                                <input type="text" class="modal-class-type-other ${isOtherType ? '' : 'd-none'}" value="${isOtherType ? cls.class_type : ''}" placeholder="Specify Type" style="padding: 10px; margin-top: 4px; width: 100%;">
                            </div>
                        </div>
                        
                        <div class="modal-class-paper-details ${isPaper ? '' : 'd-none'}" style="margin-top: 8px;">
                            <div class="form-row" style="margin-bottom: 0; display: flex; gap: 12px;">
                                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                    <label>Paper Type</label>
                                    <select class="modal-class-paper-type" style="padding: 10px;">
                                        <option value="">Select Type</option>
                                        <option value="wave" ${cls.paper_type === 'wave' ? 'selected' : ''}>Wave</option>
                                        <option value="black" ${cls.paper_type === 'black' ? 'selected' : ''}>Black</option>
                                        <option value="ranking" ${cls.paper_type === 'ranking' ? 'selected' : ''}>Ranking</option>
                                        <option value="special" ${cls.paper_type === 'special' ? 'selected' : ''}>Special</option>
                                        <option value="other" ${isOtherPaperType ? 'selected' : ''}>Other</option>
                                    </select>
                                    <input type="text" class="modal-class-paper-type-other ${isOtherPaperType ? '' : 'd-none'}" value="${isOtherPaperType ? cls.paper_type : ''}" placeholder="Specify Paper Type" style="padding: 10px; margin-top: 4px; width: 100%;">
                                </div>
                                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                    <label>Paper Number</label>
                                    <input type="number" class="modal-class-paper-number" value="${cls.paper_number || ''}" min="1" style="padding: 10px;">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        editContainer.innerHTML = `
            <div class="form-row" style="margin-bottom: 16px; display: flex; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label>Date</label>
                    <input type="date" id="modal-inst-date" value="${session.date}" required style="padding: 10px;">
                </div>
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label>Start Time</label>
                    <input type="time" id="modal-inst-start-time" value="${session.start_time.substring(0, 5)}" step="900" required style="padding: 10px;">
                </div>
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label>End Time</label>
                    <input type="time" id="modal-inst-end-time" value="${session.end_time.substring(0, 5)}" step="900" required style="padding: 10px;">
                </div>
            </div>
            <hr style="margin: 16px 0; border-top: 1px solid var(--border-light);">
            <h4 style="margin-bottom: 12px; font-size: 15px; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px;">Classes</h4>
            <div id="modal-classes-list" style="max-height: 40vh; overflow-y: auto; padding-right: 4px;">
                ${classesHTML}
            </div>
        `;

        // Attach listeners for dynamic selections inside modal
        const itemCards = editContainer.querySelectorAll('.modal-class-item');
        itemCards.forEach(itemCard => {
            const batchSelect = itemCard.querySelector('.modal-class-batch');
            const batchOther = itemCard.querySelector('.modal-class-batch-other');
            const typeSelect = itemCard.querySelector('.modal-class-type');
            const typeOther = itemCard.querySelector('.modal-class-type-other');
            const paperDetails = itemCard.querySelector('.modal-class-paper-details');
            const paperTypeSelect = itemCard.querySelector('.modal-class-paper-type');
            const paperTypeOther = itemCard.querySelector('.modal-class-paper-type-other');

            batchSelect.addEventListener('change', () => {
                batchOther.classList.toggle('d-none', batchSelect.value !== 'Other');
                if (batchSelect.value !== 'Other') batchOther.value = '';
            });

            typeSelect.addEventListener('change', () => {
                typeOther.classList.toggle('d-none', typeSelect.value !== 'Other Class');
                if (typeSelect.value !== 'Other Class') typeOther.value = '';

                const isPaper = typeSelect.value === 'Paper class';
                paperDetails.classList.toggle('d-none', !isPaper);
                
                const paperNumInput = itemCard.querySelector('.modal-class-paper-number');
                if (isPaper) {
                    paperTypeSelect.setAttribute('required', 'true');
                    paperNumInput.setAttribute('required', 'true');
                } else {
                    paperTypeSelect.removeAttribute('required');
                    paperNumInput.removeAttribute('required');
                    paperTypeSelect.value = '';
                    paperTypeOther.value = '';
                    paperTypeOther.classList.add('d-none');
                    paperNumInput.value = '';
                }
            });

            paperTypeSelect.addEventListener('change', () => {
                paperTypeOther.classList.toggle('d-none', paperTypeSelect.value !== 'other');
                if (paperTypeSelect.value !== 'other') paperTypeOther.value = '';
            });
        });

        editModal.classList.remove('d-none');

        // Form submit handler
        editForm.onsubmit = async (e) => {
            e.preventDefault();

            const date = document.getElementById('modal-inst-date').value;
            const startTime = document.getElementById('modal-inst-start-time').value;
            const endTime = document.getElementById('modal-inst-end-time').value;

            const classesData = [];
            for (let i = 0; i < itemCards.length; i++) {
                const card = itemCards[i];
                const classIndex = parseInt(card.getAttribute('data-index'), 10);
                const batchVal = card.querySelector('.modal-class-batch').value;
                const batchOther = card.querySelector('.modal-class-batch-other').value.trim();
                const typeVal = card.querySelector('.modal-class-type').value;
                const typeOther = card.querySelector('.modal-class-type-other').value.trim();

                const finalBatch = batchVal === 'Other' ? batchOther : batchVal;
                const finalType = typeVal === 'Other Class' ? typeOther : typeVal;

                let finalPaperType = null;
                let finalPaperNumber = null;

                if (finalType === 'Paper class') {
                    const pTypeVal = card.querySelector('.modal-class-paper-type').value;
                    const pTypeOther = card.querySelector('.modal-class-paper-type-other').value.trim();
                    finalPaperType = pTypeVal === 'other' ? pTypeOther : pTypeVal;
                    finalPaperNumber = parseInt(card.querySelector('.modal-class-paper-number').value, 10);

                    if (!finalPaperType || isNaN(finalPaperNumber)) {
                        window.showToast(`Please complete paper details for Class ${classIndex}.`, 'error');
                        return;
                    }
                }

                if (!finalBatch || !finalType) {
                    window.showToast(`Please complete Batch and Type for Class ${classIndex}.`, 'error');
                    return;
                }

                classesData.push({
                    user_id: user.id,
                    class_index: classIndex,
                    batch: finalBatch,
                    class_type: finalType,
                    paper_type: finalPaperType,
                    paper_number: finalPaperNumber
                });
            }

            window.showLoading(true);
            try {
                // Update Session
                const { error: sessionError } = await supabase
                    .from('instructor_sessions')
                    .update({ date, start_time: startTime, end_time: endTime })
                    .eq('id', session.id);

                if (sessionError) throw sessionError;

                // Delete old classes
                const { error: deleteError } = await supabase
                    .from('instructor_classes')
                    .delete()
                    .eq('session_id', session.id);

                if (deleteError) throw deleteError;

                // Link session ID to classes
                const classesToInsert = classesData.map(c => ({
                    ...c,
                    session_id: session.id
                }));

                // Insert Classes
                const { error: classesError } = await supabase
                    .from('instructor_classes')
                    .insert(classesToInsert);

                if (classesError) throw classesError;

                window.showToast('Instructor session updated successfully!', 'success');
                editModal.classList.add('d-none');
                window.loadPastEntries();
                if (window.loadDashboardData) window.loadDashboardData();
            } catch (error) {
                console.error(error);
                window.showToast('Failed to update session: ' + error.message, 'error');
            } finally {
                window.showLoading(false);
            }
        };
    };

    // Note: We can expand this to edit more fields if needed.
});