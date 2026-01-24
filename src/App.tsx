import { useState } from 'react'
import './App.css'

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [openChecklistIndex, setOpenChecklistIndex] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  const toggleChecklist = (index: number) => {
    setOpenChecklistIndex(openChecklistIndex === index ? null : index)
  }

  const checklistData = [
    {
      title: "Identification & Loan Details",
      icon: "🪪",
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
      icon: "💵",
      items: [
        "Recent pay stubs (last 30 days)",
        "Last two years of W-2 forms",
        "Last two years of federal tax returns (all pages)",
        "Year-to-date profit & loss statement (if self-employed)",
        "IRS Form 4506-T or 4506-EZ (to verify tax info)",
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
      icon: "📊",
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
      icon: "📝",
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
      icon: "📋",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Thank you for reaching out. This is a demo form. In production, your information would be securely submitted.')
  }

  const faqData = [
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

  const optionsData = [
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

  const stepsData = [
    { number: 1, title: "Don't Panic", description: "Take a breath. You have options and time to explore them." },
    { number: 2, title: "Open Your Mail", description: "Read all notices from your lender to understand your timeline." },
    { number: 3, title: "Call Your Lender", description: "Contact the loss mitigation department to discuss options." },
    { number: 4, title: "Gather Documents", description: "Collect income, expense, and hardship documentation." },
    { number: 5, title: "Get Free Help", description: "Contact a HUD-approved counselor for guidance." }
  ]

  const resourcesData = [
    {
      icon: "🏛️",
      title: "HUD Housing Counselors",
      description: "Free, HUD-approved counseling services to help you navigate your options.",
      link: "https://www.hud.gov/findacounselor",
      linkText: "Find a Counselor"
    },
    {
      icon: "📋",
      title: "CFPB Resources",
      description: "Consumer Financial Protection Bureau guides on mortgage assistance.",
      link: "https://www.consumerfinance.gov/housing/",
      linkText: "View Resources"
    },
    {
      icon: "⚖️",
      title: "California Legal Aid",
      description: "Free legal assistance for California homeowners facing foreclosure.",
      link: "https://www.lawhelpca.org/",
      linkText: "Get Legal Help"
    },
    {
      icon: "💰",
      title: "CA Mortgage Relief",
      description: "California Mortgage Relief Program for eligible homeowners.",
      link: "https://camortgagerelief.org/",
      linkText: "Check Eligibility"
    },
    {
      icon: "🏠",
      title: "NeighborWorks",
      description: "National network of community-based homeownership organizations.",
      link: "https://www.neighborworks.org/",
      linkText: "Find Local Help"
    },
    {
      icon: "📞",
      title: "HOPE Hotline",
      description: "24/7 free foreclosure prevention counseling: 1-888-995-4673",
      link: "tel:1-888-995-4673",
      linkText: "Call Now"
    }
  ]

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header className="header">
        <nav className="nav">
          <a href="#" className="logo">Sonder<span>Be</span></a>
          <ul className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
            <li><a href="#steps" onClick={() => setMobileMenuOpen(false)}>Get Started</a></li>
            <li><a href="#options" onClick={() => setMobileMenuOpen(false)}>Your Options</a></li>
            <li><a href="#checklist" onClick={() => setMobileMenuOpen(false)}>Documents</a></li>
            <li><a href="#resources" onClick={() => setMobileMenuOpen(false)}>Resources</a></li>
            <li><a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a></li>
            <li><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a></li>
          </ul>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </nav>
      </header>

      <main id="main-content">
        {/* Hero Section */}
        <section className="hero">
          <div className="container">
            <h1>Keep Your Home. We're Here to Help.</h1>
            <p>
              Facing foreclosure can feel overwhelming, but you're not alone.
              Discover your options and take the first step toward protecting your home and your future.
            </p>
            <div className="hero-buttons">
              <a href="#options" className="btn btn-primary">Explore Your Options</a>
              <a href="#contact" className="btn btn-secondary">Get Free Guidance</a>
            </div>
          </div>
        </section>

        {/* Action Steps */}
        <section id="steps" className="action-steps">
          <div className="container">
            <div className="section-title">
              <h2>Take Action Today</h2>
              <p>Five steps you can take right now to start protecting your home</p>
            </div>
            <div className="steps-grid">
              {stepsData.map((step) => (
                <div key={step.number} className="step">
                  <div className="step-number" aria-hidden="true">{step.number}</div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Options Section */}
        <section id="options" className="options">
          <div className="container">
            <div className="section-title">
              <h2>Your Foreclosure Prevention Options</h2>
              <p>Understanding your choices is the first step toward finding the right solution for your situation</p>
            </div>
            <div className="options-grid">
              {optionsData.map((option, index) => (
                <article key={index} className="option-card">
                  <h3>{option.title}</h3>
                  <p>{option.description}</p>
                  <ul>
                    {option.benefits.map((benefit, i) => (
                      <li key={i}>{benefit}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Loan Modification Checklist Section */}
        <section id="checklist" className="checklist">
          <div className="container">
            <div className="section-title">
              <h2>Loan Modification Document Checklist</h2>
              <p>Gather these documents before applying for a loan modification. Being prepared speeds up the process.</p>
            </div>
            <div className="checklist-container">
              {checklistData.map((category, index) => (
                <div key={index} className={`checklist-category ${openChecklistIndex === index ? 'open' : ''}`}>
                  <button
                    className="checklist-header"
                    onClick={() => toggleChecklist(index)}
                    aria-expanded={openChecklistIndex === index}
                    aria-controls={`checklist-content-${index}`}
                  >
                    <span className="checklist-icon" aria-hidden="true">{category.icon}</span>
                    <span className="checklist-title">{category.title}</span>
                    <span className="checklist-toggle" aria-hidden="true">{openChecklistIndex === index ? '−' : '+'}</span>
                  </button>
                  <div
                    id={`checklist-content-${index}`}
                    className="checklist-content"
                    role="region"
                  >
                    <ul className="checklist-items">
                      {category.items.map((item, i) => (
                        <li key={i}>
                          <label className="checklist-item">
                            <input type="checkbox" />
                            <span className="checkmark"></span>
                            <span className="item-text">{item}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <div className="checklist-tip">
              <strong>Tip:</strong> Make copies of all documents before submitting. Keep originals in a safe place and note the date you sent each item.
            </div>
          </div>
        </section>

        {/* Resources Section */}
        <section id="resources" className="resources">
          <div className="container">
            <div className="section-title">
              <h2>Trusted Resources</h2>
              <p>Free help from government agencies and nonprofit organizations</p>
            </div>
            <div className="resources-grid">
              {resourcesData.map((resource, index) => (
                <div key={index} className="resource-card">
                  <div className="resource-icon" aria-hidden="true">{resource.icon}</div>
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                  <a href={resource.link} target="_blank" rel="noopener noreferrer">
                    {resource.linkText} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="faq">
          <div className="container">
            <div className="section-title">
              <h2>Frequently Asked Questions</h2>
              <p>Get answers to common questions about foreclosure prevention in California</p>
            </div>
            <div className="faq-list">
              {faqData.map((faq, index) => (
                <div key={index} className={`faq-item ${openFaqIndex === index ? 'open' : ''}`}>
                  <button
                    className="faq-question"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={openFaqIndex === index}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span>{faq.question}</span>
                    <span className="faq-icon" aria-hidden="true">+</span>
                  </button>
                  <div
                    id={`faq-answer-${index}`}
                    className="faq-answer"
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                  >
                    <p>{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="contact">
          <div className="container">
            <div className="section-title">
              <h2>Get Personalized Guidance</h2>
              <p>Share your situation and we'll help you understand your best options</p>
            </div>
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Your Name *</label>
                <input type="text" id="name" name="name" required placeholder="Enter your full name" />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input type="tel" id="phone" name="phone" required placeholder="(555) 123-4567" />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input type="email" id="email" name="email" required placeholder="your@email.com" />
              </div>
              <div className="form-group">
                <label htmlFor="situation">Current Situation *</label>
                <select id="situation" name="situation" required>
                  <option value="">Select your situation</option>
                  <option value="behind">Behind on payments</option>
                  <option value="notice">Received Notice of Default</option>
                  <option value="sale">Received Notice of Sale</option>
                  <option value="struggling">Struggling but current</option>
                  <option value="other">Other situation</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Tell Us More (Optional)</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Share any additional details about your situation that might help us assist you better..."
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary">
                Request Free Consultation
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>SonderBe</h4>
              <p>Helping California homeowners navigate foreclosure prevention with compassion and expertise.</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="#steps">Get Started</a></li>
                <li><a href="#options">Your Options</a></li>
                <li><a href="#checklist">Document Checklist</a></li>
                <li><a href="#resources">Resources</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#contact">Contact Us</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Emergency Resources</h4>
              <ul>
                <li><a href="tel:1-888-995-4673">HOPE Hotline: 1-888-995-4673</a></li>
                <li><a href="https://www.hud.gov/findacounselor" target="_blank" rel="noopener noreferrer">HUD Counselor Search</a></li>
                <li><a href="https://camortgagerelief.org/" target="_blank" rel="noopener noreferrer">CA Mortgage Relief</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-disclaimer">
            <p>
              <strong>Disclaimer:</strong> The information provided on this website is for general educational purposes only and does not constitute legal, financial, or professional advice. Every homeowner's situation is unique, and outcomes may vary. We strongly recommend consulting with a HUD-approved housing counselor, licensed attorney, or qualified financial advisor before making any decisions regarding your mortgage or foreclosure situation.
            </p>
            <p>
              SonderBe is not a law firm, government agency, or lender. We do not guarantee any specific results or outcomes. California foreclosure laws and processes may change, and the information here may not reflect the most current legal developments.
            </p>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} SonderBe. All rights reserved. | Serving California Homeowners</p>
          </div>
        </div>
      </footer>
    </>
  )
}

export default App
