let seatingData = [];
let overflowData = [];
let isSaveInProgress = false;

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

function displayClassroomTables(seatingData, sections) {
    let html = '<h2>🏫 Seating Arrangement by Classroom</h2>';
    const roomInvigilators = JSON.parse(sessionStorage.getItem('roomInvigilators') || '{}');

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
        const invigilatorHtml = invigilators.length > 0
            ? `<div style="margin-bottom:10px;padding:8px 12px;background:#f0f4ff;border-radius:6px;font-size:13px;">
                👩‍🏫 <strong>Invigilator${invigilators.length > 1 ? 's' : ''}:</strong> ${invigilators.join(', ')}
               </div>`
            : '';

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
