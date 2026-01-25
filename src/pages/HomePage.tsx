import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSubmissions } from '../hooks/useSubmissions'
import {
  checklistData,
  faqData,
  optionsData,
  stepsData,
  resourcesData,
  situationOptions
} from '../lib/constants'

export function HomePage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [openChecklistIndex, setOpenChecklistIndex] = useState<number | null>(0)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    situation: '',
    message: ''
  })
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const { user } = useAuth()
  const { submitForm, submitting, error } = useSubmissions()

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  const toggleChecklist = (index: number) => {
    setOpenChecklistIndex(openChecklistIndex === index ? null : index)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await submitForm(formData)
    if (success) {
      setSubmitSuccess(true)
      setFormData({
        name: '',
        email: '',
        phone: '',
        situation: '',
        message: ''
      })
    }
  }

  return (
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
            {user && (
              <p className="checklist-cta">
                <a href="/portal/checklist" className="btn btn-secondary">
                  Track Your Progress in My Portal
                </a>
              </p>
            )}
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

          {submitSuccess ? (
            <div className="contact-success">
              <h3>Thank You!</h3>
              <p>Your submission has been received. We'll review your information and get back to you soon.</p>
              {user && (
                <p>
                  <a href="/portal" className="btn btn-primary">View Your Portal</a>
                </p>
              )}
              <button
                onClick={() => setSubmitSuccess(false)}
                className="btn btn-secondary"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label htmlFor="name">Your Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your full name"
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="(555) 123-4567"
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="your@email.com"
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="situation">Current Situation *</label>
                <select
                  id="situation"
                  name="situation"
                  value={formData.situation}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                >
                  {situationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Tell Us More (Optional)</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Share any additional details about your situation that might help us assist you better..."
                  disabled={submitting}
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Request Free Consultation'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
