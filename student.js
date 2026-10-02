// Get roll number from URL
const urlParams = new URLSearchParams(window.location.search);
const rollNo = urlParams.get('roll');

if (!rollNo) {
    alert('⚠️ No roll number provided');
    window.location.href = 'index.html';
} else {
    searchSeat(rollNo);
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

    // Show invigilator if available
    const roomInvigilators = table.roomInvigilators || {};
    const invigilators = roomInvigilators[seat.classroom] || [];
    const invigilatorRow = document.getElementById('invigilatorRow');
    const invigilatorVal = document.getElementById('invigilatorValue');
    if (invigilatorRow && invigilatorVal) {
        if (invigilators.length > 0) {
            invigilatorVal.textContent = invigilators.join(', ');
            invigilatorRow.style.display = 'flex';
        } else {
            invigilatorRow.style.display = 'none';
        }
    }

    renderLayout(benchNo, seatNum);
}

function renderLayout(benchNo, seatNum) {
    const grid = document.getElementById('classroomLayout');
    grid.innerHTML = '';
    if (!benchNo || benchNo < 1) {
        grid.innerHTML = '<p style="color:#a0aec0;text-align:center;">Layout unavailable</p>';
        return;
    }

    const totalBenches = Math.max(28, benchNo);
    const benchesPerCol = 7;
    const numCols = Math.ceil(totalBenches / benchesPerCol);

    // Build 4-column grid matching results page layout
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${numCols}, auto)`;
    grid.style.gap = '8px';
    grid.style.alignItems = 'start';

    for (let col = 0; col < numCols; col++) {
        const colDiv = document.createElement('div');
        colDiv.style.display = 'flex';
        colDiv.style.flexDirection = 'column';
        colDiv.style.gap = '4px';

        for (let row = 0; row < benchesPerCol; row++) {
            const b = col * benchesPerCol + row + 1;
            if (b > totalBenches) break;

            const benchEl = document.createElement('div');
            benchEl.className = 'bench-cell';

            for (let s = 1; s <= 2; s++) {
                const seatEl = document.createElement('div');
                seatEl.className = 'seat' + (b === benchNo && s === seatNum ? ' seat-mine' : '');
                benchEl.appendChild(seatEl);
            }
            colDiv.appendChild(benchEl);
        }
        grid.appendChild(colDiv);
    }
}

async function searchSeat(rollNumber) {
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
