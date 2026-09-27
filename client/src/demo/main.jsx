// Tarayıcı içi demo sürümünün giriş noktası (npm run build:demo).
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { z } from 'zod';
import App from '../App.jsx';
import { AuthProvider } from '../auth.jsx';
import { FeedbackProvider } from '../components/ui.jsx';
import '../styles.css';
import { startDemoServer } from './server.js';

// Çerçevenin güvenlik ilkesi dinamik kod üretimine izin vermeyebilir.
z.config({ jitless: true });

function DemoBanner({ onReset }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="demo-banner" role="note">
      <span>
        <b>Demo sürümü:</b> kişi ve şirket verileri kurgusaldır; yaptığınız değişiklikler yalnızca bu cihazda saklanır.
      </span>
      {confirming ? (
        <span className="row">
          <span>Tüm demo verisi başlangıç haline dönsün mü?</span>
          <button className="btn btn-sm btn-danger" onClick={onReset}>
            Sıfırla
          </button>
          <button className="btn btn-sm" onClick={() => setConfirming(false)}>
            Vazgeç
          </button>
        </span>
      ) : (
        <button className="btn btn-sm" onClick={() => setConfirming(true)}>
          Demo verisini sıfırla
        </button>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root'));

async function start() {
  try {
    const demo = await startDemoServer();
    globalThis.__FIMAR_DEMO__ = demo;
    const reset = () => {
      demo.reset();
      window.location.reload();
    };
    root.render(
      <StrictMode>
        <MemoryRouter>
          <AuthProvider>
            <FeedbackProvider>
              <DemoBanner onReset={reset} />
              <App />
            </FeedbackProvider>
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    );
  } catch (err) {
    console.error(err);
    document.getElementById('root').innerHTML =
      '<div class="loading">Demo başlatılamadı. Sayfayı yenileyip tekrar deneyin.</div>';
  }
}

start();
