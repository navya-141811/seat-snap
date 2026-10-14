let seatingData = [];
let overflowData = [];
let isSaveInProgress = false;

// Helper: fetch faculty subjects map from Firestore (used in invigilator replacement)
// Returns Map<name, Set<subject (lowercase)>>
window.fetchFacultySubjectsMap = async function() {
    try {
        const snapshot = await db.collection('facultySubjects').get();
        const map = new Map();
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            map.set(d.name, new Set((d.subjects || []).map(s => s.trim().toLowerCase())));
        });
        return map;
    } catch(err) {
        console.warn('Could not fetch faculty subjects:', err);
        return new Map();
    }
};

function updateSaveProgress(percent, step, message) {
    const overlay = document.getElementById('saveProgressOverlay');
    const fill = document.getElementById('saveProgressFill');
    const track = overlay?.querySelector('[role="progressbar"]');
    if (!overlay || !fill || !track) return;

    const value = Math.max(0, Math.min(100, percent));
    fill.style.width = `${value}%`;
    track.setAttribute('aria-valuenow', String(value));
    document.getElementById('saveProgressPercent').textContent = `${value}%`;
    document.getElementById('saveProgressStep').textContent = step;
    document.getElementById('saveProgressMessage').textContent = message;
}

function showSaveProgress() {
    const overlay = document.getElementById('saveProgressOverlay');
    const dismiss = document.getElementById('saveProgressDismiss');
    if (!overlay) return;

    dismiss.hidden = true;
    overlay.hidden = false;
    updateSaveProgress(5, 'Preparing', 'Preparing your arrangement…');
}

function hideSaveProgress() {
    const overlay = document.getElementById('saveProgressOverlay');
    if (overlay) overlay.hidden = true;
}

function dismissSaveProgress() {
    hideSaveProgress();
    isSaveInProgress = false;
    window.isSavingData = false;
    const saveButton = document.querySelector('.download-buttons button');
    if (saveButton) saveButton.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('saveProgressDismiss')?.addEventListener('click', dismissSaveProgress);
});

// Load data from sessionStorage
window.onload = function() {
    const storedSeatingData = sessionStorage.getItem('seatingData');
    const storedOverflowData = sessionStorage.getItem('overflowData');
    const storedSections = sessionStorage.getItem('sections');
    
    if (!storedSeatingData) {
        alert('No seating data found. Redirecting to main page.');
        window.location.href = 'index.html';
        return;
    }
    
    seatingData = JSON.parse(storedSeatingData);
    overflowData = JSON.parse(storedOverflowData);
    const sections = JSON.parse(storedSections);
    
    displayClassroomTables(seatingData, sections);
    
    if (overflowData.length > 0) {
        const additionalClassrooms = Math.ceil(overflowData.length / 64);
        displayOverflow(overflowData, additionalClassrooms);
    }
};

function buildInvigilatorBadge(room, name, slot) {
    const safeRoom = room.replace(/'/g, "\\'");
    const safeName = name.replace(/'/g, "\\'");
    return `<span
        onclick="openInvigilatorReplaceModal('${safeRoom}','${safeName}','${slot}')"
        title="Click to replace"
        style="display:inline-flex;align-items:center;gap:5px;background:#e8f1ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s;"
        onmouseover="this.style.background='#dbeafe'"
        onmouseout="this.style.background='#e8f1ff'">
        👩‍🏫 ${name} <span style="font-size:11px;opacity:0.7;">✎</span>
    </span>`;
}

function displayClassroomTables(seatingData, sections) {
    let html = '<h2>🏫 Seating Arrangement by Classroom</h2>';
    const roomInvigilators = JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}');
    const tableMetadata = JSON.parse(sessionStorage.getItem('tableMetadata') || localStorage.getItem('tableMetadata') || '{}');
    const slot = (tableMetadata.examTime || '10:30') < '13:00' ? 'FN' : 'AN';

    sections.forEach(classroom => {
        const seats = seatingData.filter(row => row.classroom === classroom.name);
        if (seats.length === 0) return;

        const normalSeats = seats.slice(0, 28);
        const extraSeats  = seats.slice(28);

        const col1 = normalSeats.slice(0, 7);
        const col2 = normalSeats.slice(7, 14);
        const col3 = normalSeats.slice(14, 21);
        const col4 = normalSeats.slice(21, 28);

        const invigilators = roomInvigilators[classroom.name] || [];
        const badgesHtml = invigilators.map(name => buildInvigilatorBadge(classroom.name, name, slot)).join(' ');
        const invigilatorHtml = `
            <div id="invig-bar-${CSS.escape(classroom.name)}"
                 style="margin-bottom:10px;padding:8px 12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;">
                ${invigilators.length > 0
                    ? badgesHtml
                    : `<span style="color:#9ca3af;">No invigilators assigned — <a href="#" onclick="openInvigilatorReplaceModal('${classroom.name.replace(/'/g,"\\'")}','','${slot}');return false;" style="color:#4a90e2;">+ Assign</a></span>`
                }
            </div>`;

        html += `<div class="classroom-table" style="margin-top: 30px;">
            <h3>🚪 ${classroom.name}</h3>
            ${invigilatorHtml}
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 10px;">`;

        [col1, col2, col3, col4].forEach(col => {
            html += `<table><tbody>`;
            col.forEach(row => {
                html += `<tr><td>${row.seat1.rollNo}</td><td>${row.seat2 ? row.seat2.rollNo : '-'}</td></tr>`;
            });
            html += `</tbody></table>`;
        });

        html += `</div>`;

        if (extraSeats.length > 0) {
            const extraCols = [[], [], [], []];
            extraSeats.forEach((row, idx) => extraCols[idx].push(row));

            html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 4px;">`;
            extraCols.forEach(col => {
                html += `<table><tbody>`;
                col.forEach(row => {
                    html += `<tr><td>${row.seat1.rollNo}</td><td>${row.seat2 ? row.seat2.rollNo : '-'}</td></tr>`;
                });
                html += `</tbody></table>`;
            });
            html += `</div>`;
        }

        html += `</div>`;
    });

    document.getElementById('tableContainer').innerHTML = html;
}

