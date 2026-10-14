

/**
 * rooms-data.js
 * Central room database.
 * - DEFAULT_ROOMS: the canonical list seeded from touchups.md
 * - roomsCache: in-memory cache loaded from Firestore
 * - loadRoomsFromFirestore(): loads (or seeds) the rooms collection
 * - getAllAvailableRooms(): returns names from cache (sync, after load)
 * - getRoomRecord(name): full record { name, block, number, capacity, doors[] }
 * - saveRoomToFirestore(record): upsert one room
 * - deleteRoomFromFirestore(name): remove one room
 */

// ─── Default room definitions ────────────────────────────────────────────────
// doors: array of 'Tr' | 'Tl' | 'Br' | 'Bl'
const DEFAULT_ROOMS = [
    // SMB
    { block:'SMB', number:'105', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'102', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'103', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'106', capacity:28, doors:['Tl'] },
    { block:'SMB', number:'203', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'202', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'206', capacity:28, doors:['Tl'] },
    { block:'SMB', number:'201', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'205', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'305', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'301', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'306', capacity:28, doors:['Tl'] },
    { block:'SMB', number:'302', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'303', capacity:28, doors:['Tr'] },
    { block:'SMB', number:'401', capacity:40, doors:['Tr','Br'], label:'Seminar Hall', rows:10, cols:4 },
    { block:'SMB', number:'406', capacity:40, doors:['Tl','Bl'], label:'Training Hall', rows:10, cols:4 },
    { block:'SMB', number:'405', capacity:28, doors:['Tl'], label:'Lecture Hall' },

    // JB
    { block:'JB', number:'104', capacity:28, doors:['Br'] },
    { block:'JB', number:'105', capacity:28, doors:['Br'] },
    { block:'JB', number:'204', capacity:28, doors:['Br'] },
    { block:'JB', number:'205', capacity:28, doors:['Br'] },
    { block:'JB', number:'304', capacity:28, doors:['Br'] },
    { block:'JB', number:'305', capacity:28, doors:['Br'] },
    { block:'JB', number:'404', capacity:28, doors:['Br'] },
    { block:'JB', number:'405', capacity:28, doors:['Br'] },

    // PB
    { block:'PB', number:'203', capacity:28, doors:['Tr'] },
    { block:'PB', number:'303', capacity:28, doors:['Tr'] },
    { block:'PB', number:'302', capacity:28, doors:['Tr'] },
    { block:'PB', number:'301', capacity:28, doors:['Tr'] },
    { block:'PB', number:'403', capacity:28, doors:['Tr'] },
    { block:'PB', number:'402', capacity:28, doors:['Tr'] },
    { block:'PB', number:'401', capacity:28, doors:['Tr'] },

    // OB
    { block:'OB', number:'101', capacity:28, doors:['Tl'] },
    { block:'OB', number:'102', capacity:28, doors:['Tl'] },
    { block:'OB', number:'103', capacity:28, doors:['Tl'] },
    { block:'OB', number:'201', capacity:28, doors:['Tl'] },
    { block:'OB', number:'202', capacity:28, doors:['Tl'] },
    { block:'OB', number:'203', capacity:28, doors:['Tl'] },
    { block:'OB', number:'302', capacity:28, doors:['Tl'] },
    { block:'OB', number:'303', capacity:28, doors:['Tl'] },

    // DB
    { block:'DB', number:'101', capacity:28, doors:['Tl'] },
    { block:'DB', number:'102', capacity:28, doors:['Tl'] },
    { block:'DB', number:'103', capacity:28, doors:['Tl'] },
    { block:'DB', number:'201', capacity:28, doors:['Tl'] },
    { block:'DB', number:'202', capacity:28, doors:['Tl'] },
    { block:'DB', number:'203', capacity:28, doors:['Tl'] },
    { block:'DB', number:'302', capacity:28, doors:['Tl'] },
    { block:'DB', number:'303', capacity:28, doors:['Tl'] },
];

// Derive canonical name: "SMB-401"
function makeRoomName(block, number) {
    return `${block}-${number}`;
}

// Normalise a raw DEFAULT_ROOMS entry into a full record
function normaliseRoom(r) {
    return {
        name:     makeRoomName(r.block, r.number),
        block:    r.block,
        number:   r.number,
        capacity: r.capacity || 28,
        doors:    r.doors || ['Tr'],
        label:    r.label || '',
        rows:     r.rows || 7,
        cols:     r.cols || 4,
    };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let roomsCache = [];          // array of normalised room records
let roomsCacheLoaded = false;

function getRoomRecord(name) {
    return roomsCache.find(r => r.name === name) || null;
}

function getAllAvailableRooms() {
    return roomsCache.map(r => r.name);
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

/**
 * Load rooms from Firestore.
 * If the collection is empty, seed it with DEFAULT_ROOMS and save.
 * Populates roomsCache and sets roomsCacheLoaded = true.
 */
async function loadRoomsFromFirestore() {
    try {
        const snap = await db.collection('rooms').orderBy('block').orderBy('number').get();

        if (!snap.empty) {
            roomsCache = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    name:     d.name     || makeRoomName(d.block, d.number),
                    block:    d.block    || '',
                    number:   d.number   || '',
                    capacity: d.capacity || 28,
                    doors:    d.doors    || ['Tr'],
                    label:    d.label    || '',
                    rows:     d.rows     || 7,
                    cols:     d.cols     || 4,
                };
            });
        } else {
            // First run — seed from defaults
            roomsCache = DEFAULT_ROOMS.map(normaliseRoom);
            await seedRoomsToFirestore(roomsCache);
        }
        roomsCacheLoaded = true;
        console.log(`✅ Rooms loaded: ${roomsCache.length}`);
    } catch(err) {
        console.error('Error loading rooms from Firestore, using defaults:', err);
        roomsCache = DEFAULT_ROOMS.map(normaliseRoom);
        roomsCacheLoaded = true;
    }
}

async function seedRoomsToFirestore(rooms) {
    const col = db.collection('rooms');
    const BATCH = 450;
    for (let i = 0; i < rooms.length; i += BATCH) {
        const batch = db.batch();
        rooms.slice(i, i + BATCH).forEach(r => {
            batch.set(col.doc(r.name), r);
        });
        await batch.commit();
    }
    console.log(`✅ Seeded ${rooms.length} rooms to Firestore`);
}

async function saveRoomToFirestore(record) {
    const col = db.collection('rooms');
    await col.doc(record.name).set(record);
    // Update cache
    const idx = roomsCache.findIndex(r => r.name === record.name);
    if (idx >= 0) roomsCache[idx] = record;
    else roomsCache.push(record);
    // Keep sorted
    roomsCache.sort((a, b) => a.block.localeCompare(b.block) || a.number.localeCompare(b.number, undefined, {numeric:true}));
}

async function deleteRoomFromFirestore(name) {
    await db.collection('rooms').doc(name).delete();
    roomsCache = roomsCache.filter(r => r.name !== name);
}
