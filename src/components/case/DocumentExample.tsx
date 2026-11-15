// Illustrative mock-ups of common documents, marked SAMPLE, with numbered callouts that
// match the "What they check" list. All names and numbers are made up.
import type { ReactNode } from 'react'
import { docGuide } from '../../lib/documentTypes'
import type { DocType } from '../../lib/documentTypes'

const N = ({ n }: { n: number }) => <span className="callout-num" aria-label={`Check ${n}`}>{n}</span>

function Paper({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="doc-paper" role="img" aria-label={`Sample ${title}`}>
      <div className="doc-watermark" aria-hidden="true">SAMPLE</div>
      {children}
    </div>
  )
}

function Row({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="paper-row"><span>{left}</span><span>{right}</span></div>
}

const samples: Partial<Record<DocType, () => ReactNode>> = {
  bank_statement: () => (
    <Paper title="bank statement">
      <div className="paper-head"><strong>Golden Coast Bank</strong><span>Page 1 of 3 <N n={2} /></span></div>
      <p>Jordan Sample <N n={1} /><br />123 Example St, Los Angeles CA 90001</p>
      <p className="paper-muted">Everyday Checking ····4821 · Statement period Sep 1 – Sep 30, 2026 <N n={3} /></p>
      <Row left="Beginning balance" right="$2,140.18" />
      <Row left="09/05 Payroll deposit · Acme Logistics" right="+$1,862.40" />
      <Row left="09/12 Transfer from savings" right="+$500.00" />
      <Row left="09/14 Cash deposit" right={<>+$1,200.00 <N n={4} /></>} />
      <Row left="09/15 Mortgage payment" right="−$2,315.00" />
      <Row left={<strong>Ending balance</strong>} right={<strong>$3,387.58</strong>} />
    </Paper>
  ),
  pay_stub: () => (
    <Paper title="pay stub">
      <div className="paper-head"><strong>Acme Logistics Inc. <N n={1} /></strong><span>Earnings Statement</span></div>
      <p>Employee: Jordan Sample · ID 00417</p>
      <p className="paper-muted">Pay period 09/01/2026 – 09/15/2026 · Pay date 09/19/2026 <N n={2} /></p>
      <div className="paper-cols">
        <div><Row left="Regular 80 hrs" right="$2,240.00" /><Row left="Overtime 4 hrs" right="$168.00" /><Row left={<strong>Gross pay</strong>} right={<strong>$2,408.00 <N n={3} /></strong>} /></div>
        <div><Row left="Federal tax" right="$221.00" /><Row left="State tax" right="$84.00" /><Row left={<strong>Net pay</strong>} right={<strong>$1,862.40</strong>} /></div>
      </div>
      <Row left="Year-to-date gross" right="$43,344.00" />
    </Paper>
  ),
  tax_return: () => (
    <Paper title="Form 1040">
      <div className="paper-head"><strong>Form 1040 · U.S. Individual Income Tax Return · 2025 <N n={3} /></strong><span>Page 1 of 2 <N n={1} /></span></div>
      <p>Jordan Sample &amp; Casey Sample · Filing status: Married filing jointly</p>
      <Row left="1a Wages (W-2)" right="$58,210" />
      <Row left="8 Other income (Schedule 1)" right="$4,800" />
      <Row left="11 Adjusted gross income" right="$61,370" />
      <Row left="24 Total tax" right="$3,112" />
      <div className="paper-sign">Sign here: <em>Jordan Sample</em> · Date 04/02/2026 <N n={2} /></div>
    </Paper>
  ),
  mortgage_statement: () => (
    <Paper title="mortgage statement">
      <div className="paper-head"><strong>Example Home Loan Servicing</strong><span>Statement date 10/16/2026 <N n={3} /></span></div>
      <p>Jordan Sample · 123 Example St, Los Angeles CA 90001</p>
      <Row left="Loan number" right={<>0012345678 <N n={1} /></>} />
      <Row left="Payment due 11/01/2026" right="$2,315.00" />
      <Row left="Past due amount" right={<>$6,945.00 <N n={2} /></>} />
      <Row left={<strong>Total amount due</strong>} right={<strong>$9,260.00</strong>} />
      <p className="paper-muted">Unpaid principal balance $412,880.11 · Interest rate 4.125%</p>
    </Paper>
  ),
  hardship_letter: () => (
    <Paper title="hardship letter">
      <p className="paper-muted">October 20, 2026 · Loan #0012345678</p>
      <p>To Example Home Loan Servicing,</p>
      <p>In March 2026 my hours at Acme Logistics were cut in half <N n={1} />. Our household income dropped from about $5,200 to $3,100 a month, and we fell three payments behind <N n={2} />.</p>
      <p>We would like to sell the home through a short sale to avoid foreclosure <N n={3} />. Thank you for considering our request.</p>
      <div className="paper-sign">Jordan Sample · signed 10/20/2026 <N n={4} /></div>
    </Paper>
  ),
  irs_4506c: () => (
    <Paper title="IRS Form 4506-C">
      <div className="paper-head"><strong>Form 4506-C · IVES Request for Transcript of Tax Return</strong></div>
      <Row left="1a Name shown on tax return" right={<>Jordan Sample <N n={1} /></>} />
      <Row left="1b SSN" right="XXX-XX-1234" />
      <Row left="6 Transcript requested" right="Return transcript, 2024 and 2025" />
      <div className="paper-sign">Signature: <em>Jordan Sample</em> · Date 10/20/2026 <N n={2} /></div>
    </Paper>
  ),
  profit_loss: () => (
    <Paper title="profit and loss statement">
      <div className="paper-head"><strong>Sample Landscaping LLC <N n={1} /></strong><span>Profit &amp; Loss · Jan 1 – Oct 15, 2026</span></div>
      <Row left="Income" right="$48,600.00" />
      <Row left="Supplies and equipment" right="−$9,420.00" />
      <Row left="Vehicle and fuel" right="−$5,180.00" />
      <Row left="Insurance" right="−$2,400.00" />
      <Row left={<strong>Net profit</strong>} right={<strong>$31,600.00 <N n={2} /></strong>} />
      <div className="paper-sign">Prepared and signed by Jordan Sample · 10/16/2026 <N n={3} /></div>
    </Paper>
  ),
  benefit_letter: () => (
    <Paper title="benefit letter">
      <div className="paper-head"><strong>Social Security Administration</strong><span>Benefit Verification Letter</span></div>
      <p className="paper-muted">Date: January 9, 2026 <N n={3} /></p>
      <p>Casey Sample <N n={1} /></p>
      <p>Beginning December 2025, the full monthly Social Security benefit before any deductions is <strong>$1,418.00</strong> <N n={2} />.</p>
    </Paper>
  ),
  contribution_letter: () => (
    <Paper title="household contribution letter">
      <p className="paper-muted">October 20, 2026</p>
      <p>I, Riley Sample, am Jordan Sample's adult son <N n={1} /> and have lived at 123 Example St since 2021.</p>
      <p>I contribute $900 per month toward household expenses and will continue to for at least the next 12 months <N n={2} />.</p>
      <div className="paper-sign">Riley Sample · signed 10/20/2026 <N n={3} /></div>
    </Paper>
  )
}

export function DocumentExample({ type }: { type: string | null | undefined }) {
  const guide = docGuide(type)
  const sample = samples[(type ?? 'other') as DocType]
  return (
    <div className="doc-example">
      <p><strong>{guide.title}.</strong> {guide.what}</p>
      <p><strong>Where to get it:</strong> {guide.where}</p>
      {sample && sample()}
      <h5>What they check</h5>
      <ol className="doc-checks">
        {guide.checks.map((c, i) => <li key={i}>{c}</li>)}
      </ol>
      {sample && <p className="form-note">Sample only: made-up names and numbers. Yours will look different.</p>}
    </div>
  )
}
