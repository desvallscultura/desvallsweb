/**
 * wbadmin / app.js
 * Lògica per a l'administració de Pluja d'Art
 */

// ==========================================
// 1. CONFIGURACIÓ SUPABASE I GOOGLE
// ==========================================
const SUPABASE_URL = 'https://ojqhexrqbfwcubyactuj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eV7n7kB-tnt00ScrveNm-A_gsFBqJtG';

// Inicialització de Supabase amb control d'errors
let supabaseClient;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error("Error inicialitzant Supabase:", e);
    alert("Error crític: No s'ha pogut carregar la llibreria de Supabase. Revisa la connexió a Internet.");
}

// Alerta de Protocol Local
if (window.location.protocol === 'file:') {
    console.warn("Estàs obrint el fitxer directament (file://). El login de Supabase podria fallar.");
}

// ALERTA: Aquesta és la URL del Apps Script quan programis la funció doGet()
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgxLlIpnmTf6nHuZnDPUD2MxnQEuLYSc0URMUrujYr92YlfbCuH4NuFpNZeolcKZY9bA/exec';

// ==========================================
// 2. ESTAT LOCAL
// ==========================================
let appData = [];
let currentCategoryFilter = 'Arts Generals';
let currentStatusFilter = 'Tots';
let selectedIds = new Set();

// ==========================================
// 3. UI TAB SWITCHING
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.data-tab').forEach(tab => tab.classList.remove('active'));
    
    if(window.event && window.event.target) {
        window.event.target.classList.add('active');
    }
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'arts') currentCategoryFilter = 'Arts Generals';
    if (tabName === 'residencia') currentCategoryFilter = 'Residència Artística';
    if (tabName === 'paradetes') currentCategoryFilter = 'Paradetes i Artesania';

    updateKPIs();
}

// ==========================================
// 4. AUTENTICACIÓ SUPABASE (REAL)
// ==========================================
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('auth-error');

// Escoltador d'estat d'autenticació
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        try {
            if (event === 'SIGNED_IN' || session) {
                console.log("Sessió iniciada:", session.user.email);
                document.getElementById('user-email').innerText = session.user.email;
                loginScreen.style.display = 'none';
                dashboard.style.display = 'block';
                fetchDataFromGoogle();
            } else if (event === 'SIGNED_OUT') {
                loginScreen.style.display = 'flex';
                dashboard.style.display = 'none';
            }
        } catch (e) {
            console.error("Error en canvi d'estat d'auth:", e);
        }
    });
}

btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if(!email || !password) {
        errorMsg.innerText = "Si us plau, omple tots els camps.";
        errorMsg.style.display = 'block';
        return;
    }

    btnLogin.innerText = 'Verificant...';
    btnLogin.disabled = true;
    errorMsg.style.display = 'none';
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if(error) {
            console.error("Error Login:", error.message, error.status);
            
            let customMsg = "Error d'accés: " + error.message;

            if (error.message.includes("Invalid login credentials") || error.status === 400) {
                customMsg = "L'usuari o la contrasenya no són correctes.";
            } else if (error.status === 429) {
                customMsg = "Massa intents. Espera uns minuts.";
            }

            errorMsg.innerText = customMsg;
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        console.error("Error inesperat en login:", err);
        alert("S'ha produït un error inesperat de connexió. Revisa la consola o prova des d'un servidor local (localhost).");
    } finally {
        btnLogin.innerText = 'Inicia Sessió';
        btnLogin.disabled = false;
    }
});

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// ==========================================
// 5. OBTENCIÓ I PERSISTÈNCIA DE DADES
// ==========================================

async function fetchDataFromGoogle() {
    const loader = document.getElementById('loader-data');
    loader.style.display = 'inline-block';
    
    try {
        // 1. Obtenim dades de Google
        const response = await fetch(GOOGLE_APP_SCRIPT_URL);
        const googleData = await response.json();
        
        // 2. Obtenim els estats guardats a Supabase
        const { data: dbStatuses, error } = await supabaseClient
            .from('registrations_management')
            .select('*');
            
        if (error) throw error;

        // Crear mapa d'estats per cerca ràpida
        const statusMap = {};
        dbStatuses.forEach(row => {
            statusMap[row.id] = row.status;
        });

        // 3. Fusionar dades
        appData = googleData.map(row => {
            row.Estat = statusMap[row.id] || 'Nou'; // Si no n'hi ha, per defecte "Nou"
            return row;
        });
        
        renderAllTables();
        updateKPIs();
        loader.style.display = 'none';
        
    } catch(err) {
        console.error("Error sincronitzant dades:", err);
        loader.style.display = 'none';
        alert('Error en la sincronització de dades.');
    }
}

