let selectedSemester = '';
let selectedYears = new Set();
let yearData = {}; // {year: {mid: '', branches: Set(), subjects: {}}}
let uploadedRosterRecords = [];
let occupiedRoomsForSelectedSlot = new Set();
let roomRequirementContext = { totalStudents: 0, roomsRequired: 0 };
window.isSavingData = false;

// Exposed on window so subjects-admin.js can patch it live after a save.
window.YEAR_SUBJECTS = {
    '1st Year': {
        CSE: { 'Semester 1': ['Matrices and Calculus', 'Engineering Chemistry', 'English for Skill Enhancement', 'Electronic Devices and Circuits', 'Programming for Problem Solving'],
                'Semester 2': ['Ordinary Differential Equations and Vector Calculus', 'Advanced Engineering Physics', 'Engineering Drawing and Computer Aided Drafting', 'Basic Electrical Engineering', 'Data Structures'] },
        ECE: { 'Semester 1': ['Matrices and Calculus', 'Programming for Problem Solving', 'English for Skill Enhancement', 'Advanced Engineering Physics', 'Engineering Drawing and Computer Aided Drafting'],
                'Semester 2': ['Ordinary Differential Equations and Vector Calculus', 'Engineering Chemistry', 'Network Analysis and Synthesis', 'Python Programming', 'Electronic Devices and Circuits'] },
        AIML: { 'Semester 1': ['Matrices and Calculus', 'Advanced Engineering Physics', 'Programming for Problem Solving', 'Engineering Drawing and Computer Aided Drafting', 'Basic Electrical Engineering'],
                'Semester 2': ['Ordinary Differential Equations and Vector Calculus', 'Engineering Chemistry', 'English for Skill Enhancement', 'Fundamentals of Electronics Engineering', 'Data Structures'] },
        EEE: { 'Semester 1': ['Matrices and Calculus', 'Engineering Chemistry', 'C and Data Structures', 'Analog Electronics', 'Electrical Circuits - I'],
                'Semester 2': ['Ordinary Differential Equations and Vector Calculus', 'Applied Physics', 'Electromagnetic fields', 'Computer Aided Engineering Graphics', 'Electrical Circuits - II'] }
    },
    '2nd Year': {
        CSE: { 'Semester 1': ['Discrete Mathematics', 'Computer Organization and Architecture', 'Object Oriented Programming through java', 'Software Engineering', 'Database Management Systems'],
                'Semester 2': ['Computer oriented Statistical Methods', 'Operating Systems', 'Algorithm design and Analysis', 'Computer Networks', 'Machine Learning'] },
        ECE: { 'Semester 1': ['Signals and Systems', 'Digital Logic Design', 'Control Systems', 'Data Structures', 'Numerical Methods and Complex Variables'],
                'Semester 2': ['Probability Theory and Stochastic Processes', 'Electromagnetic Fields and Transmission Lines', 'Analog and Digital Communications', 'Electronic Circuit Analysis', 'Linear and Digital IC Applications'] },
        AIML: { 'Semester 1': ['Mathematical and Statistical Foundations', 'Computer Organization and Architecture', 'Object Oriented Programming through Java', 'Software Engineering', 'Data base Management System'],
                'Semester 2': ['Discrete Mathematics', 'Operating Systems', 'Algorithm Design and Analysis', 'Computer Networks', 'Artificial Intelligence'] },
        EEE: { 'Semester 1': ['Control Systems', 'Electrical Machines - I', 'Digital Electronics', 'Power Systems - I', 'Electrical Measurements and Sensors'],
                'Semester 2': ['Numerical Methods and Complex Variables', 'Electrical Machines - II', 'Power Systems - II', 'Power Electronics', 'Microprocessors and Microcontrollers'] }
    },
    '3rd Year': {
        CSE: { 'Semester 1': ['Automata Theory and Compiler Design', 'Artificial Intelligence', 'DevOps', 'Professional Elective-I', 'Open Elective-I'],
                'Semester 2': ['Cryptography and Networks Security', 'Deep Learning', 'Business Economics and Financial Analysis', 'Professional Elective-II', 'Open Elective-II'] },
        ECE: { 'Semester 1': ['Digital Signal Processing', 'RISC and Microcontroller architectures', 'CMOS VLSI Design', 'Professional Elective-I', 'Open Elective-I'],
                'Semester 2': ['Antenna Design and Wave Propagation', 'IoT Architectures and Protocols', 'Business Economics and Financial Analysis', 'Professional Elective-II', 'Open Elective-II'] },
        AIML: { 'Semester 1': ['Machine Learning', 'Automata Theory and Compiler Design', 'Data Analytics', 'Professional Elective-I', 'Open Elective-I'],
                'Semester 2': ['Natural Language Processing', 'Deep Learning', 'Business Economics and Financial Analysis', 'Professional Elective-II', 'Open Elective-II'] },
        EEE: { 'Semester 1': ['Power Semiconductor Drives', 'Power System Protection', 'Power Electronics for Renewable Energy Systems', 'Professional Elective-I', 'Open Elective-I'],
                'Semester 2': ['Power System Operation and Control', 'Hybrid Electric Vehicles', 'Fundamentals of Management', 'Professional Elective-II', 'Open Elective-II'] }
    },
    '4th Year': {
        CSE: { 'Semester 1': ['Natural Language Processing', 'Cyber Security', 'Fundamentals of Management', 'Professional Elective-III', 'Professional Elective-IV'],
                'Semester 2': ['Professional Elective-V', 'Professional Elective-VI'] },
        ECE: { 'Semester 1': ['Microwave and Optical Communications', 'Embedded System Design', 'Fundamentals of Management for Engineers', 'Professional Elective-III', 'Professional Elective-IV'],
                'Semester 2': ['Professional Elective-V', 'Professional Elective-VI'] },
        AIML: { 'Semester 1': ['Reinforcement Learning', 'Generative AI', 'Fundamentals of Management for Engineers', 'Professional Elective-III', 'Professional Elective-IV'],
                'Semester 2': ['Professional Elective-V', 'Professional Elective-VI'] },
        EEE: { 'Semester 1': ['Smart Metering and Communication Protocols', 'EV Charging Infrastructure', 'Fundamentals of Management', 'Professional Elective-III', 'Professional Elective-IV'],
                'Semester 2': ['Professional Elective-V', 'Professional Elective-VI'] }
    }
};

const branchData = {
    CSE: { sections: ['CSE-A', 'CSE-B', 'CSE-C', 'CSE-D', 'CSE-E', 'CSE-F'] },
    ECE: { sections: ['ECE-A', 'ECE-B'] },
    AIML: { sections: ['AIML-A', 'AIML-B'] },
    EEE: { sections: ['EEE-A'] }
};

const selectedRooms = new Set();

function applyStudentSectionRecords(records) {
    records.forEach(record => {
        if (!record || !record.year || !record.branch || !record.section || !Array.isArray(record.students)) return;
        const key = `${record.year} ${record.branch} ${record.section}`;
        ROLL_NUMBERS[key] = record.students.map(student => String(student.rollNo || '').trim().toLowerCase()).filter(Boolean);
    });
}

async function loadStudentDatabaseOverrides() {
    const snapshot = await db.collection('studentSections').get();
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    uploadedRosterRecords = records;
    applyStudentSectionRecords(records);
    return records;
}

function toLocalISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getRollNumbersForYearSection(year, sectionName) {
    const normalizedSection = sectionName.replace('-', ' ');
    const fullSectionName = `${year} ${normalizedSection}`;

    const compactKey = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const wantedKey = compactKey(fullSectionName);
    const record = uploadedRosterRecords.find(item =>
        compactKey(`${item.year} ${item.branch} ${item.section}`) === wantedKey
    );
    return record && Array.isArray(record.students)
        ? record.students.map(student => String(student.rollNo || '').trim().toLowerCase()).filter(Boolean)
        : [];
}

function getStudentCountForYear(year) {
    return uploadedRosterRecords
        .filter(record => record.year === year && Array.isArray(record.students))
        .reduce((total, record) => total + record.students.length, 0);
}