// ─── Assign All Invigilators ──────────────────────────────────────────────────
async function assignAllInvigilators() {
    const btn = document.getElementById('assignInvigBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Assigning...'; }

    const meta = JSON.parse(sessionStorage.getItem('tableMetadata') || localStorage.getItem('tableMetadata') || '{}');
    const examDate = meta.examDateISO || meta.examDate || '';
    const examTime = meta.examTime || '10:30';
    const slot = examTime < '13:00' ? 'FN' : 'AN';

    const seatingDataRaw = JSON.parse(sessionStorage.getItem('seatingData') || '[]');
    const sections = JSON.parse(sessionStorage.getItem('sections') || '[]');
    const rooms = meta.selectedRooms && meta.selectedRooms.length
        ? meta.selectedRooms
        : [...new Set(seatingDataRaw.map(r => r.classroom).filter(Boolean))];

    try {
        let query = db.collection('invigilators');
        if (examDate) query = query.where('date', '==', examDate);
        const snap = await query.get();

        function normSlot(s) {
            const u = String(s||'').toUpperCase().replace(/[^A-Z]/g,'');
            if (u.startsWith('A')) return 'AN';
            if (u.startsWith('F')) return 'FN';
            return u.substring(0,2) || 'FN';
        }

        const available = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(inv => normSlot(inv.slot) === slot);

        if (available.length === 0) {
            const allSlots = [...new Set(snap.docs.map(d => d.data().slot))];
            const hint = allSlots.length
                ? ` Found slots in DB: ${allSlots.join(', ')} — but need ${slot}.`
                : ' No invigilator records found for this date at all.';
            alert(`⚠️ No invigilators found for slot ${slot}.${hint}\n\nPlease upload invigilator sheets from the Invigilators panel.`);
            if (btn) { btn.disabled = false; btn.textContent = '👩‍🏫 Assign Invigilators'; }
            return;
        }

        // Deduplicate pool by name
        const seenNames = new Map();
        available.forEach(inv => {
            if (!seenNames.has(inv.name)) seenNames.set(inv.name, inv);
        });
        const pool = Array.from(seenNames.values());

        // Shuffle
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // Fetch faculty subjects for subject constraint
        let facultySubjectsMap = new Map();
        try {
            const fsSnap = await db.collection('facultySubjects').get();
            fsSnap.docs.forEach(doc => {
                const d = doc.data();
                facultySubjectsMap.set(d.name, new Set((d.subjects || []).map(s => s.trim().toLowerCase())));
            });
        } catch(_) {}

        // Build room → exam subjects map
        const roomSubjectsMap = {};
        seatingDataRaw.forEach(row => {
            if (!row.classroom) return;
            if (!roomSubjectsMap[row.classroom]) roomSubjectsMap[row.classroom] = new Set();
            if (row.seat1?.subject) roomSubjectsMap[row.classroom].add(row.seat1.subject.trim().toLowerCase());
            if (row.seat2?.subject) roomSubjectsMap[row.classroom].add(row.seat2.subject.trim().toLowerCase());
        });

        function canAssign(name, room) {
            const taught = facultySubjectsMap.get(name);
            if (!taught || taught.size === 0) return true;
            for (const sub of (roomSubjectsMap[room] || new Set())) {
                if (taught.has(sub)) return false;
            }
            return true;
        }

        // Count students per room
        const roomStudentCount = {};
        seatingDataRaw.forEach(row => {
            if (!row.classroom) return;
            if (!roomStudentCount[row.classroom]) roomStudentCount[row.classroom] = 0;
            if (row.seat1?.rollNo) roomStudentCount[row.classroom]++;
            if (row.seat2?.rollNo) roomStudentCount[row.classroom]++;
        });

        const roomInvigilators = {};
        const usedNames = new Set();
        const shortfallRooms = []; // rooms that still need more invigilators

        rooms.forEach(room => {
            const studentCount = roomStudentCount[room] || 0;
            const needed = Math.max(1, Math.ceil(studentCount / 30));
            const assigned = [];

            for (const inv of pool) {
                if (assigned.length >= needed) break;
                if (usedNames.has(inv.name)) continue;
                if (!canAssign(inv.name, room)) continue;
                assigned.push(inv.name);
                usedNames.add(inv.name);
            }

            roomInvigilators[room] = assigned;
            if (assigned.length < needed) {
                shortfallRooms.push({ room, assigned: assigned.length, needed });
            }
        });

        sessionStorage.setItem('roomInvigilators', JSON.stringify(roomInvigilators));
        displayClassroomTables(seatingDataRaw, sections);

        if (btn) { btn.disabled = false; btn.textContent = '✅ Re-assign Invigilators'; }

        if (shortfallRooms.length > 0) {
            // Open the shortfall modal for admin to pick additional faculty
            await openInvigShortfallModal(shortfallRooms, usedNames, facultySubjectsMap, roomSubjectsMap, slot);
        }

    } catch(err) {
        console.error(err);
        alert('❌ Error assigning invigilators: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '👩‍🏫 Assign Invigilators'; }
    }
}

// ─── Shortfall Modal ──────────────────────────────────────────────────────────
let _sfCtx = {}; // context for the shortfall modal

async function openInvigShortfallModal(shortfallRooms, alreadyUsed, facultySubjectsMap, roomSubjectsMap, slot) {
    _sfCtx = { shortfallRooms, alreadyUsed: new Set(alreadyUsed), roomSubjectsMap, slot, selected: new Set() };

    // Build subtitle
    const total = shortfallRooms.reduce((s, r) => s + (r.needed - r.assigned), 0);
    document.getElementById('invigShortfallSubtitle').textContent =
        `${total} slot(s) could not be filled from the invigilator sheet. Select faculty from the list below to fill them.`;

    // Room list
    document.getElementById('invigShortfallRoomList').innerHTML =
        '<strong>Rooms needing more invigilators:</strong><br>' +
        shortfallRooms.map(r =>
            `• ${r.room} — needs ${r.needed - r.assigned} more (has ${r.assigned}/${r.needed})`
        ).join('<br>');

    // Fetch all faculty from facultySubjects collection
    let allFaculty = [];
    try {
        const fsSnap = await db.collection('facultySubjects').get();
        fsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (!d.name) return;
            allFaculty.push({ name: d.name, department: d.department || '' });
        });
        allFaculty.sort((a, b) => a.name.localeCompare(b.name));
    } catch(err) {
        console.error(err);
    }

    // Compute a combined "blocked rooms subjects" set for the remaining rooms
    // A faculty is blocked if they teach any subject being examined in any shortfall room
    const shortfallRoomNames = new Set(shortfallRooms.map(r => r.room));
    function isBlockedForShortfall(name) {
        const taught = facultySubjectsMap.get(name);
        if (!taught || taught.size === 0) return false;
        for (const room of shortfallRoomNames) {
            for (const sub of (roomSubjectsMap[room] || new Set())) {
                if (taught.has(sub)) return true;
            }
        }
        return false;
    }

    // Build candidate list — exclude already assigned
    _sfCtx.candidates = allFaculty.map(f => ({
        name: f.name,
        department: f.department,
        blocked: isBlockedForShortfall(f.name),
        alreadyAssigned: _sfCtx.alreadyUsed.has(f.name)
    }));

    _sfCtx.slotsNeeded = total;

    const modal = document.getElementById('invigShortfallModal');
    const searchEl = document.getElementById('invigShortfallSearch');
    searchEl.value = '';
    searchEl.oninput = () => renderShortfallGrid(_sfCtx.candidates, searchEl.value);
    modal.style.display = 'flex';
    renderShortfallGrid(_sfCtx.candidates, '');
    updateShortfallSelCount();
}

