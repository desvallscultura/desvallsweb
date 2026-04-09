/**
 * wbadmin / app.js
 * Lògica per a l'administració de Pluja d'Art
 */

// ==========================================
// 1. CONFIGURACIÓ SUPABASE I GOOGLE
// ==========================================
// ALERTA: Has de reemplaçar aquest valors pel teu projecte Supabase real
const SUPABASE_URL = 'https://teva-url-del-projecte.supabase.co';
const SUPABASE_KEY = 'la-teva-anon-key-publica';

// Es requereix inicialitzar Supabase
// const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ALERTA: Aquesta és la URL del Apps Script quan programis la funció doGet()
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwnR8__pzNm4UukYCixWzEWMpC0EZWUy474ChHRHhwxIn1QZc18j5QqphmVr97G0UvDzg/exec';

// ==========================================
// 2. DADES MOCK (Fins que connectis tot)
// ==========================================
const mockRows = [
    {
        id: '1', Timestamp: '2026-04-10T10:00:00Z', Categoria: 'Arts Generals', 
        Nom_Representant: 'Anna Garcia', Companyia: 'Cia Les Llums', Email: 'anna@exemple.cat',
        Titol_Obra: 'Sons de la terra', Modalitat: 'Arts Vives',
        Dossier_File: 'https://drive.google.com/open?id=test1',
        Estat: 'Nou'
    },
    {
        id: '2', Timestamp: '2026-04-11T12:30:00Z', Categoria: 'Residència Artística', 
        Nom_Representant: 'Marc Roca', Email: 'marc.roca@exemple.cat', 
        Titol_Obra: 'Identitat Fugida',
        Dossier: 'https://drive.google.com/open?id=test2a', 
        Portafoli: 'https://drive.google.com/open?id=test2b',
        Calendari: 'https://drive.google.com/open?id=test2c',
        Pressupost: 'https://drive.google.com/open?id=test2d',
        Estat: 'Pendent'
    },
    {
        id: '3', Timestamp: '2026-04-12T16:15:00Z', Categoria: 'Paradetes i Artesania', 
        Nom_Representant: 'Laura Pou', Companyia: 'Sabons Naturals Laura', Email: 'info@sabonslaura.cat',
        Descripcio: 'Sabons artesanals vegans de proximitat.', Parcel_les: 1, Electricitat: 'Sí',
        Estat: 'Aprovat'
    }
];

// Estat Local
let appData = [...mockRows];
let session = null;

// ==========================================
// 3. UI TAB SWITCHING
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.data-tab').forEach(tab => tab.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ==========================================
// 4. AUTENTICACIÓ (Supabase Simulat -> Real)
// ==========================================
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('auth-error');

// Simulació de check login on load
window.addEventListener('DOMContentLoaded', async () => {
    // Quan connectis supabase, seria: 
    // const { data: { session: savedSession } } = await supabase.auth.getSession();
    
    const isMockLoggedIn = localStorage.getItem('mockAdminAuth') === 'true';
    
    if (isMockLoggedIn) {
        // user logged in
        document.getElementById('user-email').innerText = 'admin@desvallscultura.cat';
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';
        renderAllTables();
        updateKPIs();
    }
});

btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pwd = document.getElementById('auth-password').value;
    
    if(!email || !pwd) {
        errorMsg.style.display = 'block';
        return;
    }

    btnLogin.innerText = 'Verificant...';
    
    // EXEMPLE SUPABASE:
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    // if(error) throw error;
    
    // MOCK LOGIN
    setTimeout(() => {
        if(email === 'admin@desvallscultura.cat' && pwd === 'admin') {
            localStorage.setItem('mockAdminAuth', 'true');
            window.location.reload();
        } else {
            errorMsg.innerText = "Simulació MOCK: Utilitza admin@desvallscultura.cat / admin";
            errorMsg.style.display = 'block';
            btnLogin.innerText = 'Inicia Sessió';
        }
    }, 800);
});

btnLogout.addEventListener('click', async () => {
    // await supabase.auth.signOut();
    localStorage.removeItem('mockAdminAuth');
    window.location.reload();
});

