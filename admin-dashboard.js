/**
 * SeatSnap - Admin Dashboard Controller (Member 1)
 * Integrates ExcelUploadComponent, YearDashboardComponent, and StudentDataContext.
 */

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
});

function initAdminDashboard() {
    console.log('🚀 Initializing SeatSnap Admin Dashboard (Member 1)...');

    // 1. Mount Excel Upload Component
    const uploadMount = document.getElementById('excelUploadContainer');
    if (uploadMount) {
        window.currentExcelUploadComponent = new ExcelUploadComponent('excelUploadContainer', {
            onUploadSuccess: (result) => {
                console.log('Ingestion success:', result);
                // Automatically switch view to 2nd Year
                if (window.StudentDataContext) {
                    window.StudentDataContext.setActiveYear('2nd Year');
                }
            }
        });
    }

    // 2. Mount Year & Classroom Dashboard Component
    const yearDashboardMount = document.getElementById('yearDashboardContainer');
    if (yearDashboardMount) {
        window.currentYearDashboardComponent = new YearDashboardComponent('yearDashboardContainer');
    }

    // 3. Tab switching between "Student Data & Classrooms" and "Exam Arrangement Generator"
    setupDashboardTabs();
}

function setupDashboardTabs() {
    const tabData = document.getElementById('tabStudentData');
    const tabArrangement = document.getElementById('tabArrangementGen');
    const sectionData = document.getElementById('sectionStudentData');
    const sectionArrangement = document.getElementById('sectionArrangementGen');

    if (!tabData || !tabArrangement) return;

    tabData.addEventListener('click', () => {
        tabData.classList.add('active');
        tabArrangement.classList.remove('active');
        if (sectionData) sectionData.style.display = 'block';
        if (sectionArrangement) sectionArrangement.style.display = 'none';
    });

    tabArrangement.addEventListener('click', () => {
        tabArrangement.classList.add('active');
        tabData.classList.remove('active');
        if (sectionData) sectionData.style.display = 'none';
        if (sectionArrangement) sectionArrangement.style.display = 'block';
    });
}