function renderShortfallGrid(candidates, query) {
    const gridEl = document.getElementById('invigShortfallGrid');
    const q = query.trim().toLowerCase();
    const filtered = q
        ? candidates.filter(c => c.name.toLowerCase().includes(q) || c.department.toLowerCase().includes(q))
        : candidates;

    if (filtered.length === 0) {
        gridEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;grid-column:1/-1;">No matching faculty found.</p>';
        return;
    }

    gridEl.innerHTML = filtered.map(c => {
        if (c.alreadyAssigned) {
            return `<div style="padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;background:#f9fafb;opacity:0.5;cursor:not-allowed;">
                <div style="font-size:13px;font-weight:600;color:#9ca3af;">${c.name}</div>
                <div style="font-size:11px;color:#9ca3af;margin-top:2px;">✅ Already assigned</div>
            </div>`;
        }
        if (c.blocked) {
            return `<div style="padding:10px 14px;border:1.5px solid #fde8e8;border-radius:8px;background:#fff5f5;opacity:0.6;cursor:not-allowed;" title="Teaches a subject being examined in a shortfall room">
                <div style="font-size:13px;font-weight:600;color:#dc2626;">${c.name}</div>
                <div style="font-size:11px;color:#ef4444;margin-top:2px;">⛔ Subject conflict</div>
            </div>`;
        }
        const isSel = _sfCtx.selected.has(c.name);
        return `<div onclick="toggleShortfallFaculty('${c.name.replace(/'/g,"\\'")}', this)"
                     style="padding:10px 14px;border:1.5px solid ${isSel ? '#7c3aed' : '#e5e7eb'};border-radius:8px;
                            background:${isSel ? '#f3e8ff' : 'white'};cursor:pointer;transition:all 0.15s;user-select:none;"
                     onmouseover="if(!this.dataset.sel)this.style.borderColor='#7c3aed'"
                     onmouseout="if(!this.dataset.sel)this.style.borderColor='#e5e7eb'"
                     data-sel="${isSel ? '1' : ''}">
            <div style="font-size:13px;font-weight:600;color:#1a202c;">${c.name}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">${c.department || '—'} ${isSel ? '· <span style="color:#7c3aed;font-weight:700;">✓ selected</span>' : ''}</div>
        </div>`;
    }).join('');
}

function toggleShortfallFaculty(name, el) {
    if (_sfCtx.selected.has(name)) {
        _sfCtx.selected.delete(name);
        el.style.borderColor = '#e5e7eb';
        el.style.background = 'white';
        el.dataset.sel = '';
    } else {
        _sfCtx.selected.add(name);
        el.style.borderColor = '#7c3aed';
        el.style.background = '#f3e8ff';
        el.dataset.sel = '1';
    }
    // Update the label inside
    const sub = el.querySelector('div:last-child');
    const dept = _sfCtx.candidates.find(c => c.name === name)?.department || '—';
    sub.innerHTML = `${dept} ${_sfCtx.selected.has(name) ? '· <span style="color:#7c3aed;font-weight:700;">✓ selected</span>' : ''}`;
    updateShortfallSelCount();
}

function updateShortfallSelCount() {
    const el = document.getElementById('invigShortfallSelCount');
    const n = _sfCtx.selected?.size || 0;
    const need = _sfCtx.slotsNeeded || 0;
    el.textContent = n > 0 ? `${n} selected (${need} needed)` : `${need} slot(s) to fill`;
    el.style.color = n >= need ? '#059669' : '#6b7280';
}

