import { getSiteConfig } from '../../config/site'

function FooterCTA({ siteConfig = getSiteConfig() }) {
  return (
    <section className="home-split-section footer-cta" aria-labelledby="footer-cta-title">
      <div>
        <p className="home-kicker">Plan your Costa Rica experience</p>
        <h2 id="footer-cta-title">Ready to explore Costa Rica?</h2>
        <p>Choose a nature experience or arrange transportation around your itinerary.</p>
      </div>
      <div className="footer-cta-actions" aria-label="Plan your trip">
        <a className="home-primary-action" href="#featured-tours">Explore Tours</a>
        {siteConfig.whatsapp && (
          <a
            className="home-secondary-action"
            href={siteConfig.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp Us
          </a>
        )}
      </div>
    </section>
  )
}

export default FooterCTA
