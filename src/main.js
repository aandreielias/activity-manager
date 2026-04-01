import './styles/main.css';
import { App } from './core/App.js';

// Initialize the application
const app = new App();
app.init().catch(err => {
    console.error('CRITICAL: Failed to initialize application:', err);
    // Show a basic UI fallback if needed
    document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; color:var(--text-primary); background:var(--bg-primary);">
            <h1 style="color:red;">Startfehler</h1>
            <p>Die Anwendung konnte nicht geladen werden. Bitte laden Sie die Seite neu.</p>
            <pre style="background:var(--bg-secondary); padding:1rem; border-radius:8px; font-size:0.8rem;">${err.message}</pre>
        </div>
    `;
});
