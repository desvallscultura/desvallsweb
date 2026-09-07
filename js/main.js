document.addEventListener('DOMContentLoaded', () => {

    // 1. Dynamic Year for Footer
    document.getElementById('year').textContent = new Date().getFullYear();

    // 2. Form Submission Logic using Google Apps Script (AJAX)
    const form = document.getElementById('associationForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('loader');
    const formMessage = document.getElementById('formMessage');

    // MOCK URL: Aquest URL s'hauria de substituir per l'URL del Deploy del teu Google Apps Script
    // Desplega l'script "google-apps-script-code.js" a Google Apps Script i substitueix l'URL aquí.
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxmQ3xCgRaCZdjqIdH49yBUVWOwIp3OFt7DmOkgIM-5mbGfxe6ftbib2HD2OMbh3uIR/exec'; 

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Set Loading state
            btnText.style.display = 'none';
            loader.style.display = 'block';
            submitBtn.disabled = true;
            formMessage.className = 'form-message';
            formMessage.style.display = 'none';

            // Gather Data
            const formData = new FormData(form);
            
            try {
                // We use fetch in standard way. Ensure GAS is configured to accept CORS (Content-Type text/plain workaround)
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: formData
                });

                // Wait for text response
                const resultText = await response.text();

                if (response.ok) {
                    formMessage.textContent = 'Gràcies! Hem rebut la teva sol·licitud correctament.';
                    formMessage.className = 'form-message success';
                    form.reset();
                } else {
                    throw new Error('Error al enviar les dades');
                }

            } catch (error) {
                // If SCRIPT_URL is not set, we simulate success for demo purposes
                console.error('Error enviant form:', error);
                
                // --- DEMO FALLBACK (Delete in production when SCRIPT_URL is real) ---
                if (SCRIPT_URL.includes('AKfycbxxxxxxx')) {
                     setTimeout(() => {
                         formMessage.textContent = 'DEMO: Simulació correcta. Afegeix el teu URL de Google Script al `main.js`.';
                         formMessage.className = 'form-message success';
                         form.reset();
                         resetBtnState();
                     }, 1500);
                     return;
                }
                // -------------------------------------------------------------------

                formMessage.textContent = "Hi ha hagut un error tècnic. Si us plau, contacta per Instagram a @desvallscultura o escriu a desvallscultura@gmail.com.";
                formMessage.className = 'form-message error';
            } finally {
                // This finally block won't perfectly execute after the DEMO fallback due to return, 
                // but that's fine for the demo structural flow.
                 resetBtnState();
            }
        });
    }

    function resetBtnState() {
        btnText.style.display = 'block';
        loader.style.display = 'none';
        submitBtn.disabled = false;
    }

    // 3. Smooth Header Background on Scroll
    const header = document.querySelector('.glass-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.7)';
            header.style.boxShadow = 'none';
        }
    });

    // 4. Cookie Consent Logic
    const cookieBanner = document.getElementById('cookieConsent');
    const acceptCookiesBtn = document.getElementById('acceptCookies');

    if (cookieBanner && !localStorage.getItem('cookiesAccepted')) {
        cookieBanner.style.display = 'flex';
    }

    if (acceptCookiesBtn) {
        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('cookiesAccepted', 'true');
            cookieBanner.style.display = 'none';
        });
    }

    // 5. Mobile Menu Toggle
    const mobileMenuIcon = document.getElementById('mobileMenuIcon');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuIcon && navLinks) {
        mobileMenuIcon.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuIcon.classList.toggle('active');
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuIcon.classList.remove('active');
            });
        });
    }

});

// 6. Avís Festival d'Art Lumínic (En construcció · Properament accessible)
window.openArtLuminicPending = function(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    let modal = document.getElementById('modal-art-luminic-pending');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-art-luminic-pending';
        modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(3,7,18,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1.25rem;animation:fadeInModal 0.25s ease-out;';
        modal.innerHTML = `
            <div style="background:#0f172a;border:1.5px solid #06b6d4;border-radius:24px;max-width:490px;width:100%;padding:2.5rem 2rem;text-align:center;box-shadow:0 25px 60px -15px rgba(6,182,212,0.45);position:relative;color:#f8fafc;font-family:'Outfit',sans-serif;">
                <button type="button" onclick="closeArtLuminicPending()" aria-label="Tancar" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.08);border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.color='#94a3b8';this.style.background='rgba(255,255,255,0.08)'">&times;</button>
                <div style="font-size:3.5rem;margin-bottom:0.75rem;line-height:1;">✨ 🚧</div>
                <h3 style="font-family:'Playfair Display',serif;font-size:1.85rem;color:#38bdf8;margin-bottom:0.5rem;font-weight:800;">Festival d'Art Lumínic</h3>
                <div style="display:inline-block;background:rgba(6,182,212,0.15);color:#67e8f9;border:1px solid rgba(6,182,212,0.45);padding:0.4rem 1.1rem;border-radius:9999px;font-weight:800;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1.25rem;">
                    En construcció · Properament accessible
                </div>
                <p style="color:#cbd5e1;font-size:1.02rem;line-height:1.65;margin-bottom:1.85rem;">
                    Estem acabant d'ultimar el disseny de les 9 instal·lacions lumíniques, les guies sonores i el plànol interactiu. Molt aviat estarà disponible i obert a tothom!
                </p>
                <button type="button" onclick="closeArtLuminicPending()" style="background:linear-gradient(135deg,#0284c7 0%,#06b6d4 100%);color:#ffffff;border:none;padding:0.85rem 2.2rem;border-radius:9999px;font-weight:800;font-size:1rem;cursor:pointer;box-shadow:0 4px 18px rgba(6,182,212,0.45);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='none'">
                    Entesos, gràcies!
                </button>
            </div>
        `;
        modal.addEventListener('click', function(evt) {
            if (evt.target === modal) window.closeArtLuminicPending();
        });
        document.addEventListener('keydown', function(evt) {
            if (evt.key === 'Escape') window.closeArtLuminicPending();
        });
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'flex';
    }
};

window.closeArtLuminicPending = function() {
    const modal = document.getElementById('modal-art-luminic-pending');
    if (modal) modal.style.display = 'none';
};
