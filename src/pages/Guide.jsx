import './Guide.css'

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
      <ol>
        <li>Register with your official university email and password. The email prefix before @ must match the Student ID on file with the Registrar. Your name and birthdate come from that roster; add your contact details in Settings.</li>
        <li>Sign in and submit a copy of your clearance. The Registrar must verify it before you can submit an online request or have a walk-in request entered.</li>
        <li>After your clearance is verified, choose the document, enter the required details, and submit your request. Keep the six-character tracking code.</li>
        <li>Wait for the Registrar to confirm your request. Print or save a copy of the request, then pay the fee in cash at the Finance Office. Online payment is not available.</li>
        <li>Show your receipt to the Registrar, or upload a picture of both the printed request (with its tracking code) and the cash receipt from your dashboard.</li>
        <li>Once the Registrar confirms payment, processing begins and your dashboard shows the estimated availability date and time. You will be notified if the estimate passes before the document is marked ready; open the overdue request and choose Request for ETA update to contact the Registrar. Collect documents marked Ready for pickup at the Registrar's Office; fulfilled requests remain in your dashboard history.</li>
      </ol>
      <h2>Requesting in person</h2>
      <p>
        You may request a document at the Registrar's Office after your clearance is verified. Registrar staff will enter the walk-in request into the portal and give you its tracking code. It follows the same confirmation, cash payment, processing, and pickup steps as an online request.
      </p>
    </div>
  )
}

export default Guide