// subjects-admin.js
// Admin panel section for managing exam subjects per year / branch / semester.
// Subjects are stored in Firestore collection 'subjectData' as one document
// per (year, branch, semester) combo:
//   docId: e.g. "1st_Year__CSE__Semester_1"
//   { year, branch, semester, subjects: string[], updatedAt }
//
// window.loadSubjectsFromFirestore() is also called from app-multiyear.js
// so that the exam-generation dropdowns always use live data.

// ─── Firestore helpers ────────────────────────────────────────────────────────

function subjectDocId(year, branch, semester) {
    return `${year}__${branch}__${semester}`.replace(/\s+/g, '_');
}

/**
 * Load all subject docs from Firestore.
 * Returns a nested object: { year: { branch: { semester: [subjects] } } }
 * Falls back to YEAR_SUBJECTS (hardcoded) if Firestore is empty or errors out.
 */
window.loadSubjectsFromFirestore = async function () {
    try {
        const snap = await db.collection('subjectData').get();
        if (snap.empty) return null; // signal: use hardcoded fallback
        const data = {};
        snap.docs.forEach(doc => {
            const { year, branch, semester, subjects } = doc.data();
            if (!year || !branch || !semester || !Array.isArray(subjects)) return;
            if (!data[year]) data[year] = {};
            if (!data[year][branch]) data[year][branch] = {};
            data[year][branch][semester] = subjects;
        });
        return data;
    } catch (err) {
        console.warn('subjectData load failed, using hardcoded fallback:', err);
        return null;
    }
};

/**
 * Save a single (year, branch, semester) subject list to Firestore.
 */
async function saveSubjectDoc(year, branch, semester, subjects) {
    const docId = subjectDocId(year, branch, semester);
    await db.collection('subjectData').doc(docId).set({
        year, branch, semester,
        subjects,
        updatedAt: new Date().toISOString()
    });
}

// ─── State ────────────────────────────────────────────────────────────────────

const SA_YEARS     = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SA_BRANCHES  = ['CSE', 'ECE', 'AIML', 'EEE'];
const SA_SEMESTERS = ['Semester 1', 'Semester 2'];

// Working copy loaded into UI — starts as null until initSubjectsView() runs
let _saData = null;

// Currently selected filter
let _saYear     = SA_YEARS[0];
let _saBranch   = SA_BRANCHES[0];
let _saSemester = SA_SEMESTERS[0];

// Track unsaved changes per combo key
const _saDirty = new Set();

// ─── Entry point called from admin.html showView('subjects') ──────────────────

async function initSubjectsView() {
    const view = document.getElementById('subjectsView');
    if (!view) return;
    view.innerHTML = `
        <div style="max-width:860px;margin:0 auto;">
            <h1 style="margin:0 0 6px;">📖 Subjects</h1>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
                Manage the subject lists used in exam generation. Changes saved here
                are reflected immediately in the Generate Seating form.
            </p>
            <div id="sa-loading" style="color:#6b7280;font-size:14px;">⏳ Loading subjects…</div>
            <div id="sa-body" style="display:none;"></div>
        </div>`;

    // Load from Firestore (or fall back to hardcoded)
    const firestoreData = await window.loadSubjectsFromFirestore();
    _saData = firestoreData ? deepCloneSubjects(firestoreData) : deepCloneSubjects(YEAR_SUBJECTS);
    _saDirty.clear();

    document.getElementById('sa-loading').style.display = 'none';
    document.getElementById('sa-body').style.display = 'block';
    renderSaBody();
}

// ─── Deep-clone helper ────────────────────────────────────────────────────────

