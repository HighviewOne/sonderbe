// Must match COUNTIES / SITUATIONS in server/src/matching.ts
export const COUNTIES = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']

// Document uploads are hidden: SonderBe tracks readiness only and does not hold
// homeowners' financial documents. The matched professional collects them directly.
// The upload code (DocumentUpload, /api/documents) is kept in case this changes.
export const DOCUMENT_UPLOADS_ENABLED = false

export const checklistData = [
  {
    title: "Identification & Loan Details",
    icon: "ID",
    items: [
      "Government-issued photo ID (driver's license or passport)",
      "Social Security number for all borrowers",
      "Current mortgage statement",
      "Loan number and servicer contact information",
      "Proof of residence (utility bill with property address)",
      "Property tax bill",
      "Homeowners insurance declarations page",
      "HOA bill (if applicable)"
    ]
  },
  {
    title: "Income & Asset Documentation",
    icon: "$",
    items: [
      "Recent pay stubs (last 30 days)",
      "Last two years of W-2 forms",
      "Last two years of federal tax returns (all pages)",
      "Year-to-date profit & loss statement (if self-employed)",
      "IRS Form 4506-C, signed (lets your lender verify your tax returns)",
      "Unemployment benefit statements (if applicable)",
      "Social Security or disability award letters (if applicable)",
      "Pension or retirement income documentation",
      "Child support or alimony court orders (if applicable)",
      "Rental income documentation (lease agreements)",
      "Recent bank statements (checking, savings, investments)"
    ]
  },
  {
    title: "Monthly Expenses & Budget",
    icon: "B",
    items: [
      "Current housing costs (mortgage, taxes, insurance)",
      "Utility bills (electric, gas, water, internet)",
      "Food and grocery expenses",
      "Transportation costs (car payment, insurance, gas)",
      "Health insurance and medical costs",
      "Credit card minimum payments",
      "Personal loan payments",
      "Student loan payments",
      "Child support or alimony obligations",
      "Childcare or dependent care costs",
      "Income-and-expense worksheet (servicer may provide form)"
    ]
  },
  {
    title: "Hardship Explanation & Proof",
    icon: "H",
    items: [
      "Hardship letter explaining your situation",
      "When the hardship started",
      "Whether it's temporary or permanent",
      "What payment you believe you can afford",
      "Job loss: Termination or layoff letter",
      "Reduced hours: Notice from employer",
      "Medical hardship: Medical bills or doctor's notes",
      "Divorce: Divorce decree or separation agreement",
      "Death in family: Death certificate",
      "Unemployment: Benefit award letter"
    ]
  },
  {
    title: "Servicer Forms & Authorizations",
    icon: "F",
    items: [
      "Loss mitigation or loan modification application",
      "Servicer's specific request for modification (RMA) form",
      "Contribution letter (if someone helps pay mortgage)",
      "Third-party authorization form (for counselor or attorney)",
      "Signed and dated certification statements",
      "Any additional forms requested by your servicer"
    ]
  }
]

export const faqData = [
  {
    question: "How long do I have before my home is foreclosed in California?",
    answer: "In California, the foreclosure process typically takes 120+ days from the first missed payment. You'll receive a Notice of Default after 90 days of missed payments, then have 90 days to cure the default before a Notice of Sale is filed. Even after that, you have at least 21 days before the sale. However, don't wait—the sooner you act, the more options you'll have."
  },
  {
    question: "Will foreclosure completely ruin my credit?",
    answer: "A foreclosure will significantly impact your credit score, typically causing a drop of 100-150 points. It remains on your credit report for 7 years. However, many people begin rebuilding their credit within 2-3 years and can qualify for new home loans in 3-7 years depending on the loan type. The impact lessens over time, especially if you maintain good credit habits afterward."
  },
  {
    question: "Can I stop foreclosure once it has started?",
    answer: "Yes, you can stop foreclosure at various stages in California. Options include loan modification, forbearance, repayment plans, refinancing, selling the home, or in some cases, filing for bankruptcy. Even up to 5 days before the sale, you may be able to reinstate your loan by paying all past-due amounts. Contact your lender immediately to discuss options."
  },
  {
    question: "What is a loan modification and how do I qualify?",
    answer: "A loan modification permanently changes the terms of your mortgage to make payments more affordable. This might include reducing your interest rate, extending the loan term, or adding missed payments to the loan balance. To qualify, you typically need to demonstrate financial hardship, have a steady income, and show that you can afford the modified payment. Contact your lender's loss mitigation department to apply."
  },
  {
    question: "Is refinancing an option if I'm behind on payments?",
    answer: "Refinancing while behind on payments is challenging but not impossible. Traditional refinancing typically requires you to be current on payments. However, some government programs and specialized lenders work with homeowners who are behind. FHA and VA loans may have special options. It's worth exploring, especially if you have significant equity in your home."
  },
  {
    question: "What's the difference between a short sale and foreclosure?",
    answer: "In a short sale, you sell your home for less than what you owe with your lender's approval. This typically has less credit impact than foreclosure (50-100 points less), you may avoid a deficiency judgment, and you can often buy a new home sooner. The process requires lender approval and can take 3-6 months, but it gives you more control than foreclosure."
  },
  {
    question: "How do I avoid foreclosure scams?",
    answer: "Be wary of anyone who guarantees to stop your foreclosure, asks for upfront fees before providing services, tells you to stop communicating with your lender, or asks you to sign over your property deed. Legitimate housing counselors through HUD are free. Never sign documents you don't understand, and verify any company through the California Department of Real Estate."
  },
  {
    question: "Can bankruptcy stop foreclosure?",
    answer: "Filing for bankruptcy triggers an automatic stay that temporarily halts foreclosure proceedings. Chapter 13 bankruptcy can help you catch up on missed payments over 3-5 years while keeping your home. Chapter 7 may only delay foreclosure temporarily. Bankruptcy has significant long-term consequences, so consult with a bankruptcy attorney to understand if it's right for your situation."
  }
]

