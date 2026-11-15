// What each requested document is, where to find it, and what the lender checks.
// Keys must match DOC_TYPES in server/src/household.ts.

export type DocType =
  | 'bank_statement' | 'tax_return' | 'mortgage_statement' | 'hardship_letter' | 'irs_4506c'
  | 'pay_stub' | 'profit_loss' | 'benefit_letter' | 'lease' | 'court_order' | 'contribution_letter' | 'other'

export type DocGuide = {
  title: string
  what: string
  where: string
  checks: string[]
  hasExample: boolean
}

export const docGuides: Record<DocType, DocGuide> = {
  bank_statement: {
    title: 'Bank statement',
    what: 'The monthly statement for each checking and savings account.',
    where: "Your bank's website or app, under Statements or Documents. Download the PDF, not a screenshot.",
    checks: [
      'Your name and the bank name are on it',
      'Every page is included, even blank ones ("page 3 of 3")',
      'The full statement period, usually the last 2 months',
      'Large deposits that are not your pay may need a short explanation'
    ],
    hasExample: true
  },
  tax_return: {
    title: 'Federal tax return (Form 1040)',
    what: 'The tax return you filed with the IRS, with all schedules.',
    where: 'Your tax preparer, your tax software account, or an IRS transcript from irs.gov/account.',
    checks: [
      'All pages and schedules, not just page 1',
      'Signed and dated if it is a copy you print',
      'The 2 most recent years'
    ],
    hasExample: true
  },
  mortgage_statement: {
    title: 'Mortgage statement',
    what: 'The monthly statement from the company you pay your mortgage to (your servicer).',
    where: "Your servicer's website or the paper statement they mail you.",
    checks: ['Loan number', 'Amount due and any past-due amount', 'The most recent month'],
    hasExample: true
  },
  hardship_letter: {
    title: 'Hardship letter',
    what: 'A short, signed letter in your own words: what happened, how it changed your income, and what you are asking for.',
    where: 'You write it. SonderBe can draft one from your information for you to edit.',
    checks: [
      'What happened and when',
      'How it affected your ability to pay',
      'What you want (keep the home, or sell it through a short sale)',
      'Your signature and the date'
    ],
    hasExample: true
  },
  irs_4506c: {
    title: 'IRS Form 4506-C',
    what: 'A form that lets the lender get your tax transcripts from the IRS. Each person on the loan signs one.',
    where: 'Your professional or lender usually sends it to you already filled in. Blank copies are on irs.gov.',
    checks: ['Name and Social Security number exactly as on your tax return', 'Signed and dated within the last 120 days'],
    hasExample: true
  },
  pay_stub: {
    title: 'Pay stub',
    what: 'The statement that comes with each paycheck.',
    where: "Your employer's payroll website (for example ADP or Paychex) or HR department.",
    checks: [
      'Employer name and your name',
      'Pay period dates covering the last 30 days',
      'Gross pay, deductions and year-to-date totals'
    ],
    hasExample: true
  },
  profit_loss: {
    title: 'Profit & loss statement',
    what: 'A simple summary of your business income and expenses this year.',
    where: 'Your bookkeeping software, or write it yourself. Your professional may give you a form.',
    checks: ['Business name and the period it covers (January 1 to today)', 'Total income, total expenses, net profit', 'Signed and dated'],
    hasExample: true
  },
  benefit_letter: {
    title: 'Benefit or award letter',
    what: 'The letter that says how much you receive each month (Social Security, disability, pension, unemployment).',
    where: 'Social Security: ssa.gov/myaccount. Pension: your plan administrator. Unemployment: your EDD account.',
    checks: ['Your name', 'Monthly amount', 'Dated this year'],
    hasExample: true
  },
  contribution_letter: {
    title: 'Household contribution letter',
    what: 'A short letter from someone who lives with you and helps pay the bills but is not on the loan.',
    where: 'They write and sign it. Include their proof of income too.',
    checks: ['Their name and relationship to you', 'How much they contribute each month and for how long', 'Their signature and the date'],
    hasExample: true
  },
  lease: {
    title: 'Lease agreement',
    what: 'The signed lease for any part of the property you rent out.',
    where: 'Your copy of the lease, or ask your tenant for theirs.',
    checks: ['Signed by you and the tenant', 'Monthly rent and the lease dates'],
    hasExample: false
  },
  court_order: {
    title: 'Court order or agreement',
    what: 'The court order or written agreement for child support or alimony.',
    where: 'Your family law attorney or the court clerk.',
    checks: ['Monthly amount', 'How long it lasts', 'All pages'],
    hasExample: false
  },
  other: {
    title: 'Document',
    what: 'Ask your professional if you are not sure what this is.',
    where: 'Your professional can tell you where to find it.',
    checks: ['Your name is on it', 'All pages', 'Recent dates'],
    hasExample: false
  }
}

export const docGuide = (type: string | null | undefined): DocGuide =>
  docGuides[(type ?? 'other') as DocType] ?? docGuides.other
