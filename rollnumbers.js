/**
 * SeatSnap - Student Data Management Module
 * Replaces legacy hardcoded datasets with dynamic, persistent data stores.
 * All previous hardcoded student roll numbers have been purged.
 */

// Storage keys
const STORAGE_KEYS = {
    STUDENT_DATA: 'seatsnap_student_data',
    ACADEMIC_YEARS: 'seatsnap_academic_years',
    CLASSROOM_ASSIGNMENTS: 'seatsnap_classroom_assignments',
    LEGACY_SEATING: 'seatingData',
    LEGACY_OVERFLOW: 'overflowData'
};

// Global in-memory dynamic registry
let SeatSnapStudentStore = {
    "1st Year": [],
    "2nd Year": [],
    "3rd Year": [],
    "4th Year": []
};

// Dynamic ROLL_NUMBERS proxy/object for backward compatibility with existing generator
const ROLL_NUMBERS = (typeof window !== 'undefined' && window.ROLL_NUMBERS) ? window.ROLL_NUMBERS : {};

/**
 * Purge all previous student data and legacy seating arrangements from system storage
 */
function clearPreviousSystemData() {
    console.log('🧹 Purging previous student data and legacy storage...');
    try {
        localStorage.removeItem(STORAGE_KEYS.STUDENT_DATA);
        localStorage.removeItem('seatsnap_data_meta');
        localStorage.removeItem(STORAGE_KEYS.ACADEMIC_YEARS);
        localStorage.removeItem(STORAGE_KEYS.CLASSROOM_ASSIGNMENTS);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_SEATING);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_OVERFLOW);
        
        // Reset in-memory store
        SeatSnapStudentStore = {
            "1st Year": [],
            "2nd Year": [],
            "3rd Year": [],
            "4th Year": []
        };
        
        // Reset ROLL_NUMBERS
        Object.keys(ROLL_NUMBERS).forEach(key => delete ROLL_NUMBERS[key]);
        
        if (typeof window !== 'undefined' && window.StudentDataContext) {
            window.StudentDataContext.clearAllData();
        }

        console.log('✅ Previous student data cleared successfully.');
        return { success: true, message: 'All previous data cleared.' };
    } catch (e) {
        console.error('Error clearing data:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Load student data from localStorage or StudentDataContext into memory
 */
function loadSystemStudentData() {
    try {
        if (typeof window !== 'undefined' && window.StudentDataContext) {
            SeatSnapStudentStore = window.StudentDataContext.getState().students;
            syncRollNumbersProxy();
            return SeatSnapStudentStore;
        }

        const stored = localStorage.getItem(STORAGE_KEYS.STUDENT_DATA);
        if (stored) {
            const parsed = JSON.parse(stored);
            SeatSnapStudentStore = {
                "1st Year": parsed["1st Year"] || [],
                "2nd Year": parsed["2nd Year"] || [],
                "3rd Year": parsed["3rd Year"] || [],
                "4th Year": parsed["4th Year"] || []
            };
            syncRollNumbersProxy();
            return SeatSnapStudentStore;
        }
    } catch (e) {
        console.error('Error loading stored student data:', e);
    }
    return SeatSnapStudentStore;
}

/**
 * Save new student data into system storage
 */
function saveSystemStudentData(data) {
    try {
        SeatSnapStudentStore = {
            "1st Year": data["1st Year"] || [],
            "2nd Year": data["2nd Year"] || [],
            "3rd Year": data["3rd Year"] || [],
            "4th Year": data["4th Year"] || []
        };
        localStorage.setItem(STORAGE_KEYS.STUDENT_DATA, JSON.stringify(SeatSnapStudentStore));
        syncRollNumbersProxy();

        if (typeof window !== 'undefined' && window.StudentDataContext) {
            window.StudentDataContext.setParsedData(SeatSnapStudentStore);
        }

        return { success: true };
    } catch (e) {
        console.error('Error saving student data:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Sync the ROLL_NUMBERS map used by legacy seating modules
 */
function syncRollNumbersProxy() {
    Object.keys(ROLL_NUMBERS).forEach(key => delete ROLL_NUMBERS[key]);
    
    Object.entries(SeatSnapStudentStore).forEach(([year, students]) => {
        students.forEach(student => {
            const sectionKey = `${year} ${student.department || 'CSE'} ${student.section || 'A'}`;
            if (!ROLL_NUMBERS[sectionKey]) {
                ROLL_NUMBERS[sectionKey] = [];
            }
            if (!ROLL_NUMBERS[sectionKey].includes(student.rollNumber)) {
                ROLL_NUMBERS[sectionKey].push(student.rollNumber);
            }
        });
    });
}

/**
 * Get student list for a given academic year
 */
function getStudentsForYear(yearName) {
    return SeatSnapStudentStore[yearName] || [];
}

/**
 * Classroom partitioning helper (Capacity: 7 x 4 = 28 seats)
 */
function partitionClassroomsForYear(yearName, capacity = 28) {
    const students = getStudentsForYear(yearName);
    const classrooms = [];
    
    if (!students || students.length === 0) {
        return classrooms;
    }
    
    const totalStudents = students.length;
    let roomIndex = 1;
    
    for (let i = 0; i < totalStudents; i += capacity) {
        const slice = students.slice(i, i + capacity);
        classrooms.push({
            roomId: `CR-${100 + roomIndex}`,
            roomName: `Classroom ${100 + roomIndex}`,
            capacity: capacity,
            studentsCount: slice.length,
            students: slice,
            isExtraRoom: false,
            rollRange: {
                start: slice[0]?.rollNumber || '',
                end: slice[slice.length - 1]?.rollNumber || ''
            }
        });
        roomIndex++;
    }
    
    return classrooms;
}

// Backward compatibility helper methods
function getAllRollNumbers() {
    return Object.values(ROLL_NUMBERS).flat();
}

function getRollNumbersBySection(section) {
    return ROLL_NUMBERS[section] || [];
}

function findStudentSection(rollNumber) {
    const roll = rollNumber.toLowerCase();
    for (const [section, rolls] of Object.entries(ROLL_NUMBERS)) {
        if (rolls.some(r => r.toLowerCase() === roll)) {
            return section;
        }
    }
    return null;
}

// Initialize: if StudentDataContext is already loaded (script order), sync from it.
// Otherwise fall back to localStorage load / legacy purge.
(function init() {
    if (typeof window !== 'undefined' && window.StudentDataContext) {
        // StudentDataContext already managed the load; just sync ROLL_NUMBERS proxy
        const ctxStudents = window.StudentDataContext.getState().students;
        SeatSnapStudentStore = ctxStudents;
        syncRollNumbersProxy();
        return;
    }
    const isCleaned = sessionStorage.getItem('seatsnap_legacy_purged');
    if (!isCleaned) {
        clearPreviousSystemData();
        sessionStorage.setItem('seatsnap_legacy_purged', 'true');
    } else {
        loadSystemStudentData();
    }
})();

// Export globally and for Node.js environments
if (typeof window !== 'undefined') {
    window.SeatSnapStore = {
        clearPreviousSystemData,
        loadSystemStudentData,
        saveSystemStudentData,
        getStudentsForYear,
        partitionClassroomsForYear,
        getStore: () => SeatSnapStudentStore
    };
    window.ROLL_NUMBERS = ROLL_NUMBERS;
    window.clearPreviousSystemData = clearPreviousSystemData;
    window.getAllRollNumbers = getAllRollNumbers;
    window.getRollNumbersBySection = getRollNumbersBySection;
    window.findStudentSection = findStudentSection;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ROLL_NUMBERS,
        clearPreviousSystemData,
        loadSystemStudentData,
        saveSystemStudentData,
        getStudentsForYear,
        partitionClassroomsForYear,
        getAllRollNumbers,
        getRollNumbersBySection,
        findStudentSection
    };
}
