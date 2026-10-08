/**
 * edit-data.js
 * Handles the "Edit Option" view in the Admin Panel.
 * Responsibilities:
 *  - Render the student data editing UI
 *  - Parse uploaded Excel (.xlsx/.xls) or CSV files via SheetJS (already loaded in admin.html)
 *  - Detect year / branch / section from the parsed data
 *  - Let admin drill down: Year → Branch → Section → Roll Number table
 */

// ─── State ────────────────────────────────────────────────────────────────────
let editParsedData = [];   // flat array of { sno, rollNo, name, year, branch, section }

function sortEditStudentRecords(students) {
    return [...students].sort((a, b) =>
        String(a.year).localeCompare(String(b.year)) ||
        String(a.branch).localeCompare(String(b.branch)) ||
        String(a.section).localeCompare(String(b.section)) ||
        String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true, sensitivity: 'base' })
    );
}

// ─── Entry point called by showView('edit') ───────────────────────────────────
async function initEditView() {
    if (window.studentDatabaseReady) await window.studentDatabaseReady;

    const container = document.getElementById('editView');
    container.innerHTML = `
        <!-- Year cards page -->
        <div id="editYearPage">
            <div style="margin-bottom:24px;">
                <h1 style="margin:0 0 4px 0;color:#1a202c;font-size:24px;font-weight:700;">Students Data</h1>
                <p style="margin:0;color:#6b7280;font-size:14px;">Manage student rosters by year. Upload, edit, or clear data for each year independently.</p>
            </div>
            <div id="editYearCards" style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;"></div>
        </div>

        <!-- Drill-down page (hidden until a year is clicked) -->
        <div id="editDrillPage" style="display:none;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
                <button class="ed-btn ed-btn-outline" onclick="editGoBack()">← Back</button>
                <div>
                    <h1 style="margin:0 0 2px 0;color:#1a202c;font-size:22px;font-weight:700;" id="drillPageTitle"></h1>
                    <p style="margin:0;color:#6b7280;font-size:13px;" id="drillPageSub"></p>
                </div>
            </div>
            <div class="edit-card" id="branchCard">
                <div class="edit-card-header">
                    <div class="edit-card-title">Select Branch</div>
                </div>
                <div id="branchButtons" class="edit-btn-row"></div>
            </div>
            <div class="edit-card" id="sectionCard" style="display:none;">
                <div class="edit-card-header">
                    <div>
                        <div class="edit-card-title">Select Section</div>
                        <div id="sectionCardSub" class="edit-card-sub"></div>
                    </div>
                </div>
                <div id="sectionButtons" class="edit-btn-row"></div>
            </div>
            <div class="edit-card" id="tableCard" style="display:none;">
                <div class="edit-card-header">
                    <div>
                        <div class="edit-card-title" id="tableCardTitle">Students</div>
                        <div id="tableCardSub" class="edit-card-sub"></div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                        <button class="ed-btn ed-btn-green" onclick="showAddStudentForm()">+ Add Student</button>
                        <button class="ed-btn ed-btn-blue" onclick="saveEditDataToRollNumbers()">Save Changes</button>
                    </div>
                </div>
                <div id="addStudentForm" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
                    <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:10px;">Add New Student</div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                        <input id="addRollInput" placeholder="Roll Number (e.g. 25wh1a0501)" class="ed-input" style="width:220px;">
                        <input id="addNameInput" placeholder="Student Name" class="ed-input" style="width:220px;">
                        <button class="ed-btn ed-btn-green" onclick="confirmAddStudent()">Add</button>
                        <button class="ed-btn ed-btn-gray" onclick="document.getElementById('addStudentForm').style.display='none'">Cancel</button>
                    </div>
                </div>
                <div id="editTableWrapper" style="overflow-x:auto;"></div>
            </div>
        </div>
    `;

    injectEditStyles();
    editParsedData = [];
    renderEditYearCards();
}

function renderEditYearCards() {
    const container = document.getElementById('editYearCards');
    if (!container) return;
    container.innerHTML = ALL_YEARS.map(year => {
        const fromFirebase = uploadedRosterRecords.filter(r => r.year === year)
            .reduce((sum, r) => sum + (r.students ? r.students.length : 0), 0);
        const fromParsed = editParsedData.filter(s => s.year === year).length;
        const count = fromFirebase || fromParsed;
        const hasData = count > 0;
        const yearId = year.replace(/\s+/g, '_');
        return `
        <div class="ed-year-card ${hasData ? 'ed-year-card--active' : ''}">
            <div class="ed-year-card__body" onclick="sdBrowseYear('${year}')">
                <div class="ed-year-card__title">${year}</div>
                <div class="ed-year-card__status">
                    ${hasData
                        ? `<span class="ed-badge ed-badge--green">✓ ${count} students</span>`
                        : `<span class="ed-badge ed-badge--gray">No data uploaded</span>`}
                </div>
                ${hasData ? `<div class="ed-year-card__hint">Click to browse →</div>` : `<div class="ed-year-card__hint">Upload a file to get started</div>`}
            </div>
            <div class="ed-year-card__actions">
                <label for="yearUpload_${yearId}" class="ed-btn ed-btn-outline ed-btn-sm">
                    ↑ ${hasData ? 'Re-upload' : 'Upload'}
                </label>
                <input type="file" id="yearUpload_${yearId}" accept=".csv,.xlsx,.xls" style="display:none;"
                       onchange="handleYearUpload(event,'${year}')">
                ${hasData ? `<button class="ed-btn ed-btn-danger-outline ed-btn-sm" onclick="clearYearData('${year}')">Clear Data</button>` : ''}
                <span id="yearUploadStatus_${yearId}" style="font-size:12px;color:#6b7280;"></span>
            </div>
        </div>`;
    }).join('');
}

async function clearYearData(year) {
    const count = uploadedRosterRecords.filter(r => r.year === year)
        .reduce((sum, r) => sum + (r.students ? r.students.length : 0), 0);
    if (!confirm(`Remove all ${count} students for ${year} from the database? This cannot be undone.`)) return;
    try {
        const snapshot = await db.collection('studentSections').where('year', '==', year).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        uploadedRosterRecords = uploadedRosterRecords.filter(r => r.year !== year);
        editParsedData = editParsedData.filter(s => s.year !== year);
        // Return to year cards page
        document.getElementById('editDrillPage').style.display = 'none';
        document.getElementById('editYearPage').style.display = 'block';
        renderEditYearCards();
    } catch(err) {
        alert('Failed to clear data: ' + err.message);
    }
}