document.getElementById('btn-refresh').addEventListener('click', fetchDataFromGoogle);

// Event listener pel filtre d'estat
document.getElementById('filter-status').addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    renderAllTables();
});

// ==========================================
// SELECCIÓ I ACCIONS MASSIVES (BULK)
// ==========================================

window.toggleSelect = function(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    updateBulkBar();
};

window.toggleSelectAll = function(category) {
    const isChecked = event.target.checked;
    
    // Filtrem els que es veuen actualment
    const visibleRows = appData.filter(r => {
        const matchCat = r.Categoria === category;
        const matchStat = (currentStatusFilter === 'Tots') || (r.Estat === currentStatusFilter);
        return matchCat && matchStat;
    });

    visibleRows.forEach(r => {
        if (isChecked) {
            selectedIds.add(r.id);
        } else {
            selectedIds.delete(r.id);
        }
    });

    renderAllTables();
    updateBulkBar();
};

function updateBulkBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const countEl = document.getElementById('bulk-count');
    
    if (selectedIds.size > 0) {
        bar.style.display = 'flex';
        countEl.innerText = selectedIds.size;
    } else {
        bar.style.display = 'none';
        // Reset "select all" checkboxes
        document.querySelectorAll('thead input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
}

document.getElementById('btn-clear-selection').addEventListener('click', () => {
    selectedIds.clear();
    renderAllTables();
    updateBulkBar();
});

document.getElementById('btn-apply-bulk').addEventListener('click', async () => {
    const newStatus = document.getElementById('bulk-status-select').value;
    const num = selectedIds.size;

    if (!confirm(`Estàs segur que vols canviar a "${newStatus}" els ${num} registres seleccionats?`)) {
        return;
    }

    const btn = document.getElementById('btn-apply-bulk');
    btn.innerText = 'Aplicant...';
    btn.disabled = true;

    try {
        const upsertData = Array.from(selectedIds).map(id => ({
            id: id,
            status: newStatus,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabaseClient
            .from('registrations_management')
            .upsert(upsertData);

        if (error) throw error;

        // Actualitzem local
        appData.forEach(r => {
            if (selectedIds.has(r.id)) {
                r.Estat = newStatus;
            }
        });

        alert(`✅ S'han actualitzat ${num} registres correctament.`);
        selectedIds.clear();
        renderAllTables();
        updateKPIs();
        updateBulkBar();

    } catch (err) {
        console.error("Error en bulk update:", err);
        alert("S'ha produït un error en l'actualització massiva.");
    } finally {
        btn.innerText = 'Aplica massivament';
        btn.disabled = false;
    }
});

// Funció per copiar mails dels regitres visibles
window.copyDisplayedEmails = async function(category) {
    const btn = event.currentTarget;
    const originalText = btn.innerText;
    
    // Filtrem les dades que s'estan veient actualment
    const filtered = appData.filter(r => {
        const matchCat = r.Categoria === category;
        const matchStat = (currentStatusFilter === 'Tots') || (r.Estat === currentStatusFilter);
        return matchCat && matchStat;
    });

    const emails = filtered
        .map(r => r.Email)
        .filter(email => email && email.includes('@'))
        .join('; ');

    if (!emails) {
        alert("No hi ha correus per copiar amb el filtre actual.");
        return;
    }

    try {
        await navigator.clipboard.writeText(emails);
        
        // Feedback visual
        btn.innerText = '✅ Copiats!';
        btn.classList.add('success');
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('success');
        }, 2000);
        
    } catch (err) {
        console.error('Error copiant al porta-retalls:', err);
        alert("No s'ha pogut copiar automàticament.");
    }
};

// ==========================================
// 6. RENDERITZAT DE LES TAULES I ESTATS
// ==========================================

function getStatusBadgeClass(estat) {
    const cl = String(estat).toLowerCase();
    if(cl.includes('nou')) return 'status-nou';
    if(cl.includes('pendent') || cl.includes('procés')) return 'status-pendent';
    if(cl.includes('aprovat') || cl.includes('acceptat')) return 'status-aprovat';
    if(cl.includes('descartat')) return 'status-descartat';
    return '';
}

function renderStatusSelect(id, currentStatus) {
    const options = ['Nou', 'Pendent Documentació', 'En Procés', 'Aprovat', 'Descartat'];
    let html = `<select class="select-status ${getStatusBadgeClass(currentStatus)}" onchange="updateStatus('${id}', this.value)">`;
    options.forEach(opt => {
        const sel = (opt === currentStatus) ? 'selected' : '';
        html += `<option value="${opt}" ${sel}>${opt}</option>`;
    });
    html += `</select>`;
    return html;
}

window.updateStatus = async function(rowId, newStatus) {
    // 1. Actualitza localment per render immediat
    const row = appData.find(r => r.id === rowId);
    if(row) row.Estat = newStatus;
    
    updateKPIs();
    renderAllTables(); 

    // 2. Guardem a Supabase
    try {
        const { error } = await supabaseClient
            .from('registrations_management')
            .upsert({ 
                id: rowId, 
                status: newStatus,
                updated_at: new Date().toISOString()
            });
            
        if (error) throw error;
        console.log(`✅ Guardat a Supabase: ${rowId} = ${newStatus}`);
    } catch (err) {
        console.error("Error guardant estat:", err);
        alert("No s'ha pogut guardar el canvi a la base de dades.");
    }
};

// Formatar dates JSON a string bonic
function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('ca-ES') + '<br><small style="color:#64748b">' + d.toLocaleTimeString('ca-ES',{hour:'2-digit',minute:'2-digit'}) + '</small>';
}

// Mailto builder
function generateMailto(email, name, category) {
    const subject = encodeURIComponent(`Sobre la teva sol·licitud a la Pluja d'Art 2026 (${category})`);
    const body = encodeURIComponent(`Hola ${name},\n\nEns posem en contacte amb tu en referència a la teva sol·licitud per participar a la Pluja d'Art 2026 en la modalitat de ${category}.\n\n...`);
    return `<a href="mailto:${email}?subject=${subject}&body=${body}" class="btn-email">✉️ Correu</a>`;
}

// Generar Links Drive
function linkDrive(url, label) {
    if(!url || typeof url !== 'string' || !url.includes('http')) return '-';
    return `<a href="${url}" target="_blank" class="drive-link">📄 ${label}</a>`;
}

// Formatar links de xarxes socials
function formatSocialLinks(text) {
    if(!text || text === '-') return '-';
    
    // Regex per trobar URLs (comencin per http o www o dominis comuns)
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.(?:com|net|org|cat|es|me)\/[^\s,;]*)/gi;
    
    return text.replace(urlPattern, (url) => {
        let href = url;
        if (!url.startsWith('http')) {
            href = 'https://' + url;
        }
        return `<a href="${href}" target="_blank" style="color:var(--primary); text-decoration:underline; word-break: break-all;">${url}</a>`;
    });
}

