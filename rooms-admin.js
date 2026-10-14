/**
 * rooms-admin.js
 * Admin panel "Rooms" view.
 * Depends on rooms-data.js being loaded first.
 */

const DOOR_OPTIONS = ['Tr', 'Tl', 'Br', 'Bl'];
const DOOR_LABELS  = { Tr: 'Top-Right', Tl: 'Top-Left', Br: 'Bottom-Right', Bl: 'Bottom-Left' };
const BLOCK_ORDER  = ['SMB', 'JB', 'PB', 'OB', 'DB'];

// ─── Entry point ──────────────────────────────────────────────────────────────
async function initRoomsView() {
    const container = document.getElementById('roomsView');
    if (!container) return;
    container.innerHTML = `
        <div style="margin-bottom:24px;">
            <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1a202c;">🏫 Rooms</h1>
            <p style="margin:0;font-size:14px;color:#6b7280;">Manage all classrooms. Changes are saved to Firestore and apply immediately to room selection.</p>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
            <button onclick="openAddRoomModal()" class="ra-btn ra-btn-blue">+ Add Room</button>
            <button onclick="resetRoomsToDefaults()" class="ra-btn ra-btn-outline">↺ Reset to Defaults</button>
            <span id="roomsSaveStatus" style="font-size:13px;color:#6b7280;"></span>
        </div>
        <div id="roomsBlockList"></div>
    `;
    injectRoomsStyles();
    renderRoomsBlockList();
}

