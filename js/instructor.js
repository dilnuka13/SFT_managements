// js/instructor.js

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('auth-page')) return;

    const supabase = window.supabaseClient;
    const instructorForm = document.getElementById('instructor-form');
    const classesContainer = document.getElementById('classes-container');
    const addClassBtn = document.getElementById('add-class-btn');

    let classCount = 1;

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

    // Default date to today
    document.getElementById('inst-date').valueAsDate = new Date();

    // --- Dynamic Class Forms Logic ---
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

        // Toggle "Other" inputs
        batchSelect.addEventListener('change', () => {
            batchOther.classList.toggle('d-none', batchSelect.value !== 'Other');
            if (batchSelect.value !== 'Other') batchOther.value = '';
        });

        typeSelect.addEventListener('change', () => {
            typeOther.classList.toggle('d-none', typeSelect.value !== 'Other Class');
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
                paperTypeOther.classList.add('d-none');
                paperNumberInput.value = '';
            }
        });

        paperTypeSelect.addEventListener('change', () => {
            paperTypeOther.classList.toggle('d-none', paperTypeSelect.value !== 'other');
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
                addClassBtn.classList.remove('d-none'); // Re-enable if below 3
            });
        }
    };

    // Attach to initial Class 1
    attachClassListeners(document.getElementById('class-entry-1'));

    addClassBtn.addEventListener('click', () => {
        if (classCount >= 3) {
            window.showToast('Maximum 3 classes allowed per session.', 'error');
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

        if (classCount >= 3) {
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