export const optionsData = [
  {
    title: "Loan Modification",
    description: "Work with your lender to permanently change your loan terms for more affordable payments.",
    benefits: ["Lower monthly payments", "Reduced interest rate", "Extended loan term", "Keep your home"]
  },
  {
    title: "Forbearance Agreement",
    description: "Temporarily reduce or pause your mortgage payments during financial hardship.",
    benefits: ["Immediate payment relief", "Time to recover financially", "Avoid foreclosure marks", "Flexible repayment options"]
  },
  {
    title: "Refinancing",
    description: "Replace your current mortgage with a new loan that has better terms.",
    benefits: ["Lower interest rate", "Reduced monthly payment", "Cash out equity if needed", "Fresh start on loan"]
  },
  {
    title: "Repayment Plan",
    description: "Catch up on missed payments over time while making regular monthly payments.",
    benefits: ["Spread out past-due amount", "Stay in your home", "No permanent loan changes", "Clear path to current status"]
  },
  {
    title: "Short Sale",
    description: "Sell your home for less than owed with lender approval to avoid foreclosure.",
    benefits: ["Less credit damage than foreclosure", "Potential debt forgiveness", "More control over process", "Faster credit recovery"]
  },
  {
    title: "Deed in Lieu",
    description: "Voluntarily transfer your property to the lender to satisfy the debt.",
    benefits: ["Avoid foreclosure on record", "Possible relocation assistance", "Faster resolution", "Clean break from mortgage"]
  }
]

export const stepsData = [
  { number: 1, title: "Don't Panic", description: "Take a breath. You have options and time to explore them." },
  { number: 2, title: "Open Your Mail", description: "Read all notices from your lender to understand your timeline." },
  { number: 3, title: "Call Your Lender", description: "Contact the loss mitigation department to discuss options." },
  { number: 4, title: "Gather Documents", description: "Collect income, expense, and hardship documentation." },
  { number: 5, title: "Get Free Help", description: "Contact a HUD-approved counselor for guidance." }
]

export const resourcesData = [
  {
    icon: "HUD",
    title: "HUD Housing Counselors",
    description: "Free, HUD-approved counseling services to help you navigate your options.",
    link: "https://www.hud.gov/findacounselor",
    linkText: "Find a Counselor"
  },
  {
    icon: "CFPB",
    title: "CFPB Resources",
    description: "Consumer Financial Protection Bureau guides on mortgage assistance.",
    link: "https://www.consumerfinance.gov/housing/",
    linkText: "View Resources"
  },
  {
    icon: "LAW",
    title: "California Legal Aid",
    description: "Free legal assistance for California homeowners facing foreclosure.",
    link: "https://www.lawhelpca.org/",
    linkText: "Get Legal Help"
  },
  {
    icon: "CAL",
    title: "CA Mortgage Relief",
    description: "California Mortgage Relief Program for eligible homeowners.",
    link: "https://camortgagerelief.org/",
    linkText: "Check Eligibility"
  },
  {
    icon: "NW",
    title: "NeighborWorks",
    description: "National network of community-based homeownership organizations.",
    link: "https://www.neighborworks.org/",
    linkText: "Find Local Help"
  },
  {
    icon: "HOPE",
    title: "HOPE Hotline",
    description: "24/7 free foreclosure prevention counseling: 1-888-995-4673",
    link: "tel:1-888-995-4673",
    linkText: "Call Now"
  }
]

export const situationOptions = [
  { value: "", label: "Select your situation" },
  { value: "behind", label: "Behind on payments" },
  { value: "notice", label: "Received Notice of Default" },
  { value: "sale", label: "Received Notice of Sale" },
  { value: "struggling", label: "Struggling but current" },
  { value: "other", label: "Other situation" }
]

export const situationLabel = (value: string) =>
  situationOptions.find(o => o.value === value)?.label ?? value

// ---------------------------------------------------------------------------
// Directory + case tracker. Must match server/src/matching.ts.
// ---------------------------------------------------------------------------

export type ProfessionalType = 'agent' | 'broker' | 'attorney' | 'legal_professional' | 'negotiator'

