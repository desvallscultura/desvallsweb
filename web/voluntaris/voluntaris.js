/**
 * voluntaris.js
 * Lògica per a la gestió de voluntaris del festival Pluja d'Art 2026
 */

// ==========================================
// 1. CONFIGURACIÓ SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ojqhexrqbfwcubyactuj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eV7n7kB-tnt00ScrveNm-A_gsFBqJtG';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. ESTAT DE L'APLICACIÓ
// ==========================================
let currentVoluntari = JSON.parse(localStorage.getItem('voluntari_session')) || null;
let isAdmin = false;
let currentDay = 'Divendres';
let allVoluntaris = [];
let allEspais = [];
let allConfig = [];
let allAssignacions = [];
let selectedSlots = new Set(); // Conjunt de "dia|hora|espaiId"
let isDragging = false;

// Configuració d'horaris segons petició de l'usuari
const DAY_HOURS = {
    'Divendres': [16, 17, 18, 19, 20, 21, 22, 23, 0, 1], // Fins les 2:00 dissabte
    'Dissabte': [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2], // Fins les 3:00 diumenge
    'Diumenge': [8, 9, 10, 11, 12, 13] // Fins les 14:00
};

// ==========================================
// 3. INICIALITZACIÓ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initEventListeners();
    updateUserUI();
    
    await fetchData();
    renderAll();

    // Comprovar si hi ha sessió admin activa
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        setAdminMode(true);
    }
});

function initEventListeners() {
    // Nav Days
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentDay = e.target.dataset.day;
            renderAll();
        });
    });

    // Auth Voluntaris
    document.getElementById('select-voluntari-existent').addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
            const vol = allVoluntaris.find(v => v.id === id);
            loginVoluntari(vol);
        }
    });

    document.getElementById('btn-registre-voluntari').addEventListener('click', handleRegistre);
    document.getElementById('btn-logout-vol').addEventListener('click', logoutVoluntari);

    // Admin UI
    document.getElementById('btn-admin-login-toggle').addEventListener('click', () => {
        if (isAdmin) {
            supabaseClient.auth.signOut();
            setAdminMode(false);
        } else {
            document.getElementById('modal-admin').style.display = 'flex';
        }
    });

    document.getElementById('btn-cancel-admin').addEventListener('click', () => {
        document.getElementById('modal-admin').style.display = 'none';
    });

    document.getElementById('btn-do-admin-login').addEventListener('click', handleAdminLogin);

    // Admin Actions
    document.getElementById('btn-add-espai').addEventListener('click', handleAddEspai);
    document.getElementById('btn-close-espais').addEventListener('click', () => {
        document.getElementById('modal-espais').style.display = 'none';
        renderAll();
    });

    // Batch Actions
    document.getElementById('btn-apply-batch').addEventListener('click', handleBatchApply);
    document.getElementById('btn-cancel-batch').addEventListener('click', () => {
        selectedSlots.clear();
        updateBatchBar();
        renderAll();
    });

    document.getElementById('btn-print-pdf').addEventListener('click', handlePrint);
    document.getElementById('btn-export-csv').addEventListener('click', handleExportCSV);

    // Global mouseup to stop dragging
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// ==========================================
// 4. GESTIÓ DE DADES (SUPABASE)
// ==========================================

async function fetchData() {
    try {
        const [vols, espais, config, assign] = await Promise.all([
            supabaseClient.from('vol_voluntaris').select('*').order('nom'),
            supabaseClient.from('vol_espais').select('*').order('created_at'),
            supabaseClient.from('vol_config').select('*'),
            supabaseClient.from('vol_assignacions').select('*')
        ]);

        allVoluntaris = vols.data || [];
        allEspais = espais.data || [];
        allConfig = config.data || [];
        allAssignacions = assign.data || [];

        populateVoluntarisSelect();
    } catch (err) {
        console.error("Error carregant dades:", err);
    }
}

function populateVoluntarisSelect() {
    const select = document.getElementById('select-voluntari-existent');
    const prevValue = select.value;
    select.innerHTML = '<option value="">-- Tria el teu nom --</option>';
    allVoluntaris.forEach(v => {
        select.innerHTML += `<option value="${v.id}">${v.nom} ${v.cognom}</option>`;
    });
    select.value = prevValue;
}

