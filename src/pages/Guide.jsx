import './guide.css'

const documents = [
  'CAV Certification',
  'Certificate of No Pending Disciplinary Case',
  'Certificate of Enrollment',
  'Certificate of Grading System',
  'Certificate of Graduation/Completion',
  'Certificate of GWA',
  'Certificate of Maximum Load',
  'Certificate of No Contract',
  'Certificate of Ranking (for graduates only)',
  'Certificate of Units Earned',
  'Certificate of Year Standing (for Undergraduate only)',
  'Certified Actual Text of the Actual Diploma',
  'Honorable Dismissal',
  'Letter of No Objection',
  'Permit to Transfer',
  'PTC Certificate of Completion',
  'Certified True Copy of TOR from Previous School',
  'Transcript of Records (TOR)',
  'Transfer Credential',
  'True Copy of Grades',
  'UP Exemption from issuing SO No.',
  'Letter of Request for the release of TOR from previous school',
  'Verification Form',
]

const documentsCol2 = [
  'Certified True Copy of DepEd Memo',
  'Certified True Copy of English Translated Diploma',
  'Certified True Copy of Form 5',
  'Certified True Copy of Original Diploma',
  'Course Description',
  'Diploma (only issued once)',
  'English as Medium of Instruction',
  'English Translation of Diploma',
  'Expected Date of Graduation',
]

function Guide() {
  return (
    <div className="guide-page">
      <h1>List of documents available for request</h1>
      <div className="guide-columns">
        <ul>
          {documents.map((doc) => (
            <li key={doc}>{doc}</li>
          ))}
        </ul>
        <ul>
          {documentsCol2.map((doc) => (
            <li key={doc}>{doc}</li>
          ))}
        </ul>
      </div>
      <h2>Guide for requesting a document</h2>
    </div>
  )
}

export default Guide