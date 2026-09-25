/**
 * SeatSnap - Excel Ingestion Service (Member 1)
 * Responsible for reading uploaded .xlsx / .xls / .csv files,
 * extracting student roll numbers, detecting academic years and lateral entries,
 * and structuring the student records by academic year (1st, 2nd, 3rd, 4th).
 */

class SeatSnapExcelParser {
    /**
     * Parse an uploaded File object (from file input or drag-and-drop)
     * @param {File|Blob|ArrayBuffer} fileOrBuffer
     * @param {string} [fileNameHint]
     * @returns {Promise<Object>} Extracted student dataset organized by academic year
     */
    static async parseFile(fileOrBuffer, fileNameHint = '') {
        return new Promise((resolve, reject) => {
            if (!fileOrBuffer) {
                return reject(new Error('No file provided for parsing.'));
            }

            const fileName = (fileOrBuffer.name || fileNameHint || '').toLowerCase();
            if (fileName) {
                const validExtensions = ['.xlsx', '.xls', '.csv'];
                const isValid = validExtensions.some(ext => fileName.endsWith(ext));
                if (!isValid) {
                    return reject(new Error('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV file.'));
                }
            }

            // Check if XLSX library is available
            const xlsxLib = typeof XLSX !== 'undefined' ? XLSX : (typeof window !== 'undefined' ? window.XLSX : null);
            if (!xlsxLib) {
                return reject(new Error('SheetJS (XLSX) library is not loaded. Please ensure xlsx.full.min.js is included.'));
            }

            const processArrayBuffer = (buffer) => {
                try {
                    const data = new Uint8Array(buffer);
                    const workbook = xlsxLib.read(data, { type: 'array' });

                    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                        return reject(new Error('The uploaded workbook contains no sheets.'));
                    }

                    const allStudents = [];

                    // Process all sheets in the workbook
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        if (!worksheet) return;

                        // Convert sheet to array of rows (header: 1 gives 2D array for robust header detection)
                        const rawMatrix = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        const parsedRows = this.extractStudentsFromMatrix(rawMatrix, sheetName);
                        allStudents.push(...parsedRows);
                    });

                    if (allStudents.length === 0) {
                        return reject(new Error('No valid student roll numbers found. Please verify column headers (e.g., "Roll Number", "Roll No", "HT No").'));
                    }

                    // Organize and sort by Academic Year
                    const organizedData = this.organizeByAcademicYear(allStudents);

                    // Update shared StudentDataContext if available
                    if (typeof window !== 'undefined' && window.StudentDataContext) {
                        window.StudentDataContext.setParsedData(organizedData, fileName);
                    } else if (typeof window !== 'undefined' && window.SeatSnapStore) {
                        window.SeatSnapStore.saveSystemStudentData(organizedData);
                    }

                    const summary = {
                        "1st Year": organizedData["1st Year"].length,
                        "2nd Year": organizedData["2nd Year"].length,
                        "3rd Year": organizedData["3rd Year"].length,
                        "4th Year": organizedData["4th Year"].length
                    };

                    resolve({
                        success: true,
                        fileName: fileOrBuffer.name || fileNameHint || 'uploaded_data.xlsx',
                        totalStudents: allStudents.length,
                        summary: summary,
                        data: organizedData
                    });

                } catch (err) {
                    console.error('Error processing workbook:', err);
                    reject(new Error('Failed to process Excel file: ' + err.message));
                }
            };