// ==========================================
// 5. GESTIÓ D'USUARIS (VOLUNTARIS)
// ==========================================

async function handleRegistre() {
    const nom = document.getElementById('new-vol-nom').value.trim();
    const cognom = document.getElementById('new-vol-cognom').value.trim();
    const tel = document.getElementById('new-vol-tel').value.trim();

    if (!nom || !cognom || !tel) {
        alert("Si us plau, omple tots els camps.");
        return;
    }

    const { data, error } = await supabaseClient
        .from('vol_voluntaris')
        .upsert({ nom, cognom, telefon: tel }, { onConflict: 'telefon' })
        .select()
        .single();

    if (error) {
        alert("Error en el registre: " + error.message);
    } else {
        loginVoluntari(data);
        await fetchData();
        renderAll();
    }
}

function loginVoluntari(vol) {
    currentVoluntari = vol;
    localStorage.setItem('voluntari_session', JSON.stringify(vol));
    updateUserUI();
}

function logoutVoluntari() {
    currentVoluntari = null;
    localStorage.removeItem('voluntari_session');
    updateUserUI();
    renderAll();
}

function updateUserUI() {
    const authSection = document.getElementById('auth-section');
    const welcome = document.getElementById('welcome-message');
    const authBox = document.querySelector('.auth-box');

    if (currentVoluntari) {
        document.getElementById('current-user-name').innerText = `${currentVoluntari.nom} ${currentVoluntari.cognom}`;
        welcome.style.display = 'block';
        authBox.style.display = 'none';
        authSection.classList.add('user-active');
    } else {
        welcome.style.display = 'none';
        authBox.style.display = 'flex';
        authSection.classList.remove('user-active');
    }
}

// ==========================================
// 6. RENDERITZAT DEL CALENDARI
// ==========================================

function renderAll() {
    renderHeader();
    renderBody();
}

function renderHeader() {
    const header = document.getElementById('calendar-header');
    header.innerHTML = '<th class="sticky-col">Hora</th>';

    allEspais.forEach(espai => {
        const th = document.createElement('th');
        th.innerHTML = `${espai.nom}`;
        if (isAdmin) {
            th.innerHTML += ` <button class="btn-delete-small" onclick="deleteEspai('${espai.id}')">×</button>`;
        }
        header.appendChild(th);
    });

    if (isAdmin) {
        const thAdd = document.createElement('th');
        thAdd.innerHTML = `<button class="btn-primary" onclick="openEspaisModal()" style="padding: 0.2rem 0.5rem;">+ Espai</button>`;
        header.appendChild(thAdd);
    }
}

function renderBody() {
    const tbody = document.getElementById('calendar-body');
    tbody.innerHTML = '';

    const hours = DAY_HOURS[currentDay] || [];

    hours.forEach(h => {
        const tr = document.createElement('tr');
        
        // Columna hora
        const tdTime = document.createElement('td');
        tdTime.className = 'sticky-col';
        tdTime.innerText = `${h.toString().padStart(2, '0')}:00`;
        tr.appendChild(tdTime);

        // Columnes per cada espai
        allEspais.forEach(espai => {
            const td = document.createElement('td');
            renderSlot(td, espai.id, h);
            tr.appendChild(td);
        });

        if (isAdmin) {
            tr.appendChild(document.createElement('td')); // Espai buit sota el boto +
        }

        tbody.appendChild(tr);
    });
}