function updateYearAvailabilityButtons() {
    const availableYears = [];
    document.querySelectorAll('.year-btn[data-year]').forEach(button => {
        const year = button.dataset.year;
        const count = getStudentCountForYear(year);
        const available = count > 0;
        button.textContent = `${year} (${count} students)`;
        button.hidden = false;
        button.disabled = !available;
        button.style.opacity = available ? '1' : '0.45';
        button.style.cursor = available ? 'pointer' : 'not-allowed';
        button.title = available ? `${count} saved students` : 'No saved roster for this year';
        if (available) availableYears.push(`${year}: ${count}`);
    });
    const hint = document.getElementById('yearRosterHint');
    if (hint) {
        hint.textContent = availableYears.length
            ? `Roster data available — ${availableYears.join(' · ')}`
            : 'No saved roster data. Upload student data from Students Data before generating seating.';
    }
}

function getYearSuffix(year) {
    if (year.startsWith('1st')) return '1';
    if (year.startsWith('2nd')) return '2';
    if (year.startsWith('3rd')) return '3';
    if (year.startsWith('4th')) return '4';
    return '';
}

function getPhysicalSectionRoomName(year, sectionName) {
    // With the real room database, there is no fixed section→room mapping.
    // Return null; auto-assign will simply pick from available rooms in order.
    return null;
}

function selectSemester(semester) {
    selectedSemester = semester;
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent === semester);
    });
    document.getElementById('yearSelectionSection').style.display = 'block';
    checkReady();
}

function toggleYear(year) {
    if (getStudentCountForYear(year) === 0) return;
    const btn = event.target;
    const blockId = `year-block-${year.replace(/\s/g, '-')}`;

    if (selectedYears.has(year)) {
        selectedYears.delete(year);
        btn.classList.remove('selected');
        delete yearData[year];
        document.getElementById(blockId)?.remove();
    } else {
        selectedYears.add(year);
        btn.classList.add('selected');
        yearData[year] = { mid: '', branches: new Set(), subjects: {} };
        createYearBlock(year);
    }

    checkReady();
}

function createYearBlock(year) {
    const container = document.getElementById('yearDetailsContainer');
    const blockId = `year-block-${year.replace(/\s/g, '-')}`;

    const block = document.createElement('div');
    block.className = 'year-block';
    block.id = blockId;
    block.innerHTML = `
        <h3>${year}</h3>

        <div class="form-group">
            <label>📝 Select Exam Type:</label>
            <div class="branch-count-buttons">
                <button type="button" class="count-btn" onclick="selectMid('${year}', 'Mid 1')">Mid 1</button>
                <button type="button" class="count-btn" onclick="selectMid('${year}', 'Mid 2')">Mid 2</button>
                <button type="button" class="count-btn" onclick="selectMid('${year}', 'Sem')">Sem</button>
            </div>
        </div>

        <div class="form-group" id="branches-${year.replace(/\s/g, '-')}" style="display: none;">
            <label>🎯 Select Branches:</label>
            <div class="branch-buttons">
                <button type="button" class="branch-btn" onclick="toggleBranch('${year}', 'CSE')">💻 CSE</button>
                <button type="button" class="branch-btn" onclick="toggleBranch('${year}', 'ECE')">📡 ECE</button>
                <button type="button" class="branch-btn" onclick="toggleBranch('${year}', 'AIML')">🤖 AIML</button>
                <button type="button" class="branch-btn" onclick="toggleBranch('${year}', 'EEE')">⚡ EEE</button>
            </div>
        </div>

        <div id="subjects-${year.replace(/\s/g, '-')}"></div>
    `;

    container.appendChild(block);
}

function selectMid(year, mid) {
    yearData[year].mid = mid;
    const block = document.getElementById(`year-block-${year.replace(/\s/g, '-')}`);
    block.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent === mid);
    });

    document.getElementById(`branches-${year.replace(/\s/g, '-')}`).style.display = 'block';
    checkReady();
}

function toggleBranch(year, branch) {
    const btn = event.target;

    if (yearData[year].branches.has(branch)) {
        yearData[year].branches.delete(branch);
        btn.classList.remove('selected');
        delete yearData[year].subjects[branch];
    } else {
        yearData[year].branches.add(branch);
        btn.classList.add('selected');
    }

    updateSubjects(year);
    checkReady();
}