async function handleYearUpload(event, year) {
    const file = event.target.files[0];
    if (!file) return;
    const yearId = year.replace(/\s+/g, '_');
    const statusEl = document.getElementById(`yearUploadStatus_${yearId}`);
    if (statusEl) statusEl.textContent = '⏳ Parsing...';

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let newStudents = [];
            if (ext === '.csv') {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (!rows || rows.length < 2) throw new Error('The CSV file is empty.');

                const headers = rows[0].map(value => String(value).trim().toLowerCase());
                const columns = detectColumns(headers);
                if (columns.roll === -1) throw new Error('No roll number column found in the CSV header.');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const rollNo = String(row[columns.roll] || '').trim().toLowerCase();
                    if (!rollNo) continue;
                    const resolved = resolveYearBranchSection(
                        columns.year === -1 ? '' : String(row[columns.year] || '').trim(),
                        columns.branch === -1 ? '' : String(row[columns.branch] || '').trim(),
                        columns.section === -1 ? '' : String(row[columns.section] || '').trim(),
                        rollNo
                    );
                    newStudents.push({
                        sno: newStudents.length + 1,
                        rollNo,
                        name: columns.name === -1 ? '—' : String(row[columns.name] || '').trim() || '—',
                        year: resolved.year === 'Unknown Year' ? year : resolved.year,
                        branch: resolved.branch,
                        section: resolved.section
                    });
                }
                if (!newStudents.length) throw new Error('No student rows with roll numbers were found.');
            } else {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                wb.SheetNames.forEach(sheetName => {
                    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
                    if (!rows || rows.length < 6) return;
                    const detectedYear = detectWorkbookYear(rows);
                    const { branch, section } = parseSheetName(sheetName);
                    for (let r = 6; r < rows.length; r++) {
                        const row = rows[r];
                        if (!row || row.every(c => String(c).trim() === '')) continue;
                        const leftRoll = String(row[1] || '').trim();
                        const leftName = String(row[2] || '').trim();
                        if (leftRoll && /wh/i.test(leftRoll)) {
                            newStudents.push({ sno: newStudents.length+1, rollNo: leftRoll.toLowerCase(), name: leftName||'—', year: detectedYear||year, branch, section });
                        }
                        const rightRoll = String(row[5] || '').trim();
                        const rightName = String(row[6] || '').trim();
                        if (rightRoll && /wh/i.test(rightRoll)) {
                            newStudents.push({ sno: newStudents.length+1, rollNo: rightRoll.toLowerCase(), name: rightName||'—', year: detectedYear||year, branch, section });
                        }
                    }
                });
            }
            newStudents.forEach(student => {
                if (!student.year || student.year === 'Unknown Year') student.year = year;
            });
            const mismatchedYear = newStudents.find(student => student.year !== year);
            if (mismatchedYear) {
                throw new Error(`This file contains ${mismatchedYear.year} data. Upload it from the ${mismatchedYear.year} card.`);
            }
            const unsupported = newStudents.find(student => !branchData[student.branch]);
            if (unsupported) {
                throw new Error(`Branch "${unsupported.branch}" is not supported for seating generation. Check the branch column or roll number.`);
            }

            const existingYearRecords = uploadedRosterRecords.filter(record => record.year === year);
            if (existingYearRecords.length && !confirm(`Replace the saved ${year} roster with these ${newStudents.length} students? Other years will be kept.`)) {
                if (statusEl) statusEl.textContent = 'Upload cancelled';
                return;
            }
            if (statusEl) statusEl.textContent = `⏳ Saving ${newStudents.length} students...`;
            await saveYearRoster(year, newStudents);

            // Keep the editor view in sync with the saved roster.
            editParsedData = sortEditStudentRecords(editParsedData.filter(s => s.year !== year).concat(newStudents));
            renderEditYearCards();
            const updatedStatusEl = document.getElementById(`yearUploadStatus_${yearId}`);
            if (updatedStatusEl) updatedStatusEl.textContent = `✅ Saved ${newStudents.length} students. Seating will use this roster.`;
        } catch(err) {
            if (statusEl) statusEl.textContent = `❌ ${err.message || 'Parse error'}`;
        }
    };
    reader.readAsArrayBuffer(file);
}

async function saveYearRoster(year, students) {
    const grouped = new Map();
    for (const student of students) {
        if (!student.rollNo || !student.year || !student.branch || !student.section) {
            throw new Error('A student row is missing its roll number, year, branch, or section.');
        }
        const key = `${student.year} ${student.branch} ${student.section}`;
        if (!grouped.has(key)) grouped.set(key, {
            year: student.year,
            branch: student.branch,
            section: student.section,
            students: []
        });
        grouped.get(key).students.push({
            rollNo: String(student.rollNo).trim().toLowerCase(),
            name: String(student.name || '').trim()
        });
    }

    if (!grouped.size) throw new Error('No student rows with roll numbers were found.');

    const collection = db.collection('studentSections');
    const oldRecords = await collection.where('year', '==', year).get();
    const timestamp = new Date().toISOString();
    const newRecords = Array.from(grouped, ([key, record]) => ({
        ...record,
        key,
        id: encodeURIComponent(key),
        updatedAt: timestamp
    }));
    const operations = oldRecords.docs.map(doc => ({ type: 'delete', ref: doc.ref }))
        .concat(newRecords.map(record => ({
            type: 'set',
            ref: collection.doc(record.id),
            data: {
                year: record.year,
                branch: record.branch,
                section: record.section,
                students: record.students,
                updatedAt: record.updatedAt
            }
        })));

    for (let start = 0; start < operations.length; start += 450) {
        const batch = db.batch();
        operations.slice(start, start + 450).forEach(operation => {
            if (operation.type === 'delete') batch.delete(operation.ref);
            else batch.set(operation.ref, operation.data);
        });
        await batch.commit();
    }

    // Remove stale in-memory roll numbers for this year before applying its new records.
    Object.keys(ROLL_NUMBERS).forEach(key => {
        if (key.startsWith(`${year} `)) delete ROLL_NUMBERS[key];
    });
    uploadedRosterRecords = uploadedRosterRecords.filter(record => record.year !== year).concat(newRecords);
    applyStudentSectionRecords(newRecords);
}

function editGoBack() {
    document.getElementById('editDrillPage').style.display = 'none';
    document.getElementById('editYearPage').style.display = 'block';
    renderEditYearCards();
}