export const professionalTypes: { value: ProfessionalType; label: string; description: string }[] = [
  {
    value: 'agent',
    label: 'Real Estate Agent',
    description: 'Lists and sells your home, including short sales where the lender accepts less than you owe. Usually paid from the sale at closing.'
  },
  {
    value: 'broker',
    label: 'Real Estate Broker',
    description: 'A licensed agent who can run their own office and supervise other agents. Handles the same short sales and listings.'
  },
  {
    value: 'attorney',
    label: 'Attorney',
    description: 'Gives legal advice and can represent you: foreclosure defense, bankruptcy, lender disputes. Contact them directly.'
  },
  {
    value: 'legal_professional',
    label: 'Legal Professional',
    description: 'Legal document assistants and paralegals help prepare paperwork. They cannot give legal advice or represent you.'
  },
  {
    value: 'negotiator',
    label: 'Negotiator',
    description: 'Negotiates with your lender, often alongside a short-sale agent. Not a licensed profession in California.'
  }
]

export const professionalTypeLabel = (value: string | null | undefined) =>
  professionalTypes.find(t => t.value === value)?.label ?? 'Professional'

export type Stage = 'matched' | 'first_contact' | 'documents_requested' | 'documents_received' |
  'submitted_to_lender' | 'lender_review' | 'outcome'

export const stages: { value: Stage; label: string }[] = [
  { value: 'matched', label: 'Matched' },
  { value: 'first_contact', label: 'First contact' },
  { value: 'documents_requested', label: 'Documents requested' },
  { value: 'documents_received', label: 'Documents received' },
  { value: 'submitted_to_lender', label: 'Submitted to lender' },
  { value: 'lender_review', label: 'Lender reviewing' },
  { value: 'outcome', label: 'Outcome' }
]

export const stageLabel = (value: string) => stages.find(s => s.value === value)?.label ?? value

export const outcomes = [
  { value: 'short_sale_closed', label: 'Short sale closed' },
  { value: 'loan_modified', label: 'Loan modified' },
  { value: 'reinstated', label: 'Loan reinstated (caught up)' },
  { value: 'sold', label: 'Home sold' },
  { value: 'foreclosed', label: 'Foreclosure completed' },
  { value: 'other', label: 'Other' }
]

export const outcomeLabel = (value: string | null) => outcomes.find(o => o.value === value)?.label ?? ''

export const adCategoryLabels: Record<string, string> = {
  movers: 'Movers',
  storage: 'Storage',
  cleaning: 'Cleaning',
  rental_housing: 'Rental housing',
  other: 'Other services'
}

// ---------------------------------------------------------------------------
// Homeowner information + multiple professionals. Must match server/src/matching.ts.
// ---------------------------------------------------------------------------

export type Category = 'real_estate' | 'legal'

export const categoryOf: Record<ProfessionalType, Category> = {
  agent: 'real_estate',
  broker: 'real_estate',
  negotiator: 'real_estate',
  legal_professional: 'legal',
  attorney: 'legal'
}

export const categoryLabels: Record<Category, string> = {
  real_estate: 'Real estate professional',
  legal: 'Legal help'
}

export const relationships = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Son or daughter' },
  { value: 'parent', label: 'Parent' },
  { value: 'relative', label: 'Other relative' },
  { value: 'roommate', label: 'Roommate or tenant' },
  { value: 'other', label: 'Other' }
]

export const relationshipLabel = (value: string) =>
  value === 'self' ? 'You' : relationships.find(r => r.value === value)?.label ?? value

export const incomeTypes = [
  { value: 'employment', label: 'Job (paid by an employer)' },
  { value: 'self_employment', label: 'Self-employed / own business' },
  { value: 'social_security', label: 'Social Security' },
  { value: 'pension', label: 'Pension or retirement' },
  { value: 'disability', label: 'Disability' },
  { value: 'unemployment', label: 'Unemployment' },
  { value: 'rental', label: 'Rental income' },
  { value: 'child_support', label: 'Child support or alimony' },
  { value: 'other', label: 'Other income' }
]

export const incomeLabel = (value: string) => incomeTypes.find(t => t.value === value)?.label ?? value

export const hardshipReasons = [
  { value: 'job_loss', label: 'Lost a job', letter: 'lost my job' },
  { value: 'reduced_income', label: 'Income went down', letter: 'had my income reduced' },
  { value: 'medical', label: 'Medical bills or illness', letter: 'faced a serious illness and medical bills' },
  { value: 'divorce', label: 'Divorce or separation', letter: 'went through a divorce or separation' },
  { value: 'death', label: 'Death in the family', letter: 'lost a member of my household' },
  { value: 'disability', label: 'Disability', letter: 'became disabled' },
  { value: 'business_failure', label: 'Business slowed or closed', letter: 'saw my business slow down or close' },
  { value: 'increased_expenses', label: 'Expenses went up', letter: 'had my expenses go up sharply' },
  { value: 'disaster', label: 'Natural disaster', letter: 'was affected by a natural disaster' },
  { value: 'other', label: 'Something else', letter: 'faced an unexpected hardship' }
]

export const teamStatuses = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'consultation', label: 'Consultation scheduled' },
  { value: 'retained', label: 'Hired (retained)' },
  { value: 'done', label: 'Finished' }
]
