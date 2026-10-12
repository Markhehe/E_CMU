/**
 * BACKEND HANDOFF SCHEMA:
 * The backend should return data matching this object structure.
 */

// 1. Document Catalog (Matches your doc_types ERD Table)
export const documentCatalog = [
  { id: 'DOC-01', name: 'Transcript of Records (TOR)', price: 150 },
  { id: 'DOC-02', name: 'Certificate of Enrollment', price: 50 },
  { id: 'DOC-03', name: 'Certificate of Graduation/Completion', price: 100 },
  { id: 'DOC-04', name: 'Certificate of Grading System', price: 50 },
  { id: 'DOC-05', name: 'Certificate of GWA', price: 50 },
  { id: 'DOC-06', name: 'Diploma (only issued once)', price: 500 },
  { id: 'DOC-07', name: 'Certified True Copy of Original Diploma', price: 100 },
  { id: 'DOC-08', name: 'CAV Certification', price: 150 },
  { id: 'DOC-09', name: 'Honorable Dismissal', price: 200 },
  { id: 'DOC-10', name: 'Certificate of No Pending Disciplinary Case', price: 50 },
];

// 2. Request Registry (Matches your document_requests ERD Table)
export const mockRequests = [
  {
    id: 'REQ-001',
    studentId: '2023-0145',
    studentName: 'Yuan Atanacio',
    docType: 'Transcript of Records (TOR)',
    dateRequested: '2026-10-24',
    quantity: 1,
    status: 'PENDING PAYMENT',
    sasoCleared: false,
    paymentMethod: 'Online',
    hasReceipt: true
  },
  {
    id: 'REQ-002',
    studentId: '2022-0891',
    studentName: 'Maria Santos',
    docType: 'Certificate of Enrollment',
    dateRequested: '2026-10-23',
    quantity: 2,
    status: 'PROCESSING',
    sasoCleared: true,
    paymentMethod: 'Pay at the Office',
    hasReceipt: false
  },
  {
    id: 'REQ-003',
    studentId: '2021-0332',
    studentName: 'Juan Dela Cruz',
    docType: 'Diploma (only issued once)',
    dateRequested: '2026-10-20',
    quantity: 1,
    status: 'READY FOR PICKUP',
    sasoCleared: true,
    paymentMethod: 'Online',
    hasReceipt: true
  },
  {
    id: 'REQ-004',
    studentId: '2024-0112',
    studentName: 'Anna Reyes',
    docType: 'Certificate of GWA',
    dateRequested: '2026-10-18',
    quantity: 1,
    status: 'READY FOR PICKUP',
    sasoCleared: true,
    paymentMethod: 'Pay at the Office',
    hasReceipt: false
  },
  {
    id: 'REQ-005',
    studentId: '2020-0554',
    studentName: 'Mark Bautista',
    docType: 'Honorable Dismissal',
    dateRequested: '2026-10-15',
    quantity: 1,
    status: 'PROCESSING',
    sasoCleared: true,
    paymentMethod: 'Online',
    hasReceipt: true
  },
  {
    id: 'REQ-006',
    studentId: '2023-0145',
    studentName: 'Yuan Atanacio',
    docType: 'Certificate of Grading System',
    dateRequested: '2026-10-14',
    quantity: 3,
    status: 'PENDING PAYMENT',
    sasoCleared: false,
    paymentMethod: 'Online',
    hasReceipt: false
  },
  {
    id: 'REQ-007',
    studentId: '2022-0891',
    studentName: 'Maria Santos',
    docType: 'Transcript of Records (TOR)',
    dateRequested: '2026-10-10',
    quantity: 1,
    status: 'CLEARED',
    sasoCleared: true,
    paymentMethod: 'Online',
    hasReceipt: true
  },
];