function sdBrowseYear(year) {
    const fromFirebase = uploadedRosterRecords.filter(r => r.year === year);
    const fromParsed = editParsedData.filter(s => s.year === year);
    if (fromFirebase.length === 0 && fromParsed.length === 0) {
        alert(`No data for ${year} yet. Use the Upload button on the card to add students.`);
        return;
    }
    if (fromFirebase.length > 0 && fromParsed.length === 0) {
        fromFirebase.forEach(r => {
            (r.students || []).forEach(st => {
                editParsedData.push({ sno: editParsedData.length+1, rollNo: st.rollNo, name: st.name||'—', year: r.year, branch: r.branch, section: r.section });
            });
        });
        editParsedData = sortEditStudentRecords(editParsedData);
    }
    // Switch to drill page
    document.getElementById('editYearPage').style.display = 'none';
    document.getElementById('editDrillPage').style.display = 'block';
    document.getElementById('drillPageTitle').textContent = year;
    document.getElementById('drillPageSub').textContent = 'Select a branch and section to view or edit students.';
    document.getElementById('sectionCard').style.display = 'none';
    document.getElementById('tableCard').style.display = 'none';
    renderBranchSelection(year);
}

function showAddStudentForm() {
    const form = document.getElementById('addStudentForm');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    if (form.style.display !== 'none') document.getElementById('addRollInput').focus();
}

function confirmAddStudent() {
    const card = document.getElementById('tableCard');
    const { year, branch, section } = card.dataset;
    const rollNo = document.getElementById('addRollInput').value.trim().toLowerCase();
    const name = document.getElementById('addNameInput').value.trim();
    if (!rollNo) { alert('⚠️ Roll number is required.'); return; }
    const duplicate = editParsedData.some(s => s.year === year && s.branch === branch && s.section === section && s.rollNo === rollNo);
    if (duplicate) { alert('⚠️ Roll number already exists in this section.'); return; }
    editParsedData.push({ sno: editParsedData.length+1, rollNo, name: name||'—', year, branch, section });
    editParsedData = sortEditStudentRecords(editParsedData);
    document.getElementById('addStudentForm').style.display = 'none';
    document.getElementById('addRollInput').value = '';
    document.getElementById('addNameInput').value = '';
    renderRollTable(year, branch, section);
    renderEditYearCards();
}

// ─── Rest of initEditView wiring ──────────────────────────────────────────────
function wireEditViewEvents() {
    injectEditStyles();
    editParsedData = [];
    setEditStatus('Upload a workbook to display its years and student totals.', '#6b7280');
}

// ─── Inject CSS (only once) ───────────────────────────────────────────────────
function injectEditStyles() {
    if (document.getElementById('editDataStyles')) return;
    const style = document.createElement('style');
    style.id = 'editDataStyles';
    style.textContent = `
        .edit-card { background:white; border:1px solid #e5e7eb; border-radius:12px; padding:24px; margin-bottom:20px; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
        .edit-card-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:18px; }
        .edit-card-title { font-size:16px; font-weight:700; color:#1a202c; }
        .edit-card-sub { font-size:13px; color:#6b7280; margin-top:2px; }
        .edit-btn-row { display:flex; flex-wrap:wrap; gap:10px; }
        .edit-branch-btn, .edit-section-btn {
            padding:9px 20px; border:1.5px solid #e5e7eb; border-radius:8px;
            background:white; color:#374151; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.15s;
        }
        .edit-branch-btn:hover, .edit-section-btn:hover { border-color:#4a90e2; background:#eff6ff; color:#1d4ed8; }
        .edit-branch-btn.active, .edit-section-btn.active { border-color:#4a90e2; background:#4a90e2; color:white; }

        /* Year cards */
        .ed-year-card { background:white; border:1.5px solid #e5e7eb; border-radius:12px; padding:20px; transition:box-shadow 0.15s; }
        .ed-year-card--active { border-color:#38a169; background:#f0fff4; }
        .ed-year-card__body { cursor:pointer; margin-bottom:14px; }
        .ed-year-card__title { font-size:17px; font-weight:700; color:#1a202c; margin-bottom:6px; }
        .ed-year-card__status { margin-bottom:4px; }
        .ed-year-card__hint { font-size:12px; color:#9ca3af; margin-top:4px; }
        .ed-year-card__actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding-top:12px; border-top:1px solid #f0f0f0; }

        /* Badges */
        .ed-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
        .ed-badge--green { background:#d1fae5; color:#065f46; }
        .ed-badge--gray { background:#f3f4f6; color:#6b7280; }

        /* Buttons */
        .ed-btn { display:inline-flex; align-items:center; gap:4px; padding:8px 16px; border-radius:7px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all 0.15s; white-space:nowrap; }
        .ed-btn-sm { padding:5px 12px; font-size:12px; }
        .ed-btn-blue { background:#4a90e2; color:white; }
        .ed-btn-blue:hover { background:#2c5aa0; }
        .ed-btn-green { background:#38a169; color:white; }
        .ed-btn-green:hover { background:#276749; }
        .ed-btn-gray { background:#6b7280; color:white; }
        .ed-btn-gray:hover { background:#4b5563; }
        .ed-btn-danger { background:#fff0f0; color:#dc2626; border:1px solid #fecaca; }
        .ed-btn-danger:hover { background:#dc2626; color:white; border-color:#dc2626; }
        .ed-btn-outline { background:white; color:#4b5563; border:1.5px solid #d1d5db; }
        .ed-btn-outline:hover { background:#f9fafb; border-color:#9ca3af; }
        .ed-btn-danger-outline { background:white; color:#dc2626; border:1.5px solid #fecaca; }
        .ed-btn-danger-outline:hover { background:#fff0f0; }

        /* Input */
        .ed-input { padding:8px 12px; border:1.5px solid #e0e0e0; border-radius:7px; font-size:14px; outline:none; transition:border-color 0.15s; }
        .ed-input:focus { border-color:#4a90e2; }

        /* Table */
        .ed-table { width:100%; border-collapse:collapse; font-size:14px; }
        .ed-table th { background:#f8fafc; color:#374151; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; padding:10px 14px; text-align:left; border-bottom:2px solid #e5e7eb; }
        .ed-table td { padding:11px 14px; border-bottom:1px solid #f0f0f0; color:#1a202c; vertical-align:middle; }
        .ed-table tr:last-child td { border-bottom:none; }
        .ed-table tr:hover td { background:#fafafa; }

        /* Inline edit inputs */
        .student-edit-input { width:100%; box-sizing:border-box; padding:6px 8px; border:1.5px solid #cbd5e1; border-radius:5px; font-size:13px; }
        .edit-row-button, .cancel-row-button { border:0; border-radius:5px; padding:5px 10px; cursor:pointer; background:#2563eb; color:white; font-size:12px; }
        .cancel-row-button { background:#6b7280; margin-left:4px; }
    `;
    document.head.appendChild(style);
}