function confirmShortfallSelection() {
    if (_sfCtx.selected.size === 0) {
        alert('Please select at least one faculty member, or click "Remove All" to clear all assignments.');
        return;
    }

    const roomInvigilators = JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}');
    const seatingDataRaw   = JSON.parse(sessionStorage.getItem('seatingData') || '[]');
    const sections         = JSON.parse(sessionStorage.getItem('sections') || '[]');

    // Distribute selected faculty across shortfall rooms (round-robin style)
    const toAssign = Array.from(_sfCtx.selected);
    let idx = 0;

    _sfCtx.shortfallRooms.forEach(({ room, assigned, needed }) => {
        const current = roomInvigilators[room] || [];
        let stillNeeded = needed - current.length;
        while (stillNeeded > 0 && idx < toAssign.length) {
            current.push(toAssign[idx++]);
            stillNeeded--;
        }
        roomInvigilators[room] = current;
    });

    sessionStorage.setItem('roomInvigilators', JSON.stringify(roomInvigilators));
    closeInvigShortfallModal();
    displayClassroomTables(seatingDataRaw, sections);
}

function removeAllInvigilators() {
    if (!confirm('Remove all invigilator assignments for this table?')) return;
    const seatingDataRaw = JSON.parse(sessionStorage.getItem('seatingData') || '[]');
    const sections       = JSON.parse(sessionStorage.getItem('sections') || '[]');
    sessionStorage.setItem('roomInvigilators', JSON.stringify({}));
    closeInvigShortfallModal();
    displayClassroomTables(seatingDataRaw, sections);
}

function closeInvigShortfallModal() {
    document.getElementById('invigShortfallModal').style.display = 'none';
    _sfCtx = {};
}

// ─── Export Invigilator Table PDF ─────────────────────────────────────────────
function exportInvigilatorTablePDF() {
    const { jsPDF } = window.jspdf;
    const meta = JSON.parse(sessionStorage.getItem('tableMetadata') || localStorage.getItem('tableMetadata') || '{}');
    const roomInvigilators = JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}');
    const seatingDataRaw   = JSON.parse(sessionStorage.getItem('seatingData') || '[]');

    const rooms = meta.selectedRooms && meta.selectedRooms.length
        ? meta.selectedRooms
        : [...new Set(seatingDataRaw.map(r => r.classroom).filter(Boolean))];

    const rows = rooms.map(room => [
        room,
        (roomInvigilators[room] || []).join(', ') || '—'
    ]);

    const iso = meta.examDate || meta.examDateISO || '';
    const dateDisplay = iso ? iso.split('-').reverse().join('-') : '';
    const examTime = meta.examTime || '';
    const slot = examTime && examTime < '13:00' ? 'FN' : 'AN';

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('BVRIT HYDERABAD College of Engineering for Women', 105, 14, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Invigilator Assignment Table', 105, 21, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (dateDisplay) doc.text(`Date: ${dateDisplay}   Slot: ${slot}`, 105, 28, { align: 'center' });

    doc.autoTable({
        head: [['Room', 'Invigilator(s)']],
        body: rows,
        startY: 33,
        styles: { fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [74, 144, 226], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
            0: { cellWidth: 45, fontStyle: 'bold' },
            1: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14 }
    });

    doc.save(`invigilators-${iso || 'table'}.pdf`);
}


// ─── Invigilator Replacement Modal ───────────────────────────────────────────
let _replaceCtx = {}; // { room, currentName, slot, roomSubjects }

async function openInvigilatorReplaceModal(room, currentName, slot) {
    _replaceCtx = { room, currentName, slot };

    // Collect exam subjects for this room (for subject constraint)
    const seatingData = JSON.parse(sessionStorage.getItem('seatingData') || '[]');
    const roomSubjects = new Set();
    seatingData.forEach(row => {
        if (row.classroom !== room) return;
        if (row.seat1?.subject) roomSubjects.add(row.seat1.subject.trim().toLowerCase());
        if (row.seat2?.subject) roomSubjects.add(row.seat2.subject.trim().toLowerCase());
    });
    _replaceCtx.roomSubjects = roomSubjects;

    const modal = document.getElementById('invigilatorReplaceModal');
    const titleEl = document.getElementById('invigModalTitle');
    const gridEl = document.getElementById('invigModalGrid');
    const searchEl = document.getElementById('invigModalSearch');

    titleEl.textContent = currentName
        ? `Replace: ${currentName} → ${room}`
        : `Assign invigilator for ${room}`;
    gridEl.innerHTML = '<p style="color:#6b7280;">Loading...</p>';
    searchEl.value = '';
    modal.style.display = 'flex';

    // Fetch available invigilators for the same date + slot
    const tableMetadata = JSON.parse(sessionStorage.getItem('tableMetadata') || localStorage.getItem('tableMetadata') || '{}');
    const examDate = tableMetadata.examDateISO || tableMetadata.examDate || '';

    try {
        let query = db.collection('invigilators');
        if (examDate) query = query.where('date', '==', examDate);
        const snap = await query.get();

        function normSlot(s) {
            const u = String(s||'').toUpperCase().replace(/[^A-Z]/g,'');
            if (u.startsWith('A')) return 'AN';
            if (u.startsWith('F')) return 'FN';
            return u.substring(0,2) || 'FN';
        }

        // Collect all names currently assigned to OTHER rooms
        const roomInvigilators = JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}');
        const assignedElsewhere = new Set();
        Object.entries(roomInvigilators).forEach(([r, names]) => {
            if (r === room) return; // allow re-selecting for same room
            (names || []).forEach(n => assignedElsewhere.add(n));
        });

        // Fetch faculty subjects for constraint
        let facultySubjectsMap = new Map();
        if (typeof window.fetchFacultySubjectsMap === 'function') {
            facultySubjectsMap = await window.fetchFacultySubjectsMap();
        }

        // Deduplicate by name; apply slot filter + assigned-elsewhere filter
        const seen = new Set();
        const candidates = [];
        snap.docs.forEach(doc => {
            const d = doc.data();
            if (normSlot(d.slot) !== slot) return;
            if (seen.has(d.name)) return;
            seen.add(d.name);

            const taughtSubjects = facultySubjectsMap.get(d.name) || new Set();
            let blocked = false;
            for (const sub of roomSubjects) {
                if (taughtSubjects.has(sub)) { blocked = true; break; }
            }

            const takenElsewhere = assignedElsewhere.has(d.name) && d.name !== currentName;
            candidates.push({ name: d.name, department: d.department, blocked, takenElsewhere });
        });

        candidates.sort((a, b) => a.name.localeCompare(b.name));
        _replaceCtx.candidates = candidates;
        renderInvigGrid(candidates, searchEl.value);

        searchEl.oninput = () => renderInvigGrid(_replaceCtx.candidates, searchEl.value);
    } catch(err) {
        gridEl.innerHTML = `<p style="color:red;">Error loading: ${err.message}</p>`;
    }
}