function renderRoomsBlockList() {
    const container = document.getElementById('roomsBlockList');
    if (!container) return;

    const byBlock = {};
    roomsCache.forEach(r => {
        if (!byBlock[r.block]) byBlock[r.block] = [];
        byBlock[r.block].push(r);
    });

    const blocks = BLOCK_ORDER.filter(b => byBlock[b]).concat(
        Object.keys(byBlock).filter(b => !BLOCK_ORDER.includes(b)).sort()
    );

    container.innerHTML = blocks.map(block => {
        const rooms = byBlock[block];
        return `
        <div class="ra-card" style="margin-bottom:18px;">
            <div class="ra-card-header">
                <span style="font-size:15px;font-weight:700;color:#1a202c;">${block} Block</span>
                <span style="font-size:13px;color:#6b7280;">${rooms.length} room${rooms.length!==1?'s':''}</span>
            </div>
            <div style="overflow-x:auto;">
            <table class="ra-table">
                <thead>
                    <tr>
                        <th>Room</th>
                        <th>Capacity</th>
                        <th>Door(s)</th>
                        <th>Label</th>
                        <th style="width:120px;">Preview</th>
                        <th style="width:100px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                ${rooms.map(r => `
                    <tr id="room-row-${CSS.escape(r.name)}">
                        <td><strong>${r.name}</strong></td>
                        <td>${r.capacity}</td>
                        <td>${(r.doors||['Tr']).map(d => `<span class="ra-door-badge">${d}</span>`).join(' ')}</td>
                        <td style="color:#6b7280;font-size:13px;">${r.label || '—'}</td>
                        <td>
                            <div style="transform:scale(0.28);transform-origin:top left;width:${r.cols*4}px;height:${r.rows*4+12}px;overflow:visible;">
                                ${buildRoomLayoutSVG(r, null, null, 18)}
                            </div>
                        </td>
                        <td>
                            <div style="display:flex;gap:6px;">
                                <button onclick="openEditRoomModal('${r.name.replace(/'/g,"\\'")}')" class="ra-btn ra-btn-sm ra-btn-outline">Edit</button>
                                <button onclick="confirmDeleteRoom('${r.name.replace(/'/g,"\\'")}')" class="ra-btn ra-btn-sm ra-btn-danger">Del</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
                </tbody>
            </table>
            </div>
        </div>`;
    }).join('') || '<p style="color:#9ca3af;">No rooms loaded yet.</p>';
}

// ─── Room Layout SVG ──────────────────────────────────────────────────────────
// Returns an SVG string for the room layout.
// highlightBench/highlightSeat: used on student page. Pass null for plain preview.
function buildRoomLayoutSVG(room, highlightBench, highlightSeat, cellSize) {
    const rows = room.rows || 7;
    const cols = room.cols || 4;
    const cs   = cellSize || 32;  // px per seat cell
    const seatW = cs;
    const seatH = cs * 0.7;
    const benchGap = 6;   // gap between 2 seats in a bench
    const rowGap = 8;     // gap between rows
    const colGap = 16;    // gap between columns
    const topPad = 36;    // space for board + door notch at top
    const sidePad = 20;

    const benchW = seatW * 2 + benchGap;
    const totalW = sidePad * 2 + cols * benchW + (cols - 1) * colGap;
    const totalH = topPad + rows * seatH + (rows - 1) * rowGap + sidePad;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="font-family:Arial,sans-serif;">`;

    // Room border with door notches
    const doors = room.doors || ['Tr'];
    const NOTCH = 24; // notch width
    const notchDepth = 8;
    const borderPath = buildBorderWithNotches(totalW, totalH, doors, NOTCH, notchDepth);
    svg += `<path d="${borderPath}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>`;

    // Board at top-centre
    const boardW = Math.min(totalW * 0.45, 100);
    const boardX = (totalW - boardW) / 2;
    const boardY = 10;
    svg += `<rect x="${boardX}" y="${boardY}" width="${boardW}" height="14" rx="3" fill="#1e40af" opacity="0.85"/>`;
    svg += `<text x="${totalW/2}" y="${boardY+10}" text-anchor="middle" font-size="9" fill="white" font-weight="bold">BOARD</text>`;

    // Benches
    let benchNum = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            benchNum++;
            const x = sidePad + c * (benchW + colGap);
            const y = topPad + r * (seatH + rowGap);

            const isHighlight = highlightBench === benchNum;

            // Seat 1
            const s1Fill = isHighlight && highlightSeat === 1 ? '#f59e0b' : (isHighlight ? '#dbeafe' : '#e2e8f0');
            svg += `<rect x="${x}" y="${y}" width="${seatW}" height="${seatH}" rx="3" fill="${s1Fill}" stroke="#94a3b8" stroke-width="1"/>`;
            if (isHighlight && highlightSeat === 1) {
                svg += `<text x="${x + seatW/2}" y="${y + seatH/2 + 4}" text-anchor="middle" font-size="10" fill="#92400e" font-weight="bold">★</text>`;
            }

            // Seat 2
            const s2Fill = isHighlight && highlightSeat === 2 ? '#f59e0b' : (isHighlight ? '#dbeafe' : '#e2e8f0');
            svg += `<rect x="${x + seatW + benchGap}" y="${y}" width="${seatW}" height="${seatH}" rx="3" fill="${s2Fill}" stroke="#94a3b8" stroke-width="1"/>`;
            if (isHighlight && highlightSeat === 2) {
                svg += `<text x="${x + seatW + benchGap + seatW/2}" y="${y + seatH/2 + 4}" text-anchor="middle" font-size="10" fill="#92400e" font-weight="bold">★</text>`;
            }
        }
    }

    // Door labels at notch positions
    doors.forEach(door => {
        const positions = getDoorLabelPosition(door, totalW, totalH, NOTCH);
        svg += `<text x="${positions.x}" y="${positions.y}" text-anchor="middle" font-size="9" fill="#dc2626" font-weight="bold">🚪</text>`;
    });

    svg += `</svg>`;
    return svg;
}

function buildBorderWithNotches(W, H, doors, notchW, notchDepth) {
    // Build a clockwise path for the room outline with rectangular notches cut out at door positions
    const halfNotch = notchW / 2;

    // Start top-left corner, go clockwise
    let path = `M 0 0`;

    // Top edge (left to right)
    if (doors.includes('Tl')) {
        path += ` L ${halfNotch} 0 L ${halfNotch} ${notchDepth} L ${halfNotch + notchW} ${notchDepth} L ${halfNotch + notchW} 0`;
    }
    if (doors.includes('Tr')) {
        path += ` L ${W - halfNotch - notchW} 0 L ${W - halfNotch - notchW} ${notchDepth} L ${W - halfNotch} ${notchDepth} L ${W - halfNotch} 0`;
    }
    path += ` L ${W} 0`;

    // Right edge (top to bottom)
    path += ` L ${W} ${H}`;

    // Bottom edge (right to left)
    if (doors.includes('Br')) {
        path += ` L ${W - halfNotch} ${H} L ${W - halfNotch} ${H - notchDepth} L ${W - halfNotch - notchW} ${H - notchDepth} L ${W - halfNotch - notchW} ${H}`;
    }
    if (doors.includes('Bl')) {
        path += ` L ${halfNotch + notchW} ${H} L ${halfNotch + notchW} ${H - notchDepth} L ${halfNotch} ${H - notchDepth} L ${halfNotch} ${H}`;
    }
    path += ` L 0 ${H}`;

    // Left edge (bottom to top)
    path += ` Z`;

    return path;
}

