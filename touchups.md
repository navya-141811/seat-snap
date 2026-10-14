### this documentation contains all the final changes that we are making 

---

# ✅ IMPLEMENTED CHANGES (2026-10-14)

## 📖 Subjects Admin Panel
- New **"📖 Subjects"** button in admin sidebar
- Admin can view/edit subject lists per year / branch / semester
- Add, remove, rename, reorder subjects inline
- Save button per combo → writes to Firestore `subjectData` collection
- Bulk import via CSV (`Year,Branch,Semester,Subject` format)
- Subjects load from Firestore at page startup and patch `YEAR_SUBJECTS` live
- Subject dropdowns in the Generate form always reflect latest saved subjects
- Fallback to hardcoded `YEAR_SUBJECTS` if Firestore is empty

## 👩‍🏫 Invigilator Assignment — Shortfall Flow
- Auto-assign uses invigilator CSV pool only (date + slot filtered, subject constraint applied)
- When pool is short → opens **Shortfall Modal** (instead of just an alert):
  - Shows which rooms need how many more invigilators
  - Grid of all faculty from Faculty Subjects file (searchable)
  - Already assigned = greyed out; Subject conflict = ⛔ blocked
  - Admin selects faculty, clicks Confirm → distributed across shortfall rooms
  - **"🗑 Remove All Invigilator Assignments"** button in same modal
- Invigilator name **not shown** to students on the seat lookup page

## 📄 Export Invigilator Table
- New **"🧾 Export Invigilator Table"** button on results page
- Also on each saved table card in All Tables panel
- PDF: Room | Invigilator(s) — no roll numbers, just assignment data
- Header shows college name, date, and slot (FN/AN)

## 📋 Export Table — unified format
- "📋 Export Table" in All Tables panel now produces the **exact same format** as the results page version
- Landscape A4, compact multi-room layout, 2 cols × 14 rows per room
- Proper college name, year/sem/mid header, date, time slot

## 🐛 Bug Fixes
- **Auto-delete of past tables disabled** — `purgeExpiredTables()` was silently deleting all tables with past exam dates on every page load; now a no-op
- **Crash in All Tables rendering** — `table.years.join()` threw if `years` was missing on old saved tables; all field accesses now safe with fallbacks
- **Syntax error in app-multiyear.js** — extra `}` from edit caused entire file to fail to load; fixed

---

# 🗂 ORIGINAL PLANNED CHANGES (for reference)

# Room database :

- currently we have hardcoded rooms , each representing the year and section such as , we have cse a2 , means 2nd year cse a section 
## the change i want in it :
- rooms will be stored in Firestore so the admin can manage them and they reflect across the whole system
- default capacity for all normal classrooms = 28 benches
- room format: BLOCK - ROOM_NUMBER (e.g., SMB-101)

### Special rooms:
- SMB-401 : seminar hall - 40 benches (10 rows x 4 cols) - doors: Tr, Br
- SMB-406 : training hall - 40 benches (10 rows x 4 cols) - doors: Tl, Bl
- SMB-405 : lecture hall  - 28 benches (normal) - door: Tl

### Block-wise rooms and door positions:

## SMB (Seetha Memorial Block)
105 - Tr
102 - Tr
103 - Tr
106 - Tl
203 - Tr 
202 - Tr
206 - Tl
201 - Tr
205 - Tr
305 - Tr 
301 - Tr
306 - Tl
302 - Tr 
303 - Tr
401 - seminar hall - Tr, Br (10 rows x 4 columns = 40 benches)
406 - training hall - Tl, Bl (10 rows x 4 columns = 40 benches)
405 - lecture hall - Tl (28 benches, same as normal classroom)

## JB (Jade block)
104, 105 - Br
204, 205 - Br
304, 305 - Br
404, 405 - Br

## PB (Pearl Block)
203 - Tr
303 - Tr
302 - Tr
301 - Tr
403 - Tr
402 - Tr
401 - Tr

## OB (Opal Block)
101, 102, 103, 201, 202, 203, 302, 303 - Tl

## DB (Diamond Block)
same room numbers and layout as OB:
101, 102, 103, 201, 202, 203, 302, 303 - Tl

### change in admin panel :

- new "Rooms" section in admin panel sidebar
- shows all rooms block-wise with their capacities
- admin can:
  - change capacity of any room
  - add new rooms (block, number, capacity, door position)
  - remove rooms
  - set/change entrance position (Tr, Tl, Br, Bl) per room
- room layout preview shown here too (just the layout, no seat highlights)
- all changes saved to and loaded from Firestore

### changes in layout : 

- board: always shown at top-centre of the layout (fixed for all rooms)
- entrance door: shown as a visual notch/gap in the room border at the correct corner position
  - Tr = top-right notch
  - Tl = top-left notch
  - Br = bottom-right notch
  - Bl = bottom-left notch