function renderSlot(td, espaiId, hora) {
    const config = allConfig.find(c => c.dia === currentDay && c.hora === hora && c.espai_id === espaiId);
    const necessaris = config ? config.necessaris : 0;
    
    // Voluntaris ja apuntats
    const assignats = allAssignacions.filter(a => a.dia === currentDay && a.hora === hora && a.espai_id === espaiId);
    const isMeIn = currentVoluntari && assignats.some(a => a.voluntari_id === currentVoluntari.id);
    
    td.className = 'slot';
    const slotId = `${currentDay}|${hora}|${espaiId}`;
    if (selectedSlots.has(slotId)) td.classList.add('selected');

    const content = document.createElement('div');
    content.className = 'slot-content';
    td.appendChild(content);

    if (isAdmin) {
        // Drag Events for selection
        td.onmousedown = (e) => {
            e.preventDefault();
            isDragging = true;
            toggleSelectSlot(slotId);
        };
        td.onmouseover = () => {
            if (isDragging) toggleSelectSlot(slotId);
        };

        // Vista Admin: Editar necessaris (individual)
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'admin-input-needs';
        input.value = necessaris;
        input.min = 0;
        input.onclick = (e) => e.stopPropagation(); // Evita selecció en clicar input
        input.onchange = (e) => updateConfig(espaiId, hora, e.target.value);
        content.appendChild(input);
    }

    if (necessaris > 0 || isAdmin) {
        td.classList.add('slot-available');
        
        // Llista de noms
        const list = document.createElement('div');
        list.className = 'vol-list';
        assignats.forEach(a => {
            const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
            if (v) {
                const span = document.createElement('span');
                span.className = 'vol-name' + (currentVoluntari && v.id === currentVoluntari.id ? ' me' : '');
                span.innerText = `${v.nom} ${v.cognom.charAt(0)}.`;
                list.appendChild(span);
            }
        });
        content.appendChild(list);

        // Places restants
        const placesLeft = necessaris - assignats.length;
        const info = document.createElement('div');
        info.className = 'places-left' + (placesLeft <= 0 ? ' places-none' : '');
        
        if (isAdmin) {
            info.innerText = `${assignats.length} / ${necessaris}`;
        } else {
            if (isMeIn) {
                info.innerHTML = '<span style="color:var(--secondary)">Desapuntar-se</span>';
            } else if (placesLeft > 0) {
                info.innerText = `${placesLeft} lliures`;
            } else {
                info.innerText = `Complet`;
                td.classList.remove('slot-available');
                td.classList.add('slot-full');
            }
        }
        content.appendChild(info);

        // Click handler (apuntar-se / desapuntar-se)
        if (!isAdmin && currentVoluntari) {
            td.onclick = () => toggleAssignacio(espaiId, hora, isMeIn, placesLeft);
        }
    } else {
        td.classList.add('slot-full');
        content.innerHTML = '<span class="places-none">-</span>';
    }
}

// ==========================================
// 7. LÒGICA D'ACCIONS (APUNTAR-SE, CONFIG...)
// ==========================================

async function toggleAssignacio(espaiId, hora, isMeIn, placesLeft) {
    if (!currentVoluntari) return;

    if (isMeIn) {
        // Desapuntar-se
        const res = await supabaseClient
            .from('vol_assignacions')
            .delete()
            .match({ voluntari_id: currentVoluntari.id, dia: currentDay, hora: hora, espai_id: espaiId });
        
        if (res.error) alert(res.error.message);
    } else {
        // Apuntar-se
        if (placesLeft <= 0) return;

        const { error } = await supabaseClient
            .from('vol_assignacions')
            .insert({
                voluntari_id: currentVoluntari.id,
                dia: currentDay,
                hora: hora,
                espai_id: espaiId
            });

        if (error) {
            if (error.code === '23505') {
                alert("Ja estàs apuntat a un altre lloc a aquesta mateixa hora.");
            } else {
                alert(error.message);
            }
        }
    }

    await fetchData();
    renderAll();
}

async function updateConfig(espaiId, hora, value) {
    const val = parseInt(value);
    const { error } = await supabaseClient
        .from('vol_config')
        .upsert({
            dia: currentDay,
            hora: hora,
            espai_id: espaiId,
            necessaris: val
        }, { onConflict: 'dia,hora,espai_id' });

    if (error) console.error(error);
    allConfig = (await supabaseClient.from('vol_config').select('*')).data;
}

// ==========================================
// 8. ADMINISTRACIÓ (AUTH I ESPAIS)
// ==========================================

async function handleAdminLogin() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-pass').value;
    const err = document.getElementById('admin-auth-error');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        err.innerText = "Error: " + error.message;
        err.style.display = 'block';
    } else {
        document.getElementById('modal-admin').style.display = 'none';
        setAdminMode(true);
    }
}

function setAdminMode(active) {
    isAdmin = active;
    document.getElementById('admin-indicator').style.display = active ? 'block' : 'none';
    document.getElementById('btn-admin-login-toggle').innerText = active ? 'Sortir Admin' : 'Accés Administrador';
    renderAll();
}

