// Get roll number from URL
const urlParams = new URLSearchParams(window.location.search);
const rollNo = urlParams.get('roll');

if (!rollNo) {
    alert('⚠️ No roll number provided');
    window.location.href = 'index.html';
} else {
    // Load rooms cache in parallel with seat search so board+door layout is available
    const roomsReady = (typeof loadRoomsFromFirestore === 'function')
        ? loadRoomsFromFirestore().catch(() => {})
        : Promise.resolve();
    searchSeat(rollNo, roomsReady);
}

function toLocalISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseExamDateTime(table) {
    if (!table.examDateISO || !table.examTime) {
        return null;
    }

    const [year, month, day] = table.examDateISO.split('-').map(Number);
    const [hours, minutes] = table.examTime.split(':').map(Number);

    if ([year, month, day, hours, minutes].some(value => Number.isNaN(value))) {
        return null;
    }

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function showNotFound(message) {
    document.getElementById('loadingSection').style.display = 'none';
    const notFound = document.getElementById('notFoundSection');
    notFound.style.display = 'block';
    notFound.innerHTML = `<p style="text-align: center;">${message}</p><button onclick="goBack()" style="margin-top: 20px;">🏠 Go Back</button>`;
}

function findSeat(table, rollLower) {
    return (table.seatingData || []).find(seat =>
        (seat.seat1 && seat.seat1.rollNo.toLowerCase() === rollLower) ||
        (seat.seat2 && seat.seat2.rollNo.toLowerCase() === rollLower)
    );
}

function showSeatResult(table, seat, rollLower) {
    const studentSeat = seat.seat1 && seat.seat1.rollNo.toLowerCase() === rollLower ? seat.seat1 : seat.seat2;
    const seatNum = seat.seat1 && seat.seat1.rollNo.toLowerCase() === rollLower ? 1 : 2;
    const benchNo = seat.bench || 0;

    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('rollNumber').textContent = studentSeat.rollNo;
    document.getElementById('subject').textContent = studentSeat.subject || 'N/A';
    document.getElementById('examDate').textContent = table.examDate || table.examDateISO || 'N/A';
    document.getElementById('examTime').textContent = table.examTime || 'N/A';
    document.getElementById('classroom').textContent = seat.classroom || 'N/A';
    document.getElementById('bench').textContent = benchNo || 'N/A';
    document.getElementById('classroomLabel').textContent = seat.classroom || '';

    // Invigilator info intentionally not shown to students
    const invigilatorRow = document.getElementById('invigilatorRow');
    if (invigilatorRow) invigilatorRow.style.display = 'none';

    renderLayout(benchNo, seatNum, seat.classroom);
}

function renderLayout(benchNo, seatNum, roomName) {
    const grid = document.getElementById('classroomLayout');
    grid.innerHTML = '';
    if (!benchNo || benchNo < 1) {
        grid.innerHTML = '<p style="color:#a0aec0;text-align:center;">Layout unavailable</p>';
        return;
    }

    // Get door positions from rooms cache
    let doors = ['Tr'];
    if (typeof getRoomRecord === 'function' && roomName) {
        const rec = getRoomRecord(roomName);
        if (rec && rec.doors && rec.doors.length) doors = rec.doors;
    }

    const COLS = 4;
    const ROWS = Math.ceil(Math.max(28, benchNo) / COLS);  // 7 for normal rooms

    // ── Dimensions (all in px, will be rendered as SVG units) ─────────────────
    const DESK_W    = 72;   // width of the desk rectangle
    const DESK_H    = 22;   // height of the desk rectangle
    const SEAT_W    = 28;   // width of each seat bump
    const SEAT_H    = 14;   // height of seat bump
    const SEAT_GAP  = 6;    // gap between two seats under a desk
    const BENCH_H   = DESK_H + SEAT_H + 4; // total bench unit height (desk + gap + seats)
    const COL_GAP   = 28;   // horizontal gap between columns
    const ROW_GAP   = 18;   // vertical gap between rows
    const WALL      = 18;   // wall thickness / padding around benches
    const BOARD_H   = 26;   // height of board area at top
    const NOTCH_W   = 52;   // width of door notch
    const NOTCH_H   = 14;   // depth of door notch cut

    const innerW = COLS * DESK_W + (COLS - 1) * COL_GAP;
    const innerH = ROWS * BENCH_H + (ROWS - 1) * ROW_GAP;

    const totalW = innerW + WALL * 2;
    const totalH = BOARD_H + innerH + WALL * 2;

    // ── Build room border path with notch(es) ──────────────────────────────────
    // Clockwise from top-left. A notch is a rectangular cutout in the wall.
    function notchPath(W, H, doorList) {
        const nw = NOTCH_W, nh = NOTCH_H;
        // notch centres: Tl = 15% from left, Tr = 85% from left, Bl/Br same but bottom
        const notchPos = {
            Tl: { edge:'top',    cx: W * 0.15 },
            Tr: { edge:'top',    cx: W * 0.85 },
            Bl: { edge:'bottom', cx: W * 0.15 },
            Br: { edge:'bottom', cx: W * 0.85 },
        };

        // Build top edge segments
        let topSegs = [];   // sorted x positions of notches on top
        let botSegs = [];
        doorList.forEach(d => {
            const p = notchPos[d];
            if (!p) return;
            if (p.edge === 'top')    topSegs.push(p.cx);
            if (p.edge === 'bottom') botSegs.push(p.cx);
        });
        topSegs.sort((a,b) => a-b);
        botSegs.sort((a,b) => a-b);

        let path = `M 0 0`;
        // Top edge left→right with notches
        let x = 0;
        topSegs.forEach(cx => {
            const x0 = cx - nw/2, x1 = cx + nw/2;
            path += ` L ${x0} 0 L ${x0} ${nh} L ${x1} ${nh} L ${x1} 0`;
            x = x1;
        });
        path += ` L ${W} 0`;
        // Right edge
        path += ` L ${W} ${H}`;
        // Bottom edge right→left with notches
        let bx = W;
        botSegs.slice().reverse().forEach(cx => {
            const x0 = cx - nw/2, x1 = cx + nw/2;
            path += ` L ${x1} ${H} L ${x1} ${H-nh} L ${x0} ${H-nh} L ${x0} ${H}`;
            bx = x0;
        });
        path += ` L 0 ${H}`;
        // Left edge
        path += ` Z`;
        return path;
    }

    const borderPath = notchPath(totalW, totalH, doors);

    // Door label positions
    function doorLabelPos(door, W, H) {
        switch(door) {
            case 'Tl': return { x: W*0.15, y: NOTCH_H - 3, anchor:'middle' };
            case 'Tr': return { x: W*0.85, y: NOTCH_H - 3, anchor:'middle' };
            case 'Bl': return { x: W*0.15, y: H - 2,       anchor:'middle' };
            case 'Br': return { x: W*0.85, y: H - 2,       anchor:'middle' };
        }
    }

    // ── Assemble SVG ───────────────────────────────────────────────────────────
    let svg = `<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 ${totalW} ${totalH}"
        style="width:100%;max-width:480px;height:auto;display:block;margin:0 auto;">`;

    // Room background + border
    svg += `<path d="${borderPath}" fill="#f0f4fa" stroke="#8fa7c9" stroke-width="1.5" stroke-linejoin="round"/>`;

    // Board — sits inside the top wall, centred horizontally
    const boardW  = innerW * 0.65;
    const boardX  = (totalW - boardW) / 2;
    const boardY  = NOTCH_H + (BOARD_H - NOTCH_H - 16) / 2;   // vertically centred in board zone
    svg += `<rect x="${boardX}" y="${boardY}" width="${boardW}" height="16"
               rx="3" fill="#dce8f8" stroke="#8fa7c9" stroke-width="1"/>`;
    svg += `<text x="${totalW/2}" y="${boardY + 11.5}"
               text-anchor="middle" font-size="9" font-weight="700"
               fill="#3a5a8a" letter-spacing="2" font-family="Arial,sans-serif">BOARD</text>`;

    // Door labels inside notch area
    doors.forEach(door => {
        const pos = doorLabelPos(door, totalW, totalH);
        if (!pos) return;
        svg += `<text x="${pos.x}" y="${pos.y}"
                   text-anchor="${pos.anchor}"
                   font-size="7" fill="#8fa7c9" font-family="Arial,sans-serif"
                   font-weight="600" letter-spacing="1">ENTRANCE</text>`;
    });

    // ── Benches ────────────────────────────────────────────────────────────────
    // Benches are numbered column-major: col 0 gets benches 1-ROWS, col 1 gets ROWS+1 .. 2*ROWS, etc.
    // This matches the admin results table which shows 4 columns of 7 rows.
    const startX = WALL;
    const startY = BOARD_H + WALL;

    for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
            const benchNum = col * ROWS + row + 1;
            const bx = startX + col * (DESK_W + COL_GAP);
            const by = startY + row * (BENCH_H + ROW_GAP);

            const isHL = benchNum === benchNo;

            // Desk rectangle
            const deskFill   = isHL ? '#c7d9f5' : '#d8e4f0';
            const deskStroke = isHL ? '#5a8fd4' : '#8fa7c9';
            svg += `<rect x="${bx}" y="${by}" width="${DESK_W}" height="${DESK_H}"
                       rx="4" fill="${deskFill}" stroke="${deskStroke}" stroke-width="1"/>`;

            // Two seat bumps below the desk
            const sy = by + DESK_H + 4;
            const s1x = bx + (DESK_W/2) - SEAT_W - SEAT_GAP/2;
            const s2x = bx + (DESK_W/2) + SEAT_GAP/2;

            const s1hl = isHL && seatNum === 1;
            const s2hl = isHL && seatNum === 2;

            const s1Fill = s1hl ? '#f59e0b' : (isHL ? '#c7d9f5' : '#bccfe0');
            const s2Fill = s2hl ? '#f59e0b' : (isHL ? '#c7d9f5' : '#bccfe0');
            const s1Stroke = s1hl ? '#b45309' : deskStroke;
            const s2Stroke = s2hl ? '#b45309' : deskStroke;

            svg += `<rect x="${s1x}" y="${sy}" width="${SEAT_W}" height="${SEAT_H}"
                       rx="3" fill="${s1Fill}" stroke="${s1Stroke}" stroke-width="1"/>`;
            svg += `<rect x="${s2x}" y="${sy}" width="${SEAT_W}" height="${SEAT_H}"
                       rx="3" fill="${s2Fill}" stroke="${s2Stroke}" stroke-width="1"/>`;

            // Star on highlighted seat
            if (s1hl) svg += `<text x="${s1x+SEAT_W/2}" y="${sy+SEAT_H/2+4}"
                text-anchor="middle" font-size="9" fill="#92400e" font-family="Arial,sans-serif">★</text>`;
            if (s2hl) svg += `<text x="${s2x+SEAT_W/2}" y="${sy+SEAT_H/2+4}"
                text-anchor="middle" font-size="9" fill="#92400e" font-family="Arial,sans-serif">★</text>`;
        }
    }

    svg += `</svg>`;

    // Reset any CSS grid layout so the SVG fills the container naturally
    grid.style.display = 'block';
    grid.style.overflowX = 'auto';
    grid.innerHTML = svg;
}