function getDoorLabelPosition(door, W, H, notchW) {
    const halfNotch = notchW / 2;
    switch (door) {
        case 'Tl': return { x: halfNotch + notchW / 2, y: -2 };
        case 'Tr': return { x: W - halfNotch - notchW / 2, y: -2 };
        case 'Br': return { x: W - halfNotch - notchW / 2, y: H + 10 };
        case 'Bl': return { x: halfNotch + notchW / 2, y: H + 10 };
        default:   return { x: W / 2, y: -2 };
    }
}

// ─── Add / Edit Room Modal ────────────────────────────────────────────────────
function openAddRoomModal() {
    showRoomModal({ block:'', number:'', capacity:28, doors:['Tr'], label:'' }, false);
}

function openEditRoomModal(name) {
    const r = getRoomRecord(name);
    if (!r) return;
    showRoomModal({ ...r }, true);
}

function showRoomModal(room, isEdit) {
    const existing = document.getElementById('roomEditModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'roomEditModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;';

    const selectedDoors = new Set(room.doors || ['Tr']);

    modal.innerHTML = `
    <div style="background:white;border-radius:14px;padding:28px;width:min(520px,96vw);max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;font-size:17px;font-weight:700;">${isEdit ? `Edit Room: ${room.name}` : 'Add New Room'}</h3>
            <button onclick="document.getElementById('roomEditModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>

        <div class="ra-field">
            <label>Block</label>
            <input id="rmBlock" value="${room.block}" placeholder="e.g. SMB" class="ra-input" ${isEdit ? 'disabled' : ''}>
        </div>
        <div class="ra-field">
            <label>Room Number</label>
            <input id="rmNumber" value="${room.number}" placeholder="e.g. 201" class="ra-input" ${isEdit ? 'disabled' : ''}>
        </div>
        <div class="ra-field">
            <label>Capacity (benches)</label>
            <input id="rmCapacity" type="number" min="1" max="200" value="${room.capacity}" class="ra-input">
        </div>
        <div class="ra-field">
            <label>Label (optional, e.g. Seminar Hall)</label>
            <input id="rmLabel" value="${room.label||''}" placeholder="Leave blank for normal classroom" class="ra-input">
        </div>
        <div class="ra-field">
            <label>Door Position(s) — click to toggle</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;" id="doorToggleGroup">
                ${DOOR_OPTIONS.map(d => `
                    <button type="button" id="door-btn-${d}"
                        onclick="toggleDoorBtn('${d}')"
                        class="ra-btn ${selectedDoors.has(d) ? 'ra-btn-blue' : 'ra-btn-outline'} ra-door-toggle"
                        data-active="${selectedDoors.has(d) ? 'true' : 'false'}">
                        ${d} <span style="font-size:11px;opacity:0.75;">(${DOOR_LABELS[d]})</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div id="rmPreview" style="margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#f9fafb;text-align:center;min-height:80px;">
            <p style="color:#9ca3af;font-size:13px;">Save to preview</p>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
            <button onclick="document.getElementById('roomEditModal').remove()" class="ra-btn ra-btn-outline">Cancel</button>
            <button onclick="saveRoomFromModal(${isEdit})" class="ra-btn ra-btn-blue">💾 Save Room</button>
        </div>
    </div>`;

    document.body.appendChild(modal);
    // Store the original name for edit reference
    modal.dataset.originalName = room.name || '';
}

function toggleDoorBtn(door) {
    const btn = document.getElementById(`door-btn-${door}`);
    if (!btn) return;
    const active = btn.dataset.active === 'true';
    btn.dataset.active = active ? 'false' : 'true';
    btn.className = `ra-btn ${!active ? 'ra-btn-blue' : 'ra-btn-outline'} ra-door-toggle`;
}

async function saveRoomFromModal(isEdit) {
    const modal = document.getElementById('roomEditModal');
    const block    = (document.getElementById('rmBlock').value || '').trim().toUpperCase();
    const number   = (document.getElementById('rmNumber').value || '').trim();
    const capacity = parseInt(document.getElementById('rmCapacity').value) || 28;
    const label    = (document.getElementById('rmLabel').value || '').trim();
    const doors    = DOOR_OPTIONS.filter(d => {
        const btn = document.getElementById(`door-btn-${d}`);
        return btn && btn.dataset.active === 'true';
    });

    if (!block || !number) { alert('Block and Room Number are required.'); return; }
    if (doors.length === 0) { alert('Select at least one door position.'); return; }

    const rows = capacity >= 36 ? 10 : 7;
    const cols = 4;
    const name = `${block}-${number}`;

    const record = { name, block, number, capacity, doors, label, rows, cols };

    const statusEl = document.getElementById('roomsSaveStatus');
    try {
        await saveRoomToFirestore(record);
        if (statusEl) statusEl.textContent = `✅ Saved ${name}`;
        modal.remove();
        renderRoomsBlockList();
    } catch(err) {
        alert('Error saving: ' + err.message);
    }
}

async function confirmDeleteRoom(name) {
    if (!confirm(`Remove room ${name}? This cannot be undone.`)) return;
    const statusEl = document.getElementById('roomsSaveStatus');
    try {
        await deleteRoomFromFirestore(name);
        if (statusEl) statusEl.textContent = `🗑️ Deleted ${name}`;
        renderRoomsBlockList();
    } catch(err) {
        alert('Error deleting: ' + err.message);
    }
}

async function resetRoomsToDefaults() {
    if (!confirm('This will replace ALL rooms with the defaults from touchups.md. Continue?')) return;
    const statusEl = document.getElementById('roomsSaveStatus');
    if (statusEl) statusEl.textContent = '⏳ Resetting...';
    try {
        // Delete all existing, then re-seed
        const snap = await db.collection('rooms').get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await loadRoomsFromFirestore(); // re-seeds because collection is now empty
        if (statusEl) statusEl.textContent = `✅ Reset to ${roomsCache.length} default rooms`;
        renderRoomsBlockList();
    } catch(err) {
        alert('Reset failed: ' + err.message);
        if (statusEl) statusEl.textContent = '';
    }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function injectRoomsStyles() {
    if (document.getElementById('roomsAdminStyles')) return;
    const style = document.createElement('style');
    style.id = 'roomsAdminStyles';
    style.textContent = `
        .ra-card { background:white; border:1.5px solid #e5e7eb; border-radius:12px; padding:20px; box-shadow:0 1px 4px rgba(0,0,0,0.05); }
        .ra-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .ra-table { width:100%; border-collapse:collapse; font-size:13px; }
        .ra-table th { background:#f8fafc; color:#4b5563; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; padding:8px 12px; text-align:left; border-bottom:2px solid #e5e7eb; }
        .ra-table td { padding:10px 12px; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
        .ra-table tr:last-child td { border-bottom:none; }
        .ra-table tr:hover td { background:#fafafa; }
        .ra-door-badge { display:inline-block; padding:2px 8px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:12px; font-size:11px; font-weight:700; margin:1px; }
        .ra-btn { display:inline-flex; align-items:center; gap:4px; padding:9px 18px; border-radius:7px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all 0.15s; white-space:nowrap; }
        .ra-btn-sm { padding:5px 12px; font-size:12px; }
        .ra-btn-blue { background:#2563eb; color:white; }
        .ra-btn-blue:hover { background:#1d4ed8; }
        .ra-btn-outline { background:white; color:#4b5563; border:1.5px solid #d1d5db; }
        .ra-btn-outline:hover { border-color:#4a90e2; color:#1d4ed8; }
        .ra-btn-danger { background:#fff0f0; color:#dc2626; border:1px solid #fecaca; }
        .ra-btn-danger:hover { background:#dc2626; color:white; }
        .ra-door-toggle { min-width:130px; justify-content:center; }
        .ra-field { margin-bottom:14px; }
        .ra-field label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
        .ra-input { width:100%; box-sizing:border-box; padding:9px 12px; border:1.5px solid #e0e0e0; border-radius:7px; font-size:14px; outline:none; transition:border-color 0.15s; }
        .ra-input:focus { border-color:#2563eb; }
        .ra-input:disabled { background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }
    `;
    document.head.appendChild(style);
}

// ─── Expose buildRoomLayoutSVG globally for student.js ───────────────────────
window.buildRoomLayoutSVG = buildRoomLayoutSVG;
