let selectedSemester = '';
let selectedYears = new Set();
let yearData = {}; // {year: {mid: '', branches: Set(), subjects: {}}}
let uploadedRosterRecords = [];
let occupiedRoomsForSelectedSlot = new Set();
let roomRequirementContext = { totalStudents: 0, roomsRequired: 0 };
window.isSavingData = false;

const YEAR_SUBJECTS = {
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
    const [branch, section] = sectionName.split('-');
    return `${branch} ${section}${getYearSuffix(year)}`;
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

    yearData[year].branches.forEach(branch => {
        const subjects = YEAR_SUBJECTS[year][branch][selectedSemester] || [];
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
    const rooms = [];
    const branches = ['CSE', 'ECE', 'AIML', 'EEE'];
    const sections = {
        CSE: ['A', 'B', 'C', 'D', 'E', 'F'],
        ECE: ['A', 'B'],
        AIML: ['A', 'B'],
        EEE: ['A']
    };

    for (let year = 1; year <= 4; year++) {
        branches.forEach(branch => {
            sections[branch].forEach(section => {
                rooms.push(`${branch} ${section}${year}`);
            });
        });
    }

    rooms.push('BSFI-1', 'BSFI-2', 'SMB (Seminar Hall-1)', 'SMB (Seminar Hall-2)', 'SMB (Seminar Hall-3)', 'SMB (Seminar Hall-4)');
    return rooms;
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
    const preferredSectionRooms = [];
    const populatedSections = new Set(buildStudentAndSectionData().allSections.map(section =>
        `${section.year}|${section.name}`
    ));

    selectedYears.forEach(year => {
        const data = yearData[year];
        data.branches.forEach(branch => {
            branchData[branch].sections.forEach(sectionName => {
                if (populatedSections.has(`${year}|${sectionName}`)) {
                    preferredSectionRooms.push(getPhysicalSectionRoomName(year, sectionName));
                }
            });
        });
    });

    const freePreferredRooms = [...new Set(preferredSectionRooms)]
        .filter(room => !occupiedRoomsForSelectedSlot.has(room))
        .slice(0, roomsRequired);
    const occupiedPreferredRooms = preferredSectionRooms.filter(room => occupiedRoomsForSelectedSlot.has(room));

    freePreferredRooms.forEach(room => selectedRooms.add(room));

    const sectionRoomCapacity = selectedRooms.size * 28;
    const remainingBenches = Math.max(0, roomRequirementContext.requiredBenches - sectionRoomCapacity);
    const additionalRoomsNeeded = Math.max(0, roomsRequired - selectedRooms.size);

    const container = document.getElementById('roomSelectionDisplay');
    container.innerHTML = `
        <h4 style="margin-top: 20px; color: #4caf50;">✨ Auto Assign - Section Rooms:</h4>
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p style="margin: 5px 0;"><strong>🏫 Section Rooms Auto-Allocated:</strong> ${selectedRooms.size} room(s)</p>
            <p style="margin: 5px 0;"><strong>🪑 Bench capacity:</strong> ${sectionRoomCapacity} benches</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                ${Array.from(selectedRooms).map(room => `<span style="padding: 5px 10px; background: white; border-radius: 4px; border: 2px solid #4caf50;">${room}</span>`).join('')}
            </div>
        </div>
    `;

    if (occupiedPreferredRooms.length > 0) {
        container.innerHTML += `
            <div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #f56565;">
                <p style="margin: 0 0 10px 0; color: #c53030; font-weight: 700;">Already allotted for the same date and time</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${occupiedPreferredRooms.map(room => `<span style="padding: 5px 10px; background: white; border-radius: 4px; border: 2px solid #f56565; color: #c53030;">${room}</span>`).join('')}
                </div>
            </div>
        `;
    }

    if (additionalRoomsNeeded > 0) {
        const extraFreeRooms = getAllAvailableRooms().filter(room => !occupiedRoomsForSelectedSlot.has(room) && !selectedRooms.has(room));
        container.innerHTML += `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #ffc107;">
                <p style="margin: 5px 0; color: #856404;"><strong>⚠️ Additional Rooms Needed:</strong> ${additionalRoomsNeeded} room(s)</p>
                <p style="margin: 5px 0; color: #856404;"><strong>🪑 Remaining benches:</strong> ${remainingBenches}</p>
                <p style="margin: 5px 0; color: #856404;"><strong>Available Extra Rooms:</strong> ${extraFreeRooms.length}</p>
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

    // Assign invigilators and then navigate
    assignInvigilatorsToRooms(Array.from(selectedRooms), examDate, examTime).then(roomInvigilators => {
        sessionStorage.setItem('roomInvigilators', JSON.stringify(roomInvigilators));
        window.location.href = 'results.html';
    });
}

async function assignInvigilatorsToRooms(rooms, examDateISO, examTime) {
    try {
        // Determine slot: FN = before 1pm, AN = afternoon
        const slot = examTime < '13:00' ? 'FN' : 'AN';

        const snapshot = await db.collection('invigilators')
            .where('date', '==', examDateISO)
            .where('slot', '==', slot)
            .where('assigned', '==', false)
            .get();

        const available = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Shuffle available invigilators randomly
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }

        const roomInvigilators = {};
        const batch = db.batch();
        let pointer = 0;

        rooms.forEach(room => {
            const assigned = [];
            // Assign up to 2 invigilators per room
            for (let n = 0; n < 2 && pointer < available.length; n++, pointer++) {
                assigned.push(available[pointer].name);
                batch.update(db.collection('invigilators').doc(available[pointer].id), { assigned: true });
            }
            roomInvigilators[room] = assigned;
        });

        if (pointer > 0) await batch.commit();
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

            card.innerHTML = `
                <div onclick="toggleTableExpand('${table.id}')" style="padding: 20px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h3 style="margin: 0 0 8px 0;">${getTableDisplayName(table)}</h3>
                        <p style="margin: 3px 0;"><strong>Semester:</strong> ${table.semester} &nbsp;|&nbsp; <strong>Years:</strong> ${table.years.join(', ')}</p>
                        <p style="margin: 3px 0;"><strong>Date:</strong> ${table.examDate} &nbsp;|&nbsp; <strong>Time:</strong> ${table.examTime} &nbsp;|&nbsp; <strong>Rooms:</strong> ${selectedRoomCount}</p>
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

            // If this card is pre-selected, render its content immediately
            if (isSelected) {
                renderTableContent(table);
            }
        });

        await loadTablesSidebar(selectedTableId);
    } catch (error) {
        console.error('Error loading tables:', error);
        container.innerHTML = '<p style="color: red;">Error loading tables</p>';
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

    contentDiv.innerHTML = html || '<p style="color:#6b7280;">No seating data found.</p>';
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
