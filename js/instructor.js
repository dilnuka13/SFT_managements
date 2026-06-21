// js/instructor.js

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('auth-page')) return;

    const supabase = window.supabaseClient;
    const instructorForm = document.getElementById('instructor-form');
    const classesContainer = document.getElementById('classes-container');
    const addClassBtn = document.getElementById('add-class-btn');

    let classCount = 1;

    let recentSundaySession = null;
    let recentWednesdaySession = null;
    let sessionsFetched = false;

    const getDayOfWeek = (dateStr) => {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return date.getDay(); // 0 = Sunday, 3 = Wednesday
    };

    const fetchRecentSessions = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const user = session.user;

            const { data, error } = await supabase
                .from('instructor_sessions')
                .select('id, date, start_time, end_time')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching recent sessions:', error);
                return;
            }

            if (data && data.length > 0) {
                recentSundaySession = data.find(s => getDayOfWeek(s.date) === 0);
                recentWednesdaySession = data.find(s => getDayOfWeek(s.date) === 3);
            }
            sessionsFetched = true;
        } catch (err) {
            console.error('Error fetching recent sessions:', err);
        }
    };

    const autoFillSchedule = async (dateStr) => {
        const day = getDayOfWeek(dateStr);
        if (day !== 0 && day !== 3) return; // Only Sun (0) and Wed (3)

        window.showLoading(true);

        try {
            if (!sessionsFetched) {
                await fetchRecentSessions();
            }

            // Reset classes container to just 1 class first
            const classCards = document.querySelectorAll('.class-entry-card');
            classCards.forEach((c, idx) => {
                if (idx > 0) c.remove();
            });
            classCount = 1;
            addClassBtn.classList.remove('d-none');

            // Clear the fields on Class 1
            const card1 = document.getElementById('class-entry-1');
            const batchSelect1 = card1.querySelector('.inst-batch');
            const typeSelect1 = card1.querySelector('.inst-class-type');
            batchSelect1.value = '';
            batchSelect1.dispatchEvent(new Event('change'));
            typeSelect1.value = '';
            typeSelect1.dispatchEvent(new Event('change'));

            if (day === 0) { // Sunday
                // Start/End Time
                let startTime = '08:00';
                let endTime = '18:15';
                if (recentSundaySession) {
                    startTime = recentSundaySession.start_time.substring(0, 5);
                    endTime = recentSundaySession.end_time.substring(0, 5);
                }
                document.getElementById('inst-start-time').value = startTime;
                document.getElementById('inst-end-time').value = endTime;

                // Class 1: 2026 Paper class, Black Paper
                batchSelect1.value = '2026';
                batchSelect1.dispatchEvent(new Event('change'));
                typeSelect1.value = 'Paper class';
                typeSelect1.dispatchEvent(new Event('change'));

                const paperTypeSelect = card1.querySelector('.inst-paper-type');
                paperTypeSelect.value = 'black';
                paperTypeSelect.dispatchEvent(new Event('change'));

                // Fetch next paper number
                const { data: nextNum, error } = await supabase.rpc('get_next_instructor_paper_number', {
                    p_batch: '2026',
                    p_paper_type: 'black'
                });
                if (!error && nextNum !== null) {
                    card1.querySelector('.inst-paper-number').value = nextNum;
                }

                // Add Class 2: 2027 Theory
                addClassBtn.click();
                const card2 = document.getElementById('class-entry-2');
                if (card2) {
                    const batch2 = card2.querySelector('.inst-batch');
                    const type2 = card2.querySelector('.inst-class-type');
                    batch2.value = '2027';
                    batch2.dispatchEvent(new Event('change'));
                    type2.value = 'Theory';
                    type2.dispatchEvent(new Event('change'));
                }

                // Add Class 3: 2028 Theory
                addClassBtn.click();
                const card3 = document.getElementById('class-entry-3');
                if (card3) {
                    const batch3 = card3.querySelector('.inst-batch');
                    const type3 = card3.querySelector('.inst-class-type');
                    batch3.value = '2028';
                    batch3.dispatchEvent(new Event('change'));
                    type3.value = 'Theory';
                    type3.dispatchEvent(new Event('change'));
                }

            } else if (day === 3) { // Wednesday
                // Start/End Time
                let startTime = '07:45';
                let endTime = '17:00';
                if (recentWednesdaySession) {
                    startTime = recentWednesdaySession.start_time.substring(0, 5);
                    endTime = recentWednesdaySession.end_time.substring(0, 5);
                }
                document.getElementById('inst-start-time').value = startTime;
                document.getElementById('inst-end-time').value = endTime;

                // Class 1: 2026 Revision
                batchSelect1.value = '2026';
                batchSelect1.dispatchEvent(new Event('change'));
                typeSelect1.value = 'Revision';
                typeSelect1.dispatchEvent(new Event('change'));

                // Add Class 2: 2026 Theory
                addClassBtn.click();
                const card2 = document.getElementById('class-entry-2');
                if (card2) {
                    const batch2 = card2.querySelector('.inst-batch');
                    const type2 = card2.querySelector('.inst-class-type');
                    batch2.value = '2026';
                    batch2.dispatchEvent(new Event('change'));
                    type2.value = 'Theory';
                    type2.dispatchEvent(new Event('change'));
                }
            }

            window.showToast('Schedule auto-filled successfully!', 'success');
        } catch (err) {
            console.error('Error auto-filling schedule:', err);
            window.showToast('Error auto-filling schedule: ' + err.message, 'error');
        } finally {
            window.showLoading(false);
        }
    };

    // --- Time validation (15 min intervals) ---
    const validateTimeInput = (e) => {
        const val = e.target.value; // HH:mm format
        if (!val) return;
        const [hours, minutes] = val.split(':');
        const minInt = parseInt(minutes, 10);

        // Round to nearest 15 mins
        if (minInt % 15 !== 0) {
            const rounded = Math.round(minInt / 15) * 15;
            let m = rounded === 60 ? '00' : rounded.toString().padStart(2, '0');
            let h = parseInt(hours, 10);
            if (rounded === 60) h = (h + 1) % 24;
            e.target.value = `${h.toString().padStart(2, '0')}:${m}`;
            window.showToast('Time adjusted to nearest 15-minute interval', 'default');
        }
    };

    document.getElementById('inst-start-time').addEventListener('change', validateTimeInput);
    document.getElementById('inst-end-time').addEventListener('change', validateTimeInput);

    // Default date to today and auto-fill check
    const dateInput = document.getElementById('inst-date');
    dateInput.valueAsDate = new Date();

    // Auto-fill on load if it's Sunday or Wednesday
    if (dateInput.value) {
        autoFillSchedule(dateInput.value);
    }

    // Listen to changes on date
    dateInput.addEventListener('change', () => {
        if (dateInput.value) {
            autoFillSchedule(dateInput.value);
        }
    });

    // --- Dynamic Class Forms Logic ---
    const updateCardTitle = (card) => {
        const batchSelect = card.querySelector('.inst-batch');
        const batchOther = card.querySelector('.inst-batch-other');
        const typeSelect = card.querySelector('.inst-class-type');
        const typeOther = card.querySelector('.inst-type-other');
        const h3 = card.querySelector('h3');

        if (!h3) return;

        let previewDiv = card.querySelector('.class-preview-info');
        if (!previewDiv) {
            previewDiv = document.createElement('div');
            previewDiv.className = 'class-preview-info';
            previewDiv.style = 'margin-top: 8px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; font-size: 13px;';
            h3.parentNode.insertBefore(previewDiv, h3.nextSibling);
        }

        const classIdx = card.id === 'class-entry-1' ? 1 : parseInt(card.id.split('-').pop(), 10);
        const isMandatory = classIdx === 1;

        const batchVal = batchSelect.value === 'Other' ? batchOther.value.trim() : batchSelect.value;
        const typeVal = typeSelect.value === 'Other Class' ? typeOther.value.trim() : typeSelect.value;

        h3.textContent = `Class ${classIdx} ${isMandatory ? '(Mandatory)' : '(Optional)'}`;

        let previewHTML = '';
        if (batchVal) {
            previewHTML += `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: var(--text-secondary); display: flex; align-items: center; gap: 4px; width: 95px;"><i class="material-symbols-rounded" style="font-size: 16px;">groups</i> Batch:</span>
                    <span style="background: rgba(255,255,255,0.06); color: var(--text-main); padding: 3px 10px; border-radius: 6px; border: 1px solid var(--border-light); font-size: 12px; font-weight: 500;">${batchVal}</span>
                </div>
            `;
        }
        if (typeVal) {
            previewHTML += `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: var(--text-secondary); display: flex; align-items: center; gap: 4px; width: 95px;"><i class="material-symbols-rounded" style="font-size: 16px;">category</i> Type:</span>
                    <span style="background: var(--primary-dim); color: var(--primary); padding: 3px 10px; border-radius: 6px; border: 1px solid var(--border-primary); font-size: 12px; font-weight: 600; text-shadow: 0 0 10px var(--primary-glow);">${typeVal}</span>
                </div>
            `;
        }
        previewDiv.innerHTML = previewHTML;
    };

    const attachClassListeners = (classCard) => {
        const batchSelect = classCard.querySelector('.inst-batch');
        const batchOther = classCard.querySelector('.inst-batch-other');
        const typeSelect = classCard.querySelector('.inst-class-type');
        const typeOther = classCard.querySelector('.inst-type-other');
        const paperDetails = classCard.querySelector('.inst-paper-details');
        const paperTypeSelect = classCard.querySelector('.inst-paper-type');
        const paperTypeOther = classCard.querySelector('.inst-paper-type-other');
        const fetchNextBtn = classCard.querySelector('.fetch-next-btn');
        const paperNumberInput = classCard.querySelector('.inst-paper-number');

        // Initial title update
        updateCardTitle(classCard);

        // Toggle "Other" inputs
        batchSelect.addEventListener('change', () => {
            batchOther.parentElement.classList.toggle('d-none', batchSelect.value !== 'Other');
            if (batchSelect.value !== 'Other') batchOther.value = '';
            updateCardTitle(classCard);
        });

        batchOther.addEventListener('input', () => {
            updateCardTitle(classCard);
        });

        typeSelect.addEventListener('change', () => {
            typeOther.parentElement.classList.toggle('d-none', typeSelect.value !== 'Other Class');
            if (typeSelect.value !== 'Other Class') typeOther.value = '';

            // Show paper details if 'Paper class'
            const isPaperClass = typeSelect.value === 'Paper class';
            paperDetails.classList.toggle('d-none', !isPaperClass);

            if (isPaperClass) {
                paperTypeSelect.setAttribute('required', 'true');
                paperNumberInput.setAttribute('required', 'true');
            } else {
                paperTypeSelect.removeAttribute('required');
                paperNumberInput.removeAttribute('required');
                paperTypeSelect.value = '';
                paperTypeOther.value = '';
                paperTypeOther.parentElement.classList.add('d-none');
                paperNumberInput.value = '';
            }
            updateCardTitle(classCard);
        });

        typeOther.addEventListener('input', () => {
            updateCardTitle(classCard);
        });

        paperTypeSelect.addEventListener('change', () => {
            paperTypeOther.parentElement.classList.toggle('d-none', paperTypeSelect.value !== 'other');
            if (paperTypeSelect.value !== 'other') paperTypeOther.value = '';
        });

        // Fetch Next Paper Number logic
        fetchNextBtn.addEventListener('click', async () => {
            const targetBatch = batchSelect.value === 'Other' ? batchOther.value.trim() : batchSelect.value;
            const targetPaperType = paperTypeSelect.value === 'other' ? paperTypeOther.value.trim() : paperTypeSelect.value;

            if (!targetBatch || !targetPaperType) {
                window.showToast('Please select Batch and Paper Type first.', 'error');
                return;
            }

            window.showLoading(true);
            const { data, error } = await supabase.rpc('get_next_instructor_paper_number', {
                p_batch: targetBatch,
                p_paper_type: targetPaperType
            });
            window.showLoading(false);

            if (error) {
                window.showToast('Error fetching next number: ' + error.message, 'error');
            } else {
                paperNumberInput.value = data;
                window.showToast(`Fetched next number: ${data}`, 'success');
            }
        });

        // Remove button logic
        const removeBtn = classCard.querySelector('.remove-class-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                classCard.remove();
                classCount--;
                addClassBtn.classList.remove('d-none'); // Re-enable if below 5
            });
        }
    };

    // Attach to initial Class 1
    attachClassListeners(document.getElementById('class-entry-1'));

    addClassBtn.addEventListener('click', () => {
        if (classCount >= 5) {
            window.showToast('Maximum 5 classes allowed per session.', 'error');
            return;
        }

        classCount++;
        const newClassId = `class-entry-${classCount}`;

        const cardHTML = `
            <div class="class-entry-card" id="${newClassId}" style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; margin-bottom: 16px; position: relative;">
                <button type="button" class="icon-btn remove-class-btn" style="position: absolute; top: 16px; right: 16px; width: 36px; height: 36px;"><i class="material-symbols-rounded">close</i></button>
                <h3 style="margin-top:0; font-size: 16px; color: var(--md-sys-color-primary)">Class ${classCount} (Optional)</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Batch</label>
                        <select class="inst-batch" required>
                            <option value="">Select Batch</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2028">2028</option>
                            <option value="Other">Other</option>
                        </select>
                        <input type="text" class="inst-batch-other d-none mt-2" placeholder="Specify Batch">
                    </div>
                    <div class="form-group">
                        <label>Class Type</label>
                        <select class="inst-class-type" required>
                            <option value="">Select Type</option>
                            <option value="Theory">Theory</option>
                            <option value="Revision">Revision</option>
                            <option value="Paper class">Paper class</option>
                            <option value="Special Class">Special Class</option>
                            <option value="Other Class">Other Class</option>
                        </select>
                        <input type="text" class="inst-type-other d-none mt-2" placeholder="Specify Type">
                    </div>
                </div>
                <div class="form-row inst-paper-details d-none mt-2">
                    <div class="form-group">
                        <label>Paper Type</label>
                        <select class="inst-paper-type">
                            <option value="">Select Type</option>
                            <option value="wave">Wave</option>
                            <option value="black">Black</option>
                            <option value="ranking">Ranking</option>
                            <option value="special">Special</option>
                            <option value="other">Other</option>
                        </select>
                        <input type="text" class="inst-paper-type-other d-none mt-2" placeholder="Specify Paper Type">
                    </div>
                    <div class="form-group">
                        <label>Paper Number</label>
                        <div class="input-with-button">
                            <input type="number" class="inst-paper-number" min="1">
                            <button type="button" class="btn btn-small fetch-next-btn" style="background: var(--md-sys-color-surface-container-high)"><i class="material-symbols-rounded">autorenew</i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        classesContainer.insertAdjacentHTML('beforeend', cardHTML);
        attachClassListeners(document.getElementById(newClassId));

        if (classCount >= 5) {
            addClassBtn.classList.add('d-none');
        }
    });

    // --- Submit Logic ---
    instructorForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const user = session.user;

        const date = document.getElementById('inst-date').value;
        const startTime = document.getElementById('inst-start-time').value;
        const endTime = document.getElementById('inst-end-time').value;

        // Parse classes data
        const classCards = document.querySelectorAll('.class-entry-card');
        const classesData = [];

        for (let i = 0; i < classCards.length; i++) {
            const card = classCards[i];
            const batchVal = card.querySelector('.inst-batch').value;
            const batchOther = card.querySelector('.inst-batch-other').value.trim();
            const typeVal = card.querySelector('.inst-class-type').value;
            const typeOther = card.querySelector('.inst-type-other').value.trim();

            const finalBatch = batchVal === 'Other' ? batchOther : batchVal;
            const finalType = typeVal === 'Other Class' ? typeOther : typeVal;

            let finalPaperType = null;
            let finalPaperNumber = null;

            if (finalType === 'Paper class') {
                const pTypeVal = card.querySelector('.inst-paper-type').value;
                const pTypeOther = card.querySelector('.inst-paper-type-other').value.trim();
                finalPaperType = pTypeVal === 'other' ? pTypeOther : pTypeVal;
                finalPaperNumber = parseInt(card.querySelector('.inst-paper-number').value, 10);

                if (!finalPaperType || isNaN(finalPaperNumber)) {
                    window.showToast(`Please complete paper details for Class ${i + 1}.`, 'error');
                    return;
                }
            }

            if (!finalBatch || !finalType) {
                window.showToast(`Please complete Batch and Type for Class ${i + 1}.`, 'error');
                return;
            }

            classesData.push({
                user_id: user.id,
                class_index: i + 1,
                batch: finalBatch,
                class_type: finalType,
                paper_type: finalPaperType,
                paper_number: finalPaperNumber
            });
        }

        window.showLoading(true);
        try {
            // Insert Session
            const { data: sessionData, error: sessionError } = await supabase
                .from('instructor_sessions')
                .insert({ user_id: user.id, date, start_time: startTime, end_time: endTime })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // Link session ID to classes
            const classesToInsert = classesData.map(c => ({
                ...c,
                session_id: sessionData.id
            }));

            // Insert Classes
            const { error: classesError } = await supabase
                .from('instructor_classes')
                .insert(classesToInsert);

            if (classesError) throw classesError;

            window.showToast('Instructor session saved successfully!', 'success');

            // Auto reload logic
            instructorForm.reset();
            document.getElementById('inst-date').valueAsDate = new Date();
            // Reset to 1 class
            classCards.forEach((c, idx) => { if (idx > 0) c.remove(); });
            classCount = 1;
            addClassBtn.classList.remove('d-none');
            document.getElementById('class-entry-1').querySelector('.inst-paper-details').classList.add('d-none');

            if (window.loadDashboardData) window.loadDashboardData();
            if (window.loadPastEntries) window.loadPastEntries();

        } catch (error) {
            console.error(error);
            window.showToast('Error saving data: ' + error.message, 'error');
        } finally {
            window.showLoading(false);
        }
    });
});