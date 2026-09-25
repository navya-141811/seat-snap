/**
 * SeatSnap - ExcelUpload Component (Member 1)
 * Handles file drag-and-drop, file selection, format validation,
 * sample file generation, and triggering the Excel parser service.
 */

class ExcelUploadComponent {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = options;
        this.isProcessing = false;
        this.render();
        this.attachEventListeners();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="excel-upload-wrapper">
                <div class="upload-header-row">
                    <div>
                        <h3 class="upload-title">📥 Upload Student Data</h3>
                        <p class="upload-subtitle">Upload Excel (.xlsx, .xls) or CSV file containing student roll numbers and details.</p>
                    </div>
                    <div class="upload-actions-top">
                        <button type="button" class="btn-sample-download" id="downloadSampleBtn" title="Download formatted 2nd Year sample template">
                            📄 Download Sample Template
                        </button>
                        <button type="button" class="btn-quick-sample" id="quickSampleBtn" title="Load sample dataset instantly for testing">
                            ⚡ Load Sample Data (65 Students)
                        </button>
                    </div>
                </div>

                <div class="drop-zone" id="dropZone">
                    <input type="file" id="fileInput" accept=".xlsx, .xls, .csv" style="display: none;" />
                    <div class="drop-zone-content">
                        <div class="drop-icon">📊</div>
                        <h4 class="drop-heading">Drag and drop your Excel file here</h4>
                        <p class="drop-or">or</p>
                        <button type="button" class="btn-browse" id="browseBtn">Browse Files</button>
                        <p class="drop-hint">Supported formats: .xlsx, .xls, .csv</p>
                    </div>
                </div>

                <div class="upload-status-area" id="uploadStatusArea" style="display: none;"></div>
            </div>
        `;
    }

    attachEventListeners() {
        const dropZone = this.container.querySelector('#dropZone');
        const fileInput = this.container.querySelector('#fileInput');
        const browseBtn = this.container.querySelector('#browseBtn');
        const downloadSampleBtn = this.container.querySelector('#downloadSampleBtn');
        const quickSampleBtn = this.container.querySelector('#quickSampleBtn');

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
        }

        if (dropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('drag-active');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('drag-active');
                });
            });

            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt ? dt.files : null;
                if (files && files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
        }

        if (downloadSampleBtn) {
            downloadSampleBtn.addEventListener('click', () => {
                if (typeof SeatSnapExcelParser !== 'undefined' && SeatSnapExcelParser.downloadSample2ndYearExcel) {
                    SeatSnapExcelParser.downloadSample2ndYearExcel();
                } else {
                    alert('Sample generator is initializing. Please try again.');
                }
            });
        }

        if (quickSampleBtn) {
            quickSampleBtn.addEventListener('click', () => {
                this.loadInstantSample();
            });
        }

        // Listen for context resets
        if (typeof window !== 'undefined' && window.StudentDataContext) {
            window.StudentDataContext.subscribe(({ eventType, state }) => {
                if (eventType === 'data_cleared') {
                    this.showStatus('info', 'All student data has been cleared. System is ready for a new upload.');
                } else if (eventType === 'data_uploaded') {
                    const count = state.students['2nd Year'] ? state.students['2nd Year'].length : 0;
                    this.showStatus('success', `✅ File processed successfully! Loaded ${state.summary.total} total students (${count} in 2nd Year).`);
                }
            });
        }
    }

    async handleFile(file) {
        if (!file) return;

        // Validation
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            this.showStatus('error', `❌ Invalid file format ("${file.name}"). Please upload an Excel (.xlsx, .xls) or CSV file.`);
            return;
        }

        this.setLoading(true, `Processing "${file.name}"... Parsing student roll numbers...`);

        try {
            const parser = typeof SeatSnapExcelParser !== 'undefined' ? SeatSnapExcelParser : window.SeatSnapExcelParser;
            if (!parser) {
                throw new Error('Excel parser service is not loaded.');
            }

            const result = await parser.parseFile(file);

            this.setLoading(false);
            this.showStatus('success', `
                🎉 <strong>Upload Complete!</strong> Extracted <strong>${result.totalStudents}</strong> student roll numbers from <code>${result.fileName}</code>.
                <div class="upload-stat-pills">
                    <span class="stat-pill active">2nd Year: <strong>${result.summary["2nd Year"]}</strong> students</span>
                    <span class="stat-pill">1st Year: ${result.summary["1st Year"]}</span>
                    <span class="stat-pill">3rd Year: ${result.summary["3rd Year"]}</span>
                    <span class="stat-pill">4th Year: ${result.summary["4th Year"]}</span>
                </div>
            `);

            if (this.options.onUploadSuccess) {
                this.options.onUploadSuccess(result);
            }
        } catch (err) {
            console.error('File processing failed:', err);
            this.setLoading(false);
            this.showStatus('error', `❌ Upload failed: ${err.message}`);
        }
    }

    loadInstantSample() {
        this.setLoading(true, 'Generating and loading 2nd-year dataset (65 students)...');
        setTimeout(() => {
            try {
                const sampleStudents = SeatSnapExcelParser.getSample2ndYearDataset();
                const organized = SeatSnapExcelParser.organizeByAcademicYear(sampleStudents);

                if (window.StudentDataContext) {
                    window.StudentDataContext.setParsedData(organized, 'sample_2nd_year_students.xlsx');
                }

                this.setLoading(false);
                this.showStatus('success', `
                    ⚡ <strong>Sample Data Loaded!</strong> Ingested <strong>65</strong> 2nd-Year students (55 regular CSE + 10 lateral entries).
                    <br><small>Click on "2nd Year" below to view the partitioned classrooms.</small>
                `);
            } catch (err) {
                this.setLoading(false);
                this.showStatus('error', 'Failed to load sample dataset: ' + err.message);
            }
        }, 300);
    }

    setLoading(isLoading, message = 'Processing...') {
        this.isProcessing = isLoading;
        const statusArea = this.container.querySelector('#uploadStatusArea');
        if (!statusArea) return;

        if (isLoading) {
            statusArea.style.display = 'block';
            statusArea.className = 'upload-status-area status-loading';
            statusArea.innerHTML = `<span class="spinner"></span> <span>${message}</span>`;
        }
    }

    showStatus(type, htmlMessage) {
        const statusArea = this.container.querySelector('#uploadStatusArea');
        if (!statusArea) return;

        statusArea.style.display = 'block';
        statusArea.className = `upload-status-area status-${type}`;
        statusArea.innerHTML = htmlMessage;
    }
}

if (typeof window !== 'undefined') {
    window.ExcelUploadComponent = ExcelUploadComponent;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelUploadComponent;
}
