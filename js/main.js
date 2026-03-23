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
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO_qYvUpjcQdehPTbq4tKkCaMGLgIK3GPpdbH0LdQcvLAEuaBBRI4XImmVqtcltm3YCg/exec'; 

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