function openEspaisModal() {
    renderEspaisAdmin();
    document.getElementById('modal-espais').style.display = 'flex';
}

function renderEspaisAdmin() {
    const list = document.getElementById('espais-admin-list');
    list.innerHTML = '';
    allEspais.forEach(e => {
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <span>${e.nom}</span>
                <button class="btn-small" onclick="deleteEspai('${e.id}')" style="margin:0; border-color:var(--secondary); color:var(--secondary)">Eliminar</button>
            </div>
        `;
    });
}

async function handleAddEspai() {
    const input = document.getElementById('new-espai-nom');
    const name = input.value.trim();

    if (!name) return;

    await supabaseClient.from('vol_espais').insert({ nom: name });
    input.value = '';
    await fetchData();
    renderEspaisAdmin();
}

// ==========================================
// 10. EDICIÓ MASSIVA (BATCH)
// ==========================================

function toggleSelectSlot(id) {
    if (selectedSlots.has(id)) {
        selectedSlots.delete(id);
    } else {
        selectedSlots.add(id);
    }
    updateBatchBar();
    renderAll();
}

function updateBatchBar() {
    const bar = document.getElementById('batch-edit-bar');
    const countEl = document.getElementById('batch-selected-count');
    
    if (selectedSlots.size > 0) {
        bar.style.display = 'flex';
        countEl.innerText = selectedSlots.size;
    } else {
        bar.style.display = 'none';
    }
}

async function handleBatchApply() {
    const value = parseInt(document.getElementById('batch-input-value').value);
    const btn = document.getElementById('btn-apply-batch');
    
    btn.disabled = true;
    btn.innerText = 'Aplicant...';

    try {
        const batchData = Array.from(selectedSlots).map(sid => {
            const [dia, hora, espai_id] = sid.split('|');
            return {
                dia,
                hora: parseInt(hora),
                espai_id,
                necessaris: value
            };
        });

        const { error } = await supabaseClient
            .from('vol_config')
            .upsert(batchData, { onConflict: 'dia,hora,espai_id' });

        if (error) throw error;

        selectedSlots.clear();
        updateBatchBar();
        await fetchData();
        renderAll();
    } catch (err) {
        alert("Error en l'edició massiva: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Aplica a tot';
    }
}

async function handlePrint() {
    try {
        console.log("Iniciant procés d'impressió PDF...");
        
        // 1. Generar contingut HTML
        const dies = ['Divendres', 'Dissabte', 'Diumenge'];
        const diesMap = { 'Divendres': 'Divendres 26 setembre', 'Dissabte': 'Dissabte 27 setembre', 'Diumenge': 'Diumenge 28 setembre' };

        let printHtml = `
        <html>
        <head>
            <title>Pluja d'Art 2026 - Control Voluntaris</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: black; background: white; padding: 20px; }
                h1, h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 11px; vertical-align: top; }
                th { background: #f0f0f0; font-weight: bold; }
                .hora-col { width: 60px; font-weight: bold; }
                .necessaris { font-weight: bold; }
                .noms { color: #444; display: block; margin-top: 3px; }
                @media print { .page-break { page-break-after: always; } }
            </style>
        </head>
        <body>
            <h1>Pluja d'Art 2026 - Control de Voluntaris</h1>
        `;

        dies.forEach(dia => {
            printHtml += `<h2>${diesMap[dia]}</h2>`;
            printHtml += `<table><thead><tr><th class="hora-col">Hora</th>`;
            allEspais.forEach(e => { printHtml += `<th>${e.nom}</th>`; });
            printHtml += `</tr></thead><tbody>`;

            const hores = DAY_HOURS[dia] || [];
            hores.forEach(h => {
                printHtml += `<tr><td class="hora-col">${h.toString().padStart(2, '0')}:00</td>`;
                allEspais.forEach(espai => {
                    const config = allConfig.find(c => c.dia === dia && c.hora === h && c.espai_id === espai.id);
                    const assignats = allAssignacions.filter(a => a.dia === dia && a.hora === h && a.espai_id === espai.id);
                    const necessaris = config ? config.necessaris : 0;
                    
                    if (necessaris > 0) {
                        const noms = assignats.map(a => {
                            const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                            return v ? `${v.nom} ${v.cognom}` : '';
                        }).filter(n => n !== '').join(", ");
                        printHtml += `<td><span class="necessaris">${assignats.length} / ${necessaris}</span><br><span class="noms">${noms}</span></td>`;
                    } else {
                        printHtml += `<td>-</td>`;
                    }
                });
                printHtml += `</tr>`;
            });
            printHtml += `</tbody></table><div class="page-break"></div>`;
        });

        printHtml += `<h2>Llistat de Contactes de Voluntaris</h2>`;
        printHtml += `<table><thead><tr><th>Nom i Cognoms</th><th>Telèfon</th></tr></thead><tbody>`;
        const sortedVoluntaris = [...allVoluntaris].sort((a,b) => (a.nom || '').localeCompare(b.nom || ''));
        sortedVoluntaris.forEach(v => {
            printHtml += `<tr><td>${v.nom} ${v.cognom}</td><td>${v.telefon}</td></tr>`;
        });
        printHtml += `</tbody></table></body></html>`;

        // 2. Usar o crear IFRAME al vol
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }

        const pri = iframe.contentWindow;
        pri.document.open();
        pri.document.write(printHtml);
        pri.document.close();

        setTimeout(() => {
            pri.focus();
            pri.print();
            console.log("Impressió enviada.");
        }, 600);
    } catch (err) {
        console.error("Error en imprimir:", err);
        alert("S'ha produït un error en generar el PDF. Revisa la consola.");
    }
}

// ==========================================
// 12. EXPORTACIÓ CSV
// ==========================================

function formatCatalunya(val) {
    if (typeof val === 'number') {
        return val.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return val || '';
}

async function handleExportCSV() {
    // 1. Exportar Llistat Voluntaris
    let csvVol = "\uFEFF"; // UTF-8 BOM
    csvVol += "Nom;Cognoms;Telèfon\n";
    allVoluntaris.sort((a,b) => a.nom.localeCompare(b.nom)).forEach(v => {
        csvVol += `"${v.nom}";"${v.cognom}";"${v.telefon}"\n`;
    });
    downloadCSV("voluntaris_pluja_2026.csv", csvVol);

    // 2. Exportar Graella d'Horaris (Tots els dies, format graella)
    let csvSched = "\uFEFF"; // UTF-8 BOM
    
    // Header: Dia;Hora;[Espais...]
    let header = "Dia;Hora";
    allEspais.forEach(e => {
        header += `;"${e.nom}"`;
    });
    csvSched += header + "\n";
    
    const diesMap = { 'divendres': 'Divendres', 'dissabte': 'Dissabte', 'diumenge': 'Diumenge' };

    for (const dKey in DAY_HOURS) {
        const hours = DAY_HOURS[dKey];
        hours.forEach(h => {
            let row = `${diesMap[dKey]};${h}:00`;
            
            allEspais.forEach(espai => {
                const config = allConfig.find(c => c.dia === dKey && c.hora === h && c.espai_id === espai.id);
                const assignatsArray = allAssignacions
                    .filter(a => a.dia === dKey && a.hora === h && a.espai_id === espai.id)
                    .map(a => {
                        const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                        return v ? `${v.nom} ${v.cognom}` : '';
                    })
                    .filter(name => name !== '');

                const count = assignatsArray.length;
                const namesString = assignatsArray.join(", ");

                const necessaris = config ? config.necessaris : 0;
                const cellContent = necessaris > 0 ? `(${count}/${necessaris}) ${namesString}` : "-";
                
                row += `;"${cellContent}"`;
            });
            csvSched += row + "\n";
        });
    }
    downloadCSV("horaris_pluja_2026.csv", csvSched);
}

function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.deleteEspai = async function(id) {
    if (!confirm("Segur que vols eliminar aquest espai? S'esborraran totes les configuracions i assignacions associades.")) return;
    await supabaseClient.from('vol_espais').delete().eq('id', id);
    await fetchData();
    renderAll();
    if (document.getElementById('modal-espais').style.display === 'flex') {
        renderEspaisAdmin();
    }
};

window.openEspaisModal = openEspaisModal;
window.updateConfig = updateConfig;
window.toggleAssignacio = toggleAssignacio;
window.deleteEspai = deleteEspai;
window.toggleSelectSlot = toggleSelectSlot;
window.handleBatchApply = handleBatchApply;
