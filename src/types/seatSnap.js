/**
 * SeatSnap Shared Data Contract & Defaults
 * Used across Member 1 (Ingestion), Member 2 (CRUD), and Member 3 (Allocation).
 */

const SEATSNAP_CONFIG = {
    STANDARD_CAPACITY: 28,      // 7 x 4 as finalized in Admin Plan
    EXTRA_ROOM_THRESHOLD: 8,   // Leftover >= 8 triggers extra room requirement
    DEFAULT_ACTIVE_YEAR: '2nd Year',
    SUPPORTED_YEARS: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    DEFAULT_STORAGE_KEY: 'seatsnap_student_data'
};

if (typeof window !== 'undefined') {
    window.SEATSNAP_CONFIG = SEATSNAP_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SEATSNAP_CONFIG };
}