// ==========================================
// 5. OBTENCIÓ DE DADES DES DE GOOGLE
// ==========================================
document.getElementById('btn-refresh').addEventListener('click', async () => {
    const loader = document.getElementById('loader-data');
    loader.style.display = 'inline-block';
    
    // REAL FETCH
    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL);
        const googleData = await response.json();
        
        // Ara mateix fusionem sense Supabase perquè està en mock
        appData = googleData.map(row => {
            row.Estat = 'Nou'; // Per defecte fins que afegim Supabase
            return row;
        });
        
        renderAllTables();
        updateKPIs();
        loader.style.display = 'none';
        
    } catch(err) {
        console.error("Error obtenint de Google:", err);
        loader.style.display = 'none';
        alert('Hi ha hagut un error connectant amb Google.');
    }

});

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
    // 1. Actualitza localment per render
    const row = appData.find(r => r.id === rowId);
    if(row) row.Estat = newStatus;
    
    updateKPIs();
    renderAllTables(); // actualitza colors

    // 2. Aquí cridaries a Supabase per guardar
    // await supabase.from('registrations_management').upsert({ id: rowId, status: newStatus });
    console.log(`Guardat: ${rowId} = ${newStatus} a Supabase`);
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

function renderAllTables() {
    // ARTS
    const tbodyArts = document.getElementById('table-body-arts');
    tbodyArts.innerHTML = '';
    const artsData = appData.filter(r => r.Categoria === 'Arts Generals');
    artsData.forEach(r => {
        tbodyArts.innerHTML += `
            <tr>
                <td>${formatDate(r.Timestamp)}</td>
                <td><strong>${r.Companyia}</strong><br><small>${r.Nom_Representant}</small></td>
                <td>${r.Email}</td>
                <td><strong>${r.Titol_Obra}</strong><br><small>${r.Modalitat}</small></td>
                <td>${linkDrive(r.Dossier_File, 'Dossier')}</td>
                <td>${renderStatusSelect(r.id, r.Estat)}</td>
                <td>${generateMailto(r.Email, r.Companyia, r.Categoria)}</td>
            </tr>
        `;
    });

    // RESIDÈNCIA
    const tbodyRes = document.getElementById('table-body-residencia');
    tbodyRes.innerHTML = '';
    const resData = appData.filter(r => r.Categoria === 'Residència Artística');
    resData.forEach(r => {
        const driveLinks = `
            ${linkDrive(r.Dossier, 'Dossier')}
            ${linkDrive(r.Portafoli, 'Portafoli')}
            ${linkDrive(r.Calendari, 'Calen.')}
            ${linkDrive(r.Pressupost, 'Pressup.')}
        `;
        tbodyRes.innerHTML += `
            <tr>
                <td>${formatDate(r.Timestamp)}</td>
                <td><strong>${r.Nom_Representant}</strong></td>
                <td>${r.Email}</td>
                <td><strong>${r.Titol_Obra}</strong></td>
                <td style="display:flex; flex-wrap:wrap; gap:5px;">${driveLinks || '-'}</td>
                <td>${renderStatusSelect(r.id, r.Estat)}</td>
                <td>${generateMailto(r.Email, r.Nom_Representant, r.Categoria)}</td>
            </tr>
        `;
    });

    // PARADETES
    const tbodyPar = document.getElementById('table-body-paradetes');
    tbodyPar.innerHTML = '';
    const parData = appData.filter(r => r.Categoria === 'Paradetes i Artesania');
    parData.forEach(r => {
        tbodyPar.innerHTML += `
            <tr>
                <td>${formatDate(r.Timestamp)}</td>
                <td><strong>${r.Companyia}</strong><br><small>${r.Nom_Representant}</small></td>
                <td>${r.Email}</td>
                <td><small>${r.Descripcio}</small><br><strong>Parcel·les:</strong> ${r.Parcel_les} | <strong>Llum:</strong> ${r.Electricitat}</td>
                <td>${renderStatusSelect(r.id, r.Estat)}</td>
                <td>${generateMailto(r.Email, r.Nom_Representant, 'Paradeta')}</td>
            </tr>
        `;
    });
}

function updateKPIs() {
    const total = appData.length;
    const noves = appData.filter(r => r.Estat === 'Nou' || r.Estat === 'Pendent Documentació').length;
    const aprovades = appData.filter(r => r.Estat === 'Aprovat').length;
    const process = appData.filter(r => r.Estat === 'En Procés').length;

    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-noves').innerText = noves;
    document.getElementById('kpi-aprovades').innerText = aprovades;
    document.getElementById('kpi-proces').innerText = process;
}