function updateSubjects(year) {
    const container = document.getElementById(`subjects-${year.replace(/\s/g, '-')}`);
    container.innerHTML = '';

    // Use the live YEAR_SUBJECTS (which subjects-admin.js patches after every save,
    // and which is pre-populated from Firestore at page load via loadSubjectsFromFirestore).
    yearData[year].branches.forEach(branch => {
        const subjects = (YEAR_SUBJECTS[year] && YEAR_SUBJECTS[year][branch] && YEAR_SUBJECTS[year][branch][selectedSemester])
            ? YEAR_SUBJECTS[year][branch][selectedSemester]
            : [];
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>📖 ${branch} - Subject:</label>
            <select onchange="selectSubject('${year}', '${branch}', this.value)" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
                <option value="">Select Subject</option>
                ${subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('')}
            </select>
        `;
        container.appendChild(div);
    });

    const hasBranches = yearData[year].branches.size > 0;
    document.getElementById('examDetailsSection').style.display = hasBranches || anyBranchesSelected() ? 'block' : 'none';
    document.getElementById('examTimeSection').style.display = hasBranches || anyBranchesSelected() ? 'block' : 'none';
    document.getElementById('examEndTimeSection').style.display = hasBranches || anyBranchesSelected() ? 'block' : 'none';
}

function selectSubject(year, branch, subject) {
    yearData[year].subjects[branch] = subject;
    checkReady();
}

function anyBranchesSelected() {
    return Array.from(selectedYears).some(year => yearData[year] && yearData[year].branches.size > 0);
}

function hasCompleteSelection() {
    const examDate = document.getElementById('examDate')?.value;
    const examTime = document.getElementById('examTime')?.value;
    const examEndTime = document.getElementById('examEndTime')?.value;

    if (!selectedSemester || selectedYears.size === 0 || !examDate || !examTime || !examEndTime) {
        return false;
    }

    for (const year of selectedYears) {
        if (getStudentCountForYear(year) === 0) return false;
        const data = yearData[year];
        if (!data || !data.mid || data.branches.size === 0) {
            return false;
        }
        for (const branch of data.branches) {
            if (!data.subjects[branch]) {
                return false;
            }
        }
    }

    return true;
}

function resetRoomAssignmentState() {
    selectedRooms.clear();
    roomRequirementContext = { totalStudents: 0, roomsRequired: 0 };
    occupiedRoomsForSelectedSlot = new Set();
    document.getElementById('roomAssignmentSection').style.display = 'none';
    document.getElementById('roomAssignmentSection').innerHTML = '';
    document.getElementById('roomSelectionDisplay').innerHTML = '';
    document.getElementById('generateSection').style.display = 'none';
}

async function checkReady() {
    if (!hasCompleteSelection()) {
        resetRoomAssignmentState();
        return;
    }

    await refreshOccupiedRoomsForSelectedSlot();
    await calculateRoomRequirements();
}

async function refreshOccupiedRoomsForSelectedSlot() {
    const examDateISO = document.getElementById('examDate')?.value;
    const examTime = document.getElementById('examTime')?.value;

    if (!examDateISO || !examTime) {
        occupiedRoomsForSelectedSlot = new Set();
        return;
    }

    try {
        await purgeExpiredTables();

        const snapshot = await db.collection('examTables')
            .where('examDateISO', '==', examDateISO)
            .where('examTime', '==', examTime)
            .get();

        const occupied = new Set();
        snapshot.forEach(doc => {
            const table = doc.data();
            const roomList = Array.isArray(table.selectedRooms) && table.selectedRooms.length > 0
                ? table.selectedRooms
                : Array.from(new Set((table.seatingData || []).map(seat => seat.classroom).filter(Boolean)));

            roomList.forEach(room => occupied.add(room));
        });

        occupiedRoomsForSelectedSlot = occupied;
    } catch (error) {
        console.error('Error loading occupied rooms:', error);
        occupiedRoomsForSelectedSlot = new Set();
    }
}

async function purgeExpiredTables() {
    // Auto-deletion of past tables is disabled — admins manage table lifecycle manually.
    return;
    /* original logic kept for reference:
    const todayISO = toLocalISODate();
    const snapshot = await db.collection('examTables').get();
    const deletePromises = [];

    snapshot.forEach(doc => {
        const table = doc.data();
        if (table.examDateISO && table.examDateISO < todayISO) {
            deletePromises.push(db.collection('examTables').doc(doc.id).delete());
        }
    });

    if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
    }
    */
}

function getTableDisplayName(table) {
    return table.tableName || `${table.examDateISO || 'NoDate'}_${table.examTime || 'NoTime'}`;
}

function buildSortedTableList(snapshot) {
    const tables = [];
    snapshot.forEach(doc => {
        tables.push({ id: doc.id, ...doc.data() });
    });

    tables.sort((a, b) => {
        const dateA = a.examDateISO || '';
        const dateB = b.examDateISO || '';
        if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
        }

        const timeA = a.examTime || '';
        const timeB = b.examTime || '';
        return timeA.localeCompare(timeB);
    });

    return tables;
}

async function loadTablesSidebar(selectedTableId = null) {
    const sidebarList = document.getElementById('sidebarTablesList');
    if (!sidebarList) {
        return;
    }

    sidebarList.innerHTML = '<p style="margin: 0; color: #6b7280; font-size: 12px;">Loading...</p>';

    try {
        await purgeExpiredTables();
        const snapshot = await db.collection('examTables').get();
        const tables = buildSortedTableList(snapshot);

        if (tables.length === 0) {
            sidebarList.innerHTML = '<p style="margin: 0; color: #6b7280; font-size: 12px;">No tables</p>';
            return;
        }

        sidebarList.innerHTML = '';
        tables.forEach(table => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sidebar-table-item';
            if (selectedTableId && selectedTableId === table.id) {
                btn.classList.add('active');
            }
            btn.textContent = getTableDisplayName(table);
            btn.title = `${getTableDisplayName(table)} | ${table.examDate || table.examDateISO || 'N/A'} ${table.examTime || ''}`.trim();
            btn.onclick = () => showView('tables', table.id);
            sidebarList.appendChild(btn);
        });
    } catch (error) {
        console.error('Error loading sidebar tables:', error);
        sidebarList.innerHTML = '<p style="margin: 0; color: #dc3545; font-size: 12px;">Error loading tables</p>';
    }
}

async function calculateRoomRequirements() {
    const savedRecords = await loadStudentDatabaseOverrides();
    const requestedSections = [];

    selectedYears.forEach(year => {
        const data = yearData[year];
        data.branches.forEach(branch => {
            branchData[branch].sections.forEach(sectionName => {
                const section = sectionName.replace('-', ' ').split(/\s+/).pop();
                requestedSections.push({ year, branch, section });
            });
        });
    });

    const { allStudents } = buildStudentAndSectionData();
    const totalStudents = allStudents.length;
    const requiredBenches = allocateStudentsToBenches(allStudents).length;
    const escapeRosterLabel = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);

    roomRequirementContext = {
        totalStudents,
        requiredBenches,
        roomsRequired: (function() {
            const fullRooms = Math.floor(requiredBenches / 28);
            const leftoverBenches = requiredBenches % 28;
            // leftover benches fit in extra row (<=4 benches = <=8 students) → no extra room needed
            if (leftoverBenches > 0 && leftoverBenches <= 4 && fullRooms > 0) return fullRooms;
            return Math.ceil(requiredBenches / 28);
        })()
    };

    const availableRoomCount = getAllAvailableRooms().filter(room => !occupiedRoomsForSelectedSlot.has(room)).length;
    const occupiedCount = occupiedRoomsForSelectedSlot.size;
    const container = document.getElementById('roomAssignmentSection');

    container.style.display = 'block';
    container.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white;">
            <h3 style="margin: 0 0 15px 0;">🏫 Room Assignment</h3>
            <p style="margin: 5px 0;"><strong>Total Students:</strong> ${roomRequirementContext.totalStudents}</p>
            <p style="margin: 5px 0;"><strong>Rooms Required:</strong> ${roomRequirementContext.roomsRequired}</p>
            <p style="margin: 5px 0;"><strong>Already Allotted At This Time:</strong> ${occupiedCount} room(s)</p>
            <p style="margin: 5px 0;"><strong>Available For Selection:</strong> ${availableRoomCount} room(s)</p>
            ${roomRequirementContext.totalStudents > 0 ? `<div style="display: flex; gap: 15px; margin-top: 20px;">
                <button onclick="startAutoAssign(${roomRequirementContext.roomsRequired})" style="flex: 1; padding: 15px; background: white; color: #667eea; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">
                    ✨ Auto Assign
                </button>
                <button onclick="startManualAssign(${roomRequirementContext.roomsRequired})" style="flex: 1; padding: 15px; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">
                    ✋ Manual Assign
                </button>
            </div>` : `<p style="margin-top:20px;"><strong>No students found for this selection.</strong> Selected: ${Array.from(selectedYears).map(escapeRosterLabel).join(', ')} — ${Array.from(new Set(requestedSections.map(section => section.branch))).map(escapeRosterLabel).join(', ')}.</p><p>Roster source: ${uploadedRosterRecords.length ? 'uploaded data only' : 'built-in data (no uploaded roster saved)'}. Available sections: ${uploadedRosterRecords.length ? savedRecords.map(record => `${escapeRosterLabel(record.year)} ${escapeRosterLabel(record.branch)}-${escapeRosterLabel(record.section)} (${(record.students || []).length})`).join(', ') : Object.entries(ROLL_NUMBERS).filter(([key, rolls]) => Array.isArray(rolls) && rolls.length).map(([key, rolls]) => `${escapeRosterLabel(key)} (${rolls.length})`).join(', ') || 'none'}.</p>`}
        </div>
    `;

    document.getElementById('generateSection').style.display = 'none';
}

function getAllAvailableRooms() {
    // Delegates to rooms-data.js cache (loaded on page init via loadRoomsFromFirestore())
    if (typeof window.getAllAvailableRooms_rooms !== 'undefined') {
        return window.getAllAvailableRooms_rooms();
    }
    // Fallback: return from roomsCache directly (rooms-data.js is loaded)
    if (typeof roomsCache !== 'undefined' && roomsCache.length > 0) {
        return roomsCache.map(r => r.name);
    }
    // Last-resort fallback — empty (rooms not yet loaded)
    return [];
}

function showInsufficientRoomsMessage(required, available) {
    document.getElementById('roomSelectionDisplay').innerHTML = `
        <div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin-top: 20px; border: 2px solid #f56565; color: #c53030;">
            <p style="margin: 0;"><strong>Not enough free rooms.</strong> Need ${required}, but only ${available} are currently unallotted for this date and time.</p>
        </div>
    `;
    document.getElementById('generateSection').style.display = 'none';
}

async function startAutoAssign(roomsRequired) {
    await refreshOccupiedRoomsForSelectedSlot();
    selectedRooms.clear();

    // Pick the first roomsRequired free rooms from the live room list
    const freeRooms = getAllAvailableRooms()
        .filter(room => !occupiedRoomsForSelectedSlot.has(room));

    const autoSelected = freeRooms.slice(0, roomsRequired);
    autoSelected.forEach(room => selectedRooms.add(room));

    const container = document.getElementById('roomSelectionDisplay');
    container.innerHTML = `
        <h4 style="margin-top: 20px; color: #4caf50;">✨ Auto Assign - Rooms:</h4>
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p style="margin: 5px 0;"><strong>🏫 Rooms Auto-Allocated:</strong> ${selectedRooms.size} room(s)</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                ${Array.from(selectedRooms).map(room => `<span style="padding: 5px 10px; background: white; border-radius: 4px; border: 2px solid #4caf50;">${room}</span>`).join('')}
            </div>
        </div>
    `;

    const additionalRoomsNeeded = roomsRequired - selectedRooms.size;
    if (additionalRoomsNeeded > 0) {
        const extraFreeRooms = freeRooms.filter(room => !selectedRooms.has(room));
        container.innerHTML += `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #ffc107;">
                <p style="margin: 5px 0; color: #856404;"><strong>⚠️ Not enough free rooms.</strong> Need ${roomsRequired}, found ${selectedRooms.size}.</p>
                <p style="margin: 5px 0; color: #856404;">Available: ${extraFreeRooms.length} remaining unoccupied rooms.</p>
                <button onclick="selectAdditionalRooms(${additionalRoomsNeeded})" style="width: 100%; padding: 12px; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 10px;">
                    📍 Select ${additionalRoomsNeeded} Additional Room(s)
                </button>
            </div>
        `;
        document.getElementById('generateSection').style.display = 'none';
    } else {
        document.getElementById('generateSection').style.display = 'block';
    }
}

async function startManualAssign(roomsRequired) {
    await refreshOccupiedRoomsForSelectedSlot();

    const allRooms = getAllAvailableRooms();
    const availableCount = allRooms.filter(room => !occupiedRoomsForSelectedSlot.has(room)).length;
    selectedRooms.clear();

    if (availableCount < roomsRequired) {
        showInsufficientRoomsMessage(roomsRequired, availableCount);
    }

    const container = document.getElementById('roomSelectionDisplay');
    container.innerHTML = `
        <h4 style="margin-top: 20px; color: #ff9800;">✋ Manual Assign - Select ${roomsRequired} Room(s):</h4>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 10px 0;">
            <div style="background: #fff3cd; padding: 12px 15px; border-radius: 8px; border: 2px solid #ffc107;">
                <p id="manualCounter" style="margin: 0; color: #856404; font-weight: 600;">Selected: 0 / ${roomsRequired} rooms</p>
            </div>
            <div style="background: #fff5f5; padding: 12px 15px; border-radius: 8px; border: 2px solid #f56565; color: #c53030; font-weight: 600;">
                Red rooms are already allotted for this date and time
            </div>
        </div>
        <div id="roomGrid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; max-height: 450px; overflow-y: auto; padding: 15px; background: #fafafa; border-radius: 8px;"></div>
    `;

    const gridDiv = document.getElementById('roomGrid');

    allRooms.forEach(room => {
        const isOccupied = occupiedRoomsForSelectedSlot.has(room);
        const btn = document.createElement('button');
        btn.textContent = room;
        btn.disabled = isOccupied;
        btn.style.cssText = [
            'padding: 15px 10px',
            'border: 2px solid #e0e0e0',
            'background: white',
            'border-radius: 8px',
            'cursor: pointer',
            'font-weight: 600',
            'font-size: 13px',
            'color: #333'
        ].join(';');

        if (isOccupied) {
            btn.style.background = '#fed7d7';
            btn.style.borderColor = '#f56565';
            btn.style.color = '#c53030';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Already allotted in another table for this date and time';
        }

        btn.onclick = () => {
            if (selectedRooms.has(room)) {
                selectedRooms.delete(room);
                btn.style.background = 'white';
                btn.style.color = '#333';
                btn.style.borderColor = '#e0e0e0';
            } else if (selectedRooms.size < roomsRequired) {
                selectedRooms.add(room);
                btn.style.background = '#ff9800';
                btn.style.color = 'white';
                btn.style.borderColor = '#ff9800';
            } else {
                alert(`⚠️ You can only select ${roomsRequired} room(s)`);
            }

            document.getElementById('manualCounter').textContent = `Selected: ${selectedRooms.size} / ${roomsRequired} rooms`;
            document.getElementById('generateSection').style.display = selectedRooms.size === roomsRequired ? 'block' : 'none';
        };

        gridDiv.appendChild(btn);
    });
}

function selectAdditionalRooms(needed) {
    const availableRooms = getAllAvailableRooms().filter(room => !selectedRooms.has(room));
    const modal = document.getElementById('roomSelectionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalRoomList = document.getElementById('modalRoomList');

    modalTitle.textContent = `Select ${needed} Additional Room(s)`;
    const tempSelected = new Set();

    modalRoomList.innerHTML = `
        <div id="selectionCounter" style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: 600; font-size: 16px; color: #1565c0;">
            Selected: 0 / ${needed} rooms
        </div>
        <div style="background: #fff5f5; padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #f56565; color: #c53030; font-weight: 600;">
            Red rooms are already allotted for this date and time
        </div>
        <div id="additionalRoomGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding: 15px; margin-bottom: 20px; background: #fafafa; border-radius: 8px; max-height: 400px; overflow-y: auto;"></div>
        <button onclick="confirmAdditionalRooms()" style="width: 100%; padding: 16px; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 17px; margin-bottom: 10px;">
            ✅ Confirm Selection
        </button>
        <button onclick="closeRoomModal()" style="width: 100%; padding: 16px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 17px;">
            ❌ Close
        </button>
    `;

    const gridDiv = document.getElementById('additionalRoomGrid');

    availableRooms.forEach(room => {
        const isOccupied = occupiedRoomsForSelectedSlot.has(room);
        const btn = document.createElement('button');
        btn.textContent = room;
        btn.disabled = isOccupied;
        btn.style.cssText = 'padding: 12px 8px; border: 2px solid #e0e0e0; background: white; color: #333; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; min-height: 50px;';

        if (isOccupied) {
            btn.style.background = '#fed7d7';
            btn.style.borderColor = '#f56565';
            btn.style.color = '#c53030';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Already allotted in another table for this date and time';
        }

        btn.onclick = () => {
            if (tempSelected.has(room)) {
                tempSelected.delete(room);
                btn.style.background = 'white';
                btn.style.color = '#333';
                btn.style.borderColor = '#e0e0e0';
            } else if (tempSelected.size < needed) {
                tempSelected.add(room);
                btn.style.background = '#4a90e2';
                btn.style.color = 'white';
                btn.style.borderColor = '#4a90e2';
            } else {
                alert(`⚠️ You can only select ${needed} room(s)`);
            }

            document.getElementById('selectionCounter').textContent = `Selected: ${tempSelected.size} / ${needed} rooms`;
        };

        gridDiv.appendChild(btn);
    });

    window.tempSelectedRooms = tempSelected;
    window.neededRooms = needed;
    modal.style.display = 'block';
}

function confirmAdditionalRooms() {
    if (window.tempSelectedRooms.size !== window.neededRooms) {
        alert(`⚠️ Please select exactly ${window.neededRooms} room(s)`);
        return;
    }

    window.tempSelectedRooms.forEach(room => selectedRooms.add(room));

    const container = document.getElementById('roomSelectionDisplay');
    container.innerHTML += `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <h4 style="margin-top: 0; color: #1976d2;">➕ Additional Rooms Selected:</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${Array.from(window.tempSelectedRooms).map(room => `<span style="padding: 5px 10px; background: white; border-radius: 4px; border: 2px solid #2196f3;">${room}</span>`).join('')}
            </div>
        </div>
    `;

    closeRoomModal();
    document.getElementById('generateSection').style.display = 'block';
}

function closeRoomModal() {
    document.getElementById('roomSelectionModal').style.display = 'none';
}

function buildStudentAndSectionData() {
    const allStudents = [];
    const allSections = [];
    const branchSelections = [];

    selectedYears.forEach(year => {
        const data = yearData[year];
        data.branches.forEach(branch => {
            const subject = data.subjects[branch];
            branchSelections.push(`${year} ${branch}`);

            branchData[branch].sections.forEach(sectionName => {
                const rollNumbers = getRollNumbersForYearSection(year, sectionName);

                if (rollNumbers.length > 0) {
                    allSections.push({ name: sectionName, subject, year, mid: data.mid });
                    rollNumbers.forEach(rollNo => {
                        allStudents.push({
                            rollNo,
                            name: rollNo,
                            section: sectionName,
                            subject,
                            year,
                            mid: data.mid
                        });
                    });
                }
            });
        });
    });

    return { allStudents, allSections, branchSelections };
}

function generateMultiYearArrangement() {
    if (!hasCompleteSelection()) {
        alert('⚠️ Complete semester, year, exam type, branch, subject, date and time selection first.');
        return;
    }

    if (selectedRooms.size !== roomRequirementContext.roomsRequired) {
        alert(`⚠️ Please assign exactly ${roomRequirementContext.roomsRequired} room(s) before generating.`);
        return;
    }

    if (roomRequirementContext.totalStudents === 0) {
        alert('No students are saved for the selected year and branches. Upload and save the roster from the Edit section first.');
        return;
    }

    const examDate = document.getElementById('examDate').value;
    const examTime = document.getElementById('examTime').value;
    const examEndTime = document.getElementById('examEndTime').value;
    const { allStudents, branchSelections } = buildStudentAndSectionData();
    const firstYear = Array.from(selectedYears)[0];
    const examType = yearData[firstYear]?.mid || '';
    const result = allocateSeatsToClassrooms(allStudents, examType);

    // Shuffle room assignments (same as shuffle button) so rooms differ every generation
    const sections = result.sections;
    const shuffled = [...sections].sort(() => Math.random() - 0.5);
    const classroomMapping = {};
    sections.forEach((sec, idx) => {
        classroomMapping[sec.name] = shuffled[idx].name;
    });
    result.seated.forEach(seat => {
        seat.classroom = classroomMapping[seat.classroom];
    });
    result.sections = shuffled;

    const serializedYearData = JSON.parse(JSON.stringify(yearData, (key, value) => {
        return value instanceof Set ? Array.from(value) : value;
    }));

    const tableMetadata = {
        semester: selectedSemester,
        years: Array.from(selectedYears),
        branches: branchSelections,
        yearData: serializedYearData,
        examDate,
        examTime,
        examEndTime,
        examDateISO: examDate,
        selectedRooms: Array.from(selectedRooms),
        totalStudents: allStudents.length
    };

    sessionStorage.setItem('seatingData', JSON.stringify(result.seated));
    sessionStorage.setItem('overflowData', JSON.stringify(result.overflow));
    sessionStorage.setItem('sections', JSON.stringify(result.sections));
    sessionStorage.setItem('tableMetadata', JSON.stringify(tableMetadata));
    localStorage.setItem('tableMetadata', JSON.stringify(tableMetadata));

    // Navigate to results — invigilator assignment happens there on demand
    sessionStorage.setItem('roomInvigilators', JSON.stringify({}));
    window.location.href = 'results.html';
}

async function assignInvigilatorsToRooms(rooms, examDateISO, examTime) {
    try {
        const slot = examTime < '13:00' ? 'FN' : 'AN';
        function normSlot(s) {
            const u = String(s||'').toUpperCase().replace(/[^A-Z]/g,'');
            if (u.startsWith('A')) return 'AN';
            if (u.startsWith('F')) return 'FN';
            return u.substring(0,2) || 'FN';
        }

        const snapshot = await db.collection('invigilators')
            .where('date', '==', examDateISO)
            .get();

        const available = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(inv => normSlot(inv.slot) === slot);

        // Shuffle
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }

        // Fetch subject constraints
        let facultySubjectsMap = new Map();
        if (typeof window.fetchFacultySubjectsMap === 'function') {
            facultySubjectsMap = await window.fetchFacultySubjectsMap();
        }

        const seatingData = JSON.parse(sessionStorage.getItem('seatingData') || '[]');
        const roomSubjects = {};
        seatingData.forEach(row => {
            if (!row.classroom) return;
            if (!roomSubjects[row.classroom]) roomSubjects[row.classroom] = new Set();
            if (row.seat1?.subject) roomSubjects[row.classroom].add(row.seat1.subject.trim().toLowerCase());
            if (row.seat2?.subject) roomSubjects[row.classroom].add(row.seat2.subject.trim().toLowerCase());
        });

        function canAssign(facultyName, room) {
            const taughtSubjects = facultySubjectsMap.get(facultyName);
            if (!taughtSubjects || taughtSubjects.size === 0) return true;
            const examSubjects = roomSubjects[room] || new Set();
            for (const subject of examSubjects) {
                if (taughtSubjects.has(subject)) return false;
            }
            return true;
        }

        const roomInvigilators = {};
        const usedIds = new Set();

        rooms.forEach(room => {
            const assigned = [];
            for (const invig of available) {
                if (assigned.length >= 2) break;
                if (usedIds.has(invig.id)) continue;
                if (!canAssign(invig.name, room)) continue;
                assigned.push(invig.name);
                usedIds.add(invig.id);
            }
            roomInvigilators[room] = assigned;
        });

        // No assigned:true writes — records stay reusable
        return roomInvigilators;
    } catch(err) {
        console.error('Error assigning invigilators:', err);
        return {};
    }
}

function allocateStudentsToBenches(students, examType = '') {
    const isSem = examType === 'Sem';
    const normalize = value => String(value || '').trim().toLowerCase();
    const studentsBySubject = {};

    students.forEach(student => {
        const key = normalize(student.subject);
        if (!studentsBySubject[key]) studentsBySubject[key] = [];
        studentsBySubject[key].push(student);
    });

    const subjects = Object.keys(studentsBySubject);
    const seatedRollNumbers = new Set();
    const benches = [];
    let benchCount = 0;

    if (isSem) {
        // Sem: interleaved round-robin pairing across subjects
        let keepGoing = true;
        while (keepGoing) {
            keepGoing = false;
            for (let i = 0; i < subjects.length; i++) {
                for (let j = i + 1; j < subjects.length; j++) {
                    const list1 = studentsBySubject[subjects[i]];
                    const list2 = studentsBySubject[subjects[j]];
                    if (!list1.length || !list2.length) continue;

                    const student1 = list1.shift();
                    const student2 = list2.shift();

                    if (student1.section === student2.section) {
                        list1.unshift(student1);
                        list2.unshift(student2);
                        continue;
                    }

                    const swap = benchCount % 2 === 1;
                    benches.push({ seat1: swap ? student2 : student1, seat2: swap ? student1 : student2 });
                    seatedRollNumbers.add(student1.rollNo);
                    seatedRollNumbers.add(student2.rollNo);
                    benchCount++;
                    keepGoing = true;
                }
            }
        }
    } else {
        // Mid: column-wise pairing.
        //
        // Constraints:
        //   1. No two students with the same subject on the same bench.
        //   2. Each column must be sequential — all students of one section top to bottom,
        //      then the next section, with no interleaving between sections.
        //
        // Strategy:
        //   - Sort students so all of CSE-A comes first, then CSE-B, then ECE-A, ECE-B, etc.
        //     (Firebase may return them interleaved; this corrects that.)
        //   - Group by subject (all CSE together as listA, all ECE together as listB).
        //   - Zip listA with listB bench-by-bench → different subjects on every bench ✅,
        //     sequential roll numbers down each column ✅.

        // Step 1: sort students — primary: section (preserves A,B,C... order), secondary: rollNo.
        const sectionOrder = {};
        students.forEach(s => {
            if (!(s.section in sectionOrder)) sectionOrder[s.section] = Object.keys(sectionOrder).length;
        });
        const sorted = [...students].sort((a, b) => {
            const si = sectionOrder[a.section] - sectionOrder[b.section];
            if (si !== 0) return si;
            return String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true });
        });

        // Step 2: group sorted students by subject.
        const subjectKeys = [];
        const studentsBySubject = {};
        sorted.forEach(student => {
            const key = normalize(student.subject);
            if (!studentsBySubject[key]) {
                subjectKeys.push(key);
                studentsBySubject[key] = [];
            }
            studentsBySubject[key].push(student);
        });

        // Step 3: zip subject pairs bench-by-bench.
        for (let si = 0; si < subjectKeys.length; si += 2) {
            const listA = studentsBySubject[subjectKeys[si]];
            const listB = si + 1 < subjectKeys.length
                ? studentsBySubject[subjectKeys[si + 1]]
                : [];

            const maxLen = Math.max(listA.length, listB.length);
            for (let i = 0; i < maxLen; i++) {
                const studentA = i < listA.length ? listA[i] : null;
                const studentB = i < listB.length ? listB[i] : null;

                if (studentA && studentB) {
                    benches.push({ seat1: studentA, seat2: studentB });
                    seatedRollNumbers.add(studentA.rollNo);
                    seatedRollNumbers.add(studentB.rollNo);
                } else if (studentA) {
                    benches.push({ seat1: studentA, seat2: null });
                    seatedRollNumbers.add(studentA.rollNo);
                } else if (studentB) {
                    benches.push({ seat1: studentB, seat2: null });
                    seatedRollNumbers.add(studentB.rollNo);
                }
            }
        }
    }

    // Seat remaining unpaired students
    students.forEach(student => {
        if (!seatedRollNumbers.has(student.rollNo)) {
            benches.push({ seat1: student, seat2: null });
            seatedRollNumbers.add(student.rollNo);
        }
    });

    return benches;
}

