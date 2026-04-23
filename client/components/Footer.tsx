export default function Footer() {
  return (
    <footer className="powered">
      <a
        href="https://kelsus.com"
        target="_blank"
        rel="noopener noreferrer"
        className="powered-link"
      >
        <span className="powered-text">Powered by</span>
        <span className="kelsus-logo" aria-label="Kelsus">
          <img src="/kelsus-logo.svg" alt="Kelsus" />
        </span>
      </a>
    </footer>
  );
}