// ─── File Handling ────────────────────────────────────────────────────────────
function handleEditFile(event) {
    const file = event.target.files[0];
    if (file) processEditFile(file);
}

function processEditFile(file) {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
        setEditStatus(`❌ Unsupported file type "${ext}". Please upload .csv, .xlsx, or .xls`, 'red');
        return;
    }

    setEditStatus(`⏳ Parsing "${file.name}"...`, '#6b7280');
    setSaveAllButtonVisible(false);

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            if (ext === '.csv') {
                const rows = parseCSV(e.target.result);
                processRows(rows, file.name);
            } else {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                processWorkbook(workbook, file.name);
            }
        } catch (err) {
            setEditStatus(`❌ Error parsing file: ${err.message}`, 'red');
        }
    };

    if (ext === '.csv') {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
    return text.split('\n').map(line =>
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    ).filter(row => row.some(cell => cell !== ''));
}

// ─── Row Processing ───────────────────────────────────────────────────────────
function processRows(rows, filename) {
    if (!rows || rows.length < 2) {
        setEditStatus('❌ File appears to be empty or has no data rows.', 'red');
        return;
    }
    const header = rows[0].map(h => String(h).trim().toLowerCase());
    const colIdx = detectColumns(header);
    const parsed = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(c => String(c).trim() === '')) continue;
        const rollRaw = colIdx.roll !== -1 ? String(row[colIdx.roll] || '').trim() : '';
        const nameRaw = colIdx.name !== -1 ? String(row[colIdx.name] || '').trim() : '';
        const yearRaw = colIdx.year !== -1 ? String(row[colIdx.year] || '').trim() : '';
        const branchRaw = colIdx.branch !== -1 ? String(row[colIdx.branch] || '').trim() : '';
        const sectionRaw = colIdx.section !== -1 ? String(row[colIdx.section] || '').trim() : '';
        if (!rollRaw) continue;
        const { year, branch, section } = resolveYearBranchSection(yearRaw, branchRaw, sectionRaw, rollRaw);
        parsed.push({ sno: parsed.length + 1, rollNo: rollRaw.toLowerCase(), name: nameRaw || '—', year, branch, section });
    }
    if (parsed.length === 0) {
        setEditStatus('❌ No valid roll number data found. Check column headers.', 'red');
        return;
    }
    editParsedData = sortEditStudentRecords(parsed);
    setEditStatus(`✅ Parsed ${parsed.length} students from "${filename}"`, 'green');
    setSaveAllButtonVisible(true);
    renderYearSelection();
}

function processWorkbook(workbook, filename) {
    const allStudents = [];

    workbook.SheetNames.forEach(sheetName => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
        if (!rows || rows.length < 6) return;

        const year = detectWorkbookYear(rows);
        const { branch, section } = parseSheetName(sheetName);

        for (let r = 6; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.every(c => String(c).trim() === '')) continue;

            const leftRoll = String(row[1] || '').trim();
            const leftName = String(row[2] || '').trim();
            if (leftRoll && /wh/i.test(leftRoll)) {
                allStudents.push({
                    sno: allStudents.length + 1,
                    rollNo: leftRoll.toLowerCase(),
                    name: leftName || '—',
                    year: year || guessYearFromRoll(leftRoll) || 'Unknown Year', branch, section
                });
            }

            const rightRoll = String(row[5] || '').trim();
            const rightName = String(row[6] || '').trim();
            if (rightRoll && /wh/i.test(rightRoll)) {
                allStudents.push({
                    sno: allStudents.length + 1,
                    rollNo: rightRoll.toLowerCase(),
                    name: rightName || '—',
                    year: year || guessYearFromRoll(rightRoll) || 'Unknown Year', branch, section
                });
            }
        }
    });

    if (allStudents.length === 0) {
        setEditStatus('❌ No valid student data found in the file.', 'red');
        return;
    }

    editParsedData = sortEditStudentRecords(allStudents);
    const sheetCount = workbook.SheetNames.length;
    setEditStatus(`✅ Parsed ${allStudents.length} students from ${sheetCount} sheets in "${filename}"`, 'green');
    setSaveAllButtonVisible(true);
    renderYearSelection();
}

function detectWorkbookYear(rows) {
    const header = rows.slice(0, 6).flat().map(value =>
        String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
    ).join(' ');
    const patterns = [
        [/\b(?:IV|4TH)\s*(?:B\s*TECH|YEAR)\b|\bB\s*TECH\s*(?:IV|4TH)\b/, '4th Year'],
        [/\b(?:III|3RD)\s*(?:B\s*TECH|YEAR)\b|\bB\s*TECH\s*(?:III|3RD)\b/, '3rd Year'],
        [/\b(?:II|2ND)\s*(?:B\s*TECH|YEAR)\b|\bB\s*TECH\s*(?:II|2ND)\b/, '2nd Year'],
        [/\b(?:I|1ST)\s*(?:B\s*TECH|YEAR)\b|\bB\s*TECH\s*(?:I|1ST)\b/, '1st Year']
    ];
    const match = patterns.find(([pattern]) => pattern.test(header));
    return match ? match[1] : '';
}

function parseSheetName(name) {
    const s = name.trim().toUpperCase();
    let branch = '';
    let section = 'A';

    if (s.includes('AI&ML') || s.includes('AIML') || s.includes('AI ML')) {
        branch = 'AIML';
    } else if (s.startsWith('CSE')) {
        branch = 'CSE';
    } else if (s.startsWith('ECE')) {
        branch = 'ECE';
    } else if (s.startsWith('EEE')) {
        branch = 'EEE';
    } else if (s.startsWith('MECH')) {
        branch = 'MECH';
    } else if (s.startsWith('CIVIL')) {
        branch = 'CIVIL';
    } else {
        branch = s.split(' ')[0];
    }

    const secMatch = s.match(/\b([A-Z])\s*$/);
    if (secMatch) {
        section = secMatch[1];
    }

    return { branch, section };
}

// ─── Column Detection ─────────────────────────────────────────────────────────
function detectColumns(header) {
    const find = (...keys) => {
        for (const k of keys) {
            const idx = header.findIndex(h => h.includes(k));
            if (idx !== -1) return idx;
        }
        return -1;
    };
    return {
        roll:    find('roll'),
        name:    find('name', 'student'),
        year:    find('year'),
        branch:  find('branch', 'dept', 'department'),
        section: find('section', 'class', 'sec')
    };
}