function renderAllTables() {
    // Funció genèrica de filtratge
    const getFilteredData = (cat) => {
        return appData.filter(r => {
            const matchCat = r.Categoria === cat;
            const matchStat = (currentStatusFilter === 'Tots') || (r.Estat === currentStatusFilter);
            return matchCat && matchStat;
        });
    };

    // ARTS
    const tbodyArts = document.getElementById('table-body-arts');
    tbodyArts.innerHTML = '';
    const artsData = getFilteredData('Arts Generals');
    artsData.forEach(r => {
        const isChecked = selectedIds.has(r.id) ? 'checked' : '';
        tbodyArts.innerHTML += `
            <tr>
                <td><input type="checkbox" ${isChecked} onchange="toggleSelect('${r.id}')"></td>
                <td>${formatDate(r.Timestamp)}</td>
                <td><strong>${r.Companyia || '-'}</strong><br><small>${r.Nom_Representant || ''}</small></td>
                <td>${r.Municipi || '-'}</td>
                <td><a href="mailto:${r.Email}" style="color:#60a5fa">${r.Email}</a><br><small>${r.Telefon || ''}</small></td>
                <td><strong>${r.Titol_Obra || '-'}</strong><br><small>${r.Modalitat || ''}</small></td>
                <td><div style="font-size: 0.85em; max-height: 100px; overflow-y: auto; padding-right: 5px;">${r.Descripcio ? r.Descripcio.replace(/\\n/g, '<br>') : '-'}</div></td>
                <td><small><strong>Espai:</strong> <span style="white-space: pre-wrap;">${r.Espai_m2 || '-'}</span><br><strong>Llum:</strong> ${r.Electrica_W || '-'}<br><strong>Equip:</strong> ${r.Persones_Equip || '-'}</small></td>
                <td><div style="font-size: 0.85em; min-width: 150px; white-space: pre-wrap;">${formatSocialLinks(r.Xarxes)}</div></td>
                <td><div style="font-size: 0.85em;">${r.Acessibilitat || '-'}</div></td>
                <td>${linkDrive(r.Dossier_File, 'Dossier')}</td>
                <td>${renderStatusSelect(r.id, r.Estat)}</td>
            </tr>
        `;
    });

    // RESIDÈNCIA
    const tbodyRes = document.getElementById('table-body-residencia');
    tbodyRes.innerHTML = '';
    const resData = getFilteredData('Residència Artística');
    resData.forEach(r => {
        const isChecked = selectedIds.has(r.id) ? 'checked' : '';
        const driveLinks = `
            ${linkDrive(r.Dossier, 'Dossier')}
            ${linkDrive(r.Portafoli, 'Portafoli')}
            ${linkDrive(r.Calendari, 'Calen.')}
            ${linkDrive(r.Pressupost, 'Pressup.')}
        `;
        tbodyRes.innerHTML += `
            <tr>
                <td><input type="checkbox" ${isChecked} onchange="toggleSelect('${r.id}')"></td>
                <td>${formatDate(r.Timestamp)}</td>
                <td><strong>${r.Nom_Representant || r.Companyia || '-'}</strong><br><small style="color:#64748b">${r.Municipi || ''}</small></td>
                <td><a href="mailto:${r.Email}" style="color:#60a5fa">${r.Email}</a><br><small>${r.Telefon || ''}</small></td>
                <td><strong>${r.Titol_Obra || '-'}</strong></td>
                <td><div style="font-size: 0.85em; max-height: 100px; overflow-y: auto; padding-right: 5px;">${r.Descripcio ? r.Descripcio.replace(/\\n/g, '<br>') : '-'}</div></td>
                <td style="display:flex; flex-wrap:wrap; gap:5px;">${driveLinks || '-'}</td>
                <td>${renderStatusSelect(r.id, r.Estat)}</td>
            </tr>
        `;
    });

    // PARADETES
    const tbodyPar = document.getElementById('table-body-paradetes');
    tbodyPar.innerHTML = '';
    const parData = getFilteredData('Paradetes i Artesania');
    parData.forEach(r => {
        const isChecked = selectedIds.has(r.id) ? 'checked' : '';
        tbodyPar.innerHTML += `
            <tr>
                <td><input type="checkbox" ${isChecked} onchange="toggleSelect('${r.id}')"></td>
                <td>${formatDate(r.Timestamp)}</td>
                <td><strong>${r.Companyia || '-'}</strong><br><small>${r.Nom_Representant || ''}</small></td>
                <td><a href="mailto:${r.Email}" style="color:#60a5fa">${r.Email}</a><br><small>${r.Telefon || ''}</small></td>
                <td><div style="font-size: 0.85em; margin-bottom: 5px;">${r.Descripcio || '-'}</div>
                    <small><strong>Llocs:</strong> ${r.Parcel_les || 1} | <strong>Llum:</strong> ${r.Electricitat || '-'} | <strong>Food:</strong> ${r.Carnet_Alimentari || '-'}</small></td>
                <td>${renderStatusSelect(r.id, r.Estat)}</td>
            </tr>
        `;
    });
}

function updateKPIs() {
    const cats = {
        'Arts Generals': 'arts',
        'Residència Artística': 'res',
        'Paradetes i Artesania': 'para'
    };

    Object.keys(cats).forEach(catName => {
        const prefix = cats[catName];
        const data = appData.filter(r => r.Categoria === catName);
        
        const total = data.length;
        const noves = data.filter(r => r.Estat === 'Nou').length;
        const pendent = data.filter(r => r.Estat === 'Pendent Documentació').length;
        const process = data.filter(r => r.Estat === 'En Procés').length;
        const aprovades = data.filter(r => r.Estat === 'Aprovat').length;

        document.getElementById(`stats-${prefix}-total`).innerText = total;
        document.getElementById(`stats-${prefix}-noves`).innerText = noves;
        document.getElementById(`stats-${prefix}-pendent`).innerText = pendent;
        document.getElementById(`stats-${prefix}-proces`).innerText = process;
        document.getElementById(`stats-${prefix}-aprovades`).innerText = aprovades;
    });

    const titleEl = document.getElementById('kpi-title-h2');
    if (titleEl) {
        titleEl.innerText = 'Resum de Sol·licituds 2026';
    }
}
