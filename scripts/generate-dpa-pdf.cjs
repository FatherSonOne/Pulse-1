/**
 * Generates public/legal/pulse-dpa.pdf — the Quantum Ecosystems Data Processing Agreement.
 *
 * Re-run any time you update the content:
 *   node scripts/generate-dpa-pdf.cjs
 *
 * The Compliance settings section serves this file as the customer-facing DPA.
 * Pre-filled with Quantum Ecosystems as the Data Processor; Controller (customer)
 * fields and signature blocks remain blank for the customer to complete.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.join(__dirname, '..', 'public', 'legal');
const OUT_PATH = path.join(OUT_DIR, 'pulse-dpa.pdf');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PROCESSOR_NAME    = 'Quantum Ecosystems';
const PROCESSOR_ADDRESS = [
  '1508 Hendon Dr',
  'Walhalla, SC 29691',
  'United States',
];
const PRODUCT_NAME   = 'Pulse, Logos Vision, and Entomate (the Quantum Ecosystems platform)';
const SERVICES_DESC  =
  'team communication, voice messaging, AI-assisted productivity, CRM, decision tracking, ' +
  'calendar, and ecosystem-bridge services delivered through the Quantum Ecosystems platform';

// Governing law / jurisdiction. Walhalla is in Oconee County, South Carolina.
const GOVERNING_LAW   = 'the State of South Carolina, United States of America';
const COURT_VENUE     = 'Oconee County, South Carolina';
const APPEAL_VENUE    = 'the South Carolina Court of Appeals and the Supreme Court of South Carolina';

const SUBPROCESSORS = [
  ['Supabase Inc.',         'Database, authentication, file storage, realtime, edge functions',                'United States / EU (configurable region)'],
  ['Stripe, Inc.',           'Payment processing, subscription billing, invoicing',                              'United States'],
  ['OpenAI, L.L.C.',         'AI text generation, speech-to-text (Whisper), realtime voice models',              'United States'],
  ['Anthropic PBC',          'AI text generation (Claude models)',                                                'United States'],
  ['Google LLC',             'AI text generation (Gemini), Gmail / Calendar / Drive integrations (OAuth)',        'United States / Global'],
  ['ElevenLabs Inc.',        'AI voice synthesis',                                                                'United States'],
  ['Daily.co (Pluot Inc.)',  'Video conferencing infrastructure',                                                 'United States'],
  ['Twilio Inc.',            'SMS messaging',                                                                     'United States'],
  ['Resend (Drie B.V.)',     'Transactional email delivery',                                                      'United States / EU'],
  ['Functional Software, Inc. (Sentry)', 'Error monitoring and performance telemetry',                            'United States'],
];

// ---------------------------------------------------------------------------
// PDF setup
// ---------------------------------------------------------------------------

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 70, left: 60, right: 60 },
  bufferPages: true,
  info: {
    Title:    'Data Processing Agreement — Quantum Ecosystems',
    Author:   'Quantum Ecosystems',
    Subject:  'GDPR Data Processing Agreement',
    Keywords: 'GDPR, DPA, Data Processing Agreement, Quantum Ecosystems, Pulse',
  },
});

doc.pipe(fs.createWriteStream(OUT_PATH));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FONT_BODY = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITAL = 'Helvetica-Oblique';

function h1(text) {
  doc.moveDown(0.5);
  doc.font(FONT_BOLD).fontSize(14).fillColor('#000').text(text);
  doc.moveDown(0.4);
}

function h2(num, title) {
  doc.moveDown(0.6);
  doc.font(FONT_BOLD).fontSize(11).fillColor('#000').text(`${num}. ${title}`);
  doc.moveDown(0.3);
}

function p(text, options = {}) {
  doc.font(FONT_BODY).fontSize(10).fillColor('#222').text(text, {
    align: 'justify',
    lineGap: 2,
    ...options,
  });
}

function clause(num, text) {
  doc.font(FONT_BODY).fontSize(10).fillColor('#222');
  const indent = 30;
  doc.text(num, { continued: true, indent: 0 });
  doc.text(`   ${text}`, { align: 'justify', lineGap: 2, indent });
  doc.moveDown(0.25);
}

function subClause(num, text) {
  doc.font(FONT_BODY).fontSize(10).fillColor('#222');
  doc.text(num, { continued: true, indent: 30 });
  doc.text(`   ${text}`, { align: 'justify', lineGap: 2, indent: 60 });
  doc.moveDown(0.2);
}

function blanks(rows = 3) {
  doc.font(FONT_BODY).fontSize(10).fillColor('#222');
  for (let i = 0; i < rows; i++) {
    doc.text('_'.repeat(55));
  }
  doc.moveDown(0.3);
}

function partyLabel(label) {
  doc.font(FONT_BODY).fontSize(10).fillColor('#222');
  doc.text('(the ', { continued: true });
  doc.font(FONT_BOLD).text(`"${label}"`, { continued: true });
  doc.font(FONT_BODY).text(')');
  doc.moveDown(0.4);
}

function ensureSpace(needed = 120) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

// Footers are drawn at the end via doc.bufferedPageRange().
function drawFooters() {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Save margin guard so writes near the bottom don't trigger pagination.
    const origBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(FONT_ITAL).fontSize(8).fillColor('#666');
    const usableWidth = doc.page.width - 60 * 2;
    doc.text(
      `Data Processing Agreement — ${PROCESSOR_NAME}`,
      60,
      doc.page.height - 45,
      { width: usableWidth, align: 'left', lineBreak: false },
    );
    doc.text(
      `Page ${i - range.start + 1} of ${range.count}`,
      60,
      doc.page.height - 30,
      { width: usableWidth, align: 'right', lineBreak: false },
    );
    doc.page.margins.bottom = origBottom;
  }
}

// ---------------------------------------------------------------------------
// TITLE
// ---------------------------------------------------------------------------

doc.font(FONT_BOLD).fontSize(18).fillColor('#0a0a0a');
doc.text(`Data Processing Agreement`, { align: 'center' });
doc.font(FONT_BODY).fontSize(11).fillColor('#666');
doc.text(`${PROCESSOR_NAME}`, { align: 'center' });
doc.moveDown(1);

// ---------------------------------------------------------------------------
// PREAMBLE
// ---------------------------------------------------------------------------

p(
  'This Data Processing Agreement ("Agreement") forms part of the Contract for Services ' +
  '("Principal Agreement") between',
);
doc.moveDown(0.5);
blanks(3);
partyLabel('Company');

p('and');
doc.moveDown(0.4);

doc.font(FONT_BOLD).fontSize(10).text(`${PROCESSOR_NAME}`);
doc.font(FONT_BODY).fontSize(10);
PROCESSOR_ADDRESS.forEach(line => doc.text(line));
doc.moveDown(0.2);
partyLabel('Data Processor');

p('(together as the ', { continued: true });
doc.font(FONT_BOLD).text('"Parties"', { continued: true });
doc.font(FONT_BODY).text(')');
doc.moveDown(0.6);

// WHEREAS
doc.font(FONT_BOLD).fontSize(11).text('WHEREAS');
doc.moveDown(0.3);
clause('(A)', 'The Company acts as a Data Controller.');
clause('(B)', 'The Company wishes to subcontract certain Services, which imply the processing of personal data, to the Data Processor.');
clause('(C)',
  'The Parties seek to implement a data processing agreement that complies with the requirements of the current legal framework in relation to data processing and with the Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation).',
);
clause('(D)', 'The Parties wish to lay down their rights and obligations.');
doc.moveDown(0.4);
doc.font(FONT_BOLD).fontSize(10).text('IT IS AGREED AS FOLLOWS:');

// ---------------------------------------------------------------------------
// 1. DEFINITIONS
// ---------------------------------------------------------------------------

ensureSpace();
h2('1', 'Definitions and Interpretation');
clause('1.1', 'Unless otherwise defined herein, capitalized terms and expressions used in this Agreement shall have the following meaning:');
subClause('1.1.1', '"Agreement" means this Data Processing Agreement and all Schedules;');
subClause('1.1.2', '"Company Personal Data" means any Personal Data Processed by a Contracted Processor on behalf of Company pursuant to or in connection with the Principal Agreement;');
subClause('1.1.3', '"Contracted Processor" means a Subprocessor;');
subClause('1.1.4', '"Data Protection Laws" means EU Data Protection Laws and, to the extent applicable, the data protection or privacy laws of any other country;');
subClause('1.1.5', '"EEA" means the European Economic Area;');
subClause('1.1.6', '"EU Data Protection Laws" means EU Directive 95/46/EC, as transposed into domestic legislation of each Member State and as amended, replaced or superseded from time to time, including by the GDPR and laws implementing or supplementing the GDPR;');
subClause('1.1.7', '"GDPR" means EU General Data Protection Regulation 2016/679;');
subClause('1.1.8', '"Data Transfer" means a transfer of Company Personal Data from the Company to a Contracted Processor, or an onward transfer of Company Personal Data from a Contracted Processor to a Subcontracted Processor, or between two establishments of a Contracted Processor, in each case, where such transfer would be prohibited by Data Protection Laws (or by the terms of data transfer agreements put in place to address the data transfer restrictions of Data Protection Laws);');
subClause('1.1.9', `"Services" means the ${SERVICES_DESC} that the Data Processor provides.`);
subClause('1.1.10', '"Subprocessor" means any person appointed by or on behalf of Processor to process Personal Data on behalf of the Company in connection with the Agreement, as listed in Schedule 1 to this Agreement.');
clause('1.2',
  'The terms "Commission", "Controller", "Data Subject", "Member State", "Personal Data", "Personal Data Breach", "Processing" and "Supervisory Authority" shall have the same meaning as in the GDPR, and their cognate terms shall be construed accordingly.',
);

// ---------------------------------------------------------------------------
// 2. PROCESSING
// ---------------------------------------------------------------------------

ensureSpace();
h2('2', 'Processing of Company Personal Data');
clause('2.1', 'Processor shall:');
subClause('2.1.1', 'comply with all applicable Data Protection Laws in the Processing of Company Personal Data; and');
subClause('2.1.2', "not Process Company Personal Data other than on the relevant Company's documented instructions.");
clause('2.2', 'The Company instructs Processor to process Company Personal Data for the purpose of providing the Services.');

// ---------------------------------------------------------------------------
// 3. PERSONNEL
// ---------------------------------------------------------------------------

ensureSpace();
h2('3', 'Processor Personnel');
p(
  'Processor shall take reasonable steps to ensure the reliability of any employee, agent or contractor of any ' +
  'Contracted Processor who may have access to the Company Personal Data, ensuring in each case that access is ' +
  'strictly limited to those individuals who need to know / access the relevant Company Personal Data, as strictly ' +
  'necessary for the purposes of the Principal Agreement, and to comply with Applicable Laws in the context of that ' +
  "individual's duties to the Contracted Processor, ensuring that all such individuals are subject to confidentiality " +
  'undertakings or professional or statutory obligations of confidentiality.',
);

// ---------------------------------------------------------------------------
// 4. SECURITY
// ---------------------------------------------------------------------------

ensureSpace();
h2('4', 'Security');
clause('4.1',
  'Taking into account the state of the art, the costs of implementation and the nature, scope, context and purposes of Processing as well as the risk of varying likelihood and severity for the rights and freedoms of natural persons, Processor shall in relation to the Company Personal Data implement appropriate technical and organizational measures to ensure a level of security appropriate to that risk, including, as appropriate, the measures referred to in Article 32(1) of the GDPR. Processor’s technical and organizational measures are described in Schedule 2 to this Agreement.',
);
clause('4.2',
  'In assessing the appropriate level of security, Processor shall take account in particular of the risks that are presented by Processing, in particular from a Personal Data Breach.',
);

// ---------------------------------------------------------------------------
// 5. SUBPROCESSING
// ---------------------------------------------------------------------------

ensureSpace();
h2('5', 'Subprocessing');
clause('5.1',
  'Company grants general written authorization to Processor to engage the Subprocessors listed in Schedule 1 to process Company Personal Data in connection with the Services.',
);
clause('5.2',
  'Processor shall (i) enter into a written agreement with each Subprocessor imposing data protection obligations no less protective than those set out in this Agreement; and (ii) remain liable for the acts and omissions of any Subprocessor as if they were Processor’s own.',
);
clause('5.3',
  'Processor shall give Company at least thirty (30) days prior notice of any intended addition or replacement of a Subprocessor by updating Schedule 1 and notifying Company through the Services or by email. If Company reasonably objects on data-protection grounds, the Parties shall work in good faith to resolve the objection; if no resolution is reached, Company may terminate the affected Services.',
);

// ---------------------------------------------------------------------------
// 6. DATA SUBJECT RIGHTS
// ---------------------------------------------------------------------------

ensureSpace();
h2('6', 'Data Subject Rights');
clause('6.1',
  'Taking into account the nature of the Processing, Processor shall assist the Company by implementing appropriate technical and organisational measures, insofar as this is possible, for the fulfilment of the Company obligations, as reasonably understood by Company, to respond to requests to exercise Data Subject rights under the Data Protection Laws.',
);
clause('6.2', 'Processor shall:');
subClause('6.2.1', 'promptly notify Company if it receives a request from a Data Subject under any Data Protection Law in respect of Company Personal Data; and');
subClause('6.2.2',
  'ensure that it does not respond to that request except on the documented instructions of Company or as required by Applicable Laws to which the Processor is subject, in which case Processor shall to the extent permitted by Applicable Laws inform Company of that legal requirement before the Contracted Processor responds to the request.',
);

// ---------------------------------------------------------------------------
// 7. PERSONAL DATA BREACH
// ---------------------------------------------------------------------------

ensureSpace();
h2('7', 'Personal Data Breach');
clause('7.1',
  'Processor shall notify Company without undue delay, and in any event within seventy-two (72) hours, upon Processor becoming aware of a Personal Data Breach affecting Company Personal Data, providing Company with sufficient information to allow the Company to meet any obligations to report or inform Data Subjects of the Personal Data Breach under the Data Protection Laws.',
);
clause('7.2',
  'Processor shall co-operate with the Company and take reasonable commercial steps as are directed by Company to assist in the investigation, mitigation and remediation of each such Personal Data Breach.',
);

// ---------------------------------------------------------------------------
// 8. DPIA
// ---------------------------------------------------------------------------

ensureSpace();
h2('8', 'Data Protection Impact Assessment and Prior Consultation');
p(
  'Processor shall provide reasonable assistance to the Company with any data protection impact assessments, and ' +
  'prior consultations with Supervising Authorities or other competent data privacy authorities, which Company ' +
  'reasonably considers to be required by article 35 or 36 of the GDPR or equivalent provisions of any other Data ' +
  'Protection Law, in each case solely in relation to Processing of Company Personal Data by, and taking into account ' +
  'the nature of the Processing and information available to, the Contracted Processors.',
);

// ---------------------------------------------------------------------------
// 9. DELETION
// ---------------------------------------------------------------------------

ensureSpace();
h2('9', 'Deletion or return of Company Personal Data');
clause('9.1',
  'Subject to this section 9 Processor shall promptly and in any event within thirty (30) days of the date of cessation of any Services involving the Processing of Company Personal Data (the "Cessation Date"), delete and procure the deletion of all copies of those Company Personal Data, save to the extent that retention is required by applicable law.',
);
clause('9.2',
  'Processor shall provide written certification to Company that it has fully complied with this section 9 within ten (10) business days of completing such deletion.',
);

// ---------------------------------------------------------------------------
// 10. AUDIT
// ---------------------------------------------------------------------------

ensureSpace();
h2('10', 'Audit rights');
clause('10.1',
  'Subject to this section 10, Processor shall make available to the Company on request all information necessary to demonstrate compliance with this Agreement, and shall allow for and contribute to audits, including inspections, by the Company or an auditor mandated by the Company in relation to the Processing of the Company Personal Data by the Contracted Processors.',
);
clause('10.2',
  'Information and audit rights of the Company only arise under section 10.1 to the extent that the Agreement does not otherwise give them information and audit rights meeting the relevant requirements of Data Protection Law. Where Processor holds an applicable third-party security certification (e.g. SOC 2 Type II, ISO 27001), Company agrees that the corresponding audit report will satisfy the audit obligations under this section in respect of the matters covered by that certification.',
);

// ---------------------------------------------------------------------------
// 11. DATA TRANSFER
// ---------------------------------------------------------------------------

ensureSpace();
h2('11', 'Data Transfer');
clause('11.1',
  'The Processor may not transfer or authorize the transfer of Data to countries outside the EU and/or the European Economic Area (EEA) without the prior written consent of the Company. If personal data processed under this Agreement is transferred from a country within the European Economic Area to a country outside the European Economic Area, the Parties shall ensure that the personal data are adequately protected. To achieve this, the Parties shall, unless agreed otherwise, rely on EU approved standard contractual clauses for the transfer of personal data. Company acknowledges that the Subprocessors listed in Schedule 1 may be located outside the EEA, and consents to such transfers subject to the foregoing safeguards.',
);

// ---------------------------------------------------------------------------
// 12. GENERAL TERMS
// ---------------------------------------------------------------------------

ensureSpace();
h2('12', 'General Terms');
clause('12.1',
  'Confidentiality. Each Party must keep this Agreement and information it receives about the other Party and its business in connection with this Agreement ("Confidential Information") confidential and must not use or disclose that Confidential Information without the prior written consent of the other Party except to the extent that (a) disclosure is required by law; or (b) the relevant information is already in the public domain.',
);
clause('12.2',
  'Notices. All notices and communications given under this Agreement must be in writing and will be delivered personally, sent by post or sent by email to the address or email address set out in the heading of this Agreement at such other address as notified from time to time by the Parties changing address.',
);

// ---------------------------------------------------------------------------
// 13. GOVERNING LAW
// ---------------------------------------------------------------------------

ensureSpace();
h2('13', 'Governing Law and Jurisdiction');
clause('13.1', `This Agreement is governed by the laws of ${GOVERNING_LAW}.`);
clause('13.2',
  `Any dispute arising in connection with this Agreement, which the Parties will not be able to resolve amicably, will be submitted to the exclusive jurisdiction of the courts of ${COURT_VENUE}, subject to possible appeal to ${APPEAL_VENUE}.`,
);

// ---------------------------------------------------------------------------
// SIGNATURES
// ---------------------------------------------------------------------------

ensureSpace(220);
doc.moveDown(0.8);
doc.font(FONT_ITAL).fontSize(10).fillColor('#222');
doc.text('IN WITNESS WHEREOF, this Agreement is entered into with effect from the date first set out below.', { align: 'center' });
doc.moveDown(1);

doc.font(FONT_BOLD).fontSize(11).fillColor('#000').text('Company');
doc.moveDown(0.3);
doc.font(FONT_BODY).fontSize(10);
doc.text('Signature ____________________________________________');
doc.text('Name:     ____________________________________________');
doc.text('Title:    ____________________________________________');
doc.text('Date:     ____________________________________________');
doc.moveDown(0.8);

doc.font(FONT_BOLD).fontSize(11).fillColor('#000').text(`Data Processor — ${PROCESSOR_NAME}`);
doc.moveDown(0.3);
doc.font(FONT_BODY).fontSize(10);
doc.text('Signature ____________________________________________');
doc.text('Name:     ____________________________________________');
doc.text('Title:    ____________________________________________');
doc.text('Date:     ____________________________________________');

// ---------------------------------------------------------------------------
// SCHEDULE 1 — SUBPROCESSORS
// ---------------------------------------------------------------------------

doc.addPage();
doc.font(FONT_BOLD).fontSize(14).fillColor('#0a0a0a').text('Schedule 1 — List of Subprocessors', { align: 'center' });
doc.moveDown(0.6);
doc.font(FONT_BODY).fontSize(10).fillColor('#222');
p(
  `As of the date this Agreement is signed, ${PROCESSOR_NAME} engages the following Subprocessors to ` +
  'process Company Personal Data in connection with the Services. This list is updated from time to time; ' +
  'the current version is published in the Compliance section of the Services. Notice of additions or ' +
  'replacements will be provided in accordance with section 5.3.',
);
doc.moveDown(0.6);

// Table
const startX = doc.page.margins.left;
const colWidths = [140, 220, 110]; // Subprocessor, Purpose, Location
const totalWidth = colWidths.reduce((a, b) => a + b, 0);
const rowPad = 6;

function drawRow(cells, isHeader = false) {
  const startY = doc.y;
  if (isHeader) doc.font(FONT_BOLD).fontSize(10);
  else          doc.font(FONT_BODY).fontSize(9.5);
  doc.fillColor('#222');

  // Measure max height
  let maxHeight = 0;
  cells.forEach((cell, i) => {
    const h = doc.heightOfString(cell, { width: colWidths[i] - rowPad * 2, lineGap: 1 });
    if (h > maxHeight) maxHeight = h;
  });
  const rowHeight = maxHeight + rowPad * 2;

  // Page break if needed
  if (startY + rowHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  const y = doc.y;

  // Background
  if (isHeader) {
    doc.rect(startX, y, totalWidth, rowHeight).fillColor('#f4f4f5').fill();
    doc.fillColor('#222');
  }

  // Cell text & borders
  let x = startX;
  cells.forEach((cell, i) => {
    doc.rect(x, y, colWidths[i], rowHeight).strokeColor('#d4d4d8').lineWidth(0.5).stroke();
    if (isHeader) doc.font(FONT_BOLD).fontSize(10);
    else          doc.font(FONT_BODY).fontSize(9.5);
    doc.fillColor('#222');
    doc.text(cell, x + rowPad, y + rowPad, { width: colWidths[i] - rowPad * 2, lineGap: 1 });
    x += colWidths[i];
  });

  doc.y = y + rowHeight;
}

drawRow(['Subprocessor', 'Purpose of processing', 'Location'], true);
SUBPROCESSORS.forEach(row => drawRow(row));

doc.moveDown(0.8);
doc.font(FONT_ITAL).fontSize(8.5).fillColor('#666');
doc.text(
  'Locations indicate the primary processing region. Some Subprocessors may operate from additional regions; ' +
  'cross-border transfers are governed by section 11 of this Agreement and the EU Standard Contractual Clauses ' +
  'where applicable.',
  { align: 'left' },
);

// ---------------------------------------------------------------------------
// SCHEDULE 2 — TECHNICAL & ORGANIZATIONAL MEASURES
// ---------------------------------------------------------------------------

doc.addPage();
doc.font(FONT_BOLD).fontSize(14).fillColor('#0a0a0a').text('Schedule 2 — Technical and Organizational Measures', { align: 'center' });
doc.moveDown(0.6);
p(
  'Pursuant to Article 32 of the GDPR, the Data Processor implements the following technical and organizational ' +
  'measures to ensure a level of security appropriate to the risk of Processing:',
);

function tom(title, body) {
  doc.moveDown(0.4);
  doc.font(FONT_BOLD).fontSize(10.5).fillColor('#000').text(title);
  doc.moveDown(0.15);
  doc.font(FONT_BODY).fontSize(10).fillColor('#222');
  p(body);
}

tom('Access Control',
  'Role-based access control with workspace-scoped roles (owner, admin, member). Database row-level security ' +
  'policies enforce per-workspace data isolation. Multi-factor authentication can be enforced at the organization ' +
  'level. Idle session timeouts and IP allowlists are configurable per organization.',
);
tom('Encryption',
  'Data is encrypted in transit using TLS 1.2+ for all client and Subprocessor connections. Data at rest is ' +
  'encrypted using AES-256 by the Subprocessors hosting Company Personal Data (Supabase / underlying cloud ' +
  'providers). Authentication tokens are stored as one-way hashes.',
);
tom('Pseudonymization & Minimization',
  'User identifiers are UUIDs; user-supplied content is logically separated by workspace. Audit logs capture ' +
  'identifiers without exposing payload content where not strictly necessary.',
);
tom('Resilience & Backups',
  'Daily automated database backups with point-in-time recovery via Subprocessor-managed infrastructure. Edge ' +
  'function and storage redundancy provided through cloud-region replication.',
);
tom('Incident Response',
  'Documented breach-response procedure with 72-hour customer notification commitment. Error monitoring (Sentry) ' +
  'and security-alert email channel for anomalous events.',
);
tom('Vendor Management',
  'All Subprocessors are bound by written data-processing agreements no less protective than this Agreement. ' +
  'Subprocessor list is reviewed periodically and any additions are subject to the notice obligations in section 5.3.',
);
tom('Personnel',
  'Personnel with access to Company Personal Data are subject to written confidentiality obligations and ' +
  'least-privilege access principles.',
);
tom('Logging & Monitoring',
  'Authentication events, administrative actions, and security-sensitive operations are recorded in immutable audit ' +
  'logs accessible to organization administrators.',
);

drawFooters();
doc.end();

doc.on('end', () => {
  console.log(`Wrote DPA to ${OUT_PATH}`);
});