// ─── Year / Branch / Section Resolver ────────────────────────────────────────
const YEAR_MAP = {
    '1': '1st Year', 'i': '1st Year', '1st': '1st Year', '1st year': '1st Year', 'first': '1st Year',
    '2': '2nd Year', 'ii': '2nd Year', '2nd': '2nd Year', '2nd year': '2nd Year', 'second': '2nd Year',
    '3': '3rd Year', 'iii': '3rd Year', '3rd': '3rd Year', '3rd year': '3rd Year', 'third': '3rd Year',
    '4': '4th Year', 'iv': '4th Year', '4th': '4th Year', '4th year': '4th Year', 'fourth': '4th Year'
};

function resolveYearBranchSection(yearRaw, branchRaw, sectionRaw, rollNo) {
    let year = YEAR_MAP[yearRaw.toLowerCase()] || yearRaw || guessYearFromRoll(rollNo);
    let branch = normalizeBranch(branchRaw);
    let section = sectionRaw.toUpperCase() || '';

    if (!branch && sectionRaw) {
        const combined = parseCombinedSection(sectionRaw);
        if (combined.year) year = combined.year;
        if (combined.branch) branch = combined.branch;
        if (combined.section) section = combined.section;
    }

    if (!branch) branch = guessBranchFromRoll(rollNo);
    if (!year) year = guessYearFromRoll(rollNo);

    return { year: year || 'Unknown Year', branch: branch || 'Unknown Branch', section: section || 'A' };
}

function parseCombinedSection(str) {
    const result = { year: '', branch: '', section: '' };
    const s = str.toUpperCase();

    if (s.includes('1ST') || s.startsWith('1 ')) result.year = '1st Year';
    else if (s.includes('2ND') || s.startsWith('2 ')) result.year = '2nd Year';
    else if (s.includes('3RD') || s.startsWith('3 ')) result.year = '3rd Year';
    else if (s.includes('4TH') || s.startsWith('4 ')) result.year = '4th Year';

    if (s.includes('AIML')) result.branch = 'AIML';
    else if (s.includes('CSE')) result.branch = 'CSE';
    else if (s.includes('ECE')) result.branch = 'ECE';
    else if (s.includes('EEE')) result.branch = 'EEE';
    else if (s.includes('MECH')) result.branch = 'MECH';
    else if (s.includes('CIVIL')) result.branch = 'CIVIL';

    const secMatch = s.match(/\b([A-Z])\s*$/);
    if (secMatch) result.section = secMatch[1];

    return result;
}

function normalizeBranch(raw) {
    const b = raw.toUpperCase().trim();
    if (b.includes('AIML') || b.includes('AI')) return 'AIML';
    if (b.includes('CSE') || b.includes('COMPUTER')) return 'CSE';
    if (b.includes('ECE') || b.includes('ELECTRONICS')) return 'ECE';
    if (b.includes('EEE') || b.includes('ELECTRICAL')) return 'EEE';
    if (b.includes('MECH')) return 'MECH';
    if (b.includes('CIVIL')) return 'CIVIL';
    return b || '';
}

function guessBranchFromRoll(roll) {
    const r = roll.toLowerCase();
    const match = r.match(/wh\d[a-z](\d{2})/);
    if (match) {
        const code = match[1];
        if (code === '05') return 'CSE';
        if (code === '12' || code === '55') return 'ECE';
        if (code === '42' || code === '44') return 'EEE';
        if (code === '66') return 'AIML';
    }
    if (r.includes('cse')) return 'CSE';
    if (r.includes('ece')) return 'ECE';
    if (r.includes('eee')) return 'EEE';
    if (r.includes('aiml')) return 'AIML';
    return '';
}

function guessYearFromRoll(roll) {
    const r = roll.toLowerCase();
    const match = r.match(/^(\d{2})wh/);
    if (!match) return '';
    const batch = parseInt(match[1]);
    const now = new Date();
    const academicYear = (now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1) % 100;
    const diff = academicYear - batch;
    if (diff === 0) return '1st Year';
    if (diff === 1) return '2nd Year';
    if (diff === 2) return '3rd Year';
    if (diff === 3) return '4th Year';
    return '';
}

// ─── UI: Year Selection ───────────────────────────────────────────────────────
const ALL_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