function renderInvigGrid(candidates, query) {
    const gridEl = document.getElementById('invigModalGrid');
    const q = query.trim().toLowerCase();
    const filtered = q
        ? candidates.filter(c => c.name.toLowerCase().includes(q) || (c.department || '').toLowerCase().includes(q))
        : candidates;

    if (filtered.length === 0) {
        gridEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No matching invigilators found.</p>';
        return;
    }

    gridEl.innerHTML = filtered.map(c => {
        const isCurrently = c.name === _replaceCtx.currentName;
        if (c.blocked) {
            return `<div style="padding:10px 14px;border:1.5px solid #fde8e8;border-radius:8px;background:#fff5f5;opacity:0.6;cursor:not-allowed;" title="Cannot assign — teaches a subject being examined in this room">
                <div style="font-size:13px;font-weight:600;color:#dc2626;">${c.name}</div>
                <div style="font-size:11px;color:#ef4444;margin-top:2px;">⛔ Subject conflict</div>
            </div>`;
        }
        if (c.takenElsewhere) {
            return `<div style="padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;background:#f9fafb;opacity:0.55;cursor:not-allowed;" title="Already assigned to another room">
                <div style="font-size:13px;font-weight:600;color:#9ca3af;">${c.name}</div>
                <div style="font-size:11px;color:#9ca3af;margin-top:2px;">🔒 Assigned elsewhere</div>
            </div>`;
        }
        return `<div onclick="selectInvigilatorReplacement('${c.name.replace(/'/g,"\\'")}', '${c.department || ''}')"
                     style="padding:10px 14px;border:1.5px solid ${isCurrently ? '#4a90e2' : '#e5e7eb'};border-radius:8px;background:${isCurrently ? '#e8f1ff' : 'white'};cursor:pointer;transition:all 0.15s;"
                     onmouseover="this.style.borderColor='#4a90e2';this.style.background='#eff6ff'"
                     onmouseout="this.style.borderColor='${isCurrently ? '#4a90e2' : '#e5e7eb'}';this.style.background='${isCurrently ? '#e8f1ff' : 'white'}'">
            <div style="font-size:13px;font-weight:600;color:#1a202c;">${c.name}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">${c.department || '—'} ${isCurrently ? '· <span style="color:#4a90e2;">current</span>' : ''}</div>
        </div>`;
    }).join('');
}

function selectInvigilatorReplacement(newName, department) {
    const { room, currentName } = _replaceCtx;
    const roomInvigilators = JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}');
    const list = roomInvigilators[room] || [];

    if (currentName && list.includes(currentName)) {
        // Replace the specific one
        const idx = list.indexOf(currentName);
        list[idx] = newName;
    } else if (!currentName) {
        // Adding new (+ Assign link)
        if (list.length < 2) list.push(newName);
        else list[0] = newName; // replace first if already 2
    } else {
        // Current name not found — just add/replace
        if (list.length < 2) list.push(newName);
        else list[0] = newName;
    }

    roomInvigilators[room] = list;
    sessionStorage.setItem('roomInvigilators', JSON.stringify(roomInvigilators));

    closeInvigilatorReplaceModal();

    // Refresh the invigilator bar for this room only
    const slot = _replaceCtx.slot;
    const bar = document.getElementById(`invig-bar-${CSS.escape(room)}`);
    if (bar) {
        const badges = list.map(n => buildInvigilatorBadge(room, n, slot)).join(' ');
        bar.innerHTML = badges || `<span style="color:#9ca3af;">No invigilators assigned</span>`;
    }
}

function closeInvigilatorReplaceModal() {
    document.getElementById('invigilatorReplaceModal').style.display = 'none';
}

// ─── Export Table PDF (multi-room format) ─────────────────────────────────────
function exportTablePDF() {
    const meta = JSON.parse(sessionStorage.getItem('tableMetadata') || localStorage.getItem('tableMetadata') || '{}');
    const data = JSON.parse(sessionStorage.getItem('seatingData') || '[]');
    const rooms = meta.selectedRooms && meta.selectedRooms.length
        ? meta.selectedRooms
        : [...new Set(data.map(r => r.classroom).filter(Boolean))];
    _doExportTablePDF(data, rooms, meta);
}

