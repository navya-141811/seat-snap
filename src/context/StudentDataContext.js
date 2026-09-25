/**
 * SeatSnap - Global Student Data Context & State Provider (Member 1)
 * Serves as the single source of truth for student datasets, academic years,
 * classroom partitioning, and provides mutation hooks for Member 2 (CRUD)
 * and Member 3 (Classroom Allocation Engine).
 */

const STORAGE_KEY = 'seatsnap_student_data';
const META_KEY = 'seatsnap_data_meta';

class StudentDataState {
    constructor() {
        this.students = {
            "1st Year": [],
            "2nd Year": [],
            "3rd Year": [],
            "4th Year": []
        };
        this.activeYear = '2nd Year';
        this.selectedClassroom = null;
        this.meta = {
            fileName: null,
            lastUploadedAt: null,
            totalStudents: 0
        };
        this.listeners = new Set();
        this.standardCapacity = 28; // 7 x 4 as agreed in baseline

        this.loadFromStorage();
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback
     * @returns {Function} Unsubscribe callback
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify(eventType = 'change', payload = null) {
        this.listeners.forEach(listener => {
            try {
                listener({ eventType, state: this.getState(), payload });
            } catch (err) {
                console.error('Error in StudentDataContext subscriber:', err);
            }
        });
    }

    getState() {
        return {
            students: this.students,
            activeYear: this.activeYear,
            selectedClassroom: this.selectedClassroom,
            meta: this.meta,
            summary: this.getSummary(),
            standardCapacity: this.standardCapacity
        };
    }

    /**
     * Load persisted student data from localStorage
     */
    loadFromStorage() {
        try {
            if (typeof localStorage === 'undefined') return;

            const stored = localStorage.getItem(STORAGE_KEY);
            const storedMeta = localStorage.getItem(META_KEY);

            if (stored) {
                const parsed = JSON.parse(stored);
                this.students = {
                    "1st Year": parsed["1st Year"] || [],
                    "2nd Year": parsed["2nd Year"] || [],
                    "3rd Year": parsed["3rd Year"] || [],
                    "4th Year": parsed["4th Year"] || []
                };
            }

            if (storedMeta) {
                this.meta = JSON.parse(storedMeta);
            } else {
                this.updateMeta(null);
            }

            this.syncRollNumbersGlobal();
        } catch (e) {
            console.error('Failed to load student data from storage:', e);
        }
    }

    /**
     * Save current state to localStorage
     */
    saveToStorage() {
        try {
            if (typeof localStorage === 'undefined') return;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.students));
            localStorage.setItem(META_KEY, JSON.stringify(this.meta));
            this.syncRollNumbersGlobal();
        } catch (e) {
            console.error('Failed to save student data to storage:', e);
        }
    }

    /**
     * Set new parsed data from Excel ingestion
     */
    setParsedData(dataByYear, fileName = 'student_data.xlsx') {
        this.students = {
            "1st Year": dataByYear["1st Year"] || [],
            "2nd Year": dataByYear["2nd Year"] || [],
            "3rd Year": dataByYear["3rd Year"] || [],
            "4th Year": dataByYear["4th Year"] || []
        };

        // Sort each academic year in strict ascending alphanumeric order
        Object.keys(this.students).forEach(year => {
            this.students[year].sort((a, b) =>
                a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' })
            );
        });

        this.meta = {
            fileName: fileName,
            lastUploadedAt: new Date().toISOString(),
            totalStudents: this.getTotalCount()
        };

        this.selectedClassroom = null;
        this.saveToStorage();
        this.notify('data_uploaded', { summary: this.getSummary() });
    }

    /**
     * Purge and clear all student data
     */
    clearAllData() {
        this.students = {
            "1st Year": [],
            "2nd Year": [],
            "3rd Year": [],
            "4th Year": []
        };
        this.selectedClassroom = null;
        this.meta = {
            fileName: null,
            lastUploadedAt: null,
            totalStudents: 0
        };

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(META_KEY);
                localStorage.removeItem('seatsnap_academic_years');
                localStorage.removeItem('seatsnap_classroom_assignments');
            }
        } catch (e) {
            console.error(e);
        }

        this.syncRollNumbersGlobal();
        this.notify('data_cleared');
    }

    /**
     * Set the currently active academic year card
     */
    setActiveYear(year) {
        if (this.students[year]) {
            this.activeYear = year;
            this.selectedClassroom = null;
            this.notify('year_changed', { year });
        }
    }

    /**
     * Select a specific classroom to inspect its roll numbers
     */
    selectClassroom(classroom) {
        this.selectedClassroom = classroom;
        this.notify('classroom_selected', { classroom });
    }

    /**
     * Deselect current classroom (return to classroom cards view)
     */
    clearSelectedClassroom() {
        this.selectedClassroom = null;
        this.notify('classroom_deselected');
    }

    /**
     * Get students for a specific academic year
     */
    getStudentsForYear(year = this.activeYear) {
        return this.students[year] || [];
    }

    /**
     * Partition students of an academic year into standard classrooms (Capacity: 28)
     */
    getClassroomsForYear(year = this.activeYear, capacity = this.standardCapacity) {
        const students = this.getStudentsForYear(year);
        const classrooms = [];

        if (!students || students.length === 0) {
            return classrooms;
        }

        const totalStudents = students.length;
        let roomIndex = 1;

        for (let i = 0; i < totalStudents; i += capacity) {
            const slice = students.slice(i, i + capacity);
            const firstRoll = slice[0]?.rollNumber || '';
            const lastRoll = slice[slice.length - 1]?.rollNumber || '';
            const lateralCount = slice.filter(s => s.isLateral).length;

            classrooms.push({
                roomId: `CR-${100 + roomIndex}`,
                roomName: `Classroom ${100 + roomIndex}`,
                capacity: capacity,
                studentsCount: slice.length,
                isFull: slice.length === capacity,
                assignedStudents: slice,
                isExtraRoom: false,
                lateralCount: lateralCount,
                rollRange: {
                    start: firstRoll,
                    end: lastRoll
                }
            });
            roomIndex++;
        }

        return classrooms;
    }

    /**
     * Member 2 Hook: Add a student maintaining ascending roll number order
     */
    addStudent(studentData, year = this.activeYear) {
        if (!studentData || !studentData.rollNumber) return false;

        const cleanRoll = String(studentData.rollNumber).trim().toUpperCase();
        const yearList = this.students[year] || [];

        // Check if student already exists
        if (yearList.some(s => s.rollNumber === cleanRoll)) {
            throw new Error(`Student with Roll Number ${cleanRoll} already exists.`);
        }

        const newStudent = {
            id: studentData.id || `STU_${cleanRoll}`,
            rollNumber: cleanRoll,
            name: studentData.name || `Student ${cleanRoll}`,
            department: studentData.department || 'CSE',
            academicYear: year,
            section: studentData.section || 'A',
            isLateral: !!studentData.isLateral,
            status: studentData.status || 'active'
        };

        // Insert in ascending position
        let inserted = false;
        for (let i = 0; i < yearList.length; i++) {
            if (newStudent.rollNumber.localeCompare(yearList[i].rollNumber, undefined, { numeric: true, sensitivity: 'base' }) < 0) {
                yearList.splice(i, 0, newStudent);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            yearList.push(newStudent);
        }

        this.students[year] = yearList;
        this.saveToStorage();
        this.notify('student_added', { student: newStudent, year });
        return true;
    }

    /**
     * Member 2 Hook: Remove/detain a student cleanly
     */
    removeStudent(rollNumber, year = this.activeYear) {
        const cleanRoll = String(rollNumber).trim().toUpperCase();
        const yearList = this.students[year] || [];
        const index = yearList.findIndex(s => s.rollNumber === cleanRoll);

        if (index === -1) return false;

        const [removed] = yearList.splice(index, 1);
        this.students[year] = yearList;

        // If the removed student was in the active classroom view, refresh it
        if (this.selectedClassroom) {
            const updatedClassrooms = this.getClassroomsForYear(year);
            const found = updatedClassrooms.find(c => c.roomId === this.selectedClassroom.roomId);
            this.selectedClassroom = found || null;
        }

        this.saveToStorage();
        this.notify('student_removed', { removed, year });
        return true;
    }

    /**
     * Member 3 Hook: Update or set manual classroom allocations
     */
    setCustomClassrooms(year, customClassrooms) {
        this.notify('classrooms_reallocated', { year, classrooms: customClassrooms });
    }

    getSummary() {
        return {
            "1st Year": (this.students["1st Year"] || []).length,
            "2nd Year": (this.students["2nd Year"] || []).length,
            "3rd Year": (this.students["3rd Year"] || []).length,
            "4th Year": (this.students["4th Year"] || []).length,
            total: this.getTotalCount()
        };
    }

    getTotalCount() {
        return Object.values(this.students).reduce((sum, list) => sum + list.length, 0);
    }

    updateMeta(fileName) {
        this.meta = {
            fileName: fileName,
            lastUploadedAt: fileName ? new Date().toISOString() : null,
            totalStudents: this.getTotalCount()
        };
    }

    /**
     * Synchronize with global ROLL_NUMBERS for legacy seating modules
     */
    syncRollNumbersGlobal() {
        if (typeof window === 'undefined') return;

        window.ROLL_NUMBERS = window.ROLL_NUMBERS || {};
        Object.keys(window.ROLL_NUMBERS).forEach(key => delete window.ROLL_NUMBERS[key]);

        Object.entries(this.students).forEach(([year, studentList]) => {
            studentList.forEach(student => {
                const sectionKey = `${year} ${student.department || 'CSE'} ${student.section || 'A'}`;
                if (!window.ROLL_NUMBERS[sectionKey]) {
                    window.ROLL_NUMBERS[sectionKey] = [];
                }
                if (!window.ROLL_NUMBERS[sectionKey].includes(student.rollNumber)) {
                    window.ROLL_NUMBERS[sectionKey].push(student.rollNumber);
                }
            });
        });

        // Also expose SeatSnapStore compatibility wrapper
        window.SeatSnapStore = {
            clearPreviousSystemData: () => this.clearAllData(),
            loadSystemStudentData: () => this.students,
            saveSystemStudentData: (data) => this.setParsedData(data),
            getStudentsForYear: (yr) => this.getStudentsForYear(yr),
            partitionClassroomsForYear: (yr, cap) => this.getClassroomsForYear(yr, cap),
            getStore: () => this.students
        };
    }
}

// Singleton state instance
const StudentDataContext = new StudentDataState();

if (typeof window !== 'undefined') {
    window.StudentDataContext = StudentDataContext;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StudentDataContext;
}
