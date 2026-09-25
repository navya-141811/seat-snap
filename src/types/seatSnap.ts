/**
 * SeatSnap Shared Data Contract & Type Definitions
 * Baseline interfaces agreed across all 3 members (Ingestion, CRUD, Allocation)
 */

export interface Student {
  id: string;
  rollNumber: string;
  name?: string;
  department?: string;
  academicYear: '1st Year' | '2nd Year' | '3rd Year' | '4th Year' | '1st' | '2nd' | '3rd' | '4th';
  section?: string;
  isLateral: boolean;
  status: 'active' | 'detained';
}

export interface Classroom {
  roomId: string;
  roomName: string;
  capacity: number; // 28 (7 x 4)
  studentsCount: number;
  assignedStudents: Student[];
  isExtraRoom: boolean;
  rollRange?: {
    start: string;
    end: string;
  };
}

export interface AllocationConfig {
  standardCapacity: 28; // 7 x 4
  extraRoomThreshold: 8; // >= 8 requires extra room
}

export interface AcademicYearData {
  "1st Year": Student[];
  "2nd Year": Student[];
  "3rd Year": Student[];
  "4th Year": Student[];
}