function _doExportTablePDF(seatingData, rooms, meta) {
    const { jsPDF } = window.jspdf;

    const fmtTime = t => {
        if (!t) return '';
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        return `${hr % 12 || 12}.${m} ${hr < 12 ? 'am' : 'pm'}`;
    };
    const yearMap = {'1st Year':'I','2nd Year':'II','3rd Year':'III','4th Year':'IV'};

    const examTime    = meta.examTime || '';
    const examEndTime = meta.examEndTime || '';
    const isFN        = examTime < '13:00';
    const slotLabel   = isFN ? 'Forenoon' : 'Afternoon';
    const timeStr     = examTime ? `${slotLabel}: ${fmtTime(examTime)} to ${fmtTime(examEndTime)}` : slotLabel;

    const years   = Array.isArray(meta.years) ? meta.years : [];
    const yearStr = years.map(y => yearMap[y] || y).join(' & ');
    const semNum  = parseInt(((meta.semester || '').match(/(\d+)/) || [])[1]) || 0;
    const semRoman = ['','I','II','III','IV'][semNum] || '';

    let midLabel = '';
    if (meta.yearData) {
        const mids = [...new Set(Object.values(meta.yearData).map(d => d.mid || ''))].filter(Boolean);
        if (mids.length) {
            const raw = mids[0];
            if (/sem/i.test(raw)) midLabel = 'End Examinations';
            else { const mn = (raw.match(/\d+/)||[])[0]; midLabel = `Mid-${['','I','II','III'][parseInt(mn)]||mn} Examinations`; }
        }
    }

    const iso = meta.examDate || meta.examDateISO || '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthYear = /^\d{4}-\d{2}/.test(iso) ? `${months[parseInt(iso.split('-')[1])-1]}/${iso.split('-')[0]}` : '';
    const dateDisplay = iso ? iso.split('-').reverse().join('-') : '';

    const line2 = [[yearStr?`${yearStr} B.Tech`:'', semRoman?`${semRoman} SEM`:'', midLabel, monthYear?`${monthYear}`:''].filter(Boolean).join(' ')].join('');

    // ── Per-room: collect flat list of all roll numbers ────────────────────────
    // 2 columns × 14 rows = 28 slots per room block. Each slot = one roll number.
    const ROWS_PER_COL = 14;
    const COLS_PER_ROOM = 2;
    const SLOTS_PER_ROOM = ROWS_PER_COL * COLS_PER_ROOM; // 28

    const roomData = rooms.map(room => {
        const seats = seatingData.filter(r => r.classroom === room);
        // Flatten all roll numbers in order: seat1 bench1, seat2 bench1, seat1 bench2 ...
        const rolls = [];
        seats.forEach(b => {
            if (b.seat1 && b.seat1.rollNo) rolls.push(b.seat1.rollNo);
            if (b.seat2 && b.seat2.rollNo) rolls.push(b.seat2.rollNo);
        });
        return { room, rolls };
    });

    // ── Page constants ─────────────────────────────────────────────────────────
    const PAGE_W    = 297;
    const PAGE_H    = 210;
    const M         = 5;
    const HEADER_H  = 21;
    const ROW_H     = 4.6;
    const HEAD_H    = 5.0;
    const FONT_SZ   = 5.0;
    const CONTENT_W = PAGE_W - 2 * M;
    const CONTENT_H = PAGE_H - M - HEADER_H - M;

    // Each "room block" = 2 sub-columns. Min sub-col width to fit a roll number ~13mm
    const MIN_SUBCOL   = 12.5;
    const MAX_ROOMS_ACROSS = Math.floor(CONTENT_W / (MIN_SUBCOL * COLS_PER_ROOM));

    // How many bands (rows of room groups) needed?
    // Each band height = HEAD_H + ROWS_PER_COL * ROW_H
    const BAND_H = HEAD_H + ROWS_PER_COL * ROW_H;  // ~69.4mm
    const MAX_BANDS = Math.floor(CONTENT_H / BAND_H); // how many bands fit vertically

    // Rooms across per band: spread all rooms as evenly as possible across bands
    // to fit on one page
    const bandsNeeded = Math.ceil(roomData.length / MAX_ROOMS_ACROSS);
    const roomsAcross = bandsNeeded <= MAX_BANDS
        ? Math.ceil(roomData.length / bandsNeeded)  // spread evenly
        : MAX_ROOMS_ACROSS;                          // max that fits; may need 2nd page

    // ── Create doc ─────────────────────────────────────────────────────────────
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setLineWidth(0.3);
    doc.setTextColor(0);

    // ── Page header ────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BVRIT HYDERABAD College of Engineering for Women', PAGE_W/2, M+5, {align:'center'});
    doc.setFontSize(9);
    doc.text(line2, PAGE_W/2, M+11, {align:'center'});
    doc.setFontSize(10);
    doc.text(dateDisplay ? `${dateDisplay} ${isFN?'FN':'AN'}` : (isFN?'FN':'AN'),
             PAGE_W * 0.25, M+17.5, {align:'center'});
    doc.text(timeStr, PAGE_W * 0.72, M+17.5, {align:'center'});
    doc.setDrawColor(0);
    doc.line(M, M+19.5, PAGE_W-M, M+19.5);

    // ── Draw room bands ────────────────────────────────────────────────────────
    let bandY = M + HEADER_H;
    let pageRoomIdx = 0;

    while (pageRoomIdx < roomData.length) {
        const bandRooms = roomData.slice(pageRoomIdx, pageRoomIdx + roomsAcross);
        const bandCount = bandRooms.length;
        const roomBlockW = CONTENT_W / bandCount;
        const subColW    = roomBlockW / COLS_PER_ROOM;

        // Check if we need a new page
        if (bandY + BAND_H > PAGE_H - M + 1) {
            doc.addPage();
            bandY = M;
        }

        bandRooms.forEach((rd, ri) => {
            const x = M + ri * roomBlockW;

            // Room name header
            doc.setFillColor(210, 210, 210);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.rect(x, bandY, roomBlockW, HEAD_H, 'FD');
            doc.setTextColor(0);
            doc.text(rd.room, x + roomBlockW/2, bandY + HEAD_H - 1.2, {align:'center'});

            // Data rows: col 0 = rolls[0..13], col 1 = rolls[14..27]
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FONT_SZ);

            for (let col = 0; col < COLS_PER_ROOM; col++) {
                for (let row = 0; row < ROWS_PER_COL; row++) {
                    const rollIdx = col * ROWS_PER_COL + row;
                    const roll    = rd.rolls[rollIdx] || '';
                    const cx      = x + col * subColW;
                    const ry      = bandY + HEAD_H + row * ROW_H;

                    // Alternating shade
                    if (row % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(cx, ry, subColW, ROW_H, 'F'); }
                    doc.setDrawColor(160,160,160);
                    doc.rect(cx, ry, subColW, ROW_H);
                    if (roll) {
                        doc.setTextColor(0);
                        doc.text(roll, cx + 1, ry + ROW_H - 1.2);
                    }
                }
            }

            // Outer border
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.rect(x, bandY, roomBlockW, HEAD_H + ROWS_PER_COL * ROW_H);
            doc.setLineWidth(0.3);
        });

        bandY += BAND_H + 2;
        pageRoomIdx += roomsAcross;
    }

    doc.save(`seating-table-${iso || 'export'}.pdf`);
}