- rooms with two doors (seminar hall, training hall): show both notches
- this applies to:
  1. room layout preview in the admin Rooms panel
  2. student seating detail page (with seat highlighted, same as before, just add board + door)

# Assigning invigilator :

- after generating the table, admin sees an "Assign Invigilators" button in the results page
- this is completely optional — admin can save data without ever touching this option
- no popup forcing assignment; admin can just save directly

### Invigilator subject data:
- admin uploads invigilator xlsx files (the ones like "I-I Mid-1 Invigilations CSE.xlsx")
- xlsx format: S.No | Name of Faculty | Date1 | Date2 | ... | Faculty Signature
  - row with FN/AN per date column indicates slot availability
  - a ü mark = faculty available for that date+slot
  - department is in row 5 (e.g., "Department : CSE")
- SEPARATELY: admin also uploads a "faculty subjects" file that maps each teacher name to their subjects
  - this is a separate option in the admin panel
  - stored in Firestore
  - used for the subject constraint during invigilator assignment

### Subject constraint rule:
- a faculty member should NOT be assigned to a room where students are writing an exam
  for a subject that the faculty member teaches
- constraint is subject-specific (not department-level)
- faculty subjects come from the separately uploaded faculty subjects file in Firestore

### when admin clicks "Assign Invigilators":
- system auto-assigns invigilators from the invigilators Firestore collection
- respects FN/AN slot availability (FN = 10:30–12:30, AN = 13:30–15:30)
- respects subject constraint (faculty cannot be in a room for their own subject)
- if invigilators are not sufficient, show a popup asking admin to upload more invigilator files
- after assignment, show a new table in the results page:
  - columns: Room | Roll Numbers | Invigilators assigned
  - admin can change any invigilator from this table
  - replacement UI: same style as the room selection grid (not a dropdown)
  - includes a name search so admin can quickly find a specific invigilator
  - replacements filtered by: same slot + subject constraint
- invigilator assignments saved to Firestore with the exam table

# Student seating details :

- keep existing highlighted-seat layout as-is
- only addition: board at top-centre + entrance door notch at correct corner
- door position comes from the room's Firestore record

# HOD Mam login :

- add a "HOD Access" button on index.html (below Dev Access)
- clicking it directly opens hod.html (no password/PIN for now, Google OAuth will be added later)
- hod.html shows:
  - list of all invigilators and the rooms they are assigned to
  - only show entries where the exam is currently happening or upcoming (today or future)
  - "currently invigilating" = exam time window is active right now
  - "upcoming" = exam is today or future but not yet started
  - search bar: type invigilator name → shows their assigned room and status
- further changes to HOD page will come later

# Export table (multi-room sheet format):

- this is a NEW, separate export — keep the existing single-room-per-page PDF as-is
- add an "Export Table" button (alongside existing PDF button):
  - on results page after generation
  - also on each table card in the All Tables panel
- format (based on the WhatsApp image):
  - header: college name + exam label (e.g., "Mid Examinations, Aug/Sep-2026") + time slot line (e.g., "Forenoon: 10.30 am to 12.30 pm")
  - multiple rooms shown as column groups side by side on the same page
  - each room = 2 sub-columns of roll numbers, max 14 rows per room
  - room name as column header (e.g., PB-203, PB-301...)
  - rooms with fewer than 14 students show blank cells to maintain consistent row height
  - if rooms overflow one page, continue on next page
  - this is a PDF export (named "Export Table" not "Export CSV")
- the existing single-room JNTU seating plan PDF is kept separately and unchanged

- currently we have hardcoded rooms , each representing the year and section such as , we have cse a2 , means 2nd year cse a section 
## the change i want in it :
- rooms will be stored in Firestore so the admin can manage them and they reflect across the whole system
- default capacity for all normal classrooms = 28 benches
- room format: BLOCK - ROOM_NUMBER (e.g., SMB-101)

### Special rooms:
- SMB-401 : seminar hall - 40 benches (10 rows x 4 cols) - doors: Tr, Br
- SMB-406 : training hall - 40 benches (10 rows x 4 cols) - doors: Tl, Bl
- SMB-405 : lecture hall  - 28 benches (normal) - door: Tl

### Block-wise rooms and door positions:

## SMB (Seetha Memorial Block)
105 - Tr
102 - Tr
103 - Tr
106 - Tl
203 - Tr 
202 - Tr
206 - Tl
201 - Tr
205 - Tr
305 - Tr 
301 - Tr
306 - Tl
302 - Tr 
303 - Tr
401 - seminar hall - Tr, Br (10 rows x 4 columns = 40 benches)
406 - training hall - Tl, Bl (10 rows x 4 columns = 40 benches)
405 - lecture hall - Tl (28 benches, same as normal classroom)