            // Browser FileReader branch
            if (typeof FileReader !== 'undefined' && fileOrBuffer instanceof Blob) {
                const reader = new FileReader();
                reader.onload = (e) => processArrayBuffer(e.target.result);
                reader.onerror = (err) => reject(new Error('File reading error: ' + err));
                reader.readAsArrayBuffer(fileOrBuffer);
            } else if (fileOrBuffer instanceof ArrayBuffer) {
                processArrayBuffer(fileOrBuffer);
            } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(fileOrBuffer)) {
                processArrayBuffer(fileOrBuffer);
            } else {
                reject(new Error('Unsupported file input type. Expected File, Blob, or ArrayBuffer.'));
            }
        });
    }

    /**
     * Detect header row and map rows to normalized Student objects
     */
    static extractStudentsFromMatrix(matrix, sheetName = '') {
        if (!matrix || matrix.length === 0) return [];

        // Scan first 15 rows to find the row containing roll number headers
        let headerRowIdx = -1;
        let rollColIdx = -1;
        let nameColIdx = -1;
        let deptColIdx = -1;
        let yearColIdx = -1;
        let secColIdx = -1;
        let typeColIdx = -1;

        const rollMatches = ['roll', 'rollno', 'rollnumber', 'htno', 'hallticket', 'pin', 'registration', 'regno', 'regdno', 'studentid', 'id'];

        for (let r = 0; r < Math.min(matrix.length, 15); r++) {
            const row = matrix[r];
            if (!Array.isArray(row)) continue;

            for (let c = 0; c < row.length; c++) {
                const val = String(row[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rollMatches.some(m => val === m || val.includes(m))) {
                    headerRowIdx = r;
                    rollColIdx = c;
                    break;
                }
            }
            if (headerRowIdx !== -1) break;
        }

        // If no explicit header row was detected, check if row 0 has data that looks like roll numbers
        if (headerRowIdx === -1) {
            headerRowIdx = 0;
            rollColIdx = 0;
        } else {
            // Map other columns based on the detected header row
            const headerRow = matrix[headerRowIdx];
            for (let c = 0; c < headerRow.length; c++) {
                if (c === rollColIdx) continue;
                const hVal = String(headerRow[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

                if (['name', 'studentname', 'candidatename'].some(m => hVal.includes(m))) {
                    nameColIdx = c;
                } else if (['dept', 'department', 'branch'].some(m => hVal.includes(m))) {
                    deptColIdx = c;
                } else if (['year', 'academicyear', 'class', 'sem'].some(m => hVal.includes(m))) {
                    yearColIdx = c;
                } else if (['section', 'sec'].some(m => hVal.includes(m))) {
                    secColIdx = c;
                } else if (['admission', 'type', 'category', 'admissiontype', 'entry'].some(m => hVal.includes(m))) {
                    typeColIdx = c;
                }
            }
        }

        const students = [];
        const seenRolls = new Set();

        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
            const row = matrix[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            const rawRoll = row[rollColIdx];
            if (!rawRoll) continue;

            const cleanRoll = String(rawRoll).trim().toUpperCase();
            // Valid roll number format check (minimum 5 chars, alphanumeric)
            if (cleanRoll.length < 5 || seenRolls.has(cleanRoll) || cleanRoll === 'ROLL NO' || cleanRoll === 'ROLL NUMBER') {
                continue;
            }

            seenRolls.add(cleanRoll);

            const rawName = nameColIdx !== -1 ? row[nameColIdx] : null;
            const name = rawName ? String(rawName).trim() : `Student ${cleanRoll}`;

            let dept = deptColIdx !== -1 ? String(row[deptColIdx] || '').trim().toUpperCase() : '';
            if (!dept) {
                dept = this.inferDepartmentFromRoll(cleanRoll);
            }

            let yearHint = yearColIdx !== -1 ? String(row[yearColIdx] || '').trim() : '';
            const academicYear = this.inferYear(cleanRoll, sheetName, yearHint);

            const rawType = typeColIdx !== -1 ? String(row[typeColIdx] || '').trim() : '';
            const isLateral = this.checkIsLateral(cleanRoll, rawType);

            const section = secColIdx !== -1 ? String(row[secColIdx] || '').trim().toUpperCase() : 'A';

            students.push({
                id: `STU_${cleanRoll}`,
                rollNumber: cleanRoll,
                name: name,
                department: dept,
                academicYear: academicYear,
                section: section,
                isLateral: isLateral,
                status: 'active'
            });
        }

        return students;
    }

    /**
     * Infer Department from roll number code (e.g., 24WH1A0501 -> 05: CSE)
     */
    static inferDepartmentFromRoll(roll) {
        const upper = roll.toUpperCase();
        if (upper.includes('A05') || upper.includes('5A05')) return 'CSE';
        if (upper.includes('A66') || upper.includes('5A66')) return 'AIML';
        if (upper.includes('A04') || upper.includes('A55') || upper.includes('5A04')) return 'ECE';
        if (upper.includes('A02') || upper.includes('A44') || upper.includes('5A02')) return 'EEE';
        if (upper.includes('A12') || upper.includes('5A12')) return 'IT';
        if (upper.includes('A03') || upper.includes('5A03')) return 'MECH';
        return 'CSE';
    }

    /**
     * Infer Academic Year based on roll number patterns, sheet title, or year hints
     */
    static inferYear(roll, sheetName = '', explicitYear = '') {
        const text = `${explicitYear} ${sheetName} ${roll}`.toLowerCase();

        if (text.includes('1st') || text.includes('year 1') || text.includes('first')) return '1st Year';
        if (text.includes('3rd') || text.includes('year 3') || text.includes('third')) return '3rd Year';
        if (text.includes('4th') || text.includes('year 4') || text.includes('fourth')) return '4th Year';
        if (text.includes('2nd') || text.includes('year 2') || text.includes('second')) return '2nd Year';

        const upper = roll.toUpperCase();

        // Standard batch prefixes:
        // 2nd Year: 24WH1A (regular batch of 2024) or 25WH5A (lateral entries admitted 2025 into 2nd year)
        if (upper.startsWith('24WH1A') || upper.startsWith('25WH5A') || upper.startsWith('24')) {
            return '2nd Year';
        }
        // 1st Year: 25WH1A
        if (upper.startsWith('25WH1A')) {
            return '1st Year';
        }
        // 3rd Year: 23WH1A or 24WH5A
        if (upper.startsWith('23WH1A') || upper.startsWith('24WH5A') || upper.startsWith('23')) {
            return '3rd Year';
        }
        // 4th Year: 22WH1A or 23WH5A
        if (upper.startsWith('22WH1A') || upper.startsWith('23WH5A') || upper.startsWith('22')) {
            return '4th Year';
        }

        // Default to 2nd Year as specified in project requirements
        return '2nd Year';
    }

    /**
     * Check if a student is Lateral Entry
     * (Contains '5A' in BVRIT roll format, or admission column specifies 'lateral')
     */
    static checkIsLateral(roll, typeStr = '') {
        if (/5A/i.test(roll)) return true;
        if (typeStr && /lateral|le/i.test(typeStr)) return true;
        return false;
    }

    /**
     * Group and sort students by academic year in ascending alphanumeric order
     */
    static organizeByAcademicYear(students) {
        const organized = {
            "1st Year": [],
            "2nd Year": [],
            "3rd Year": [],
            "4th Year": []
        };

        students.forEach(student => {
            const yr = student.academicYear;
            const key = organized[yr] ? yr : "2nd Year";
            organized[key].push(student);
        });

        // Ensure strict ascending roll number order inside each year
        Object.keys(organized).forEach(year => {
            organized[year].sort((a, b) =>
                a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' })
            );
        });

        return organized;
    }

    /**
     * Generate sample 2nd-Year dataset records in memory (55 regular + 10 lateral = 65 students)
     */
    static getSample2ndYearDataset() {
        const sampleStudents = [];
        let sno = 1;

        // 55 Regular 2nd-Year CSE students
        for (let i = 1; i <= 55; i++) {
            const roll = `24WH1A05${String(i).padStart(2, '0')}`;
            sampleStudents.push({
                sno: sno++,
                id: `STU_${roll}`,
                rollNumber: roll,
                name: `Student CSE ${String(i).padStart(2, '0')}`,
                department: "CSE",
                academicYear: "2nd Year",
                section: i <= 28 ? "CSE-A" : "CSE-B",
                isLateral: false,
                admissionType: "Regular",
                status: 'active'
            });
        }

        // 10 Lateral Entry 2nd-Year students (25WH5A0501 - 25WH5A0510)
        for (let i = 1; i <= 10; i++) {
            const roll = `25WH5A05${String(i).padStart(2, '0')}`;
            sampleStudents.push({
                sno: sno++,
                id: `STU_${roll}`,
                rollNumber: roll,
                name: `Lateral Student ${String(i).padStart(2, '0')}`,
                department: "CSE",
                academicYear: "2nd Year",
                section: "CSE-B",
                isLateral: true,
                admissionType: "Lateral Entry",
                status: 'active'
            });
        }

        return sampleStudents;
    }

    /**
     * Generate and download a sample 2nd-year Excel file for the user
     */
    static downloadSample2ndYearExcel() {
        const xlsxLib = typeof XLSX !== 'undefined' ? XLSX : (typeof window !== 'undefined' ? window.XLSX : null);
        if (!xlsxLib) {
            alert('XLSX library not available to generate file.');
            return;
        }

        const rawStudents = this.getSample2ndYearDataset();
        const exportData = rawStudents.map(s => ({
            "S.No": s.sno,
            "Roll Number": s.rollNumber,
            "Student Name": s.name,
            "Department": s.department,
            "Academic Year": s.academicYear,
            "Section": s.section,
            "Admission Type": s.admissionType
        }));

        const worksheet = xlsxLib.utils.json_to_sheet(exportData);
        const workbook = xlsxLib.utils.book_new();
        xlsxLib.utils.book_append_sheet(workbook, worksheet, "2nd Year Students");

        xlsxLib.writeFile(workbook, "seatsnap_2nd_year_students_sample.xlsx");
    }
}

// Global & CommonJS exports
if (typeof window !== 'undefined') {
    window.SeatSnapExcelParser = SeatSnapExcelParser;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeatSnapExcelParser;
}