function displayOverflow(students, additionalClassrooms) {
    const overflowSeating = allocateOverflowSeats(students, additionalClassrooms);
    
    const roomGroups = {};
    overflowSeating.forEach(row => {
        const roomName = `Overflow-Class-${row.classroom}`;
        if (!roomGroups[roomName]) roomGroups[roomName] = [];
        roomGroups[roomName].push(row);
    });
    
    const actualClassroomsUsed = Object.keys(roomGroups).length;
    
    let html = `<div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); border-radius: 15px; border: 2px solid #ffc107; box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);">
        <h3 style="color: #856404; font-size: 1.4em; margin-bottom: 10px;">⚠️ Additional Classrooms Needed: ${actualClassroomsUsed}</h3>
        <p style="color: #856404; font-size: 1.1em;">📊 Total overflow students: ${students.length}</p>
    </div>`;
    
    const sortedRoomNames = Object.keys(roomGroups).sort((a, b) => {
        const numA = parseInt(a.split('-')[2]);
        const numB = parseInt(b.split('-')[2]);
        return numA - numB;
    });
    
    sortedRoomNames.forEach(roomName => {
        const roomSeats = roomGroups[roomName];
        const col1 = roomSeats.slice(0, 7);
        const col2 = roomSeats.slice(7, 14);
        const col3 = roomSeats.slice(14, 21);
        const col4 = roomSeats.slice(21, 28);
        
        html += `
            <div class="classroom-table" style="margin-top: 30px;">
                <h3 style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);">🏫 ${roomName}</h3>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 10px;">
        `;
        
        [col1, col2, col3, col4].forEach((column) => {
            html += `<table><tbody>`;
            
            column.forEach(row => {
                html += `
                    <tr>
                        <td>${row.seat1.rollNo}</td>
                        <td>${row.seat2 ? row.seat2.rollNo : '-'}</td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
        });
        
        html += `</div></div>`;
    });
    
    document.getElementById('tableContainer').innerHTML += html;
}

function allocateOverflowSeats(students, classrooms) {
    const result = [];
    let currentRoom = 1;
    let currentBench = 1;
    
    const remaining = [...students];
    
    while (remaining.length > 0) {
        const student1 = remaining.shift();
        let student2 = null;
        
        // Try to find a partner with different subject
        for (let j = 0; j < remaining.length; j++) {
            if (remaining[j].subject !== student1.subject) {
                student2 = remaining[j];
                remaining.splice(j, 1);
                break;
            }
        }
        
        result.push({
            classroom: currentRoom,
            bench: currentBench,
            seat1: student1,
            seat2: student2
        });
        
        currentBench++;
        if (currentBench > 28) {
            currentRoom++;
            currentBench = 1;
        }
    }
    
    return result;
}

async function saveData() {
    if (isSaveInProgress) return;

    const seatingData = JSON.parse(sessionStorage.getItem('seatingData'));
    const tableMetadata = JSON.parse(sessionStorage.getItem('tableMetadata') || localStorage.getItem('tableMetadata') || 'null');
    
    if (!seatingData || !tableMetadata) {
        alert('❌ No data to save!');
        return;
    }
    
    // Generate table name
    const branches = Array.isArray(tableMetadata.branches) ? tableMetadata.branches : [];
    const branchesStr = branches.length > 0 ? branches.join('-') : 'No-Branches';
    const yearLabel = Array.isArray(tableMetadata.years) ? tableMetadata.years.join('_') : (tableMetadata.year || 'Multi-Year');
    const midLabels = tableMetadata.yearData
        ? Object.entries(tableMetadata.yearData).map(([year, data]) => `${year}-${data.mid || 'NoMid'}`).join('_')
        : (tableMetadata.mid || 'NoMid');
    const defaultTableName = `${yearLabel}_${midLabels}_${tableMetadata.examDateISO}_${tableMetadata.examTime}_${branchesStr}`;
    
    const tableName = prompt('Enter table name:', defaultTableName);
    if (!tableName || !tableName.trim()) return;

    isSaveInProgress = true;
    const saveButton = document.querySelector('.download-buttons button');
    if (saveButton) saveButton.disabled = true;
    showSaveProgress();

    window.isSavingData = true;
    console.log('💾 Saving table to Firebase...');
    
    try {
        // Check for conflicts (same date + time + overlapping branches)
        updateSaveProgress(25, 'Checking schedule', 'Looking for existing tables at this date and time…');
        const conflictSnapshot = await db.collection('examTables')
            .where('examDateISO', '==', tableMetadata.examDateISO)
            .where('examTime', '==', tableMetadata.examTime)
            .get();
        
        let conflictingTable = null;
        conflictSnapshot.forEach(doc => {
            const existingTable = doc.data();
            const existingBranches = Array.isArray(existingTable.branches) ? existingTable.branches : [];
            const hasOverlap = existingBranches.some(branch => branches.includes(branch));
            if (hasOverlap) {
                conflictingTable = { id: doc.id, data: existingTable };
            }
        });
        
        if (conflictingTable) {
            updateSaveProgress(45, 'Checking overlap', 'Reviewing tables that share the selected branches…');
            const existingBranches = Array.isArray(conflictingTable.data.branches) ? conflictingTable.data.branches : [];
            const overlappingBranches = existingBranches.filter(branch => branches.includes(branch));
            const replace = confirm(`⚠️ ${overlappingBranches.join(', ')} already has exam at this time.\n\nExisting table: ${conflictingTable.data.tableName}\n\nDo you want to replace it?`);
            
            if (!replace) {
                dismissSaveProgress();
                return;
            }
            
            // Delete conflicting table
            updateSaveProgress(65, 'Replacing table', 'Removing the previous table before saving this arrangement…');
            await db.collection('examTables').doc(conflictingTable.id).delete();
            console.log('✅ Deleted conflicting table');
        }
        
        // Save table metadata and seating data
        const tableId = Date.now().toString();
        updateSaveProgress(82, 'Saving table', 'Writing seating details to the database…');
        await db.collection('examTables').doc(tableId).set({
            tableName: tableName.trim(),
            ...tableMetadata,
            createdAt: new Date().toISOString(),
            seatingData: seatingData,
            roomInvigilators: JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}')
        });
        
        console.log('✅ Table saved to Firebase');
        updateSaveProgress(100, 'Complete', 'Your seating table has been saved successfully.');
        document.getElementById('saveProgressTitle').textContent = 'Table saved';
        window.isSavingData = false;
        window.setTimeout(() => {
            window.location.href = 'admin.html';
        }, 900);
        
    } catch (error) {
        console.error('❌ Firebase error:', error);
        window.isSavingData = false;
        updateSaveProgress(82, 'Save failed', `Could not save the table: ${error.message}`);
        document.getElementById('saveProgressDismiss').hidden = false;
    }
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.text('Exam Seating Arrangement', 14, 15);
    
    const tableData = seatingData.map(row => [
        row.classroom,
        row.bench,
        row.seat1.rollNo,
        row.seat1.name,
        row.seat1.section,
        row.seat1.subject,
        row.seat2 ? row.seat2.rollNo : '-',
        row.seat2 ? row.seat2.name : '-',
        row.seat2 ? row.seat2.section : '-',
        row.seat2 ? row.seat2.subject : '-'
    ]);
    
    doc.autoTable({
        head: [['Room', 'Bench', 'Roll', 'Name', 'Section', 'Subject', 'Roll', 'Name', 'Section', 'Subject']],
        body: tableData,
        startY: 20,
        styles: { fontSize: 7 }
    });
    
    if (overflowData.length > 0) {
        doc.addPage();
        doc.text('Overflow Students - Additional Classrooms', 14, 15);
        const additionalClassrooms = Math.ceil(overflowData.length / 64);
        const overflowSeating = allocateOverflowSeats(overflowData, additionalClassrooms);
        
        const overflowTableData = overflowSeating.map(row => [
            `Class ${row.classroom}`,
            row.bench,
            row.seat1.rollNo,
            row.seat1.name,
            row.seat1.section,
            row.seat1.subject,
            row.seat2 ? row.seat2.rollNo : '-',
            row.seat2 ? row.seat2.name : '-',
            row.seat2 ? row.seat2.section : '-',
            row.seat2 ? row.seat2.subject : '-'
        ]);
        
        doc.autoTable({
            head: [['Room', 'Bench', 'Roll', 'Name', 'Section', 'Subject', 'Roll', 'Name', 'Section', 'Subject']],
            body: overflowTableData,
            startY: 25,
            styles: { fontSize: 7 }
        });
    }
    
    doc.save('seating-arrangement.pdf');
}

function shuffleArrangement() {
    const sections = JSON.parse(sessionStorage.getItem('sections'));
    const shuffled = [...sections].sort(() => Math.random() - 0.5);
    
    const classroomMapping = {};
    sections.forEach((sec, idx) => {
        classroomMapping[sec.name] = shuffled[idx].name;
    });
    
    seatingData.forEach(seat => {
        seat.classroom = classroomMapping[seat.classroom];
    });
    
    sessionStorage.setItem('seatingData', JSON.stringify(seatingData));
    sessionStorage.setItem('sections', JSON.stringify(shuffled));
    
    displayClassroomTables(seatingData, shuffled);
    
    if (overflowData.length > 0) {
        const additionalClassrooms = Math.ceil(overflowData.length / 64);
        displayOverflow(overflowData, additionalClassrooms);
    }
}

function downloadExcel() {
    const data = seatingData.map(row => ({
        'Classroom': row.classroom,
        'Bench': row.bench,
        'Seat1 Roll No': row.seat1.rollNo,
        'Seat1 Name': row.seat1.name,
        'Seat1 Section': row.seat1.section,
        'Seat1 Subject': row.seat1.subject,
        'Seat2 Roll No': row.seat2 ? row.seat2.rollNo : '-',
        'Seat2 Name': row.seat2 ? row.seat2.name : '-',
        'Seat2 Section': row.seat2 ? row.seat2.section : '-',
        'Seat2 Subject': row.seat2 ? row.seat2.subject : '-'
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Main Seating');
    
    if (overflowData.length > 0) {
        const additionalClassrooms = Math.ceil(overflowData.length / 64);
        const overflowSeating = allocateOverflowSeats(overflowData, additionalClassrooms);
        
        const overflowExcelData = overflowSeating.map(row => ({
            'Classroom': `Class ${row.classroom}`,
            'Bench': row.bench,
            'Seat1 Roll No': row.seat1.rollNo,
            'Seat1 Name': row.seat1.name,
            'Seat1 Section': row.seat1.section,
            'Seat1 Subject': row.seat1.subject,
            'Seat2 Roll No': row.seat2 ? row.seat2.rollNo : '-',
            'Seat2 Name': row.seat2 ? row.seat2.name : '-',
            'Seat2 Section': row.seat2 ? row.seat2.section : '-',
            'Seat2 Subject': row.seat2 ? row.seat2.subject : '-'
        }));
        
        const ws2 = XLSX.utils.json_to_sheet(overflowExcelData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Overflow Seating');
    }
    
    XLSX.writeFile(wb, 'seating-arrangement.xlsx');
}