## JB (Jade block)
104, 105 - Br
204, 205 - Br
304, 305 - Br
404, 405 - Br

## PB (Pearl Block)
203 - Tr
303 - Tr
302 - Tr
301 - Tr
403 - Tr
402 - Tr
401 - Tr

## OB (Opal Block)
101, 102, 103, 201, 202, 203, 302, 303 - Tl

## DB (Diamond Block)
same room numbers and layout as OB:
101, 102, 103, 201, 202, 203, 302, 303 - Tl

### change in admin panel :

- new "Rooms" section in admin panel sidebar
- shows all rooms block-wise with their capacities
- admin can:
  - change capacity of any room
  - add new rooms (block, number, capacity, door position)
  - remove rooms
  - set/change entrance position (Tr, Tl, Br, Bl) per room
- room layout preview shown here too (just the layout, no seat highlights)
- all changes saved to and loaded from Firestore

### changes in layout : 

- board: always shown at top-centre of the layout (fixed for all rooms)
- entrance door: shown as a visual notch/gap in the room border at the correct corner position
  - Tr = top-right notch
  - Tl = top-left notch
  - Br = bottom-right notch
  - Bl = bottom-left notch
- rooms with two doors (seminar hall, training hall): show both notches
- this applies to:
  1. room layout preview in the admin Rooms panel
  2. student seating detail page (with seat highlighted, same as before, just add board + door)

# Assigning invigilator :

- after generating the table, admin sees an "Assign Invigilators" button in the results page
- this is completely optional — admin can save data without ever touching this option
- no popup forcing assignment; admin can just save directly

### Invigilator subject data:
- admin uploads invigilator xlsx files (the ones like "I-I Mid-1 Invigilations CSE.xlsx")
- xlsx format: S.No | Name of Faculty | Date1 | Date2 | ... | Faculty Signature
  - row with FN/AN per date column indicates slot availability
  - a ü mark = faculty available for that date+slot
  - department is in row 5 (e.g., "Department : CSE")
- SEPARATELY: admin also uploads a "faculty subjects" file that maps each teacher name to their subjects
  - this is a separate option in the admin panel
  - stored in Firestore
  - used for the subject constraint during invigilator assignment

### Subject constraint rule:
- a faculty member should NOT be assigned to a room where students are writing an exam
  for a subject that the faculty member teaches
- constraint is subject-specific (not department-level)
- faculty subjects come from the separately uploaded faculty subjects file in Firestore

### when admin clicks "Assign Invigilators":
- system auto-assigns invigilators from the invigilators Firestore collection
- respects FN/AN slot availability (FN = 10:30–12:30, AN = 13:30–15:30)
- respects subject constraint (faculty cannot be in a room for their own subject)
- if invigilators are not sufficient, show a popup asking admin to upload more invigilator files
- after assignment, show a new table in the results page:
  - columns: Room | Roll Numbers | Invigilators assigned
  - admin can change any invigilator from this table
  - replacement UI: same style as the room selection grid (not a dropdown)
  - includes a name search so admin can quickly find a specific invigilator
  - replacements filtered by: same slot + subject constraint
- invigilator assignments saved to Firestore with the exam table

# Student seating details :

- keep existing highlighted-seat layout as-is
- only addition: board at top-centre + entrance door notch at correct corner
- door position comes from the room's Firestore record

# HOD Mam login :

- add a "HOD Access" button on index.html (below Dev Access)
- clicking it directly opens hod.html (no password/PIN for now, Google OAuth will be added later)
- hod.html shows:
  - list of all invigilators and the rooms they are assigned to
  - only show entries where the exam is currently happening or upcoming (today or future)
  - "currently invigilating" = exam time window is active right now
  - "upcoming" = exam is today or future but not yet started
  - search bar: type invigilator name → shows their assigned room and status
- further changes to HOD page will come later

# Export table (multi-room sheet format):

- this is a NEW, separate export — keep the existing single-room-per-page PDF as-is
- add an "Export Table" button (alongside existing PDF button):
  - on results page after generation
  - also on each table card in the All Tables panel
- format (based on the WhatsApp image):
  - header: college name + exam label (e.g., "Mid Examinations, Aug/Sep-2026") + time slot line (e.g., "Forenoon: 10.30 am to 12.30 pm")
  - multiple rooms shown as column groups side by side on the same page
  - each room = 2 sub-columns of roll numbers, max 14 rows per room
  - room name as column header (e.g., PB-203, PB-301...)
  - rooms with fewer than 14 students show blank cells to maintain consistent row height
  - if rooms overflow one page, continue on next page
  - this is a PDF export (named "Export Table" not "Export CSV")
- the existing single-room JNTU seating plan PDF is kept separately and unchanged