function allocateSeatsToClassrooms(students, examType = '') {
    const BENCHES_PER_CLASSROOM = 28;
    const allBenches = allocateStudentsToBenches(students, examType);
    const rooms = Array.from(selectedRooms);

    // Distribute benches into rooms (28 per room)
    const roomBenches = {};
    let benchIndex = 0;
    rooms.forEach(room => {
        roomBenches[room] = [];
        for (let i = 0; i < BENCHES_PER_CLASSROOM && benchIndex < allBenches.length; i++) {
            roomBenches[room].push(allBenches[benchIndex++]);
        }
    });

    // Any remaining benches (overflow, <=4) go into the last room's extra row
    if (benchIndex < allBenches.length) {
        const lastRoom = rooms[rooms.length - 1];
        while (benchIndex < allBenches.length) {
            roomBenches[lastRoom].push(allBenches[benchIndex++]);
        }
    }

    const seatingResult = [];
    rooms.forEach(room => {
        roomBenches[room].forEach((benchData, idx) => {
            seatingResult.push({
                classroom: room,
                bench: idx + 1,
                seat1: benchData.seat1,
                seat2: benchData.seat2
            });
        });
    });

    return {
        seated: seatingResult,
        overflow: [],
        sections: rooms.map(room => ({ name: room }))
    };
}