function deepCloneSubjects(src) {
    const out = {};
    for (const year of Object.keys(src)) {
        out[year] = {};
        for (const branch of Object.keys(src[year])) {
            out[year][branch] = {};
            for (const sem of Object.keys(src[year][branch])) {
                out[year][branch][sem] = [...(src[year][branch][sem] || [])];
            }
        }
    }
    return out;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSaBody() {
    const body = document.getElementById('sa-body');
    if (!body) return;

    body.innerHTML = `
        <!-- Filter row -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${SA_YEARS.map(y => `
                    <button onclick="saSelectYear('${y}')"
                        style="padding:7px 14px;border-radius:6px;border:2px solid ${_saYear===y?'#4a90e2':'#e0e0e0'};
                               background:${_saYear===y?'#e8f1ff':'white'};color:${_saYear===y?'#1d4ed8':'#374151'};
                               font-size:13px;font-weight:600;cursor:pointer;">
                        ${y}
                    </button>`).join('')}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${SA_BRANCHES.map(b => `
                    <button onclick="saSelectBranch('${b}')"
                        style="padding:7px 14px;border-radius:6px;border:2px solid ${_saBranch===b?'#7c3aed':'#e0e0e0'};
                               background:${_saBranch===b?'#f3e8ff':'white'};color:${_saBranch===b?'#6d28d9':'#374151'};
                               font-size:13px;font-weight:600;cursor:pointer;">
                        ${b}
                    </button>`).join('')}
            </div>
            <div style="display:flex;gap:6px;">
                ${SA_SEMESTERS.map(s => `
                    <button onclick="saSelectSemester('${s}')"
                        style="padding:7px 14px;border-radius:6px;border:2px solid ${_saSemester===s?'#059669':'#e0e0e0'};
                               background:${_saSemester===s?'#d1fae5':'white'};color:${_saSemester===s?'#065f46':'#374151'};
                               font-size:13px;font-weight:600;cursor:pointer;">
                        ${s}
                    </button>`).join('')}
            </div>
        </div>

        <!-- Subject editor card -->
        <div id="sa-card"></div>

        <!-- Bulk CSV import -->
        <div style="background:white;border:2px solid #e0e0e0;border-radius:8px;padding:20px;margin-top:24px;">
            <strong style="font-size:14px;">📥 Bulk Import from CSV</strong>
            <p style="margin:4px 0 12px;color:#6b7280;font-size:13px;">
                Upload a CSV with columns <code>Year,Branch,Semester,Subject</code>
                (same format as the exported <code>subjects_all_years.csv</code>).
                This will <strong>replace</strong> subjects for every year/branch/semester
                present in the file and save all to Firestore.
            </p>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <label for="saImportInput"
                    style="padding:8px 16px;background:#4a90e2;color:white;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">
                    ↑ Import CSV
                </label>
                <input type="file" id="saImportInput" accept=".csv" style="display:none;" onchange="saHandleImport(event)">
                <span id="saImportStatus" style="font-size:13px;color:#6b7280;"></span>
            </div>
        </div>`;

    renderSaCard();
}

function renderSaCard() {
    const card = document.getElementById('sa-card');
    if (!card) return;

    // Ensure path exists in _saData
    if (!_saData[_saYear]) _saData[_saYear] = {};
    if (!_saData[_saYear][_saBranch]) _saData[_saYear][_saBranch] = {};
    if (!_saData[_saYear][_saBranch][_saSemester]) _saData[_saYear][_saBranch][_saSemester] = [];

    const subjects = _saData[_saYear][_saBranch][_saSemester];
    const comboKey = subjectDocId(_saYear, _saBranch, _saSemester);
    const isDirty  = _saDirty.has(comboKey);

    card.innerHTML = `
        <div style="background:white;border:2px solid #e0e0e0;border-radius:8px;padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
                <div>
                    <strong style="font-size:15px;">${_saYear} · ${_saBranch} · ${_saSemester}</strong>
                    ${isDirty ? '<span style="margin-left:8px;font-size:12px;color:#d97706;font-weight:600;">● unsaved changes</span>' : ''}
                </div>
                <button onclick="saSaveCombo()"
                    style="padding:8px 20px;background:${isDirty?'#059669':'#9ca3af'};color:white;border:none;border-radius:6px;
                           font-size:13px;font-weight:600;cursor:${isDirty?'pointer':'default'};">
                    💾 Save
                </button>
            </div>

            <!-- Subject list -->
            <div id="sa-subject-list">
                ${subjects.length === 0
                    ? '<p style="color:#9ca3af;font-size:13px;margin:0 0 12px;">No subjects yet. Add one below.</p>'
                    : subjects.map((subj, idx) => `
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;" id="sa-row-${idx}">
                            <span style="flex:0 0 22px;text-align:right;color:#9ca3af;font-size:12px;">${idx+1}.</span>
                            <input type="text" value="${escHtml(subj)}"
                                oninput="saUpdateSubject(${idx}, this.value)"
                                style="flex:1;padding:8px 10px;border:1.5px solid #e0e0e0;border-radius:6px;font-size:13px;">
                            <button onclick="saMoveUp(${idx})" title="Move up"
                                style="padding:5px 8px;border:1.5px solid #e0e0e0;border-radius:5px;background:white;cursor:pointer;font-size:12px;"
                                ${idx===0?'disabled':''}>▲</button>
                            <button onclick="saMoveDown(${idx})" title="Move down"
                                style="padding:5px 8px;border:1.5px solid #e0e0e0;border-radius:5px;background:white;cursor:pointer;font-size:12px;"
                                ${idx===subjects.length-1?'disabled':''}>▼</button>
                            <button onclick="saDeleteSubject(${idx})" title="Remove"
                                style="padding:5px 8px;border:1.5px solid #fde8e8;border-radius:5px;background:#fff5f5;color:#dc2626;cursor:pointer;font-size:12px;">✕</button>
                        </div>`).join('')}
            </div>

            <!-- Add new subject -->
            <div style="display:flex;gap:8px;margin-top:4px;">
                <input type="text" id="saNewSubjectInput" placeholder="Add a subject…"
                    style="flex:1;padding:8px 10px;border:1.5px solid #c7d2fe;border-radius:6px;font-size:13px;"
                    onkeydown="if(event.key==='Enter') saAddSubject()">
                <button onclick="saAddSubject()"
                    style="padding:8px 16px;background:#4a90e2;color:white;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
                    + Add
                </button>
            </div>
        </div>`;
}

// ─── Filter selectors ─────────────────────────────────────────────────────────

function saSelectYear(y)     { _saYear = y;     renderSaBody(); }
function saSelectBranch(b)   { _saBranch = b;   renderSaBody(); }
function saSelectSemester(s) { _saSemester = s; renderSaBody(); }

// ─── Edit actions ─────────────────────────────────────────────────────────────

function saMarkDirty() {
    _saDirty.add(subjectDocId(_saYear, _saBranch, _saSemester));
    // Refresh just the save button state without re-rendering the whole card
    const btn = document.querySelector('#sa-card button[onclick="saSaveCombo()"]');
    if (btn) { btn.style.background = '#059669'; btn.style.cursor = 'pointer'; }
    const label = document.querySelector('#sa-card strong + span');
    // Full re-render is fine here since inputs lose focus anyway only on delete/move
}

function saUpdateSubject(idx, val) {
    _saData[_saYear][_saBranch][_saSemester][idx] = val;
    _saDirty.add(subjectDocId(_saYear, _saBranch, _saSemester));
    // Update just the save-button colour without full re-render (keeps cursor in input)
    const btn = document.querySelector('#sa-card button[onclick="saSaveCombo()"]');
    if (btn) { btn.style.background = '#059669'; btn.style.cursor = 'pointer'; }
}

function saAddSubject() {
    const input = document.getElementById('saNewSubjectInput');
    const val = (input?.value || '').trim();
    if (!val) return;
    _saData[_saYear][_saBranch][_saSemester].push(val);
    _saDirty.add(subjectDocId(_saYear, _saBranch, _saSemester));
    input.value = '';
    renderSaCard();
}

function saDeleteSubject(idx) {
    _saData[_saYear][_saBranch][_saSemester].splice(idx, 1);
    _saDirty.add(subjectDocId(_saYear, _saBranch, _saSemester));
    renderSaCard();
}

function saMoveUp(idx) {
    if (idx === 0) return;
    const arr = _saData[_saYear][_saBranch][_saSemester];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    _saDirty.add(subjectDocId(_saYear, _saBranch, _saSemester));
    renderSaCard();
}

function saMoveDown(idx) {
    const arr = _saData[_saYear][_saBranch][_saSemester];
    if (idx >= arr.length - 1) return;
    [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
    _saDirty.add(subjectDocId(_saYear, _saBranch, _saSemester));
    renderSaCard();
}

// ─── Save to Firestore ────────────────────────────────────────────────────────

async function saSaveCombo() {
    const comboKey = subjectDocId(_saYear, _saBranch, _saSemester);
    if (!_saDirty.has(comboKey)) return;

    const subjects = _saData[_saYear][_saBranch][_saSemester]
        .map(s => s.trim()).filter(Boolean);

    const btn = document.querySelector('#sa-card button[onclick="saSaveCombo()"]');
    if (btn) { btn.textContent = '⏳ Saving…'; btn.disabled = true; }

    try {
        await saveSubjectDoc(_saYear, _saBranch, _saSemester, subjects);
        _saDirty.delete(comboKey);
        // Also update the live YEAR_SUBJECTS so dropdowns reflect immediately
        // without needing a page reload.
        if (window.YEAR_SUBJECTS) {
            if (!YEAR_SUBJECTS[_saYear]) YEAR_SUBJECTS[_saYear] = {};
            if (!YEAR_SUBJECTS[_saYear][_saBranch]) YEAR_SUBJECTS[_saYear][_saBranch] = {};
            YEAR_SUBJECTS[_saYear][_saBranch][_saSemester] = [...subjects];
        }
        if (btn) { btn.textContent = '✅ Saved'; btn.disabled = false; }
        setTimeout(() => renderSaCard(), 1200);
    } catch (err) {
        if (btn) { btn.textContent = '❌ Error — retry'; btn.disabled = false; btn.style.background = '#dc2626'; }
        console.error('Error saving subjects:', err);
    }
}

// ─── Bulk CSV import ──────────────────────────────────────────────────────────

async function saHandleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('saImportStatus');
    statusEl.textContent = '⏳ Parsing…';

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const lines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) throw new Error('File is empty or has only a header.');

            // Detect and skip header row
            const firstCols = lines[0].split(',').map(c => c.trim().toLowerCase());
            const startIdx = (firstCols[0] === 'year' || firstCols[0] === 'branch') ? 1 : 0;

            // Group rows by (year, branch, semester)
            const grouped = {};
            for (let i = startIdx; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length < 4) continue;
                const year     = parts[0].trim();
                const branch   = parts[1].trim();
                const semester = parts[2].trim();
                const subject  = parts.slice(3).join(',').trim();
                if (!year || !branch || !semester || !subject) continue;
                const key = subjectDocId(year, branch, semester);
                if (!grouped[key]) grouped[key] = { year, branch, semester, subjects: [] };
                grouped[key].subjects.push(subject);
            }

            const combos = Object.values(grouped);
            if (combos.length === 0) throw new Error('No valid rows found. Expected: Year,Branch,Semester,Subject');

            statusEl.textContent = `⏳ Saving ${combos.length} combos to Firestore…`;

            // Batch write
            const batch = db.batch();
            combos.forEach(({ year, branch, semester, subjects }) => {
                const docId = subjectDocId(year, branch, semester);
                batch.set(db.collection('subjectData').doc(docId), {
                    year, branch, semester, subjects,
                    updatedAt: new Date().toISOString()
                });
                // Update local working copy
                if (!_saData[year]) _saData[year] = {};
                if (!_saData[year][branch]) _saData[year][branch] = {};
                _saData[year][branch][semester] = [...subjects];
                // Update live YEAR_SUBJECTS
                if (window.YEAR_SUBJECTS) {
                    if (!YEAR_SUBJECTS[year]) YEAR_SUBJECTS[year] = {};
                    if (!YEAR_SUBJECTS[year][branch]) YEAR_SUBJECTS[year][branch] = {};
                    YEAR_SUBJECTS[year][branch][semester] = [...subjects];
                }
            });
            await batch.commit();

            _saDirty.clear();
            event.target.value = '';
            statusEl.textContent = `✅ Imported ${combos.length} year/branch/semester combos.`;
            renderSaCard();
        } catch (err) {
            statusEl.textContent = '❌ ' + err.message;
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// ─── Tiny utility ─────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