function renderYearSelection() {
    renderEditYearCards();

    const container = document.getElementById('yearButtons');
    container.innerHTML = '';

    ALL_YEARS.forEach(year => {
        const count = editParsedData.filter(s => s.year === year).length;
        const btn = document.createElement('button');
        btn.className = 'edit-year-btn';
        btn.textContent = count > 0 ? `${year} (${count})` : year;
        if (count === 0) {
            btn.style.opacity = '0.45';
            btn.title = 'No data uploaded for this year yet';
        }
        btn.onclick = () => {
            document.querySelectorAll('.edit-year-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderBranchSelection(year);
        };
        container.appendChild(btn);
    });

    document.getElementById('yearCard').style.display = 'block';
    document.getElementById('branchCard').style.display = 'none';
    document.getElementById('sectionCard').style.display = 'none';
    document.getElementById('tableCard').style.display = 'none';
}

// ─── UI: Branch Selection ─────────────────────────────────────────────────────
const BRANCH_ORDER = ['EEE', 'ECE', 'CSE', 'AIML', 'MECH', 'CIVIL'];

function renderBranchSelection(year) {
    const yearData = editParsedData.filter(s => s.year === year);

    const branchesInData = [...new Set(yearData.map(s => s.branch))];
    const branches = BRANCH_ORDER.filter(b => branchesInData.includes(b))
        .concat(branchesInData.filter(b => !BRANCH_ORDER.includes(b)).sort());

    document.getElementById('branchCardSub') && (document.getElementById('branchCardSub').textContent = `Year: ${year}`);
    const container = document.getElementById('branchButtons');
    container.innerHTML = '';

    if (branches.length === 0) {
        container.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No data available for this year. Please upload a file containing this year\'s data.</p>';
        document.getElementById('branchCard').style.display = 'block';
        document.getElementById('sectionCard').style.display = 'none';
        document.getElementById('tableCard').style.display = 'none';
        return;
    }

    branches.forEach(branch => {
        const count = yearData.filter(s => s.branch === branch).length;
        const sectionCount = [...new Set(yearData.filter(s => s.branch === branch).map(s => s.section))].length;
        const btn = document.createElement('button');
        btn.className = 'edit-branch-btn';
        btn.dataset.branch = branch;
        btn.textContent = `${branch} (${sectionCount} section${sectionCount !== 1 ? 's' : ''}, ${count} students)`;
        btn.onclick = () => {
            document.querySelectorAll('.edit-branch-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderSectionSelection(year, branch);
        };
        container.appendChild(btn);
    });

    document.getElementById('branchCard').style.display = 'block';
    document.getElementById('sectionCard').style.display = 'none';
    document.getElementById('tableCard').style.display = 'none';

    document.getElementById('branchCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── UI: Section Selection ────────────────────────────────────────────────────
function renderSectionSelection(year, branch) {
    const branchData = editParsedData.filter(s => s.year === year && s.branch === branch);
    const sections = [...new Set(branchData.map(s => s.section))].sort();

    document.getElementById('sectionCardSub').textContent = `${year} › ${branch}`;
    const container = document.getElementById('sectionButtons');
    container.innerHTML = '';

    sections.forEach(section => {
        const count = branchData.filter(s => s.section === section).length;
        const btn = document.createElement('button');
        btn.className = 'edit-section-btn';
        btn.dataset.section = section;
        btn.textContent = `Section ${section} (${count})`;
        btn.onclick = () => {
            document.querySelectorAll('.edit-section-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRollTable(year, branch, section);
        };
        container.appendChild(btn);
    });

    document.getElementById('sectionCard').style.display = 'block';
    document.getElementById('tableCard').style.display = 'none';

    document.getElementById('sectionCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── UI: Roll Number Table ────────────────────────────────────────────────────
function renderRollTable(year, branch, section) {
    const students = editParsedData
        .map((student, index) => ({ student, index }))
        .filter(({ student }) => student.year === year && student.branch === branch && student.section === section)
        .sort((a, b) => String(a.student.rollNo).localeCompare(
            String(b.student.rollNo), undefined, { numeric: true, sensitivity: 'base' }
        ));

    document.getElementById('tableCardTitle').textContent =
        `👥 ${year} › ${branch} › Section ${section}`;
    document.getElementById('tableCardSub').textContent =
        `${students.length} student${students.length !== 1 ? 's' : ''}. Use Edit on a row, then Save Changes.`;

    document.getElementById('tableCard').dataset.year = year;
    document.getElementById('tableCard').dataset.branch = branch;
    document.getElementById('tableCard').dataset.section = section;

    const wrapper = document.getElementById('editTableWrapper');
    if (students.length === 0) {
        wrapper.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No students found for this selection.</p>';
    } else {
        wrapper.innerHTML = `
            <label for="studentListSearch" style="display:block;margin:0 0 8px;font-size:13px;font-weight:600;color:#4a5568;">Search this section</label>
            <input id="studentListSearch" type="search" placeholder="Search by roll number or name…" autocomplete="off"
                style="width:100%;max-width:420px;margin-bottom:12px;padding:11px 14px;border:1px solid #cbd5e0;border-radius:8px;font-size:14px;">
            <p id="studentListCount" aria-live="polite" style="margin:0 0 10px;color:#718096;font-size:13px;">Showing ${students.length} of ${students.length} students</p>
            <table class="ed-table">
                <thead>
                    <tr>
                        <th style="width:56px;">#</th>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th style="width:140px;">Actions</th>
                    </tr>
                </thead>
                <tbody id="studentListBody"></tbody>
            </table>
        `;

        const body = document.getElementById('studentListBody');
        const search = document.getElementById('studentListSearch');
        const count = document.getElementById('studentListCount');
        const renderRows = query => {
            const normalizedQuery = query.trim().toLocaleLowerCase();
            const visibleStudents = students.filter(({ student }) =>
                String(student.rollNo || '').toLocaleLowerCase().includes(normalizedQuery) ||
                String(student.name || '').toLocaleLowerCase().includes(normalizedQuery)
            );

            count.textContent = `Showing ${visibleStudents.length} of ${students.length} students`;
            body.innerHTML = visibleStudents.length
                ? visibleStudents.map(({ student, index }, rowIndex) => `
                    <tr id="student-row-${index}">
                        <td style="color:#9ca3af;">${rowIndex + 1}</td>
                        <td style="font-family:monospace;font-size:13px;">${escapeEditHTML(student.rollNo)}</td>
                        <td>${escapeEditHTML(student.name)}</td>
                        <td>
                            <div style="display:flex;gap:6px;">
                                <button class="ed-btn ed-btn-blue ed-btn-sm" onclick="editStudentRow(${index})">Edit</button>
                                <button class="ed-btn ed-btn-danger ed-btn-sm" onclick="deleteStudentRow(${index})" title="Remove student">Delete</button>
                            </div>
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af;">No students match your search.</td></tr>';
        };

        renderRows('');
        search.addEventListener('input', () => renderRows(search.value));
    }

    document.getElementById('tableCard').style.display = 'block';
    document.getElementById('tableCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleAppendDataMenu(button) {
    const menu = document.getElementById('appendDataMenu');
    if (!menu) return;
    const willOpen = menu.style.display === 'none';
    menu.style.display = willOpen ? 'block' : 'none';
    button.setAttribute('aria-expanded', String(willOpen));
}

function refreshCurrentEditSection(year, branch, section) {
    const branchStudents = editParsedData.filter(student => student.year === year && student.branch === branch);
    const branchButton = [...document.querySelectorAll('.edit-branch-btn')]
        .find(button => button.dataset.branch === branch);
    if (branchButton) {
        const sectionCount = new Set(branchStudents.map(student => student.section)).size;
        branchButton.textContent = `${branch} (${sectionCount} section${sectionCount !== 1 ? 's' : ''}, ${branchStudents.length} students)`;
    }
    renderSectionSelection(year, branch);
    renderRollTable(year, branch, section);
}

function addRollNumberToSection() {
    const card = document.getElementById('tableCard');
    const { year, branch, section } = card.dataset;
    if (!year || !branch || !section) return;

    const rollNo = (prompt(`Enter the roll number to add to ${year} ${branch} Section ${section}:`) || '')
        .trim().toLowerCase();
    if (!rollNo) return;

    const duplicate = editParsedData.some(student => student.year === year && student.branch === branch &&
        student.section === section && String(student.rollNo).trim().toLowerCase() === rollNo);
    if (duplicate) {
        alert('That roll number is already in this section.');
        return;
    }

    editParsedData.push({ sno: editParsedData.length + 1, rollNo, name: '—', year, branch, section });
    editParsedData = sortEditStudentRecords(editParsedData);
    setEditStatus(`Added ${rollNo} to ${year} ${branch} Section ${section}. Click Save Changes to save this section.`, 'green');
    refreshCurrentEditSection(year, branch, section);
}

function deleteRollNumberFromSection() {
    const card = document.getElementById('tableCard');
    const { year, branch, section } = card.dataset;
    if (!year || !branch || !section) return;

    const rollNo = (prompt(`Enter the roll number to delete from ${year} ${branch} Section ${section}:`) || '')
        .trim().toLowerCase();
    if (!rollNo) return;

    const index = editParsedData.findIndex(student => student.year === year && student.branch === branch &&
        student.section === section && String(student.rollNo).trim().toLowerCase() === rollNo);
    if (index === -1) {
        alert('That roll number was not found in this section.');
        return;
    }

    editParsedData.splice(index, 1);
    setEditStatus(`Deleted ${rollNo} from ${year} ${branch} Section ${section}. Click Save Changes to save this section.`, 'green');
    refreshCurrentEditSection(year, branch, section);
}

function escapeEditHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function deleteStudentRow(index) {
    const student = editParsedData[index];
    if (!student) return;
    if (!confirm(`Remove ${student.name} (${student.rollNo}) from this section?`)) return;
    editParsedData.splice(index, 1);
    renderRollTable(student.year, student.branch, student.section);
    renderEditYearCards();
}

function editStudentRow(index) {
    const student = editParsedData[index];
    const row = document.getElementById(`student-row-${index}`);
    if (!student || !row) return;

    row.innerHTML = `
        <td>${index + 1}</td>
        <td><input class="student-edit-input" id="student-roll-${index}" value="${escapeEditHTML(student.rollNo)}" aria-label="Hall ticket number"></td>
        <td><input class="student-edit-input" id="student-name-${index}" value="${escapeEditHTML(student.name)}" aria-label="Student name"></td>
        <td class="student-edit-actions">
            <button type="button" class="edit-row-button" onclick="saveStudentRow(${index})">Save</button>
            <button type="button" class="cancel-row-button" onclick="cancelStudentRow(${index})">Cancel</button>
        </td>`;
}

function cancelStudentRow(index) {
    const student = editParsedData[index];
    if (student) renderRollTable(student.year, student.branch, student.section);
}

function saveStudentRow(index) {
    const rollNo = document.getElementById(`student-roll-${index}`)?.value.trim().toLowerCase();
    const name = document.getElementById(`student-name-${index}`)?.value.trim();
    const student = editParsedData[index];
    if (!student || !rollNo || !name) {
        alert('Enter both a hall-ticket number and student name.');
        return;
    }
    const duplicate = editParsedData.some((other, otherIndex) => otherIndex !== index &&
        other.year === student.year && other.branch === student.branch && other.section === student.section &&
        String(other.rollNo).toLowerCase() === rollNo);
    if (duplicate) {
        alert('That hall-ticket number is already in this section.');
        return;
    }
    student.rollNo = rollNo;
    student.name = name;
    renderRollTable(student.year, student.branch, student.section);
}

// ─── Save to ROLL_NUMBERS ─────────────────────────────────────────────────────
async function saveEditDataToRollNumbers() {
    const card = document.getElementById('tableCard');
    const year = card.dataset.year;
    const branch = card.dataset.branch;
    const section = card.dataset.section;

    if (!year || !branch || !section) return;

    const key = `${year} ${branch} ${section}`;
    const students = sortEditStudentRecords(editParsedData
        .filter(s => s.year === year && s.branch === branch && s.section === section)
    ).map(s => ({ rollNo: String(s.rollNo).trim().toLowerCase(), name: String(s.name || '').trim() }));

    if (typeof ROLL_NUMBERS !== 'undefined') {
        const record = {
            year,
            branch,
            section,
            students,
            updatedAt: new Date().toISOString()
        };
        try {
            await db.collection('studentSections').doc(encodeURIComponent(key)).set(record);
            uploadedRosterRecords = uploadedRosterRecords.filter(item => item.key !== key &&
                `${item.year} ${item.branch} ${item.section}` !== key
            ).concat(record);
            ROLL_NUMBERS[key] = students.map(student => student.rollNo);
            alert(`✅ Saved ${students.length} student records under "${key}". They are available for seating generation.`);
        } catch (error) {
            alert(`Could not save student records: ${error.message}`);
        }
    } else {
        alert('⚠️ ROLL_NUMBERS not available. Make sure rollnumbers.js is loaded.');
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setEditStatus(msg, color) {
    const el = document.getElementById('editFileStatus');
    if (el) { el.textContent = msg; el.style.color = color; }
}

function setSaveAllButtonVisible(visible) {
    const button = document.getElementById('saveAllStudentDataButton');
    if (button) button.style.display = visible ? 'inline-block' : 'none';
}

async function saveAllEditDataToSystem() {
    const groupedStudents = new Map();
    for (const student of editParsedData) {
        if (!student.rollNo || !student.year || !student.branch || !student.section) {
            alert('The uploaded file contains a student without a roll number, year, branch, or section. Fix the row before saving.');
            return false;
        }
        const key = `${student.year} ${student.branch} ${student.section}`;
        if (!groupedStudents.has(key)) {
            groupedStudents.set(key, {
                key,
                year: student.year,
                branch: student.branch,
                section: student.section,
                students: []
            });
        }
        groupedStudents.get(key).students.push({
            rollNo: String(student.rollNo).trim().toLowerCase(),
            name: String(student.name || '').trim()
        });
    }

    if (!groupedStudents.size) {
        alert('Upload a student file before saving the database.');
        return false;
    }

    const records = Array.from(groupedStudents.values(), record => ({
        ...record,
        updatedAt: new Date().toISOString()
    }));
    const studentCount = records.reduce((total, record) => total + record.students.length, 0);
    if (!confirm(`Use the entire uploaded workbook as the seating roster: ${studentCount} students across ${records.length} sections? Saved sections absent from this workbook will be removed, and seating will use only this workbook.`)) {
        return false;
    }

    const collection = db.collection('studentSections');
    try {
        const existing = await collection.get();
        const replacementIds = new Set(records.map(record => encodeURIComponent(record.key)));
        const operations = existing.docs
            .filter(doc => !replacementIds.has(doc.id))
            .map(doc => ({ type: 'delete', ref: doc.ref }))
            .concat(records.map(record => ({
                type: 'set',
                ref: collection.doc(encodeURIComponent(record.key)),
                data: {
                    year: record.year,
                    branch: record.branch,
                    section: record.section,
                    students: record.students,
                    updatedAt: record.updatedAt
                }
            })));

        for (let start = 0; start < operations.length; start += 450) {
            const batch = db.batch();
            operations.slice(start, start + 450).forEach(operation => {
                if (operation.type === 'delete') batch.delete(operation.ref);
                else batch.set(operation.ref, operation.data);
            });
            await batch.commit();
        }

        uploadedRosterRecords = records;
        applyStudentSectionRecords(records);
        setSaveAllButtonVisible(false);
        setEditStatus(`✅ Saved ${studentCount} uploaded students across ${records.length} sections. Seating will use only this uploaded roster.`, 'green');
        return true;
    } catch (error) {
        setEditStatus(`Could not replace the student database: ${error.message}`, 'red');
        alert(`Could not replace the student database: ${error.message}`);
        return false;
    }
}

// ─── Invigilators ─────────────────────────────────────────────────────────────

function initInvigilatorView() {
    const container = document.getElementById('invigilatorView');
    if (!container) return;
    container.innerHTML = `
        <div style="margin-bottom:24px;">
            <h1 style="margin:0 0 4px 0;color:#1a202c;font-size:24px;font-weight:700;">👩‍🏫 Invigilators</h1>
            <p style="margin:0;color:#6b7280;font-size:14px;">Upload invigilator availability sheets (one per department). Each sheet should follow the standard format with faculty names and date/slot availability.</p>
        </div>
        <div style="background:white;border:2px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:16px;">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <label for="invigilatorUploadInput" class="ed-btn ed-btn-blue" style="cursor:pointer;">↑ Upload Invigilator Sheet</label>
                <input type="file" id="invigilatorUploadInput" accept=".xlsx,.xls" style="display:none;" onchange="handleInvigilatorUpload(event)">
                <span id="invigilatorUploadStatus" style="font-size:13px;color:#6b7280;"></span>
            </div>
        </div>
        <div id="invigilatorListContainer"></div>
    `;
    loadInvigilatorList();
}

async function handleInvigilatorUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('invigilatorUploadStatus');
    statusEl.textContent = '⏳ Parsing...';

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const allRecords = [];

            wb.SheetNames.forEach(sheetName => {
                const ws = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

                let department = 'Unknown';
                for (let i = 0; i < Math.min(10, rows.length); i++) {
                    const rowText = (rows[i] || []).join(' ');
                    const deptMatch = rowText.match(/Department\s*[:\-]?\s*([A-Z]+)/i);
                    if (deptMatch) { department = deptMatch[1].toUpperCase(); break; }
                }

                let headerRowIdx = -1;
                for (let i = 0; i < rows.length; i++) {
                    const hasDate = (rows[i] || []).some(c => String(c||'').match(/\d{2}-\d{2}-\d{4}/));
                    if (hasDate) { headerRowIdx = i; break; }
                }
                if (headerRowIdx === -1) return;

                const slotRowIdx = headerRowIdx + 1;
                const headerRow = rows[headerRowIdx] || [];
                const slotRow = rows[slotRowIdx] || [];

                const dateCols = [];
                headerRow.forEach((cell, colIdx) => {
                    const dateMatch = String(cell||'').match(/(\d{2}-\d{2}-\d{4})/);
                    if (dateMatch) {
                        const [dd, mm, yyyy] = dateMatch[1].split('-');
                        const isoDate = `${yyyy}-${mm}-${dd}`;
                        const slot = String(slotRow[colIdx]||'').trim().toUpperCase() || 'FN';
                        dateCols.push({ colIdx, date: isoDate, slot });
                    }
                });

                for (let i = slotRowIdx + 1; i < rows.length; i++) {
                    const row = rows[i] || [];
                    const sno = row[0];
                    const name = String(row[1]||'').trim();
                    if (!name || !sno || typeof sno !== 'number') continue;

                    dateCols.forEach(({ colIdx, date, slot }) => {
                        const val = String(row[colIdx]||'').trim();
                        if (val && val !== '' && val !== 'null') {
                            allRecords.push({ name, department, date, slot, assigned: false });
                        }
                    });
                }
            });

            if (allRecords.length === 0) {
                statusEl.textContent = '❌ No records found. Check file format.';
                return;
            }

            const batch = db.batch();
            const dates = [...new Set(allRecords.map(r => r.date))];
            const dept = allRecords[0].department;
            const existing = await db.collection('invigilators')
                .where('department', '==', dept)
                .where('date', 'in', dates.slice(0, 10))
                .get();
            existing.docs.forEach(doc => batch.delete(doc.ref));

            allRecords.forEach(record => {
                const ref = db.collection('invigilators').doc();
                batch.set(ref, { ...record, uploadedAt: new Date().toISOString() });
            });

            await batch.commit();
            statusEl.textContent = `✅ Saved ${allRecords.length} invigilator slots from ${dept}`;
            event.target.value = '';
            loadInvigilatorList();
        } catch(err) {
            console.error(err);
            statusEl.textContent = '❌ Parse error: ' + err.message;
        }
    };
    reader.readAsArrayBuffer(file);
}

async function loadInvigilatorList() {
    const container = document.getElementById('invigilatorListContainer');
    if (!container) return;
    container.innerHTML = '<p style="color:#6b7280;font-size:13px;">Loading...</p>';

    try {
        const snapshot = await db.collection('invigilators').get();
        if (snapshot.empty) {
            container.innerHTML = '<p style="color:#6b7280;font-size:13px;">No invigilators uploaded yet.</p>';
            return;
        }

        const byDept = {};
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (!byDept[d.department]) byDept[d.department] = [];
            byDept[d.department].push({ id: doc.id, ...d });
        });

        let html = '';
        Object.entries(byDept).forEach(([dept, records]) => {
            const bySlot = {};
            records.forEach(r => {
                const key = `${r.date} ${r.slot}`;
                if (!bySlot[key]) bySlot[key] = [];
                bySlot[key].push(r.name);
            });

            html += `<div style="background:white;border:2px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <strong style="font-size:15px;">${dept} Department</strong>
                    <button onclick="clearInvigilatorsByDept('${dept}')" class="ed-btn ed-btn-danger-outline ed-btn-sm">Clear</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">`;

            Object.entries(bySlot).sort().forEach(([slot, names]) => {
                html += `<div style="background:#f0f4ff;border:1px solid #c7d7ff;border-radius:6px;padding:8px 12px;font-size:12px;">
                    <strong>${slot}</strong>: ${names.join(', ')}
                </div>`;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = `<p style="color:red;">Error loading: ${err.message}</p>`;
    }
}

async function clearInvigilatorsByDept(dept) {
    if (!confirm(`Remove all invigilator records for ${dept} department?`)) return;
    try {
        const snapshot = await db.collection('invigilators').where('department', '==', dept).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        loadInvigilatorList();
    } catch(err) {
        alert('Error: ' + err.message);
    }
}