async function loadAllTables(selectedTableId = null) {
    const container = document.getElementById('tablesContainer');
    container.innerHTML = '<p>Loading...</p>';

    try {
        await purgeExpiredTables();
        const snapshot = await db.collection('examTables').get();
        const tables = buildSortedTableList(snapshot);
        container.innerHTML = '';

        if (tables.length === 0) {
            container.innerHTML = '<p>No tables found.</p>';
            await loadTablesSidebar();
            return;
        }

        tables.forEach(table => {
            const selectedRoomCount = Array.isArray(table.selectedRooms) ? table.selectedRooms.length : Array.from(new Set((table.seatingData || []).map(seat => seat.classroom))).length;
            const isSelected = selectedTableId && selectedTableId === table.id;
            const card = document.createElement('div');
            card.id = `table-card-${table.id}`;
            card.style.cssText = `background: white; margin: 10px 0; border-radius: 8px; border: 2px solid ${isSelected ? '#4a90e2' : '#e0e0e0'}; overflow: hidden;`;

            const yearsStr   = Array.isArray(table.years) ? table.years.join(', ') : (table.year || '—');
            const semStr     = table.semester || '—';
            const dateStr    = table.examDate || table.examDateISO || '—';
            const timeStr    = table.examTime || '—';

            card.innerHTML = `
                <div onclick="toggleTableExpand('${table.id}')" style="padding: 20px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h3 style="margin: 0 0 8px 0;">${getTableDisplayName(table)}</h3>
                        <p style="margin: 3px 0;"><strong>Semester:</strong> ${semStr} &nbsp;|&nbsp; <strong>Years:</strong> ${yearsStr}</p>
                        <p style="margin: 3px 0;"><strong>Date:</strong> ${dateStr} &nbsp;|&nbsp; <strong>Time:</strong> ${timeStr} &nbsp;|&nbsp; <strong>Rooms:</strong> ${selectedRoomCount}</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span id="chevron-${table.id}" style="font-size: 20px; transition: transform 0.2s;">${isSelected ? '▲' : '▼'}</span>
                        <button onclick="event.stopPropagation(); deleteTable('${table.id}')" style="background: #dc3545; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                    </div>
                </div>
                <div id="table-expand-${table.id}" style="display: ${isSelected ? 'block' : 'none'}; padding: 0 20px 20px; border-top: 1px solid #e0e0e0;">
                    <div id="table-content-${table.id}"></div>
                </div>
            `;
            container.appendChild(card);

            if (isSelected) {
                renderTableContent(table);
            }
        });

        await loadTablesSidebar(selectedTableId);
    } catch (error) {
        console.error('Error loading tables:', error);
        container.innerHTML = `<p style="color: red;">Error loading tables: ${error.message}</p>`;
    }
}