async function searchSeat(rollNumber, roomsReady) {
    try {
        const rollLower = rollNumber.toLowerCase();
        console.log('Searching for:', rollNumber, '→', rollLower);
        const now = new Date();
        const todayISO = toLocalISODate(now);

        const snapshot = await db.collection('examTables')
            .where('examDateISO', '==', todayISO)
            .get();

        if (snapshot.empty) {
            showNotFound('No exams scheduled for today.');
            return;
        }

        const eligibleTables = [];
        snapshot.forEach(doc => {
            const table = doc.data();
            const examDateTime = parseExamDateTime(table);
            if (!examDateTime) {
                return;
            }

            const accessStart = new Date(examDateTime.getTime() - (60 * 60 * 1000));

            // Build end time if available
            let accessEnd = null;
            if (table.examEndTime) {
                const [endHours, endMinutes] = table.examEndTime.split(':').map(Number);
                const [year, month, day] = table.examDateISO.split('-').map(Number);
                accessEnd = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);
            }

            const withinStart = now >= accessStart;
            const withinEnd = !accessEnd || now <= accessEnd;

            if (withinStart && withinEnd) {
                eligibleTables.push({ id: doc.id, ...table, examDateTime });
            }
        });

        if (eligibleTables.length === 0) {
            showNotFound('Seat details are visible only from 1 hour before exam time.');
            return;
        }

        eligibleTables.sort((a, b) => a.examDateTime - b.examDateTime);

        // Wait for rooms to finish loading so layout has door info
        if (roomsReady) await roomsReady;

        for (const table of eligibleTables) {
            const seat = findSeat(table, rollLower);
            if (seat) {
                console.log('Found student in table:', table.tableName || table.id);
                showSeatResult(table, seat, rollLower);
                return;
            }
        }

        showNotFound('No seating arrangement found for this roll number in today\'s active exam window.');
    } catch (error) {
        console.error('Error fetching seat:', error);
        alert('❌ Error fetching seat details: ' + error.message);
        showNotFound('Unable to load seat details right now.');
    }
}

function goBack() {
    window.location.href = 'index.html';
}
