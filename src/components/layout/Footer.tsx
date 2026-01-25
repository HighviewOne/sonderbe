import { Link } from 'react-router-dom'

export function Footer() {
  return (
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
              <li><Link to="/#steps">Get Started</Link></li>
              <li><Link to="/#options">Your Options</Link></li>
              <li><Link to="/#checklist">Document Checklist</Link></li>
              <li><Link to="/#resources">Resources</Link></li>
              <li><Link to="/#faq">FAQ</Link></li>
              <li><Link to="/#contact">Contact Us</Link></li>
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
  )
}