function toggleTableExpand(tableId) {
    const expandDiv = document.getElementById(`table-expand-${tableId}`);
    const chevron = document.getElementById(`chevron-${tableId}`);
    const isOpen = expandDiv.style.display === 'block';

    if (isOpen) {
        expandDiv.style.display = 'none';
        chevron.textContent = '▼';
    } else {
        expandDiv.style.display = 'block';
        chevron.textContent = '▲';
        // Load content if not already loaded
        const contentDiv = document.getElementById(`table-content-${tableId}`);
        if (!contentDiv.dataset.loaded) {
            // Fetch from Firebase and render
            db.collection('examTables').doc(tableId).get().then(doc => {
                if (doc.exists) {
                    renderTableContent({ id: doc.id, ...doc.data() });
                }
            });
        }
    }
}

function renderTableContent(table) {
    const contentDiv = document.getElementById(`table-content-${table.id}`);
    if (!contentDiv) return;
    contentDiv.dataset.loaded = 'true';

    const seatingData = table.seatingData || [];
    const rooms = Array.isArray(table.selectedRooms) && table.selectedRooms.length > 0
        ? table.selectedRooms
        : Array.from(new Set(seatingData.map(s => s.classroom).filter(Boolean)));

    let html = '';
    rooms.forEach(roomName => {
        const seats = seatingData.filter(row => row.classroom === roomName);
        if (seats.length === 0) return;

        const normalSeats = seats.slice(0, 28);
        const extraSeats = seats.slice(28);

        const col1 = normalSeats.slice(0, 7);
        const col2 = normalSeats.slice(7, 14);
        const col3 = normalSeats.slice(14, 21);
        const col4 = normalSeats.slice(21, 28);

        html += `<div style="margin-top: 24px;">
            <h4 style="background: #4a90e2; color: white; padding: 10px 15px; border-radius: 6px; margin-bottom: 10px;">🚪 ${roomName}</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">`;

        [col1, col2, col3, col4].forEach(col => {
            html += `<table style="width:100%;border-collapse:collapse;"><tbody>`;
            col.forEach(row => {
                html += `<tr>
                    <td style="padding:6px 8px;border:1px solid #e0e0e0;">${row.seat1 ? row.seat1.rollNo : '-'}</td>
                    <td style="padding:6px 8px;border:1px solid #e0e0e0;">${row.seat2 ? row.seat2.rollNo : '-'}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        });

        html += `</div>`;

        if (extraSeats.length > 0) {
            const extraCols = [[], [], [], []];
            extraSeats.forEach((row, idx) => extraCols[idx % 4].push(row));
            html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 4px;">`;
            extraCols.forEach(col => {
                html += `<table style="width:100%;border-collapse:collapse;"><tbody>`;
                col.forEach(row => {
                    html += `<tr>
                        <td style="padding:6px 8px;border:1px solid #e0e0e0;">${row.seat1 ? row.seat1.rollNo : '-'}</td>
                        <td style="padding:6px 8px;border:1px solid #e0e0e0;">${row.seat2 ? row.seat2.rollNo : '-'}</td>
                    </tr>`;
                });
                html += `</tbody></table>`;
            });
            html += `</div>`;
        }

        html += `</div>`;
    });

    // Prepend the Download Seating Plan button
    const btnBar = `<div style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="exportSeatingPlanCSV(window.__tableCache_${table.id})"
                style="background:#1d6f42;color:white;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
            📄 Download Seating Plan (PDF)
        </button>
        <button onclick="exportTablePDFFromAdmin(window.__tableCache_${table.id})"
                style="background:#0369a1;color:white;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
            📋 Export Table
        </button>
        <button onclick="exportInvigilatorTablePDFFromAdmin(window.__tableCache_${table.id})"
                style="background:#0e7490;color:white;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
            🧾 Export Invigilator Table
        </button>
    </div>`;

    // Cache the table object so the button's onclick can reach it
    window[`__tableCache_${table.id}`] = table;

    contentDiv.innerHTML = btnBar + (html || '<p style="color:#6b7280;">No seating data found.</p>');
}

async function deleteTable(id) {
    if (!confirm('Delete this table?')) {
        return;
    }

    try {
        await db.collection('examTables').doc(id).delete();
        await loadAllTables();
    } catch (error) {
        alert('Error deleting: ' + error.message);
    }
}

// ─── JNTU-style Seating Plan PDF export ──────────────────────────────────────
// Generates one A4 portrait page per room, matching the official JNTU sheet.
// Uses jsPDF already loaded in admin.html.

const SEATING_PLAN_LOGO_B64 = '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';

function toRoman(n) {
    const map = [
        [1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],
        [100,'C'],[90,'XC'],[50,'L'],[40,'XL'],
        [10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']
    ];
    let result = '';
    map.forEach(([val, sym]) => {
        while (n >= val) { result += sym; n -= val; }
    });
    return result;
}

function buildExamLabel(table) {
    // Year: "1st Year" → "I B.Tech", "2nd Year" → "II B.Tech" etc.
    const yearMap = {'1st Year':'I','2nd Year':'II','3rd Year':'III','4th Year':'IV'};
    const years   = Array.isArray(table.years) ? table.years : [];
    const yearRoman = years.map(y => yearMap[y] || y).join(' & ');
    const yearPart  = yearRoman ? `${yearRoman} B.Tech` : '';

    // Semester: "Semester 1" → "I Sem", "Semester 2" → "II Sem"
    const semMatch = (table.semester || '').match(/(\d+)/);
    const semRoman = semMatch ? toRoman(parseInt(semMatch[1])) : '';
    const semPart  = semRoman ? `${semRoman} Sem` : '';

    // Mid: "Mid 1" → "Mid-I", "Mid 2" → "Mid-II", "Sem" → "End"
    const midLabels = table.yearData
        ? [...new Set(Object.values(table.yearData).map(d => d.mid || '').filter(Boolean))]
        : [];
    let midPart = '';
    if (midLabels.length > 0) {
        const raw = midLabels[0];
        if (/sem/i.test(raw)) {
            midPart = 'End';
        } else {
            const mNum = raw.match(/(\d+)/);
            midPart = mNum ? `Mid-${toRoman(parseInt(mNum[1]))}` : raw;
        }
    }

    // Date: month name from table
    let monthPart = '';
    const iso = table.examDateISO || table.examDate || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const mo = parseInt(iso.split('-')[1]) - 1;
        monthPart = months[mo] ? `, ${months[mo]}-${iso.split('-')[0]}` : '';
    }

    return [yearPart, semPart, midPart, 'Examinations'].filter(Boolean).join(' ') + monthPart;
}

function exportSeatingPlanCSV(table) {
    const seatingData = table.seatingData || [];
    const rooms = Array.isArray(table.selectedRooms) && table.selectedRooms.length > 0
        ? table.selectedRooms
        : Array.from(new Set(seatingData.map(s => s.classroom).filter(Boolean)));

    if (rooms.length === 0) { alert('No room data found for this table.'); return; }

    const examLabel = buildExamLabel(table);

    // Date display: DD-MM-YYYY FN/AN
    let displayDate = table.examDateISO || table.examDate || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
        const [y,m,d] = displayDate.split('-');
        displayDate = `${d}-${m}-${y}`;
    }
    const slot = table.examTime && table.examTime < '13:00' ? 'FN' : 'AN';
    displayDate = displayDate ? `${displayDate} ${slot}` : '';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Page dimensions
    const PW = 210, PH = 297;
    const ML = 12, MR = 12;
    const CW = PW - ML - MR;   // content width = 186mm

    rooms.forEach((roomName, roomIdx) => {
        if (roomIdx > 0) doc.addPage();

        const seats     = seatingData.filter(r => r.classroom === roomName);
        if (seats.length === 0) return;
        const allSeats  = [...seats];
        const registered = allSeats.reduce((n,r) => n + (r.seat1?1:0) + (r.seat2?1:0), 0);

        // 4 display columns of 7 rows each (+ optional extra row per col)
        const norm = allSeats.slice(0,28);
        const extra = allSeats.slice(28);
        const cols = [ norm.slice(0,7), norm.slice(7,14), norm.slice(14,21), norm.slice(21,28) ];
        extra.forEach((row,i) => { if(i<4) cols[i].push(row); });
        const maxRows = Math.max(...cols.map(c=>c.length));

        // ── helpers ────────────────────────────────────────────────────────
        const R  = (x,y,w,h,opts) => doc.rect(x,y,w,h, opts||'S');
        const T  = (s,x,y,a)      => doc.text(String(s),x,y,a||{});
        const F  = (nm,st,sz)     => { doc.setFont(nm||'helvetica', st||'normal'); doc.setFontSize(sz||9); };
        const HL = (x1,y1,x2,y2) => doc.line(x1,y1,x2,y2);

        let Y = 8;  // running Y cursor

        // ── Row 0: Logo (left) + University text (center-right) ────────────
        const LOGO_W = 14, LOGO_H = 14;
        try {
            doc.addImage('data:image/png;base64,' + SEATING_PLAN_LOGO_B64,
                         'PNG', ML, Y, LOGO_W, LOGO_H);
        } catch(e) { /* skip if image fails */ }

        F('helvetica','bold',9);
        T('Jawaharlal Nehru Technological University, Hyderabad - 500 085',
          ML + LOGO_W + 2 + (CW - LOGO_W - 2)/2, Y+6, {align:'center'});
        Y += LOGO_H + 1;

        // ── Row 1+2: Exam Center box (left) | Center Code box (right) ──────
        const CC_W = 28;         // center-code box width
        const EC_W = CW - CC_W;  // exam-center box width
        const HEADER_H = 14;

        R(ML,         Y, EC_W, HEADER_H);
        R(ML + EC_W,  Y, CC_W, HEADER_H);

        // Vertical divider inside CC box (label / value)
        // inner label text
        F('helvetica','normal',7);
        T('Name of the Exam Center', ML+2, Y+4);
        F('helvetica','bold',8);
        T('BVRIT HYDERABAD College of Engineering for Women',
          ML + EC_W/2, Y+10, {align:'center'});

        // center code label
        F('helvetica','normal',7);
        T('Center', ML+EC_W+CC_W/2, Y+4,  {align:'center'});
        T('Code',   ML+EC_W+CC_W/2, Y+7.5,{align:'center'});
        F('helvetica','bold',14);
        T('WH',     ML+EC_W+CC_W/2, Y+13, {align:'center'});
        Y += HEADER_H;

        // ── Row 3: SEATING PLAN ─────────────────────────────────────────────
        const SP_H = 8;
        R(ML, Y, CW, SP_H);
        F('helvetica','bold',13);
        T('SEATING PLAN', ML+CW/2, Y+6, {align:'center'});
        Y += SP_H;

        // ── Row 4: Exam name (left box) ─────────────────────────────────────
        const EN_H = 7;
        R(ML, Y, CW, EN_H);
        F('helvetica','bold',8);
        T(`Name of the Exam :`, ML+2, Y+5);
        F('helvetica','normal',8);
        // measure label width and place value after it
        const labelW = doc.getTextWidth('Name of the Exam : ');
        T(examLabel, ML+2+labelW, Y+5);
        Y += EN_H;

        // ── Row 5: Date (right-aligned, no box border — just text in own row) ─
        const DT_H = 5;
        R(ML, Y, CW, DT_H);
        F('helvetica','normal',8);
        T(`Date : ${displayDate}`, ML+CW-2, Y+4, {align:'right'});
        Y += DT_H;

        // ── Row 6: Class Room ───────────────────────────────────────────────
        Y += 4;
        F('helvetica','bold',11);
        T(`Class Room : ${roomName}`, ML+CW/2, Y, {align:'center'});
        Y += 6;

        // ── Bench grid ──────────────────────────────────────────────────────
        // 4 columns with 3mm gap; each bench = HT row (7mm) + SN row (5.5mm)
        const GAP   = 3;
        const COL_W = (CW - GAP*3) / 4;   // ~42mm per column
        const HALF  = COL_W / 2;
        const HT_H  = 7;     // H.T.No row height
        const SN_H  = 5.5;   // Seat No row height
        const BH    = HT_H + SN_H;
        const BGAP  = 2.5;   // gap between benches

        for (let r = 0; r < maxRows; r++) {
            for (let c = 0; c < 4; c++) {
                const bench = cols[c][r];
                if (!bench) continue;

                const bx = ML + c*(COL_W+GAP);
                const by = Y + r*(BH+BGAP);

                const ht1 = bench.seat1 ? String(bench.seat1.rollNo).toUpperCase() : '';
                const ht2 = bench.seat2 ? String(bench.seat2.rollNo).toUpperCase() : '';
                const sn  = String(bench.bench || (r+1+c*7));

                // Left HT cell
                R(bx,        by, HALF, HT_H);
                F('helvetica','normal',6);
                T('H.T.No.', bx+1.5,      by+3.5);
                F('helvetica','bold',7);
                T(ht1,       bx+HALF/2,   by+6.5, {align:'center'});

                // Right HT cell
                R(bx+HALF,   by, HALF, HT_H);
                F('helvetica','normal',6);
                T('H.T.No.', bx+HALF+1.5, by+3.5);
                F('helvetica','bold',7);
                T(ht2,       bx+HALF+HALF/2, by+6.5, {align:'center'});

                // Seat No full-width cell
                R(bx, by+HT_H, COL_W, SN_H);
                F('helvetica','normal',6);
                T('Seat No.', bx+1.5,    by+HT_H+4);
                F('helvetica','bold',8);
                T(sn,         bx+COL_W/2, by+HT_H+4, {align:'center'});
            }
        }

        Y += maxRows*(BH+BGAP) + 3;

        // ── Footer ──────────────────────────────────────────────────────────
        const FT_H = 7;
        const T3   = CW/3;
        R(ML,       Y, T3, FT_H);
        R(ML+T3,    Y, T3, FT_H);
        R(ML+T3*2,  Y, T3, FT_H);
        F('helvetica','normal',8);
        T(`No. Registered: ${registered}`, ML+2,      Y+5);
        T('No. Absent:',                    ML+T3+2,   Y+5);
        T('No. Present:',                   ML+T3*2+2, Y+5);
        Y += FT_H + 3;

        // ── Note ────────────────────────────────────────────────────────────
        F('helvetica','normal',7);
        T('Note: Cross the box containing the Hall Ticket Number when the candidate is Absent', ML, Y+3.5);
        Y += 14;

        // ── Signatures ──────────────────────────────────────────────────────
        HL(ML,        Y, ML+60,     Y);
        HL(ML+CW-60,  Y, ML+CW,     Y);
        F('helvetica','normal',8);
        T('Signature of Invigilator',         ML,        Y+4);
        T('Signature of Chief Superintendent',ML+CW,     Y+4, {align:'right'});
    });

    const safeName = (table.tableName||table.id||'export').replace(/\s+/g,'_');
    doc.save(`SeatingPlan_${safeName}.pdf`);
}


// ─── Export Table PDF from All Tables panel ───────────────────────────────────
// Uses the exact same format as the "Export Table" button on the results page.
function exportTablePDFFromAdmin(table) {
    if (!table) return;
    const seatingData = table.seatingData || [];
    const rooms = Array.isArray(table.selectedRooms) && table.selectedRooms.length
        ? table.selectedRooms
        : [...new Set(seatingData.map(r => r.classroom).filter(Boolean))];
    // Build a meta object matching what _doExportTablePDF expects
    const meta = {
        examTime:    table.examTime    || '',
        examEndTime: table.examEndTime || '',
        years:       table.years       || [],
        semester:    table.semester    || '',
        yearData:    table.yearData    || null,
        examDate:    table.examDate    || table.examDateISO || '',
        examDateISO: table.examDateISO || table.examDate    || '',
        selectedRooms: rooms,
    };

    const { jsPDF } = window.jspdf;

    const fmtTime = t => {
        if (!t) return '';
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        return `${hr % 12 || 12}.${m} ${hr < 12 ? 'am' : 'pm'}`;
    };
    const yearMap = {'1st Year':'I','2nd Year':'II','3rd Year':'III','4th Year':'IV'};

    const examTime    = meta.examTime;
    const examEndTime = meta.examEndTime;
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

    const ROWS_PER_COL = 14;
    const COLS_PER_ROOM = 2;

    const roomData = rooms.map(room => {
        const seats = seatingData.filter(r => r.classroom === room);
        const rolls = [];
        seats.forEach(b => {
            if (b.seat1 && b.seat1.rollNo) rolls.push(b.seat1.rollNo);
            if (b.seat2 && b.seat2.rollNo) rolls.push(b.seat2.rollNo);
        });
        return { room, rolls };
    });

    const PAGE_W    = 297;
    const PAGE_H    = 210;
    const M         = 5;
    const HEADER_H  = 21;
    const ROW_H     = 4.6;
    const HEAD_H    = 5.0;
    const FONT_SZ   = 5.0;
    const CONTENT_W = PAGE_W - 2 * M;
    const CONTENT_H = PAGE_H - M - HEADER_H - M;

    const MIN_SUBCOL   = 12.5;
    const MAX_ROOMS_ACROSS = Math.floor(CONTENT_W / (MIN_SUBCOL * COLS_PER_ROOM));
    const BAND_H = HEAD_H + ROWS_PER_COL * ROW_H;
    const MAX_BANDS = Math.floor(CONTENT_H / BAND_H);

    const bandsNeeded = Math.ceil(roomData.length / MAX_ROOMS_ACROSS);
    const roomsAcross = bandsNeeded <= MAX_BANDS
        ? Math.ceil(roomData.length / bandsNeeded)
        : MAX_ROOMS_ACROSS;

    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setLineWidth(0.3);
    doc.setTextColor(0);

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

    let bandY = M + HEADER_H;
    let pageRoomIdx = 0;

    while (pageRoomIdx < roomData.length) {
        const bandRooms = roomData.slice(pageRoomIdx, pageRoomIdx + roomsAcross);
        const bandCount = bandRooms.length;
        const roomBlockW = CONTENT_W / bandCount;
        const subColW    = roomBlockW / COLS_PER_ROOM;

        if (bandY + BAND_H > PAGE_H - M + 1) {
            doc.addPage();
            bandY = M;
        }

        bandRooms.forEach((rd, ri) => {
            const x = M + ri * roomBlockW;

            doc.setFillColor(210, 210, 210);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.rect(x, bandY, roomBlockW, HEAD_H, 'FD');
            doc.setTextColor(0);
            doc.text(rd.room, x + roomBlockW/2, bandY + HEAD_H - 1.2, {align:'center'});

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FONT_SZ);

            for (let col = 0; col < COLS_PER_ROOM; col++) {
                for (let row = 0; row < ROWS_PER_COL; row++) {
                    const rollIdx = col * ROWS_PER_COL + row;
                    const roll    = rd.rolls[rollIdx] || '';
                    const cx      = x + col * subColW;
                    const ry      = bandY + HEAD_H + row * ROW_H;

                    if (row % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(cx, ry, subColW, ROW_H, 'F'); }
                    doc.setDrawColor(160,160,160);
                    doc.rect(cx, ry, subColW, ROW_H);
                    if (roll) {
                        doc.setTextColor(0);
                        doc.text(roll, cx + 1, ry + ROW_H - 1.2);
                    }
                }
            }

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

// ─── Export Invigilator Table PDF from All Tables panel ───────────────────────
function exportInvigilatorTablePDFFromAdmin(table) {
    if (!table) return;
    const { jsPDF } = window.jspdf;

    const seatingData = table.seatingData || [];
    const rooms = Array.isArray(table.selectedRooms) && table.selectedRooms.length
        ? table.selectedRooms
        : [...new Set(seatingData.map(r => r.classroom).filter(Boolean))];

    const roomInvigilators = table.roomInvigilators || {};

    const rows = rooms.map(room => [
        room,
        (roomInvigilators[room] || []).join(', ') || '—'
    ]);

    const iso = table.examDate || table.examDateISO || '';
    const dateDisplay = iso ? iso.split('-').reverse().join('-') : '';
    const examTime = table.examTime || '';
    const slot = examTime && examTime < '13:00' ? 'FN' : 'AN';

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('BVRIT HYDERABAD College of Engineering for Women', 105, 14, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Invigilator Assignment Table', 105, 21, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
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
