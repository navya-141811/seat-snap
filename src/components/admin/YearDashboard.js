/**
 * SeatSnap - YearDashboard Component (Member 1)
 * Renders:
 * 1. Year Selection Cards (2nd Year active & selectable; others disabled/coming soon)
 * 2. Classrooms Grid for selected Year (7 x 4 = 28 capacity standard)
 * 3. Classroom Student Roster View (showing roll numbers, names, lateral tags)
 */

class YearDashboardComponent {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = options;
        this.activeYear = '2nd Year';
        this.selectedClassroom = null;
        this.searchQuery = '';

        this.init();
    }

    init() {
        if (!this.container) return;

        // Subscribe to global StudentDataContext changes
        if (typeof window !== 'undefined' && window.StudentDataContext) {
            window.StudentDataContext.subscribe(({ eventType, state, payload }) => {
                if (eventType === 'classroom_selected') {
                    this.selectedClassroom = payload.classroom;
                } else if (eventType === 'classroom_deselected') {
                    this.selectedClassroom = null;
                } else if (eventType === 'year_changed') {
                    this.activeYear = payload.year;
                    this.selectedClassroom = null;
                }
                this.render();
            });

            // Initial state sync
            const state = window.StudentDataContext.getState();
            this.activeYear = state.activeYear || '2nd Year';
            this.selectedClassroom = state.selectedClassroom;
        }

        this.render();
    }

    render() {
        if (!this.container) return;

        const state = window.StudentDataContext ? window.StudentDataContext.getState() : {
            students: { "1st Year": [], "2nd Year": [], "3rd Year": [], "4th Year": [] },
            summary: { "1st Year": 0, "2nd Year": 0, "3rd Year": 0, "4th Year": 0, total: 0 }
        };

        const yearCounts = state.summary || { "1st Year": 0, "2nd Year": 0, "3rd Year": 0, "4th Year": 0 };
        const secondYearStudents = (state.students && state.students['2nd Year']) ? state.students['2nd Year'] : [];

        this.container.innerHTML = `
            <div class="year-dashboard-wrapper">
                <!-- Academic Year Selection Cards -->
                <div class="year-cards-header">
                    <div>
                        <h3 class="section-title">🎓 Academic Year Selection</h3>
                        <p class="section-subtitle">Select an academic year to inspect classrooms and student roll numbers.</p>
                    </div>
                    ${secondYearStudents.length > 0 ? `
                        <button type="button" class="btn-clear-data" id="dashboardClearBtn" title="Purge all student data">
                            🗑️ Clear Student Data
                        </button>
                    ` : ''}
                </div>

                <div class="year-cards-grid">
                    <!-- 1st Year -->
                    <div class="year-card disabled" data-year="1st Year">
                        <div class="year-badge badge-muted">🔒 Coming Soon</div>
                        <div class="year-card-icon">1️⃣</div>
                        <h4 class="year-card-title">1st Year</h4>
                        <div class="year-student-count">${yearCounts["1st Year"] || 0} Students</div>
                        <p class="year-card-desc">Batch enrollment pending</p>
                    </div>

                    <!-- 2nd Year (ACTIVE & SELECTABLE) -->
                    <div class="year-card active ${this.activeYear === '2nd Year' ? 'selected' : ''}" id="yearCard2nd" data-year="2nd Year" style="cursor: pointer;">
                        <div class="year-badge badge-active">✨ Active Batch</div>
                        <div class="year-card-icon">2️⃣</div>
                        <h4 class="year-card-title">2nd Year</h4>
                        <div class="year-student-count highlight"><strong>${secondYearStudents.length}</strong> Students</div>
                        <p class="year-card-desc">Click to view classrooms & roll numbers</p>
                    </div>

                    <!-- 3rd Year -->
                    <div class="year-card disabled" data-year="3rd Year">
                        <div class="year-badge badge-muted">🔒 Coming Soon</div>
                        <div class="year-card-icon">3️⃣</div>
                        <h4 class="year-card-title">3rd Year</h4>
                        <div class="year-student-count">${yearCounts["3rd Year"] || 0} Students</div>
                        <p class="year-card-desc">Batch enrollment pending</p>
                    </div>

                    <!-- 4th Year -->
                    <div class="year-card disabled" data-year="4th Year">
                        <div class="year-badge badge-muted">🔒 Coming Soon</div>
                        <div class="year-card-icon">4️⃣</div>
                        <h4 class="year-card-title">4th Year</h4>
                        <div class="year-student-count">${yearCounts["4th Year"] || 0} Students</div>
                        <p class="year-card-desc">Batch enrollment pending</p>
                    </div>
                </div>

                <!-- Classroom & Student Details Area -->
                <div class="classrooms-container" id="classroomsContainer">
                    ${this.renderClassroomOrStudentView(secondYearStudents)}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderClassroomOrStudentView(students) {
        // If a specific classroom is selected, render its student roster view!
        if (this.selectedClassroom) {
            return this.renderClassroomRoster(this.selectedClassroom);
        }

        // If no students exist yet for 2nd Year
        if (!students || students.length === 0) {
            return `
                <div class="empty-state-card">
                    <div class="empty-icon">📁</div>
                    <h4>No 2nd-Year Student Data Loaded</h4>
                    <p>Upload your student Excel (.xlsx / .xls) file above to automatically extract 2nd-year roll numbers and generate classrooms.</p>
                    <div style="margin-top: 15px;">
                        <button type="button" class="btn-sample-load" id="emptyStateSampleBtn">
                            ⚡ Or Click Here to Load 2nd-Year Sample Dataset
                        </button>
                    </div>
                </div>
            `;
        }

        // Calculate classrooms (Capacity: 28)
        const classrooms = window.StudentDataContext ?
            window.StudentDataContext.getClassroomsForYear('2nd Year', 28) : [];

        const totalStudents = students.length;
        const capacity = 28;
        const regularRooms = Math.floor(totalStudents / capacity);
        const remainder = totalStudents % capacity;

        return `
            <div class="classrooms-header-row">
                <div>
                    <h3 class="classrooms-section-title">
                        🏫 2nd Year Classrooms 
                        <span class="room-count-badge">${classrooms.length} Rooms Generated</span>
                    </h3>
                    <p class="classrooms-section-subtitle">
                        Standard room capacity: <strong>7 × 4 = 28 seats</strong>. Total 2nd-year students: <strong>${totalStudents}</strong>.
                        ${remainder > 0 ? `(${regularRooms} full rooms of 28 + 1 room with ${remainder} students)` : `(${regularRooms} perfectly filled rooms of 28)`}
                    </p>
                </div>
                <div class="rule-hint-box">
                    <span>💡 <strong>Capacity Rule:</strong> 28 seats/room. Click any room card below to inspect its roll numbers.</span>
                </div>
            </div>

            <div class="classroom-cards-grid">
                ${classrooms.map((room, index) => {
                    const percentFull = Math.min(100, Math.round((room.studentsCount / room.capacity) * 100));
                    return `
                        <div class="classroom-card" data-room-id="${room.roomId}">
                            <div class="room-card-top">
                                <span class="room-number-tag">🚪 ${room.roomName}</span>
                                <span class="room-capacity-tag ${room.isFull ? 'cap-full' : 'cap-partial'}">
                                    ${room.studentsCount} / ${room.capacity} Seats
                                </span>
                            </div>

                            <div class="room-card-body">
                                <div class="capacity-meter">
                                    <div class="capacity-bar" style="width: ${percentFull}%;"></div>
                                </div>

                                <div class="room-roll-range">
                                    <span class="range-label">Roll Range:</span>
                                    <span class="range-values">
                                        <code>${room.rollRange.start}</code> → <code>${room.rollRange.end}</code>
                                    </span>
                                </div>

                                ${room.lateralCount > 0 ? `
                                    <div class="room-lateral-badge">
                                        ⭐ ${room.lateralCount} Lateral ${room.lateralCount === 1 ? 'Entry' : 'Entries'}
                                    </div>
                                ` : ''}
                            </div>

                            <div class="room-card-footer">
                                <button type="button" class="btn-inspect-room" data-room-id="${room.roomId}">
                                    📋 View Roll Numbers (${room.studentsCount}) ➔
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderClassroomRoster(classroom) {
        const students = classroom.assignedStudents || [];
        const filteredStudents = this.searchQuery ?
            students.filter(s =>
                s.rollNumber.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                (s.name && s.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
            ) : students;

        return `
            <div class="room-detail-view">
                <div class="room-detail-header">
                    <div class="detail-header-left">
                        <button type="button" class="btn-back-classrooms" id="backToClassroomsBtn">
                            ⬅ Back to Classrooms
                        </button>
                        <div class="detail-title-group">
                            <h2>🏫 ${classroom.roomName} Student Roster</h2>
                            <p class="detail-meta">
                                Capacity: <strong>${classroom.capacity} seats</strong> | Assigned: <strong>${classroom.studentsCount} students</strong>
                                ${classroom.lateralCount > 0 ? ` | Lateral Entries: <strong>${classroom.lateralCount}</strong>` : ''}
                            </p>
                        </div>
                    </div>
                    <div class="detail-header-right">
                        <input 
                            type="text" 
                            id="rosterSearchInput" 
                            class="roster-search" 
                            placeholder="🔍 Filter roll number or name..." 
                            value="${this.searchQuery || ''}"
                        />
                    </div>
                </div>

                <!-- Member 2 & 3 Hooks Banner -->
                <div class="integration-banner">
                    <div class="integration-info">
                        <strong>📌 Seating Roster:</strong> Showing roll numbers assigned to <strong>${classroom.roomName}</strong> in strictly ascending alphanumeric order.
                    </div>
                </div>

                <!-- Student Roll Numbers Table -->
                <div class="table-responsive">
                    <table class="student-roster-table">
                        <thead>
                            <tr>
                                <th style="width: 60px;">#</th>
                                <th>Roll Number</th>
                                <th>Student Name</th>
                                <th>Branch</th>
                                <th>Section</th>
                                <th>Admission Type</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredStudents.length > 0 ? filteredStudents.map((student, idx) => `
                                <tr class="${student.isLateral ? 'lateral-row' : ''}">
                                    <td class="text-muted">${idx + 1}</td>
                                    <td>
                                        <span class="roll-number-badge">${student.rollNumber}</span>
                                        ${student.isLateral ? `<span class="badge-lateral-entry">Lateral Entry</span>` : ''}
                                    </td>
                                    <td class="student-name-cell">${student.name || '-'}</td>
                                    <td><span class="dept-badge">${student.department || 'CSE'}</span></td>
                                    <td>${student.section || 'A'}</td>
                                    <td>${student.isLateral ? 'Lateral (5A)' : 'Regular (1A)'}</td>
                                    <td><span class="status-active-pill">● Active</span></td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="7" class="text-center" style="padding: 30px; color: #718096;">
                                        No students found matching "${this.searchQuery}".
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                <div class="detail-footer">
                    <span>Showing <strong>${filteredStudents.length}</strong> of <strong>${students.length}</strong> students in ${classroom.roomName}</span>
                    <button type="button" class="btn-back-classrooms-bottom" id="backToClassroomsBottomBtn">
                        ⬅ Back to All Classrooms
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // 2nd Year Card click
        const card2nd = this.container.querySelector('#yearCard2nd');
        if (card2nd) {
            card2nd.addEventListener('click', () => {
                if (window.StudentDataContext) {
                    window.StudentDataContext.setActiveYear('2nd Year');
                }
            });
        }

        // Disabled Year Cards alert
        const disabledCards = this.container.querySelectorAll('.year-card.disabled');
        disabledCards.forEach(card => {
            card.addEventListener('click', () => {
                const yr = card.getAttribute('data-year');
                alert(`ℹ️ ${yr} is marked "Coming Soon". Currently, SeatSnap is focused on 2nd-Year student data ingestion & allocation.`);
            });
        });

        // Classroom card click / inspect button click
        const inspectBtns = this.container.querySelectorAll('.btn-inspect-room');
        inspectBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const roomId = btn.getAttribute('data-room-id');
                this.handleClassroomClick(roomId);
            });
        });

        const classroomCards = this.container.querySelectorAll('.classroom-card');
        classroomCards.forEach(card => {
            card.addEventListener('click', () => {
                const roomId = card.getAttribute('data-room-id');
                this.handleClassroomClick(roomId);
            });
        });

        // Back to Classrooms buttons
        const backBtn = this.container.querySelector('#backToClassroomsBtn');
        const backBottomBtn = this.container.querySelector('#backToClassroomsBottomBtn');
        [backBtn, backBottomBtn].forEach(b => {
            if (b) {
                b.addEventListener('click', () => {
                    this.searchQuery = '';
                    if (window.StudentDataContext) {
                        window.StudentDataContext.clearSelectedClassroom();
                    } else {
                        this.selectedClassroom = null;
                        this.render();
                    }
                });
            }
        });

        // Search input in roster
        const searchInput = this.container.querySelector('#rosterSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                // Targeted re-render of table or full render
                this.render();
                const newSearch = this.container.querySelector('#rosterSearchInput');
                if (newSearch) {
                    newSearch.focus();
                    newSearch.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
                }
            });
        }

        // Clear button
        const clearBtn = this.container.querySelector('#dashboardClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('⚠️ Are you sure you want to clear all student datasets from the system? You will need to upload a new Excel file.')) {
                    if (window.StudentDataContext) {
                        window.StudentDataContext.clearAllData();
                    }
                }
            });
        }

        // Empty state sample load button
        const emptyStateSampleBtn = this.container.querySelector('#emptyStateSampleBtn');
        if (emptyStateSampleBtn) {
            emptyStateSampleBtn.addEventListener('click', () => {
                const uploadComp = window.currentExcelUploadComponent;
                if (uploadComp && uploadComp.loadInstantSample) {
                    uploadComp.loadInstantSample();
                } else if (typeof SeatSnapExcelParser !== 'undefined') {
                    const sampleStudents = SeatSnapExcelParser.getSample2ndYearDataset();
                    const organized = SeatSnapExcelParser.organizeByAcademicYear(sampleStudents);
                    if (window.StudentDataContext) {
                        window.StudentDataContext.setParsedData(organized, 'sample_2nd_year_students.xlsx');
                    }
                }
            });
        }
    }

    handleClassroomClick(roomId) {
        if (!window.StudentDataContext) return;

        const classrooms = window.StudentDataContext.getClassroomsForYear('2nd Year', 28);
        const room = classrooms.find(r => r.roomId === roomId);
        if (room) {
            this.searchQuery = '';
            window.StudentDataContext.selectClassroom(room);
        }
    }
}

if (typeof window !== 'undefined') {
    window.YearDashboardComponent = YearDashboardComponent;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = YearDashboardComponent;
}
