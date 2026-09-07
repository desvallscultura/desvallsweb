/**
 * voluntaris.js
 * Lògica del sistema de voluntaris v2 per al festival Pluja d'Art 2026
 * Associació Desvalls Cultura
 */

// ==========================================
// 1. CONFIGURACIÓ SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ojqhexrqbfwcubyactuj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eV7n7kB-tnt00ScrveNm-A_gsFBqJtG';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. ESTAT GLOBAL DE L'APLICACIÓ
// ==========================================
let currentVoluntari = JSON.parse(localStorage.getItem('voluntari_session')) || null;
let isAdmin = false;

const DEFAULT_DIES = [
    { nom: 'Divendres', data: '18 setembre', data_iso: '2026-09-18' },
    { nom: 'Dissabte', data: '19 setembre', data_iso: '2026-09-19' },
    { nom: 'Diumenge', data: '20 setembre', data_iso: '2026-09-20' }
];
let allDies = JSON.parse(localStorage.getItem('pluja_dies_list')) || DEFAULT_DIES;
let currentDay = allDies[0] ? allDies[0].nom : 'Divendres';

let allVoluntaris = [];
let allEspais = [];
let allTorns = [];
let allAssignacions = [];
let currentColumnWidth = parseInt(localStorage.getItem('pluja_col_width')) || 320;
let currentViewMode = localStorage.getItem('pluja_view_mode') || 'detailed';
let selectedHourSlotIdx = null;

// ==========================================
// 3. INICIALITZACIÓ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setColumnWidth(currentColumnWidth);
    setViewMode(currentViewMode);
    initEventListeners();
    updateUserUI();
    renderDaySelector();
    
    await fetchData();
    renderAll();

    // Comprovar si hi ha sessió admin activa a Supabase
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            setAdminMode(true);
        }
    } catch (e) {
        console.warn("No s'ha pogut verificar la sessió admin:", e);
    }
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        renderAll();
    }, 250);
});

function setColumnWidth(width) {
    currentColumnWidth = Math.max(200, Math.min(650, width));
    document.documentElement.style.setProperty('--col-width', `${currentColumnWidth}px`);
    localStorage.setItem('pluja_col_width', currentColumnWidth);
    const display = document.getElementById('zoom-val-display');
    if (display) display.textContent = `${currentColumnWidth}px`;
}

window.adjustColumnWidth = function(delta) {
    setColumnWidth(currentColumnWidth + delta);
};

function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('pluja_view_mode', mode);

    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `btn-view-${mode}`);
    });

    const zoomCtrl = document.getElementById('zoom-controls');
    if (zoomCtrl) {
        zoomCtrl.style.display = mode === 'detailed' ? 'inline-flex' : 'none';
    }

    renderAll();
}

window.setViewMode = setViewMode;

let editingDiaKey = null;
let currentDayKey = null;

const CATALAN_WEEKDAYS = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
const CATALAN_MONTHS = [
    'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
    'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
];
const MONTH_MAP = {
    'gen': 1, 'gener': 1, 'enero': 1, 'ene': 1,
    'feb': 2, 'febrer': 2, 'febrero': 2,
    'mar': 3, 'març': 3, 'marc': 3, 'marzo': 3,
    'abr': 4, 'abril': 4,
    'mai': 5, 'maig': 5, 'mayo': 5, 'may': 5,
    'jun': 6, 'juny': 6, 'junio': 6,
    'jul': 7, 'juliol': 7, 'julio': 7,
    'ago': 8, 'agost': 8, 'agosto': 8, 'aug': 8,
    'set': 9, 'setembre': 9, 'septiembre': 9, 'sep': 9,
    'oct': 10, 'octubre': 10,
    'nov': 11, 'novembre': 11, 'noviembre': 11,
    'des': 12, 'desembre': 12, 'diciembre': 12, 'dic': 12
};

const SHORT_WEEKDAYS = {
    'dilluns': 'Dl',
    'dimarts': 'Dm',
    'dimecres': 'Dc',
    'dijous': 'Dj',
    'divendres': 'Dv',
    'dissabte': 'Ds',
    'diumenge': 'Dg'
};

const SHORT_MONTHS = {
    'gener': 'Gen', 'febrer': 'Feb', 'març': 'Mar', 'abril': 'Abr', 'maig': 'Mai', 'juny': 'Jun',
    'juliol': 'Jul', 'agost': 'Ago', 'setembre': 'Set', 'octubre': 'Oct', 'novembre': 'Nov', 'desembre': 'Des'
};

/**
 * Converteix una data ISO (YYYY-MM-DD) a objecte català amb nom de dia de la setmana i data formatada
 */
function parseIsoToCatalan(isoDateStr) {
    if (!isoDateStr) return { nom: 'Dia', shortNom: 'Dia', data: '', iso: '', full: '', dayNum: '', shortMonth: 'Set' };
    const clean = isoDateStr.trim();
    const parts = clean.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return { nom: 'Dia', shortNom: 'Dia', data: clean, iso: clean, full: clean, dayNum: clean, shortMonth: 'Set' };
    }
    const year = parts[0];
    const monthIdx = parts[1] - 1;
    const day = parts[2];
    const dateObj = new Date(year, monthIdx, day);
    const weekday = CATALAN_WEEKDAYS[dateObj.getDay()] || 'Dia';
    const monthName = CATALAN_MONTHS[monthIdx] || 'setembre';
    const shortNom = SHORT_WEEKDAYS[weekday.toLowerCase()] || weekday.substring(0, 2);
    const shortMonth = SHORT_MONTHS[monthName.toLowerCase()] || monthName.substring(0, 3);

    return {
        nom: weekday,
        shortNom,
        data: `${day} ${monthName}`,
        shortDate: `${day} ${shortMonth}`,
        iso: clean,
        full: `${weekday}, ${day} de ${monthName} de ${year}`,
        dayNum: day,
        monthNum: monthIdx + 1,
        shortMonth,
        year
    };
}

/**
 * Extreu o calcula la data_iso (YYYY-MM-DD) de qualsevol objecte de dia o torn
 */
function getDiaIso(d) {
    if (!d) return '2026-09-19';
    if (typeof d === 'string') {
        const mIso = d.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (mIso) {
            const y = mIso[1];
            const m = mIso[2].padStart(2, '0');
            const day = mIso[3].padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        // Match day number with word boundaries or punctuation, e.g. "19 setembre", "(19)", "· 19", " 19 "
        const numMatch = d.match(/(?:^|[^\d])(\d{1,2})(?:[^\d]|$)/);
        if (numMatch) {
            const day = parseInt(numMatch[1]);
            if (day >= 1 && day <= 31) {
                return `2026-09-${day.toString().padStart(2, '0')}`;
            }
        }
        const str = d.toLowerCase();
        if (str.includes('divendres')) return '2026-09-18';
        if (str.includes('dissabte') || str.includes('disabte')) return '2026-09-19';
        if (str.includes('diumenge') || str.includes('dumenge')) return '2026-09-20';
        if (str.includes('dilluns')) return '2026-09-14';
        if (str.includes('dimarts')) return '2026-09-15';
        if (str.includes('dimecres')) return '2026-09-16';
        if (str.includes('dijous')) return '2026-09-17';
        return '2026-09-19';
    }

    if (d.data_iso) {
        const mIso = String(d.data_iso).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (mIso) {
            return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
        }
    }

    const combined = `${d.dia || ''} ${d.nom || ''} ${d.data || ''}`;
    return getDiaIso(combined);
}

function getDiaKey(d) {
    if (!d) return '';
    return getDiaIso(d);
}

function getDiaDisplayName(d) {
    if (!d) return '';
    const iso = getDiaIso(d);
    const info = parseIsoToCatalan(iso);
    const customData = (d.data || '').trim();
    if (customData && !customData.toLowerCase().includes(info.data.toLowerCase())) {
        return `${info.nom} (${info.data} · ${customData})`;
    }
    return `${info.nom} (${info.data})`;
}

function sortDaysChronologically() {
    allDies.sort((a, b) => getDiaIso(a).localeCompare(getDiaIso(b)));
    allDies.forEach((d, idx) => {
        d.ordre = idx;
        if (!d.data_iso) d.data_iso = getDiaIso(d);
        const info = parseIsoToCatalan(d.data_iso);
        if (!d.nom) d.nom = info.nom;
        if (!d.data) d.data = info.data;
    });
}

function getCurrentDiaObj() {
    if (currentDayKey) {
        const found = allDies.find(d => getDiaKey(d) === currentDayKey || d.data_iso === currentDayKey);
        if (found) return found;
    }
    const savedKey = localStorage.getItem('pluja_active_dia_iso');
    if (savedKey) {
        const found = allDies.find(d => getDiaKey(d) === savedKey || d.data_iso === savedKey);
        if (found) return found;
    }
    // Per defecte, seleccionar el primer dia que tingui torns assignats
    const dayWithShifts = allDies.find(d => allTorns.some(t => isTornInDia(t, d)));
    return dayWithShifts || allDies[0] || { nom: 'Dissabte', data: '19 setembre', data_iso: '2026-09-19', ordre: 0 };
}

function isDuplicateDia(isoVal, excludeIso = null) {
    const cleanIso = getDiaIso(isoVal);
    const cleanExclude = excludeIso ? getDiaIso(excludeIso) : null;
    return allDies.some(d => {
        const dIso = getDiaIso(d);
        if (cleanExclude && dIso === cleanExclude) return false;
        return dIso === cleanIso;
    });
}

/**
 * Comprovació 100% estricta de torns pertanyents a un dia per data_iso
 */
function isTornInDia(t, d) {
    if (!t || !d) return false;
    return getDiaIso(t) === getDiaIso(d);
}

function renderDaySelector() {
    const container = document.getElementById('day-selector');
    if (!container) return;
    container.innerHTML = '';

    sortDaysChronologically();

    const curDia = getCurrentDiaObj();
    currentDay = curDia.nom;
    currentDayKey = getDiaKey(curDia);
    const diaInfo = parseIsoToCatalan(currentDayKey);

    if (!isAdmin) {
        let slotSubText = "Torns de voluntariat disponibles";
        if (selectedHourSlotIdx !== null && FESTIVAL_HOURS[selectedHourSlotIdx] !== undefined) {
            const hVal = FESTIVAL_HOURS[selectedHourSlotIdx];
            const hNext = (hVal + 1) % 24;
            slotSubText = `⏰ Franja: ${hVal.toString().padStart(2, '0')}:00 – ${hNext.toString().padStart(2, '0')}:00`;
        }

        // Mode voluntari a Pantalla 3: capçalera neta amb el dia actual i botó per anar a Pantalla 2
        container.className = 'screen3-day-bar-volunteer';
        container.innerHTML = `
            <div class="screen3-day-info">
                <span class="screen3-day-icon">🗓️</span>
                <div class="screen3-day-text">
                    <strong class="screen3-day-title">${diaInfo.nom}, ${diaInfo.data}</strong>
                    <span class="screen3-day-sub">${slotSubText}</span>
                </div>
            </div>
            <button type="button" class="btn-change-day-slot" onclick="setMobileScreen(2)">
                <span>⬅️ Triar un altre dia / franja</span>
            </button>
        `;
        renderHourlyScreenDaySelector();
        populateDaysSelectInModal();
        return;
    }

    container.className = 'day-selector';
    allDies.forEach((d) => {
        const diaIso = getDiaIso(d);
        const dInfo = parseIsoToCatalan(diaIso);
        const isActive = diaIso === currentDayKey;

        const wrapper = document.createElement('div');
        wrapper.className = 'day-btn-wrapper';

        const btn = document.createElement('button');
        btn.className = 'day-btn' + (isActive ? ' active' : '');
        btn.dataset.day = dInfo.nom;
        btn.dataset.dayIso = diaIso;
        btn.title = `${dInfo.nom}, ${dInfo.data}`;
        btn.innerHTML = `
            <div class="day-admin-header">
                <button class="btn-icon-order" title="Editar data del dia" onclick="event.stopPropagation(); promptEditDia('${diaIso}')">✏️</button>
            </div>
            <span class="day-weekday">${dInfo.shortNom || dInfo.nom}</span>
            <span class="day-number">${dInfo.dayNum}</span>
            <span class="day-month-sub">${dInfo.shortMonth || 'Set'}</span>
        `;
        btn.onclick = () => {
            currentDayKey = diaIso;
            currentDay = dInfo.nom;
            localStorage.setItem('pluja_active_dia_iso', diaIso);
            renderDaySelector();
            renderAll();
        };
        wrapper.appendChild(btn);

        if (allDies.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete-day';
            delBtn.title = `Eliminar dia ${getDiaDisplayName(d)}`;
            delBtn.textContent = '✕';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteDia(diaIso);
            };
            wrapper.appendChild(delBtn);
        }

        container.appendChild(wrapper);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-day';
    addBtn.innerHTML = '<span>➕</span> <span>Afegir Dia</span>';
    addBtn.onclick = promptAddDia;
    container.appendChild(addBtn);

    renderHourlyScreenDaySelector();
    populateDaysSelectInModal();
}

window.renderHourlyScreenDaySelector = function() {
    const container = document.getElementById('hourly-screen-day-selector');
    if (!container) return;
    container.innerHTML = '';

    sortDaysChronologically();
    const curDia = getCurrentDiaObj();
    const curKey = getDiaKey(curDia);

    allDies.forEach((d) => {
        const diaIso = getDiaIso(d);
        const diaInfo = parseIsoToCatalan(diaIso);
        const isActive = diaIso === curKey;

        const btn = document.createElement('button');
        btn.className = 'day-btn' + (isActive ? ' active' : '');
        btn.title = `${diaInfo.nom}, ${diaInfo.data}`;
        btn.innerHTML = `
            <span class="day-weekday">${diaInfo.shortNom || diaInfo.nom}</span>
            <span class="day-number">${diaInfo.dayNum}</span>
            <span class="day-month-sub">${diaInfo.shortMonth || 'Set'}</span>
        `;
        btn.onclick = () => {
            currentDayKey = diaIso;
            currentDay = diaInfo.nom;
            localStorage.setItem('pluja_active_dia_iso', diaIso);
            renderDaySelector();
            renderHourlyOverviewScreen();
        };
        container.appendChild(btn);
    });
};

function populateDaysSelectInModal() {
    const select = document.getElementById('torn-dia');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '';

    const curDia = getCurrentDiaObj();

    allDies.forEach(d => {
        const diaIso = getDiaIso(d);
        const diaInfo = parseIsoToCatalan(diaIso);
        const opt = document.createElement('option');
        opt.value = diaIso;
        opt.textContent = `${diaInfo.nom}, ${diaInfo.data} (2026)`;
        select.appendChild(opt);
    });

    if (prev && allDies.some(d => getDiaIso(d) === prev)) {
        select.value = prev;
    } else if (curDia) {
        select.value = getDiaIso(curDia);
    }
}

window.promptEditDia = async function(diaIso) {
    const dia = allDies.find(d => getDiaIso(d) === diaIso);
    if (!dia) return;

    const novaDataIso = prompt("Nova data de calendari (format YYYY-MM-DD):", getDiaIso(dia));
    if (!novaDataIso) return;
    const cleanIso = novaDataIso.trim();

    if (!cleanIso.match(/^\d{4}-\d{2}-\d{2}$/)) {
        alert("El format de data ha de ser AAAA-MM-DD (ex: 2026-09-12).");
        return;
    }

    if (isDuplicateDia(cleanIso, diaIso)) {
        alert("Aquest dia de calendari ja existeix.");
        return;
    }

    const nouSubtitol = prompt("Subtítol o comentari (opcional):", dia.data || "");
    await applyEditDia(diaIso, cleanIso, nouSubtitol !== null ? nouSubtitol.trim() : "");
};

window.applyEditDia = async function(oldDiaIso, newDiaIso, newSubtitol = '') {
    const dia = allDies.find(d => getDiaIso(d) === oldDiaIso);
    if (!dia) return;

    const newInfo = parseIsoToCatalan(newDiaIso);
    const formattedDisplay = `${newInfo.nom} (${newInfo.data})`;

    // 1. Actualitzar els torns a Supabase
    try {
        let res = await supabaseClient
            .from('vol_torns')
            .update({ data_iso: newDiaIso, dia: formattedDisplay })
            .or(`data_iso.eq.${oldDiaIso},dia.ilike.%${oldDiaIso}%`);

        if (res.error && res.error.code === 'PGRST204') {
            await supabaseClient
                .from('vol_torns')
                .update({ dia: formattedDisplay })
                .or(`dia.ilike.%${oldDiaIso}%,dia.ilike.%${parseIsoToCatalan(oldDiaIso).data}%`);
        }

        allTorns.forEach(t => {
            if (getDiaIso(t) === oldDiaIso) {
                t.data_iso = newDiaIso;
                t.dia = formattedDisplay;
            }
        });
    } catch(e) {
        console.warn("Error actualitzant torns a Supabase:", e);
    }

    // 2. Actualitzar vol_dies a Supabase
    try {
        if (dia.id) {
            let res = await supabaseClient
                .from('vol_dies')
                .update({ data_iso: newDiaIso, nom: newInfo.nom, data: newSubtitol || newInfo.data, ordre: dia.ordre || 0 })
                .eq('id', dia.id);

            if (res.error && res.error.code === 'PGRST204') {
                await supabaseClient
                    .from('vol_dies')
                    .update({ nom: newInfo.nom, data: newSubtitol || newInfo.data, ordre: dia.ordre || 0 })
                    .eq('id', dia.id);
            }
        } else {
            let res = await supabaseClient
                .from('vol_dies')
                .upsert({ data_iso: newDiaIso, nom: newInfo.nom, data: newSubtitol || newInfo.data, ordre: dia.ordre || 0 });

            if (res.error && res.error.code === 'PGRST204') {
                await supabaseClient
                    .from('vol_dies')
                    .upsert({ nom: newInfo.nom, data: newSubtitol || newInfo.data, ordre: dia.ordre || 0 });
            }
        }
    } catch(e) {
        console.warn("Error actualitzant vol_dies:", e);
    }

    // 3. Actualitzar memòria local
    dia.data_iso = newDiaIso;
    dia.nom = newInfo.nom;
    dia.data = newSubtitol || newInfo.data;
    currentDayKey = newDiaIso;
    currentDay = newInfo.nom;
    localStorage.setItem('pluja_active_dia_iso', newDiaIso);

    sortDaysChronologically();
    localStorage.setItem('pluja_dies_list', JSON.stringify(allDies));

    await fetchData();
    renderDaySelector();
    renderDiesAdminList();
    renderAll();
};

window.promptAddDia = function() {
    openDiesModal();
};

window.deleteDia = async function(diaIso) {
    const dia = allDies.find(d => getDiaIso(d) === diaIso);
    if (!dia) return;

    const dayTorns = allTorns.filter(t => isTornInDia(t, dia));
    const msg = dayTorns.length > 0
        ? `⚠️ El dia '${getDiaDisplayName(dia)}' té ${dayTorns.length} torn(s) creat(s).\n\nSegur que vols eliminar aquest dia i tots els seus torns?`
        : `Segur que vols eliminar el dia '${getDiaDisplayName(dia)}'?`;

    if (!confirm(msg)) return;

    if (dayTorns.length > 0) {
        const ids = dayTorns.map(t => t.id);
        try {
            await supabaseClient.from('vol_torns').delete().in('id', ids);
        } catch(e) {
            console.warn("Error eliminant torns a Supabase:", e);
        }
    }

    // Eliminar de Supabase vol_dies
    try {
        if (dia.id) {
            await supabaseClient.from('vol_dies').delete().eq('id', dia.id);
        }
        await supabaseClient.from('vol_dies').delete().eq('data_iso', diaIso);
    } catch(e) {
        console.warn("Error eliminant de vol_dies:", e);
    }

    allDies = allDies.filter(d => getDiaIso(d) !== diaIso);
    allTorns = allTorns.filter(t => !dayTorns.some(dt => dt.id === t.id));
    if (allDies.length === 0) {
        allDies = [...DEFAULT_DIES];
    }
    sortDaysChronologically();
    localStorage.setItem('pluja_dies_list', JSON.stringify(allDies));

    currentDayKey = getDiaKey(allDies[0]);
    currentDay = allDies[0].nom;

    await fetchData();
    renderDaySelector();
    renderDiesAdminList();
    renderAll();
};

// ==========================================
// MODAL GESTIÓ DIES
// ==========================================
window.openDiesModal = function() {
    editingDiaKey = null;
    const picker = document.getElementById('new-dia-date-picker');
    const subtitolInp = document.getElementById('new-dia-subtitol');
    const err = document.getElementById('dies-form-error');
    if (err) err.style.display = 'none';

    if (picker) {
        // Suggerir una data lògica per al festival
        picker.value = '2026-09-12';
        updateNewDiaPreview();
        picker.onchange = updateNewDiaPreview;
    }
    if (subtitolInp) subtitolInp.value = '';

    renderDiesAdminList();
    document.getElementById('modal-dies').style.display = 'flex';
};

function updateNewDiaPreview() {
    const picker = document.getElementById('new-dia-date-picker');
    const previewEl = document.getElementById('new-dia-preview-text');
    if (!picker || !previewEl) return;
    const info = parseIsoToCatalan(picker.value);
    previewEl.textContent = info.full;
}

function renderDiesAdminList() {
    const list = document.getElementById('dies-admin-list');
    if (!list) return;
    list.innerHTML = '';

    sortDaysChronologically();

    if (allDies.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No hi ha cap dia creat.</p>';
        return;
    }

    allDies.forEach((d, index) => {
        const diaIso = getDiaIso(d);
        const diaInfo = parseIsoToCatalan(diaIso);
        const row = document.createElement('div');
        row.className = 'dia-item-row';

        if (editingDiaKey === diaIso) {
            // Mode edició inline amb date picker
            row.innerHTML = `
                <div style="display: flex; gap: 0.5rem; width: 100%; align-items: center; flex-wrap: wrap;">
                    <span class="espai-order-num">#${index + 1}</span>
                    <input type="date" id="input-edit-dia-iso-${index}" value="${diaIso}" style="padding: 0.4rem 0.6rem; font-size: 0.85rem; width: 140px; color: white;">
                    <input type="text" id="input-edit-dia-subtitol-${index}" value="${(d.data || '').replace(/"/g, '&quot;')}" placeholder="Subtítol / Notes (opcional)" style="padding: 0.4rem 0.6rem; font-size: 0.85rem; flex: 1; min-width: 120px;">
                    <button class="btn-primary" onclick="saveInlineDiaEdit('${diaIso}', ${index})" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✓</button>
                    <button class="btn-ghost" onclick="cancelInlineDiaEdit()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✕</button>
                </div>
            `;
        } else {
            const shiftCount = allTorns.filter(t => isTornInDia(t, d)).length;
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                    <span class="espai-order-num">#${index + 1}</span>
                    <div>
                        <strong style="color: white; font-size: 0.95rem;">${diaInfo.nom}</strong>
                        <span style="color: #38bdf8; font-size: 0.85rem; font-weight: 600; margin-left: 0.4rem;">(${diaInfo.data})</span>
                        <span style="color: #94a3b8; font-size: 0.75rem; margin-left: 0.3rem;">[${diaIso}]</span>
                        <span class="space-badge" style="margin-left: 0.4rem;">${shiftCount} torn${shiftCount === 1 ? '' : 's'}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn-small" onclick="startInlineDiaEdit('${diaIso}')" style="margin: 0; color: var(--primary); border-color: var(--primary);">✏️ Editar</button>
                    <button class="btn-small" onclick="deleteDia('${diaIso}')" style="margin: 0; color: var(--danger); border-color: var(--danger);" ${allDies.length <= 1 ? 'disabled' : ''}>🗑️</button>
                </div>
            `;
        }

        list.appendChild(row);
    });
}

window.startInlineDiaEdit = function(diaIso) {
    editingDiaKey = diaIso;
    renderDiesAdminList();
};

window.cancelInlineDiaEdit = function() {
    editingDiaKey = null;
    renderDiesAdminList();
};

window.saveInlineDiaEdit = async function(oldDiaIso, index) {
    const inpIso = document.getElementById(`input-edit-dia-iso-${index}`);
    const inpSubtitol = document.getElementById(`input-edit-dia-subtitol-${index}`);
    const newIso = inpIso ? inpIso.value.trim() : '';
    const newSubtitol = inpSubtitol ? inpSubtitol.value.trim() : '';

    if (!newIso) {
        alert("Has de seleccionar una data de calendari.");
        return;
    }

    if (isDuplicateDia(newIso, oldDiaIso)) {
        alert("Aquest dia de calendari ja està afegit.");
        return;
    }

    editingDiaKey = null;
    await applyEditDia(oldDiaIso, newIso, newSubtitol);
};

window.handleAddDiaFromModal = async function() {
    const picker = document.getElementById('new-dia-date-picker');
    const subtitolInp = document.getElementById('new-dia-subtitol');
    const err = document.getElementById('dies-form-error');
    const isoVal = picker ? picker.value.trim() : '';
    const subtitol = subtitolInp ? subtitolInp.value.trim() : '';

    if (!isoVal) {
        if (err) {
            err.textContent = "Si us plau, tria una data de calendari.";
            err.style.display = 'block';
        }
        return;
    }

    if (isDuplicateDia(isoVal)) {
        if (err) {
            err.textContent = `Aquesta data de calendari (${isoVal}) ja està afegida a la llista.`;
            err.style.display = 'block';
        }
        return;
    }

    if (err) err.style.display = 'none';

    const diaInfo = parseIsoToCatalan(isoVal);
    const nouDia = {
        data_iso: isoVal,
        nom: diaInfo.nom,
        data: subtitol ? `${diaInfo.data} · ${subtitol}` : diaInfo.data,
        ordre: allDies.length,
        isNewlyAdded: true
    };

    try {
        let res = await supabaseClient
            .from('vol_dies')
            .insert({
                data_iso: isoVal,
                nom: diaInfo.nom,
                data: nouDia.data,
                ordre: allDies.length
            })
            .select()
            .single();

        if (res.error && res.error.code === 'PGRST204') {
            res = await supabaseClient
                .from('vol_dies')
                .insert({
                    nom: diaInfo.nom,
                    data: nouDia.data,
                    ordre: allDies.length
                })
                .select()
                .single();
        }

        if (res.data) {
            nouDia.id = res.data.id;
        }
    } catch(e) {
        console.warn("Supabase insert vol_dies:", e);
    }

    allDies.push(nouDia);
    sortDaysChronologically();
    localStorage.setItem('pluja_dies_list', JSON.stringify(allDies));
    currentDay = diaInfo.nom;
    currentDayKey = isoVal;
    localStorage.setItem('pluja_active_dia_iso', isoVal);

    if (subtitolInp) subtitolInp.value = '';

    renderDaySelector();
    renderDiesAdminList();
    renderAll();
};

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxmQ3xCgRaCZdjqIdH49yBUVWOwIp3OFt7DmOkgIM-5mbGfxe6ftbib2HD2OMbh3uIR/exec';

function initEventListeners() {

    // 2. Autenticació de voluntaris
    document.getElementById('select-voluntari-existent').addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
            const vol = allVoluntaris.find(v => v.id === id);
            if (vol) loginVoluntari(vol);
        }
    });

    document.getElementById('btn-registre-voluntari').addEventListener('click', handleRegistreVoluntari);
    document.getElementById('btn-logout-vol').addEventListener('click', logoutVoluntari);

    // Toggle opció persones dinar
    const radioSi = document.getElementById('radio-dinar-si');
    const radioNo = document.getElementById('radio-dinar-no');
    const dinarGroup = document.getElementById('dinar-persones-group');
    if (radioSi && radioNo && dinarGroup) {
        radioSi.addEventListener('change', () => { dinarGroup.style.display = 'flex'; });
        radioNo.addEventListener('change', () => { dinarGroup.style.display = 'none'; });
    }

    // 3. Autenticació Admin
    document.getElementById('btn-admin-login-toggle').addEventListener('click', () => {
        if (isAdmin) {
            supabaseClient.auth.signOut();
            setAdminMode(false);
        } else {
            document.getElementById('admin-email').value = '';
            document.getElementById('admin-pass').value = '';
            document.getElementById('admin-auth-error').style.display = 'none';
            document.getElementById('modal-admin').style.display = 'flex';
        }
    });

    document.getElementById('btn-cancel-admin').addEventListener('click', () => {
        document.getElementById('modal-admin').style.display = 'none';
    });

    document.getElementById('btn-do-admin-login').addEventListener('click', handleAdminLogin);

    // 4. Gestió de Dies (Admin)
    document.getElementById('btn-open-dies-modal').addEventListener('click', openDiesModal);
    document.getElementById('btn-add-dia-modal').addEventListener('click', handleAddDiaFromModal);
    const datePicker = document.getElementById('new-dia-date-picker');
    const subtitolInp = document.getElementById('new-dia-subtitol');
    if (datePicker) {
        datePicker.addEventListener('change', updateNewDiaPreview);
    }
    if (subtitolInp) {
        subtitolInp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDiaFromModal();
            }
        });
    }
    document.getElementById('btn-close-dies').addEventListener('click', () => {
        document.getElementById('modal-dies').style.display = 'none';
        renderAll();
    });

    // 5. Gestió d'Espais (Admin)
    document.getElementById('btn-open-espais-modal').addEventListener('click', openEspaisModal);
    document.getElementById('btn-add-espai').addEventListener('click', handleAddEspai);
    document.getElementById('new-espai-nom').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddEspai();
        }
    });
    document.getElementById('btn-close-espais').addEventListener('click', () => {
        document.getElementById('modal-espais').style.display = 'none';
        renderAll();
    });

    // 6. Gestió de Torns (Admin)
    document.getElementById('btn-new-torn-global').addEventListener('click', () => openTornModal(null));
    document.getElementById('btn-save-torn').addEventListener('click', handleSaveTorn);
    document.getElementById('btn-cancel-torn').addEventListener('click', closeTornModal);
    document.getElementById('btn-delete-torn').addEventListener('click', handleDeleteTorn);
    document.getElementById('btn-duplicate-torn').addEventListener('click', handleDuplicateTorn);
    document.getElementById('btn-split-from-edit').addEventListener('click', () => {
        const editId = document.getElementById('torn-edit-id').value;
        if (editId) {
            closeTornModal();
            openDividirTornModal(editId);
        }
    });

    // 7. Modal Dividir Torns en Trams (Admin)
    document.querySelectorAll('#modal-dividir-torn .btn-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#modal-dividir-torn .btn-preset').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const mins = e.currentTarget.dataset.mins;
            const customRow = document.getElementById('custom-mins-row');
            if (mins === 'custom') {
                customRow.style.display = 'block';
            } else {
                customRow.style.display = 'none';
            }
            updateSplitPreview();
        });
    });
    document.getElementById('split-custom-mins').addEventListener('input', updateSplitPreview);
    document.getElementById('btn-cancel-dividir').addEventListener('click', closeDividirTornModal);
    document.getElementById('btn-do-dividir').addEventListener('click', handleDoDividirTorn);

    // 8. Exportacions i Impressió
    document.getElementById('btn-export-csv').addEventListener('click', handleExportCSV);
    document.getElementById('btn-print-pdf').addEventListener('click', handlePrintPDF);
}

// ==========================================
// 4. CARREGA DE DADES (SUPABASE)
// ==========================================
async function fetchData() {
    try {
        const [volsRes, espaisRes, tornsRes, assignRes, diesRes] = await Promise.all([
            supabaseClient.from('vol_voluntaris').select('*').order('nom'),
            supabaseClient.from('vol_espais').select('*').order('ordre', { ascending: true }).order('created_at'),
            supabaseClient.from('vol_torns').select('*'),
            supabaseClient.from('vol_assignacions').select('*'),
            supabaseClient.from('vol_dies').select('*').order('ordre', { ascending: true })
        ]);

        allVoluntaris = volsRes.data || [];
        allEspais = espaisRes.data || [];
        allTorns = tornsRes.data || [];
        allAssignacions = assignRes.data || [];

        // Carregar dies de Supabase si la taula existeix i té dades
        if (diesRes.data && diesRes.data.length > 0) {
            allDies = diesRes.data.map(d => {
                const diaIso = getDiaIso(d);
                const diaInfo = parseIsoToCatalan(diaIso);
                return {
                    id: d.id,
                    data_iso: diaIso,
                    nom: d.nom || diaInfo.nom,
                    data: d.data || diaInfo.data,
                    ordre: d.ordre ?? 0
                };
            });
        } else if (!diesRes.error && diesRes.data && diesRes.data.length === 0) {
            // Taula buida a Supabase: inicialitzar amb DEFAULT_DIES
            try {
                await supabaseClient.from('vol_dies').insert(DEFAULT_DIES);
            } catch(e) {}
        }

        // Sincronitzar automàticament nous dies que puguin existir a la taula de torns
        let diesChanged = false;
        allTorns.forEach(t => {
            const tIso = getDiaIso(t);
            if (!allDies.some(d => getDiaIso(d) === tIso)) {
                const diaInfo = parseIsoToCatalan(tIso);
                allDies.push({
                    data_iso: tIso,
                    nom: diaInfo.nom,
                    data: diaInfo.data,
                    ordre: allDies.length
                });
                diesChanged = true;
            }
        });

        // Ordenar sempre automàticament de forma cronològica per data ISO
        sortDaysChronologically();

        if (diesChanged) {
            localStorage.setItem('pluja_dies_list', JSON.stringify(allDies));
        }

        populateVoluntarisSelect();
        populateEspaisSelectInModal();
        renderDaySelector();
        renderDiesAdminList();
    } catch (err) {
        console.error("Error carregant dades de Supabase:", err);
    }
}

function populateVoluntarisSelect() {
    const select = document.getElementById('select-voluntari-existent');
    if (!select) return;
    const prevValue = select.value;
    select.innerHTML = '<option value="">-- Tria el teu nom --</option>';
    
    // Ordenar alfabèticament
    const sorted = [...allVoluntaris].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    sorted.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.nom} ${v.cognom}`;
        select.appendChild(opt);
    });
    
    select.value = prevValue;
}

function populateEspaisSelectInModal() {
    const select = document.getElementById('torn-espai-id');
    if (!select) return;
    select.innerHTML = '';
    allEspais.forEach(espai => {
        const opt = document.createElement('option');
        opt.value = espai.id;
        opt.textContent = espai.nom;
        select.appendChild(opt);
    });
}

// ==========================================
// 5. GESTIÓ D'USUARIS (VOLUNTARIS)
// ==========================================
async function handleRegistreVoluntari() {
    const nom = document.getElementById('new-vol-nom').value.trim();
    const cognom = document.getElementById('new-vol-cognom').value.trim();
    const tel = document.getElementById('new-vol-tel').value.trim();

    if (!nom || !cognom || !tel) {
        alert("Si us plau, omple el teu nom, cognoms i telèfon.");
        return;
    }

    const radioSi = document.getElementById('radio-dinar-si');
    const dinar = radioSi ? radioSi.checked : true;
    const dinarPersonesInput = document.getElementById('new-vol-dinar-persones');
    const dinar_persones = dinar ? Math.max(1, parseInt(dinarPersonesInput ? dinarPersonesInput.value : 1) || 1) : 0;

    let payload = {
        nom,
        cognom,
        telefon: tel,
        dinar,
        dinar_persones
    };

    let data = null;
    let error = null;

    try {
        const res = await supabaseClient
            .from('vol_voluntaris')
            .upsert(payload, { onConflict: 'telefon' })
            .select()
            .single();
        data = res.data;
        error = res.error;
    } catch (e) {
        error = e;
    }

    // Fallback si la columna dinar encara no està creada a Supabase
    if (error && (error.code === '42703' || (error.message && error.message.includes('dinar')))) {
        try {
            const fallbackRes = await supabaseClient
                .from('vol_voluntaris')
                .upsert({ nom, cognom, telefon: tel }, { onConflict: 'telefon' })
                .select()
                .single();
            data = fallbackRes.data ? { ...fallbackRes.data, dinar, dinar_persones } : null;
            error = fallbackRes.error;
        } catch (e2) {
            error = e2;
        }
    }

    if (error) {
        alert("Error en registrar el voluntari: " + error.message);
        return;
    }

    // Sincronitzar automàticament amb Google Sheets
    try {
        const formData = new FormData();
        formData.append('nom', `${nom} ${cognom}`);
        formData.append('telefon', tel);
        formData.append('tipus', `Voluntari (Dinar dissabte: ${dinar ? 'Sí, ' + dinar_persones + ' pers.' : 'No'})`);
        formData.append('dinar', dinar ? 'Sí' : 'No');
        formData.append('persones_dinar', dinar ? dinar_persones : 0);
        formData.append('data_limit_dinar', '11 setembre');
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData, mode: 'no-cors' }).catch(e => console.warn("Google Sheets sync:", e));
    } catch (e) {
        console.warn("Google Sheets sync error:", e);
    }

    document.getElementById('new-vol-nom').value = '';
    document.getElementById('new-vol-cognom').value = '';
    document.getElementById('new-vol-tel').value = '';
    if (document.getElementById('radio-dinar-si')) document.getElementById('radio-dinar-si').checked = true;
    if (document.getElementById('new-vol-dinar-persones')) document.getElementById('new-vol-dinar-persones').value = '1';

    loginVoluntari(data || payload);
    await fetchData();
    renderAll();
}

let currentMobileScreen = 1;

window.setMobileScreen = function(screenNum, options = {}) {
    currentMobileScreen = screenNum;

    // Actualitzar classes de la barra de navegació superior
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`step-nav-${i}`);
        if (btn) {
            btn.classList.remove('active', 'done');
            if (i === screenNum) {
                btn.classList.add('active');
            } else if (i < screenNum) {
                btn.classList.add('done');
            }
        }
    }

    // Amagar/mostrar pantalles
    const screens = [
        document.getElementById('screen-1-auth'),
        document.getElementById('screen-2-hourly'),
        document.getElementById('screen-3-shifts'),
        document.getElementById('screen-4-summary')
    ];

    screens.forEach((scr, idx) => {
        if (!scr) return;
        if (idx + 1 === screenNum) {
            scr.style.display = 'block';
            scr.classList.add('active');
        } else {
            scr.style.display = 'none';
            scr.classList.remove('active');
        }
    });

    if (screenNum === 2) {
        renderHourlyOverviewScreen();
    } else if (screenNum === 3) {
        if (!isAdmin && window.innerWidth <= 768) {
            setViewMode('detailed');
        }
        renderAll();
        if (options.targetHourMin !== undefined) {
            setTimeout(() => {
                const wrapper = document.getElementById('spaces-grid-wrapper');
                if (wrapper) {
                    const targetTop = getTimelineY(options.targetHourMin);
                    wrapper.scrollTo({ top: Math.max(0, targetTop - 20), behavior: 'smooth' });
                }
            }, 120);
        }
    } else if (screenNum === 4) {
        renderUserSummary();
    }

    // Desplaçar la finestra a la part superior de forma suau
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.renderHourlyOverviewScreen = function() {
    const listEl = document.getElementById('mobile-hourly-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const curDia = getCurrentDiaObj();
    const dayTorns = allTorns.filter(t => isTornInDia(t, curDia));

    renderHourlyScreenDaySelector();

    if (dayTorns.length === 0) {
        listEl.innerHTML = `
            <div class="user-summary-empty">
                <p style="font-size: 1.6rem; margin-bottom: 0.5rem;">🏖️</p>
                <strong style="font-size: 1.05rem; color: white;">Sense torns en aquest dia</strong>
                <p style="font-size: 0.85rem; margin-top: 0.3rem;">Tria un altre dia al selector superior per consultar les franges horàries.</p>
            </div>
        `;
        return;
    }

    // Recollir hores actives del dia
    const activeHours = [];
    FESTIVAL_HOURS.forEach((hVal, k) => {
        const hStart = k * 60;
        const hEnd = (k + 1) * 60;
        const hNext = (hVal + 1) % 24;
        const timeLabel = `${hVal.toString().padStart(2, '0')}:00 – ${hNext.toString().padStart(2, '0')}:00`;

        const hourTorns = dayTorns.filter(t => {
            const s = timeToFestivalMinutes(t.hora_inici);
            let e = timeToFestivalMinutes(t.hora_fi);
            if (e <= s) e += 1440;
            return s < hEnd && e > hStart;
        });

        if (hourTorns.length > 0) {
            const totalNeeded = hourTorns.reduce((sum, t) => sum + (parseInt(t.necessaris) || 1), 0);
            const totalAssigned = hourTorns.reduce((sum, t) => {
                return sum + allAssignacions.filter(a => a.torn_id === t.id).length;
            }, 0);
            const deficit = Math.max(0, totalNeeded - totalAssigned);

            const activeEspaisMap = {};
            hourTorns.forEach(t => {
                const espai = allEspais.find(e => e.id === t.espai_id);
                const espaiNom = espai ? espai.nom : 'Espai';
                const count = allAssignacions.filter(a => a.torn_id === t.id).length;
                if (!activeEspaisMap[espaiNom]) {
                    activeEspaisMap[espaiNom] = { needed: 0, assigned: 0 };
                }
                activeEspaisMap[espaiNom].needed += (parseInt(t.necessaris) || 1);
                activeEspaisMap[espaiNom].assigned += count;
            });

            activeHours.push({
                hourIdx: k,
                hVal,
                timeLabel,
                hourTorns,
                totalNeeded,
                totalAssigned,
                deficit,
                activeEspaisMap
            });
        }
    });

    activeHours.forEach(item => {
        let statusClass = 'status-empty';
        let badgeText = `🚨 Falten ${item.totalNeeded} (${item.totalAssigned}/${item.totalNeeded})`;
        if (item.totalAssigned >= item.totalNeeded) {
            statusClass = 'status-full';
            badgeText = `✓ Complet (${item.totalAssigned}/${item.totalNeeded})`;
        } else if (item.totalAssigned > 0) {
            statusClass = 'status-partial';
            badgeText = `⚠️ Falten ${item.deficit} (${item.totalAssigned}/${item.totalNeeded})`;
        }

        const chipsHtml = Object.entries(item.activeEspaisMap).map(([nom, st]) => {
            return `<span class="mobile-hourly-space-tag">📍 ${nom}: ${st.assigned}/${st.needed}</span>`;
        }).join('');

        const card = document.createElement('div');
        card.className = `mobile-hourly-card ${statusClass}`;
        card.onclick = () => selectHourlySlotAndZoom(item.hourIdx);

        card.innerHTML = `
            <div class="mobile-hourly-card-header">
                <span class="mobile-hourly-time">⏰ ${item.timeLabel}</span>
                <span class="mobile-hourly-badge">${badgeText}</span>
            </div>
            <div class="mobile-hourly-spaces">
                ${chipsHtml}
            </div>
            <div class="mobile-hourly-card-cta">
                <span>Veure ${item.hourTorns.length} torn${item.hourTorns.length === 1 ? '' : 's'} d'aquesta hora ❯</span>
            </div>
        `;
        listEl.appendChild(card);
    });
};

window.selectHourlySlotAndZoom = function(hourIdx) {
    selectedHourSlotIdx = hourIdx;
    setViewMode('detailed');
    setMobileScreen(3, { targetHourMin: hourIdx * 60, selectedHourIdx: hourIdx });
};

function loginVoluntari(vol) {
    currentVoluntari = vol;
    localStorage.setItem('voluntari_session', JSON.stringify(vol));
    updateUserUI();
    renderAll();
    // Avançar automàticament a la pantalla 2 (Franges Horàries)
    setMobileScreen(2);
}

function logoutVoluntari() {
    currentVoluntari = null;
    localStorage.removeItem('voluntari_session');
    document.getElementById('select-voluntari-existent').value = '';
    updateUserUI();
    renderAll();
    setMobileScreen(1);
}

function updateUserUI() {
    const authSection = document.getElementById('auth-section');
    const welcome = document.getElementById('welcome-message');
    const authBox = document.querySelector('.auth-box');
    const dinarBadge = document.getElementById('greeting-dinar-badge');

    if (currentVoluntari) {
        document.getElementById('current-user-name').innerText = `${currentVoluntari.nom} ${currentVoluntari.cognom}`;
        
        if (dinarBadge) {
            const hasDinar = currentVoluntari.dinar !== false;
            const pers = hasDinar ? (currentVoluntari.dinar_persones || 1) : 0;
            const statusText = hasDinar ? `🍽️ Dinar dissabte: <strong>Sí (${pers} pers.)</strong>` : `🍽️ Dinar dissabte: <strong>No</strong>`;
            dinarBadge.innerHTML = `
                <span>${statusText}</span>
                <span style="color: #cbd5e1; font-size: 0.72rem;">· Data límit: 11 setembre</span>
                <button class="btn-change-dinar" onclick="promptChangeDinar()">✏️ Canviar</button>
            `;
        }

        welcome.style.display = 'block';
        authBox.style.display = 'none';
        authSection.classList.add('user-active');
    } else {
        welcome.style.display = 'none';
        authBox.style.display = 'grid';
        authSection.classList.remove('user-active');
    }
    renderUserSummary();
}

/**
 * Renderitza el resum personal del voluntari actual (torns inscrits, dinar i botó de WhatsApp)
 */
function renderUserSummary() {
    const section = document.getElementById('user-summary-section');
    if (!section) return;

    if (!currentVoluntari) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'flex';
    const nameEl = document.getElementById('user-summary-vol-name');
    if (nameEl) {
        nameEl.textContent = `${currentVoluntari.nom} ${currentVoluntari.cognom}${currentVoluntari.telefon ? ' · ' + currentVoluntari.telefon : ''}`;
    }

    // 1. Dinar Card
    const dinarBox = document.getElementById('user-summary-dinar-box');
    if (dinarBox) {
        const hasDinar = currentVoluntari.dinar !== false;
        const pers = hasDinar ? (currentVoluntari.dinar_persones || 1) : 0;
        dinarBox.className = `user-summary-dinar-card ${hasDinar ? 'dinar-si' : ''}`;
        dinarBox.innerHTML = `
            <div class="user-summary-dinar-info">
                <span class="dinar-icon">🍽️</span>
                <div class="user-summary-dinar-text">
                    <strong>Dinar gratuït de voluntaris (Dissabte 19 de setembre)</strong>
                    <p>${hasDinar ? `✅ Inscrit/a: <strong>${pers} ${pers === 1 ? 'persona' : 'persones'}</strong>` : '❌ No hi assistiràs'}</p>
                </div>
            </div>
            <button type="button" class="btn-secondary" onclick="promptChangeDinar()" style="font-size: 0.82rem; padding: 0.35rem 0.75rem;">
                ✏️ Canviar estat
            </button>
        `;
    }

    // 2. Torns assignats
    const myAssignations = allAssignacions.filter(a => a.voluntari_id === currentVoluntari.id);
    const myTorns = myAssignations.map(a => allTorns.find(t => t.id === a.torn_id)).filter(Boolean);

    // Ordenar cronològicament per data ISO i hora d'inici
    myTorns.sort((a, b) => {
        const dateA = getDiaIso(a);
        const dateB = getDiaIso(b);
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici);
    });

    const totalBadge = document.getElementById('user-summary-total-badge');
    if (totalBadge) {
        totalBadge.textContent = `${myTorns.length} torn${myTorns.length === 1 ? '' : 's'} assignat${myTorns.length === 1 ? '' : 's'}`;
    }

    const listEl = document.getElementById('user-summary-torns-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (myTorns.length === 0) {
        listEl.innerHTML = `
            <div class="user-summary-empty" style="grid-column: 1 / -1;">
                <p>🏖️ Encara no t'has inscrit a cap torn.</p>
                <p style="font-size: 0.85rem; margin-top: 0.4rem;">Fes clic sobre qualsevol torn disponible a la graella de dalt per apuntar-t'hi!</p>
            </div>
        `;
        return;
    }

    myTorns.forEach(t => {
        const espai = allEspais.find(e => e.id === t.espai_id);
        const diaIso = getDiaIso(t);
        const diaInfo = parseIsoToCatalan(diaIso);
        const durada = calculateDuration(t.hora_inici, t.hora_fi);

        const card = document.createElement('div');
        card.className = 'user-torn-card';
        card.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                <div class="user-torn-day">🗓️ ${diaInfo.full || diaInfo.nom}</div>
                <div class="user-torn-time">
                    ⏰ ${t.hora_inici} – ${t.hora_fi}
                    <span class="user-torn-duration">${durada}</span>
                </div>
                <div class="user-torn-location">
                    <span>📍</span>
                    <strong>${espai ? espai.nom : 'Espai'}${t.lloc ? ' · ' + t.lloc : ''}</strong>
                </div>
                <div class="user-torn-task">
                    <span>🎯</span>
                    <span>${t.tasca || 'Suport general'}</span>
                </div>
            </div>
            <div class="user-torn-footer">
                <button type="button" class="btn-user-withdraw" onclick="handleToggleInscripcio('${t.id}')">
                    Desapuntar-me d'aquest torn
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

/**
 * Genera el missatge de text amb el resum de voluntariat
 */
function buildUserSummaryMessage() {
    if (!currentVoluntari) return '';

    const myAssignations = allAssignacions.filter(a => a.voluntari_id === currentVoluntari.id);
    const myTorns = myAssignations.map(a => allTorns.find(t => t.id === a.torn_id)).filter(Boolean);

    myTorns.sort((a, b) => {
        const dateA = getDiaIso(a);
        const dateB = getDiaIso(b);
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici);
    });

    const hasDinar = currentVoluntari.dinar !== false;
    const dinarPers = hasDinar ? (currentVoluntari.dinar_persones || 1) : 0;

    let msg = `🎨 *Festival Pluja d'Art 2026 — El meu resum de voluntariat*\n\n`;
    msg += `👤 *Voluntari/a:* ${currentVoluntari.nom} ${currentVoluntari.cognom}\n`;
    if (currentVoluntari.telefon) {
        msg += `📞 *Telèfon:* ${currentVoluntari.telefon}\n`;
    }
    msg += `\n📅 *ELS MEUS TORNS (${myTorns.length} torn${myTorns.length === 1 ? '' : 's'}):*\n`;

    if (myTorns.length === 0) {
        msg += `(Encara no t'has inscrit a cap torn)\n`;
    } else {
        myTorns.forEach((t, i) => {
            const espai = allEspais.find(e => e.id === t.espai_id);
            const diaIso = getDiaIso(t);
            const diaInfo = parseIsoToCatalan(diaIso);
            const durada = calculateDuration(t.hora_inici, t.hora_fi);

            msg += `\n${i + 1}️⃣ *${diaInfo.nom}, ${diaInfo.data}*\n`;
            msg += `   ⏰ *Horari:* ${t.hora_inici} – ${t.hora_fi} (${durada})\n`;
            msg += `   📍 *Espai:* ${espai ? espai.nom : 'Espai'}${t.lloc ? ' — ' + t.lloc : ''}\n`;
            msg += `   🎯 *Tasca:* ${t.tasca || 'Suport'}\n`;
        });
    }

    msg += `\n🍽️ *Dinar de voluntaris (Dissabte 19):* ${hasDinar ? `Sí (${dinarPers} ${dinarPers === 1 ? 'persona' : 'persones'})` : 'No'}\n`;
    msg += `\n🌧️✨ *Ens veiem a la Pluja d'Art!*`;

    return msg;
}

/**
 * Envia el resum per WhatsApp
 */
window.sendSummaryViaWhatsApp = function() {
    const msg = buildUserSummaryMessage();
    if (!msg) {
        alert("Si us plau, identifica't primer com a voluntari/a.");
        return;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
};

/**
 * Copia el resum al porta-retalls
 */
window.copyUserSummary = async function() {
    const msg = buildUserSummaryMessage();
    if (!msg) {
        alert("Si us plau, identifica't primer com a voluntari/a.");
        return;
    }

    try {
        await navigator.clipboard.writeText(msg);
        const btn = document.getElementById('btn-copy-user-summary');
        if (btn) {
            const origText = btn.innerHTML;
            btn.innerHTML = '✅ Copiat!';
            setTimeout(() => { btn.innerHTML = origText; }, 2000);
        } else {
            alert("Resum copiat al porta-retalls!");
        }
    } catch(err) {
        prompt("Copia el teu resum:", msg);
    }
};

window.promptChangeDinar = async function() {
    if (!currentVoluntari) return;
    const currentStatus = currentVoluntari.dinar !== false;
    const currentPers = currentStatus ? (currentVoluntari.dinar_persones || 1) : 1;

    const volDinar = confirm(
        `🍽️ DINAR GRATUÏT DE VOLUNTARIS (Dissabte 19 de setembre)\n(Data límit inscripció: 11 de setembre)\n\n` +
        `Vindràs al dinar de dissabte? (Prem 'D'acord' per a SÍ, 'Cancel·la' per a NO)`
    );

    let newPers = 0;
    if (volDinar) {
        const input = prompt("Quantes persones sereu en total al dinar? (Incloent acompanyants no voluntaris):", currentPers.toString());
        newPers = Math.max(1, parseInt(input) || 1);
    }

    currentVoluntari.dinar = volDinar;
    currentVoluntari.dinar_persones = newPers;
    localStorage.setItem('voluntari_session', JSON.stringify(currentVoluntari));

    try {
        await supabaseClient
            .from('vol_voluntaris')
            .update({ dinar: volDinar, dinar_persones: newPers })
            .eq('id', currentVoluntari.id);
    } catch(e) {
        console.warn("Error actualitzant dinar a Supabase:", e);
    }

    // Sincronitzar amb Google Sheets
    try {
        const formData = new FormData();
        formData.append('nom', `${currentVoluntari.nom} ${currentVoluntari.cognom}`);
        formData.append('telefon', currentVoluntari.telefon || '');
        formData.append('tipus', `Modificació Dinar (Dinar: ${volDinar ? 'Sí (' + newPers + ' pers.)' : 'No'})`);
        formData.append('dinar', volDinar ? 'Sí' : 'No');
        formData.append('persones_dinar', newPers);
        formData.append('data_limit_dinar', '11 setembre');
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData, mode: 'no-cors' }).catch(() => {});
    } catch(e) {}

    await fetchData();
    updateUserUI();
};

// ==========================================
// 6. RENDERITZAT DEL CALENDARI TIMELINE (EIX VERTICAL D'HORES)
// ==========================================
const FESTIVAL_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
const HOUR_HEIGHT = 150;

function computeTrackLayout(shifts) {
    if (!shifts || shifts.length === 0) return [];

    // 1. Prepare items with festival start/end minutes
    const items = shifts.map(torn => {
        const start = timeToFestivalMinutes(torn.hora_inici);
        let end = timeToFestivalMinutes(torn.hora_fi);
        if (end <= start) end += 24 * 60;
        return {
            torn,
            start,
            end,
            col: 0,
            maxCols: 1
        };
    });

    // 2. Sort by start time, then by longest duration first
    items.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // 3. Find connected overlapping clusters
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    for (const item of items) {
        if (currentCluster.length === 0) {
            currentCluster.push(item);
            clusterEnd = item.end;
        } else {
            if (item.start < clusterEnd) {
                // Overlaps with the current cluster
                currentCluster.push(item);
                clusterEnd = Math.max(clusterEnd, item.end);
            } else {
                // New disconnected cluster
                clusters.push(currentCluster);
                currentCluster = [item];
                clusterEnd = item.end;
            }
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    // 4. For each cluster, greedily assign column indices (lanes)
    for (const cluster of clusters) {
        const lanes = []; // stores end time of the last item in each sub-column lane

        for (const item of cluster) {
            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] <= item.start) {
                    item.col = i;
                    lanes[i] = item.end;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                item.col = lanes.length;
                lanes.push(item.end);
            }
        }

        const totalLanes = lanes.length;
        for (const item of cluster) {
            item.maxCols = totalLanes;
        }
    }

    return items;
}

/**
 * Calcula el resum de necessitats i voluntaris inscrits per a cada tram horari actiu del dia
 */
function computeDayTimeSlotsSummary(torns, assignations) {
    if (!torns || torns.length === 0) return [];

    // 1. Recollir tots els punts límit en minuts del festival
    const pointsSet = new Set();
    torns.forEach(t => {
        const s = timeToFestivalMinutes(t.hora_inici);
        let e = timeToFestivalMinutes(t.hora_fi);
        if (e <= s) e += 1440;
        pointsSet.add(s);
        pointsSet.add(e);
    });

    const sortedPoints = Array.from(pointsSet).sort((a, b) => a - b);
    const rawSlots = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const startMin = sortedPoints[i];
        const endMin = sortedPoints[i + 1];

        // Torns actius durant aquest interval concret
        const activeTorns = torns.filter(t => {
            const s = timeToFestivalMinutes(t.hora_inici);
            let e = timeToFestivalMinutes(t.hora_fi);
            if (e <= s) e += 1440;
            return s <= startMin && e >= endMin;
        });

        if (activeTorns.length > 0) {
            const totalNeeded = activeTorns.reduce((sum, t) => sum + (parseInt(t.necessaris) || 1), 0);
            const totalAssigned = activeTorns.reduce((sum, t) => {
                const count = assignations.filter(a => a.torn_id === t.id).length;
                return sum + count;
            }, 0);
            const deficit = Math.max(0, totalNeeded - totalAssigned);
            const pct = totalNeeded > 0 ? Math.round((totalAssigned / totalNeeded) * 100) : 0;

            const hInici = festivalMinutesToTime(startMin);
            const hFi = festivalMinutesToTime(endMin % 1440);

            rawSlots.push({
                startMin,
                endMin,
                hora_inici: hInici,
                hora_fi: hFi,
                totalNeeded,
                totalAssigned,
                deficit,
                pct,
                tornsCount: activeTorns.length,
                torns: activeTorns
            });
        }
    }

    // Fusionar trams contigus que tenen el mateix nombre de voluntaris necessaris i assignats
    const merged = [];
    rawSlots.forEach(slot => {
        if (merged.length === 0) {
            merged.push({ ...slot });
        } else {
            const prev = merged[merged.length - 1];
            if (prev.endMin === slot.startMin && prev.totalNeeded === slot.totalNeeded && prev.totalAssigned === slot.totalAssigned) {
                prev.endMin = slot.endMin;
                prev.hora_fi = slot.hora_fi;
                prev.torns = Array.from(new Set([...prev.torns, ...slot.torns]));
                prev.tornsCount = prev.torns.length;
            } else {
                merged.push({ ...slot });
            }
        }
    });

    return merged;
}

/**
 * Renderitza la Vista Detallada de la Pantalla 3 per a voluntaris:
 * Mostra ÚNICAMENT les fitxes de torn corresponents a la franja horària seleccionada a la Pantalla 2.
 */
function renderVolunteerSlotDetailedView(container, curDia, dayTorns, visibleEspais) {
    let displayedTorns = dayTorns;
    let slotLabel = "Tots els torns d'aquest dia";

    if (selectedHourSlotIdx !== null && FESTIVAL_HOURS[selectedHourSlotIdx] !== undefined) {
        const hVal = FESTIVAL_HOURS[selectedHourSlotIdx];
        const hNext = (hVal + 1) % 24;
        slotLabel = `${hVal.toString().padStart(2, '0')}:00 – ${hNext.toString().padStart(2, '0')}:00`;
        const hStart = selectedHourSlotIdx * 60;
        const hEnd = (selectedHourSlotIdx + 1) * 60;
        
        displayedTorns = dayTorns.filter(t => {
            const s = timeToFestivalMinutes(t.hora_inici);
            let e = timeToFestivalMinutes(t.hora_fi);
            if (e <= s) e += 1440;
            return s < hEnd && e > hStart;
        });
    }

    // Ordenar cronològicament per hora d'inici i espai
    displayedTorns.sort((a, b) => {
        const diff = timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici);
        if (diff !== 0) return diff;
        return (a.espai_id || '').localeCompare(b.espai_id || '');
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'detailed-slot-wrapper';

    // Banner de la franja seleccionada
    const banner = document.createElement('div');
    banner.className = 'detailed-slot-banner';
    banner.innerHTML = `
        <div class="detailed-slot-banner-left">
            <span class="slot-banner-icon">⏰</span>
            <div>
                <strong class="slot-banner-time">Franja: ${slotLabel}</strong>
                <span class="slot-banner-count">${displayedTorns.length} torn${displayedTorns.length === 1 ? '' : 's'} disponible${displayedTorns.length === 1 ? '' : 's'}</span>
            </div>
        </div>
        <button type="button" class="btn-change-day-slot" onclick="setMobileScreen(2)">
            <span>⬅️ Triar un altre dia / franja</span>
        </button>
    `;
    wrapper.appendChild(banner);

    if (displayedTorns.length === 0) {
        const emptyBox = document.createElement('div');
        emptyBox.className = 'user-summary-empty';
        emptyBox.style.cssText = 'padding: 2.5rem 1.5rem; text-align: center; margin: 1.5rem 0;';
        emptyBox.innerHTML = `
            <span style="font-size: 2.5rem; display: block; margin-bottom: 0.8rem;">🏖️</span>
            <p style="font-size: 1.15rem; font-weight: 700; color: white;">Sense torns en aquesta franja</p>
            <p style="font-size: 0.88rem; color: #94a3b8; margin: 0.5rem 0 1.2rem;">No s'ha trobat cap torn actiu per a la franja horària seleccionada.</p>
            <button type="button" class="btn-primary" onclick="setMobileScreen(2)">⬅️ Triar una altra franja a la Pantalla 2</button>
        `;
        wrapper.appendChild(emptyBox);
    } else {
        const grid = document.createElement('div');
        grid.className = 'detailed-slot-cards-grid';

        displayedTorns.forEach(torn => {
            const espai = allEspais.find(e => e.id === torn.espai_id);
            const card = renderShiftCard(torn, espai);
            // En vista de franja aïllada, les targetes no tenen posició absoluta
            card.style.position = 'relative';
            card.style.top = 'auto';
            card.style.left = 'auto';
            card.style.right = 'auto';
            card.style.width = '100%';
            card.style.height = 'auto';
            card.style.minHeight = 'auto';
            grid.appendChild(card);
        });

        wrapper.appendChild(grid);
    }

    // Botons inferiors de navegació
    const bottomNav = document.createElement('div');
    bottomNav.className = 'screen-nav-bottom-bar';
    bottomNav.style.marginTop = '1.5rem';
    bottomNav.innerHTML = `
        <button type="button" class="btn-secondary" onclick="setMobileScreen(2)">
            ◀ Enrere a Franges (Pantalla 2)
        </button>
        <button type="button" class="btn-primary" onclick="setMobileScreen(4)">
            El meu Resum (Pantalla 4) ❯
        </button>
    `;
    wrapper.appendChild(bottomNav);

    container.appendChild(wrapper);
}

function renderAll() {
    renderDaySelector();

    const container = document.getElementById('timeline-container');
    if (!container) return;
    container.innerHTML = '';

    if (currentViewMode === 'global') {
        container.classList.add('view-global');
        container.classList.remove('view-detailed');
    } else {
        container.classList.add('view-detailed');
        container.classList.remove('view-global');
    }

    const curDia = getCurrentDiaObj();
    currentDay = curDia.nom;
    currentDayKey = getDiaKey(curDia);

    // 1. Filtrar espais visibles: en mode usuari, amagar els espais que no tenen torns aquest dia
    let visibleEspais = allEspais;
    if (!isAdmin) {
        visibleEspais = allEspais.filter(espai =>
            allTorns.some(t => isTornInDia(t, curDia) && t.espai_id === espai.id)
        );
    }

    if (allEspais.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Encara no hi ha cap espai creat.</p>
                ${isAdmin ? '<button class="btn-primary" onclick="openEspaisModal()">+ Crear el primer espai</button>' : ''}
            </div>
        `;
        return;
    }

    if (!isAdmin && visibleEspais.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                <span style="font-size: 2.5rem; display: block; margin-bottom: 0.8rem;">🏖️</span>
                <p style="font-size: 1.15rem; font-weight: 600; color: white; margin-bottom: 0.4rem;">Sense torns actius</p>
                <p style="font-size: 0.9rem;">No hi ha cap torn de voluntariat programat per a <strong>${getDiaDisplayName(curDia)}</strong>.</p>
            </div>
        `;
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const normalHourHeight = currentViewMode === 'global' ? (isMobile ? 135 : 140) : (isMobile ? 145 : 160);
    const inactiveHourHeight = isMobile ? 28 : 34;
    document.documentElement.style.setProperty('--hour-height', `${normalHourHeight}px`);

    // 2. Torns del dia per als espais visibles
    const dayTorns = allTorns.filter(t => isTornInDia(t, curDia) && visibleEspais.some(e => e.id === t.espai_id));

    // =========================================================================
    // VISTA DETALLADA PER A VOLUNTARIS: NOMÉS MOSTRAR ELS TORNS DE LA FRANJA
    // =========================================================================
    if (!isAdmin && currentViewMode === 'detailed') {
        renderVolunteerSlotDetailedView(container, curDia, dayTorns, visibleEspais);
        renderUserSummary();
        return;
    }

    // 3. Determinar el rang d'hores visibles (Retall d'hores a l'inici i al final en mode usuari)
    let minHourIdx = 0;
    let maxHourIdx = FESTIVAL_HOURS.length - 1; // 23

    if (!isAdmin && dayTorns.length > 0) {
        const startMins = dayTorns.map(t => timeToFestivalMinutes(t.hora_inici));
        const endMins = dayTorns.map(t => {
            let e = timeToFestivalMinutes(t.hora_fi);
            if (e <= timeToFestivalMinutes(t.hora_inici)) e += 1440;
            return e;
        });

        const earliestMin = Math.min(...startMins);
        const latestMin = Math.max(...endMins);

        minHourIdx = Math.max(0, Math.floor(earliestMin / 60));
        maxHourIdx = Math.min(FESTIVAL_HOURS.length - 1, Math.floor((latestMin - 1) / 60));
    }

    const visibleHourIndices = [];
    for (let k = minHourIdx; k <= maxHourIdx; k++) {
        visibleHourIndices.push(k);
    }

    // 4. Identificar hores actives vs hores intermitges inactives
    const activeHourMap = {};
    visibleHourIndices.forEach(k => {
        const hStart = k * 60;
        const hEnd = (k + 1) * 60;
        const isActive = dayTorns.some(t => {
            const s = timeToFestivalMinutes(t.hora_inici);
            let e = timeToFestivalMinutes(t.hora_fi);
            if (e <= s) e += 1440;
            return s < hEnd && e > hStart;
        });
        activeHourMap[k] = isActive;
    });

    // 5. Mapeig d'alçades i coordenades Y
    const hourHeights = {};
    const hourTops = {};
    let currentCumulativeY = 0;

    visibleHourIndices.forEach(k => {
        const isInactive = !isAdmin && !activeHourMap[k];
        const h = isInactive ? inactiveHourHeight : normalHourHeight;
        hourHeights[k] = h;
        hourTops[k] = currentCumulativeY;
        currentCumulativeY += h;
    });

    const totalTimelineHeight = currentCumulativeY;

    function getTimelineY(festMin) {
        if (visibleHourIndices.length === 0) return 0;
        const hourIdx = Math.floor(festMin / 60);
        const minWithin = festMin - (hourIdx * 60);

        if (hourIdx < visibleHourIndices[0]) return 0;
        if (hourIdx > visibleHourIndices[visibleHourIndices.length - 1]) return totalTimelineHeight;

        const top = hourTops[hourIdx] !== undefined ? hourTops[hourIdx] : 0;
        const h = hourHeights[hourIdx] !== undefined ? hourHeights[hourIdx] : normalHourHeight;
        return top + (minWithin / 60) * h;
    }

    const schedule = document.createElement('div');
    schedule.className = 'timeline-schedule';

    // 6. Capçalera superior fixa (Header Row)
    const headerRow = document.createElement('div');
    headerRow.className = 'timeline-header-row';

    const timeCorner = document.createElement('div');
    timeCorner.className = 'timeline-time-corner';
    timeCorner.textContent = 'HORARI';
    headerRow.appendChild(timeCorner);

    const spacesHeaders = document.createElement('div');
    spacesHeaders.className = 'timeline-spaces-headers';

    visibleEspais.forEach((espai, index) => {
        const espaiTorns = allTorns.filter(t => isTornInDia(t, curDia) && t.espai_id === espai.id);
        const isFirst = index === 0;
        const isLast = index === visibleEspais.length - 1;
        const th = document.createElement('div');
        th.className = 'space-col-header';
        th.innerHTML = `
            <div class="space-col-header-content">
                <div class="space-title-row">
                    <span class="space-title" title="${espai.nom}">${espai.nom}</span>
                    ${isAdmin ? `<button class="btn-edit-title" title="Canviar nom de l'espai" onclick="promptEditEspaiName('${espai.id}')">✏️</button>` : ''}
                    <span class="space-badge">${espaiTorns.length} torn${espaiTorns.length === 1 ? '' : 's'}</span>
                </div>
                ${isAdmin ? `
                    <div class="space-actions-row">
                        <div class="space-header-reorder">
                            <button class="btn-icon-order" title="Moure espai a l'esquerra" onclick="moveEspaiOrder('${espai.id}', -1)" ${isFirst ? 'disabled' : ''}>◀</button>
                            <button class="btn-icon-order" title="Moure espai a la dreta" onclick="moveEspaiOrder('${espai.id}', 1)" ${isLast ? 'disabled' : ''}>▶</button>
                        </div>
                        <button class="btn-add-torn-col" onclick="openTornModal(null, '${espai.id}')" title="Crear torn a ${espai.nom}">+ Torn</button>
                    </div>
                ` : ''}
            </div>
        `;
        spacesHeaders.appendChild(th);
    });

    // Columna de Resum Total de Voluntaris per tram horari (Mode Administrador)
    if (isAdmin) {
        const totalDayNeeded = dayTorns.reduce((sum, t) => sum + (parseInt(t.necessaris) || 1), 0);
        const totalDayInscrits = dayTorns.reduce((sum, t) => {
            return sum + allAssignacions.filter(a => a.torn_id === t.id).length;
        }, 0);
        const totalFalten = Math.max(0, totalDayNeeded - totalDayInscrits);

        const summaryTh = document.createElement('div');
        summaryTh.className = 'summary-col-header';
        summaryTh.innerHTML = `
            <div class="space-col-header-content">
                <div class="space-title-row">
                    <span class="space-title">👥 Total Voluntaris</span>
                    <span class="summary-badge-total">${totalDayInscrits}/${totalDayNeeded}</span>
                </div>
                <div class="space-actions-row">
                    <span style="font-size: 0.72rem; color: ${totalDayNeeded === 0 ? '#94a3b8' : (totalFalten === 0 ? '#4ade80' : '#f87171')}; font-weight: 700;">
                        ${totalDayNeeded === 0 ? '🏖️ Sense torns' : (totalFalten === 0 ? '✓ 100% Cobert' : `⚠️ Falten ${totalFalten} voluntaris`)}
                    </span>
                </div>
            </div>
        `;
        spacesHeaders.appendChild(summaryTh);
    }

    headerRow.appendChild(spacesHeaders);
    schedule.appendChild(headerRow);

    // 7. Cos del calendari: Eix d'hores + Pistes per espai
    const bodyRow = document.createElement('div');
    bodyRow.className = 'timeline-body-row';

    // Eix d'hores (Esquerra)
    const timeAxis = document.createElement('div');
    timeAxis.className = 'timeline-time-axis';

    visibleHourIndices.forEach(k => {
        const hVal = FESTIVAL_HOURS[k];
        const isInactive = !isAdmin && !activeHourMap[k];
        const marker = document.createElement('div');
        marker.className = 'time-marker' + (isInactive ? ' hour-inactive' : '');
        marker.style.height = `${hourHeights[k]}px`;
        marker.innerHTML = `<span class="time-label">${hVal.toString().padStart(2, '0')}:00</span>`;
        timeAxis.appendChild(marker);
    });
    bodyRow.appendChild(timeAxis);

    // Pistes de cada espai
    const spacesTracks = document.createElement('div');
    spacesTracks.className = 'timeline-spaces-tracks';

    visibleEspais.forEach(espai => {
        const espaiTorns = allTorns
            .filter(t => isTornInDia(t, curDia) && t.espai_id === espai.id)
            .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

        const track = document.createElement('div');
        track.className = 'space-track';
        track.style.height = `${totalTimelineHeight}px`;

        // Línies de graella de fons per hora
        const gridLines = document.createElement('div');
        gridLines.className = 'track-grid-lines';

        visibleHourIndices.forEach(k => {
            const hVal = FESTIVAL_HOURS[k];
            const isInactive = !isAdmin && !activeHourMap[k];
            const cell = document.createElement('div');
            cell.className = 'track-hour-cell' + (isInactive ? ' hour-inactive' : '');
            cell.style.height = `${hourHeights[k]}px`;
            if (isAdmin) {
                cell.title = `Fes clic per crear un torn a les ${hVal.toString().padStart(2, '0')}:00 a ${espai.nom}`;
                cell.onclick = (ev) => handleTrackHourClick(ev, espai.id, hVal);
            }
            gridLines.appendChild(cell);
        });
        track.appendChild(gridLines);

        // Capa de torns posicionats en el temps
        const shiftsLayer = document.createElement('div');
        shiftsLayer.className = 'track-shifts-layer';

        const layoutItems = computeTrackLayout(espaiTorns);

        layoutItems.forEach(item => {
            const torn = item.torn;
            const card = renderShiftCard(torn, espai);

            const festStart = item.start;
            const festEnd = item.end;

            const topPx = getTimelineY(festStart);
            const bottomPx = getTimelineY(festEnd);
            const minH = currentViewMode === 'global' ? (isMobile ? 115 : 120) : (isMobile ? 95 : 110);
            const heightPx = Math.max(minH, bottomPx - topPx - 4);

            card.style.top = `${topPx}px`;
            card.style.height = `${heightPx}px`;

            if (item.maxCols > 1) {
                const colWidthPct = 100 / item.maxCols;
                card.style.width = `calc(${colWidthPct}% - 6px)`;
                card.style.left = `calc(${item.col * colWidthPct}% + 3px)`;
            } else {
                card.style.left = '4px';
                card.style.right = '4px';
                card.style.width = 'auto';
            }

            shiftsLayer.appendChild(card);
        });

        track.appendChild(shiftsLayer);
        spacesTracks.appendChild(track);
    });

    // Pista de Resum Total de Voluntaris (Mode Administrador)
    if (isAdmin) {
        const summaryTrack = document.createElement('div');
        summaryTrack.className = 'summary-track';
        summaryTrack.style.height = `${totalTimelineHeight}px`;

        // Línies de graella de fons per hora
        const gridLines = document.createElement('div');
        gridLines.className = 'track-grid-lines';

        visibleHourIndices.forEach(k => {
            const cell = document.createElement('div');
            cell.className = 'track-hour-cell';
            cell.style.height = `${hourHeights[k]}px`;

            const hStart = k * 60;
            const hEnd = (k + 1) * 60;
            const hourTorns = dayTorns.filter(t => {
                const s = timeToFestivalMinutes(t.hora_inici);
                let e = timeToFestivalMinutes(t.hora_fi);
                if (e <= s) e += 1440;
                return s < hEnd && e > hStart;
            });

            if (hourTorns.length === 0) {
                cell.innerHTML = `<div class="summary-empty-cell">— 0 vols</div>`;
            }

            gridLines.appendChild(cell);
        });
        summaryTrack.appendChild(gridLines);

        // Capa de fitxes de resum per tram
        const summaryLayer = document.createElement('div');
        summaryLayer.className = 'track-shifts-layer';

        if (dayTorns.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'position: absolute; top: 20px; left: 10px; right: 10px; padding: 1.2rem; background: rgba(30, 41, 59, 0.85); border: 1px dashed rgba(255, 255, 255, 0.2); border-radius: 10px; text-align: center; color: var(--text-muted); font-size: 0.85rem;';
            emptyMsg.innerHTML = `
                <span style="font-size: 1.6rem; display: block; margin-bottom: 0.4rem;">🏖️</span>
                <strong style="color: white; font-size: 0.95rem; display: block;">Sense torns programats</strong>
                <span style="font-size: 0.78rem; color: #94a3b8; display: block; margin-top: 0.3rem;">No hi ha cap torn de voluntariat per a aquest dia.</span>
            `;
            summaryLayer.appendChild(emptyMsg);
        } else {
            // Renderitzar cada hora activa amb la seva targeta de resum
            visibleHourIndices.forEach(k => {
                const hStart = k * 60;
                const hEnd = (k + 1) * 60;
                const hVal = FESTIVAL_HOURS[k];
                const hNext = (hVal + 1) % 24;
                const timeLabel = `${hVal.toString().padStart(2, '0')}:00 – ${hNext.toString().padStart(2, '0')}:00`;

                const hourTorns = dayTorns.filter(t => {
                    const s = timeToFestivalMinutes(t.hora_inici);
                    let e = timeToFestivalMinutes(t.hora_fi);
                    if (e <= s) e += 1440;
                    return s < hEnd && e > hStart;
                });

                if (hourTorns.length === 0) return;

                const totalNeeded = hourTorns.reduce((sum, t) => sum + (parseInt(t.necessaris) || 1), 0);
                const totalAssigned = hourTorns.reduce((sum, t) => {
                    return sum + allAssignacions.filter(a => a.torn_id === t.id).length;
                }, 0);
                const deficit = Math.max(0, totalNeeded - totalAssigned);
                const pct = totalNeeded > 0 ? Math.round((totalAssigned / totalNeeded) * 100) : 0;

                const topPx = hourTops[k];
                const heightPx = Math.max(currentViewMode === 'global' ? 36 : 54, hourHeights[k] - 6);

                let statusClass = 'status-empty';
                let badgeText = `🚨 Falten ${totalNeeded} (0/${totalNeeded})`;
                if (totalAssigned >= totalNeeded) {
                    statusClass = 'status-full';
                    badgeText = `✓ ${totalAssigned}/${totalNeeded}`;
                } else if (totalAssigned > 0) {
                    statusClass = 'status-partial';
                    badgeText = `⚠️ Falten ${deficit} (${totalAssigned}/${totalNeeded})`;
                }

                const card = document.createElement('div');
                card.className = `summary-slot-card ${statusClass}`;
                card.style.top = `${topPx}px`;
                card.style.height = `${heightPx}px`;

                // Obtenir espais actius en aquest tram
                const activeEspaisMap = {};
                hourTorns.forEach(t => {
                    const espai = allEspais.find(e => e.id === t.espai_id);
                    const espaiNom = espai ? espai.nom : 'Espai';
                    const count = allAssignacions.filter(a => a.torn_id === t.id).length;
                    if (!activeEspaisMap[espaiNom]) {
                        activeEspaisMap[espaiNom] = { needed: 0, assigned: 0 };
                    }
                    activeEspaisMap[espaiNom].needed += (parseInt(t.necessaris) || 1);
                    activeEspaisMap[espaiNom].assigned += count;
                });

                const chipsHtml = Object.entries(activeEspaisMap).map(([nom, st]) => {
                    return `<span class="summary-space-chip">${nom}: ${st.assigned}/${st.needed}</span>`;
                }).join('');

                card.innerHTML = `
                    <div class="summary-card-header">
                        <span class="summary-card-time">⏰ ${timeLabel}</span>
                        <span class="summary-card-badge">${badgeText}</span>
                    </div>
                    ${currentViewMode !== 'global' ? `
                        <div class="summary-card-detail">
                            <span>${hourTorns.length} torn${hourTorns.length === 1 ? '' : 's'} actiu${hourTorns.length === 1 ? '' : 's'}</span>
                            <span>${pct}% cobert</span>
                        </div>
                        <div class="summary-spaces-chips">${chipsHtml}</div>
                    ` : ''}
                `;

                summaryLayer.appendChild(card);
            });
        }

        summaryTrack.appendChild(summaryLayer);
        spacesTracks.appendChild(summaryTrack);
    }

    bodyRow.appendChild(spacesTracks);
    schedule.appendChild(bodyRow);
    container.appendChild(schedule);

    // Actualitzar resum inferior del voluntari
    renderUserSummary();
}

window.handleTrackHourClick = function(e, espaiId, startHour) {
    if (!isAdmin) return;
    if (e.target.closest('.shift-card')) return;

    const hInici = `${startHour.toString().padStart(2, '0')}:00`;
    const nextHour = (startHour + 1) % 24;
    const hFi = `${nextHour.toString().padStart(2, '0')}:00`;

    openTornModal(null, espaiId, hInici, hFi);
};

function renderShiftCard(torn, espai) {
    const card = document.createElement('div');
    card.className = 'shift-card';

    const assignats = allAssignacions.filter(a => a.torn_id === torn.id);
    const isMeIn = currentVoluntari && assignats.some(a => a.voluntari_id === currentVoluntari.id);
    const placesLeft = Math.max(0, torn.necessaris - assignats.length);
    const isFull = placesLeft === 0;

    if (isMeIn) card.classList.add('my-shift');
    if (isFull) card.classList.add('shift-full');

    const durationStr = calculateDuration(torn.hora_inici, torn.hora_fi);

    // Tooltip complet
    const llocFull = (torn.lloc && torn.lloc.trim()) ? torn.lloc.trim() : (espai ? espai.nom : 'Sense lloc');
    const tooltipText = `Horari: ${torn.hora_inici} – ${torn.hora_fi} (${durationStr})\nTasca: ${torn.tasca || 'Sense tasca'}\nLloc: ${llocFull}\nPlaces: ${assignats.length}/${torn.necessaris}`;
    card.title = tooltipText;

    if (currentViewMode === 'global') {
        // ==========================================
        // VISTA GLOBAL / CALENDARI (PANORÀMICA)
        // ==========================================
        card.classList.add('shift-card-global');

        // 1. Horari compacte
        const timeRow = document.createElement('div');
        timeRow.className = 'shift-time-row';
        timeRow.innerHTML = `
            <div class="shift-time">
                <span>⏰ ${torn.hora_inici}–${torn.hora_fi}</span>
            </div>
            <div class="shift-duration">${durationStr}</div>
        `;
        card.appendChild(timeRow);

        // 2. Tasca concreta destacada (Vista Global)
        if (torn.tasca && torn.tasca.trim()) {
            const taskEl = document.createElement('div');
            taskEl.className = 'shift-task-global';
            taskEl.title = `Tasca: ${torn.tasca.trim()}`;
            taskEl.innerHTML = `<span class="shift-task-icon">🎯</span> <span class="shift-task-text">${torn.tasca.trim()}</span>`;
            card.appendChild(taskEl);
        }

        // 3. Lloc específic / punt de trobada (sempre visible: lloc concret o espai)
        const llocText = (torn.lloc && torn.lloc.trim()) ? torn.lloc.trim() : (espai ? espai.nom : '');
        if (llocText) {
            const locEl = document.createElement('div');
            locEl.className = 'shift-location-global';
            locEl.title = `Lloc: ${llocText}`;
            locEl.innerHTML = `<span class="shift-location-icon">📍</span> <span class="shift-location-text">${llocText}</span>`;
            card.appendChild(locEl);
        }

        // 4. Fila d'estat de places
        const statusRow = document.createElement('div');
        statusRow.className = 'shift-status-row';

        let badgeClass = 'status-free';
        let badgeText = `${assignats.length}/${torn.necessaris} places`;

        if (isMeIn) {
            badgeClass = 'status-me';
            badgeText = `✓ Inscrit/a (${assignats.length}/${torn.necessaris})`;
        } else if (isFull) {
            badgeClass = 'status-full';
            badgeText = `Complet (${assignats.length}/${torn.necessaris})`;
        } else {
            badgeText = `${placesLeft} lliure${placesLeft === 1 ? '' : 's'} (${assignats.length}/${torn.necessaris})`;
        }

        statusRow.innerHTML = `<span class="places-badge ${badgeClass}">${badgeText}</span>`;
        card.appendChild(statusRow);

        // 5. Botó d'apuntar-se / desapuntar-se per als voluntaris
        if (currentVoluntari && !isAdmin) {
            const actionsBox = document.createElement('div');
            actionsBox.className = 'shift-actions';

            if (isMeIn) {
                const btnWithdraw = document.createElement('button');
                btnWithdraw.className = 'btn-withdraw';
                btnWithdraw.textContent = '✕ Desapuntar-me';
                btnWithdraw.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
                actionsBox.appendChild(btnWithdraw);
            } else if (!isFull) {
                const btnSignup = document.createElement('button');
                btnSignup.className = 'btn-signup';
                btnSignup.textContent = 'Apuntar-m\'hi';
                btnSignup.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
                actionsBox.appendChild(btnSignup);
            }

            if (actionsBox.children.length > 0) {
                card.appendChild(actionsBox);
            }
        }

        // 6. Botons admin
        if (isAdmin) {
            const adminBar = document.createElement('div');
            adminBar.className = 'admin-card-bar';
            adminBar.innerHTML = `
                <button class="btn-icon-admin" title="Editar torn" onclick="openTornModal('${torn.id}')">✏️</button>
                <button class="btn-icon-admin delete" title="Eliminar torn" onclick="quickDeleteTorn('${torn.id}')">🗑️</button>
            `;
            card.appendChild(adminBar);
        }

        return card;
    }

    // ==========================================
    // VISTA DETALLADA
    // ==========================================
    // 0. Espai / Àrea
    if (espai) {
        const spaceRow = document.createElement('div');
        spaceRow.className = 'shift-space-badge';
        spaceRow.innerHTML = `<span>🏢</span> <strong>${espai.nom}</strong>`;
        card.appendChild(spaceRow);
    }

    // 1. Fila d'hora i durada
    const timeRow = document.createElement('div');
    timeRow.className = 'shift-time-row';
    timeRow.innerHTML = `
        <div class="shift-time">
            <span>⏰ ${torn.hora_inici} – ${torn.hora_fi}</span>
        </div>
        <div class="shift-duration">${durationStr}</div>
    `;
    card.appendChild(timeRow);

    // 2. Tasca concreta destacada
    if (torn.tasca && torn.tasca.trim()) {
        const taskEl = document.createElement('div');
        taskEl.className = 'shift-task-box';
        taskEl.innerHTML = `
            <span class="shift-task-icon">🎯</span>
            <div class="shift-task-content">
                <span class="shift-task-title">${torn.tasca.trim()}</span>
            </div>
        `;
        card.appendChild(taskEl);
    }

    // 3. Lloc específic / punt de trobada
    const llocTextDet = (torn.lloc && torn.lloc.trim()) ? torn.lloc.trim() : (espai ? espai.nom : '');
    if (llocTextDet) {
        const locEl = document.createElement('div');
        locEl.className = 'shift-location';
        locEl.title = `Lloc: ${llocTextDet}`;
        locEl.innerHTML = `<span class="shift-location-icon">📍</span> <span>${llocTextDet}</span>`;
        card.appendChild(locEl);
    }

    // 4. Llista de voluntaris assignats
    if (assignats.length > 0) {
        const volsList = document.createElement('div');
        volsList.className = 'shift-vols-list';
        assignats.forEach(a => {
            const vol = allVoluntaris.find(v => v.id === a.voluntari_id);
            if (vol) {
                const tag = document.createElement('span');
                tag.className = 'vol-tag' + (currentVoluntari && vol.id === currentVoluntari.id ? ' me' : '');
                tag.textContent = `${vol.nom} ${vol.cognom.charAt(0)}.`;
                volsList.appendChild(tag);
            }
        });
        card.appendChild(volsList);
    }

    // 5. Fila d'estat de places
    const statusRow = document.createElement('div');
    statusRow.className = 'shift-status-row';

    let badgeClass = 'status-free';
    let badgeText = `${placesLeft} lliure${placesLeft === 1 ? '' : 's'} (${assignats.length}/${torn.necessaris})`;

    if (isMeIn) {
        badgeClass = 'status-me';
        badgeText = `✓ Inscrit/a (${assignats.length}/${torn.necessaris})`;
    } else if (isFull) {
        badgeClass = 'status-full';
        badgeText = `Complet (${assignats.length}/${torn.necessaris})`;
    }

    statusRow.innerHTML = `<span class="places-badge ${badgeClass}">${badgeText}</span>`;
    card.appendChild(statusRow);

    // 6. Botó d'apuntar-se / desapuntar-se per als voluntaris
    if (currentVoluntari && !isAdmin) {
        const actionsBox = document.createElement('div');
        actionsBox.className = 'shift-actions';

        if (isMeIn) {
            const btnWithdraw = document.createElement('button');
            btnWithdraw.className = 'btn-withdraw';
            btnWithdraw.textContent = '✕ Desapuntar-me';
            btnWithdraw.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
            actionsBox.appendChild(btnWithdraw);
        } else if (!isFull) {
            const btnSignup = document.createElement('button');
            btnSignup.className = 'btn-signup';
            btnSignup.textContent = 'Apuntar-m\'hi';
            btnSignup.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
            actionsBox.appendChild(btnSignup);
        }

        if (actionsBox.children.length > 0) {
            card.appendChild(actionsBox);
        }
    }

    // 7. Botons d'administració (Editar, Duplicar, Eliminar)
    if (isAdmin) {
        const adminBar = document.createElement('div');
        adminBar.className = 'admin-card-bar';
        adminBar.innerHTML = `
            <button class="btn-icon-admin" title="Dividir en trams horaris" onclick="openDividirTornModal('${torn.id}')">✂️</button>
            <button class="btn-icon-admin" title="Editar torn" onclick="openTornModal('${torn.id}')">✏️</button>
            <button class="btn-icon-admin" title="Duplicar torn" onclick="quickDuplicateTorn('${torn.id}')">📋</button>
            <button class="btn-icon-admin delete" title="Eliminar torn" onclick="quickDeleteTorn('${torn.id}')">🗑️</button>
        `;
        card.appendChild(adminBar);
    }

    return card;
}

// ==========================================
// 7. COMPROVACIÓ DE SOLAPAMENTS I INSCRIPCIÓ
// ==========================================
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * 60 + minutes;
}

/**
 * Converteix una hora (HH:MM) a minuts dins de la lògica del festival:
 * De 06:00 a 23:59 van primer (minuts relatius 0 .. 1079).
 * De 00:00 a 05:59 van després (minuts relatius 1080 .. 1439).
 */
function timeToFestivalMinutes(timeStr) {
    const rawMinutes = timeToMinutes(timeStr);
    return ((rawMinutes - 360) % 1440 + 1440) % 1440;
}

function festivalMinutesToTime(festMins) {
    const rawMins = ((festMins + 360) % 1440 + 1440) % 1440;
    const h = Math.floor(rawMins / 60).toString().padStart(2, '0');
    const m = (rawMins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function calculateDuration(iniciStr, fiStr) {
    let startMin = timeToFestivalMinutes(iniciStr);
    let endMin = timeToFestivalMinutes(fiStr);

    // Si el torn acaba passada la durada relativa (ex: creua el límit de 24h)
    if (endMin <= startMin) {
        endMin += 24 * 60;
    }

    const diffMin = endMin - startMin;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    if (hours > 0 && mins > 0) {
        return `${hours}h ${mins}m`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${mins}m`;
    }
}

/**
 * Comprova si el voluntari ja té un torn assignat al mateix dia que se solapi en el temps
 */
function checkVolunteerOverlap(voluntariId, targetTorn) {
    // 1. Obtenir tots els torns on ja està apuntat aquest voluntari
    const myAssignations = allAssignacions.filter(a => a.voluntari_id === voluntariId);
    const myTornIds = myAssignations.map(a => a.torn_id);
    
    // Torns del mateix dia on està apuntat (excloent el mateix torn si ja hi fos)
    const mySameDayTorns = allTorns.filter(t => t.dia === targetTorn.dia && myTornIds.includes(t.id) && t.id !== targetTorn.id);

    let targetStart = timeToFestivalMinutes(targetTorn.hora_inici);
    let targetEnd = timeToFestivalMinutes(targetTorn.hora_fi);
    if (targetEnd <= targetStart) targetEnd += 24 * 60;

    for (const otherTorn of mySameDayTorns) {
        let otherStart = timeToFestivalMinutes(otherTorn.hora_inici);
        let otherEnd = timeToFestivalMinutes(otherTorn.hora_fi);
        if (otherEnd <= otherStart) otherEnd += 24 * 60;

        // Condició de solapament temporal: (StartA < EndB) && (EndA > StartB)
        const isOverlapping = (targetStart < otherEnd) && (targetEnd > otherStart);

        if (isOverlapping) {
            const otherEspai = allEspais.find(e => e.id === otherTorn.espai_id);
            return {
                overlap: true,
                conflictingTorn: otherTorn,
                conflictingEspai: otherEspai ? otherEspai.nom : 'un altre espai'
            };
        }
    }

    return { overlap: false };
}

async function handleToggleAssignacio(torn, isMeIn, placesLeft) {
    if (!currentVoluntari) {
        alert("Si us plau, identifica't o registra't a dalt per apuntar-te.");
        return;
    }

    if (isMeIn) {
        // Desapuntar-se
        const { error } = await supabaseClient
            .from('vol_assignacions')
            .delete()
            .match({ torn_id: torn.id, voluntari_id: currentVoluntari.id });

        if (error) {
            alert("Error en desapuntar-se: " + error.message);
        }
    } else {
        // Apuntar-se: comprovar places
        if (placesLeft <= 0) {
            alert("Aquest torn ja està complet!");
            return;
        }

        // Comprovar solapaments d'horaris amb altres espais/tasques
        const overlapResult = checkVolunteerOverlap(currentVoluntari.id, torn);
        if (overlapResult.overlap) {
            const confTorn = overlapResult.conflictingTorn;
            alert(
                `⚠️ No et pots apuntar a aquest torn perquè coincideix en horari amb un altre torn on ja estàs inscrit/a:\n\n` +
                `• Espai: ${overlapResult.conflictingEspai}\n` +
                `• Horari: ${confTorn.hora_inici} – ${confTorn.hora_fi}\n` +
                `• Tasca: ${confTorn.tasca || 'Sense especificar'}\n\n` +
                `Si vols fer aquest nou torn, desapunta't primer de l'altre.`
            );
            return;
        }

        const insertPayload = {
            torn_id: torn.id,
            voluntari_id: currentVoluntari.id,
            dia: torn.dia,
            espai_id: torn.espai_id,
            hora: parseInt(torn.hora_inici) || 0
        };

        const { error } = await supabaseClient
            .from('vol_assignacions')
            .insert(insertPayload);

        if (error) {
            if (error.code === '23505') {
                alert("Ja estàs apuntat/da a aquest torn.");
            } else {
                alert("Error en apuntar-se: " + error.message);
            }
        } else {
            // Èxit en la inscripció!
            await fetchData();
            renderAll();
            showSignupNextStepModal(torn);
            return;
        }
    }

    await fetchData();
    renderAll();
}

window.showSignupNextStepModal = function(torn) {
    const modal = document.getElementById('modal-signup-next');
    if (!modal) return;

    const espai = allEspais.find(e => e.id === torn.espai_id);
    const diaIso = getDiaIso(torn);
    const diaInfo = parseIsoToCatalan(diaIso);
    const llocText = (torn.lloc && torn.lloc.trim()) ? torn.lloc.trim() : (espai ? espai.nom : '');

    const detailsEl = document.getElementById('signup-next-details');
    if (detailsEl) {
        detailsEl.innerHTML = `
            <div style="font-weight: 700; color: #38bdf8; font-size: 0.95rem; margin-bottom: 0.35rem;">🎯 ${torn.tasca || (espai ? espai.nom : 'Torn de voluntariat')}</div>
            <div style="margin-bottom: 0.2rem;">🗓️ <strong>${diaInfo.nom}, ${diaInfo.data}</strong></div>
            <div style="margin-bottom: 0.2rem;">⏰ <strong>${torn.hora_inici} – ${torn.hora_fi}</strong></div>
            <div>📍 <strong>${llocText || (espai ? espai.nom : 'Espai')}</strong></div>
        `;
    }

    modal.style.display = 'flex';
};

window.handleSignupNextMore = function() {
    const modal = document.getElementById('modal-signup-next');
    if (modal) modal.style.display = 'none';
    setMobileScreen(2);
};

window.handleSignupNextSummary = function() {
    const modal = document.getElementById('modal-signup-next');
    if (modal) modal.style.display = 'none';
    setMobileScreen(4);
};

// ==========================================
// 8. GESTIÓ DE TORNS PER A L'ADMIN (MODAL)
// ==========================================
function openTornModal(tornId = null, defaultEspaiId = null, defaultHInici = null, defaultHFi = null) {
    const modal = document.getElementById('modal-torn');
    const title = document.getElementById('modal-torn-title');
    const err = document.getElementById('torn-form-error');
    err.style.display = 'none';

    populateEspaisSelectInModal();
    populateDaysSelectInModal();

    const editIdInput = document.getElementById('torn-edit-id');
    const btnDelete = document.getElementById('btn-delete-torn');
    const btnDuplicate = document.getElementById('btn-duplicate-torn');
    const btnSplit = document.getElementById('btn-split-from-edit');
    const curDia = getCurrentDiaObj();

    if (tornId) {
        // Mode edició
        const torn = allTorns.find(t => t.id === tornId);
        if (!torn) return;

        title.textContent = "Editar Torn de Voluntariat";
        editIdInput.value = torn.id;
        const matchingDia = allDies.find(d => isTornInDia(torn, d));
        document.getElementById('torn-dia').value = matchingDia ? getDiaKey(matchingDia) : (torn.dia || getDiaKey(curDia));
        document.getElementById('torn-espai-id').value = torn.espai_id;
        document.getElementById('torn-hora-inici').value = torn.hora_inici;
        document.getElementById('torn-hora-fi').value = torn.hora_fi;
        document.getElementById('torn-tasca').value = torn.tasca || '';
        document.getElementById('torn-lloc').value = torn.lloc || '';
        document.getElementById('torn-necessaris').value = torn.necessaris || 1;

        btnDelete.style.display = 'block';
        btnDuplicate.style.display = 'block';
        if (btnSplit) btnSplit.style.display = 'block';
    } else {
        // Mode creació
        title.textContent = "Nou Torn de Voluntariat";
        editIdInput.value = '';
        document.getElementById('torn-dia').value = getDiaKey(curDia);
        if (defaultEspaiId) {
            document.getElementById('torn-espai-id').value = defaultEspaiId;
        }
        document.getElementById('torn-hora-inici').value = defaultHInici || '17:00';
        document.getElementById('torn-hora-fi').value = defaultHFi || '18:30';
        document.getElementById('torn-tasca').value = '';
        document.getElementById('torn-lloc').value = '';
        document.getElementById('torn-necessaris').value = 2;

        btnDelete.style.display = 'none';
        btnDuplicate.style.display = 'none';
        if (btnSplit) btnSplit.style.display = 'none';
    }

    modal.style.display = 'flex';
}

function closeTornModal() {
    document.getElementById('modal-torn').style.display = 'none';
}

async function handleSaveTorn() {
    const editId = document.getElementById('torn-edit-id').value;
    const rawDiaKey = document.getElementById('torn-dia').value;
    const espai_id = document.getElementById('torn-espai-id').value;
    const hora_inici = document.getElementById('torn-hora-inici').value;
    const hora_fi = document.getElementById('torn-hora-fi').value;
    const tasca = document.getElementById('torn-tasca').value.trim();
    const lloc = document.getElementById('torn-lloc').value.trim();
    const necessaris = parseInt(document.getElementById('torn-necessaris').value) || 1;
    const err = document.getElementById('torn-form-error');

    if (!rawDiaKey || !espai_id || !hora_inici || !hora_fi) {
        err.textContent = "Si us plau, especifica l'espai, el dia i les hores d'inici i fi.";
        err.style.display = 'block';
        return;
    }

    const targetIso = getDiaIso(rawDiaKey);
    const diaInfo = parseIsoToCatalan(targetIso);
    const diaFormatted = `${diaInfo.nom} (${diaInfo.data})`;

    const payload = {
        data_iso: targetIso,
        dia: diaFormatted,
        espai_id,
        hora_inici,
        hora_fi,
        tasca,
        lloc,
        necessaris
    };

    let error = null;
    if (editId) {
        let res = await supabaseClient.from('vol_torns').update(payload).eq('id', editId);
        if (res.error && res.error.code === 'PGRST204') {
            const { data_iso, ...legacyPayload } = payload;
            res = await supabaseClient.from('vol_torns').update(legacyPayload).eq('id', editId);
        }
        error = res.error;
    } else {
        let res = await supabaseClient.from('vol_torns').insert(payload);
        if (res.error && res.error.code === 'PGRST204') {
            const { data_iso, ...legacyPayload } = payload;
            res = await supabaseClient.from('vol_torns').insert(legacyPayload);
        }
        error = res.error;
    }

    if (error) {
        err.textContent = "Error guardant el torn: " + error.message;
        err.style.display = 'block';
    } else {
        closeTornModal();
        await fetchData();
        renderAll();
    }
}

async function handleDeleteTorn() {
    const editId = document.getElementById('torn-edit-id').value;
    if (!editId) return;
    if (!confirm("Segur que vols eliminar aquest torn? S'esborraran també les inscripcions de voluntaris associades.")) return;

    const { error } = await supabaseClient.from('vol_torns').delete().eq('id', editId);
    if (error) {
        alert("Error eliminant el torn: " + error.message);
    } else {
        closeTornModal();
        await fetchData();
        renderAll();
    }
}

async function handleDuplicateTorn() {
    const rawDiaKey = document.getElementById('torn-dia').value;
    const targetIso = getDiaIso(rawDiaKey);
    const diaInfo = parseIsoToCatalan(targetIso);
    const diaFormatted = `${diaInfo.nom} (${diaInfo.data})`;

    const espai_id = document.getElementById('torn-espai-id').value;
    const hora_inici = document.getElementById('torn-hora-inici').value;
    const hora_fi = document.getElementById('torn-hora-fi').value;
    const tasca = document.getElementById('torn-tasca').value.trim();
    const lloc = document.getElementById('torn-lloc').value.trim();
    const necessaris = parseInt(document.getElementById('torn-necessaris').value) || 1;

    const payload = {
        data_iso: targetIso,
        dia: diaFormatted,
        espai_id,
        hora_inici,
        hora_fi,
        tasca,
        lloc,
        necessaris
    };

    const { error } = await supabaseClient.from('vol_torns').insert(payload);
    if (error) {
        alert("Error duplicant el torn: " + error.message);
    } else {
        closeTornModal();
        await fetchData();
        renderAll();
    }
}

window.quickDuplicateTorn = async function(tornId) {
    const torn = allTorns.find(t => t.id === tornId);
    if (!torn) return;

    const targetIso = getDiaIso(torn);
    const diaInfo = parseIsoToCatalan(targetIso);
    const diaFormatted = `${diaInfo.nom} (${diaInfo.data})`;

    const payload = {
        data_iso: targetIso,
        dia: diaFormatted,
        espai_id: torn.espai_id,
        hora_inici: torn.hora_inici,
        hora_fi: torn.hora_fi,
        tasca: torn.tasca || '',
        lloc: torn.lloc || '',
        necessaris: torn.necessaris || 1
    };

    const { error } = await supabaseClient.from('vol_torns').insert(payload);
    if (error) {
        alert("Error duplicant el torn: " + error.message);
    } else {
        await fetchData();
        renderAll();
    }
};

window.quickDeleteTorn = async function(tornId) {
    if (!confirm("Segur que vols eliminar aquest torn?")) return;
    const { error } = await supabaseClient.from('vol_torns').delete().eq('id', tornId);
    if (error) {
        alert("Error eliminant el torn: " + error.message);
    } else {
        await fetchData();
        renderAll();
    }
};

// ==========================================
// 8.1. DIVIDIR TORNS EN TRAMS (ADMIN)
// ==========================================
function minutesToTime(mins) {
    const normalized = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60).toString().padStart(2, '0');
    const m = (normalized % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function calculateSplitSlots(iniciStr, fiStr, chunkMins) {
    let startMin = timeToFestivalMinutes(iniciStr);
    let endMin = timeToFestivalMinutes(fiStr);
    if (endMin <= startMin) endMin += 24 * 60;

    const slots = [];
    let cur = startMin;
    while (cur < endMin) {
        let next = Math.min(cur + chunkMins, endMin);
        const hInici = festivalMinutesToTime(cur);
        const hFi = festivalMinutesToTime(next);
        const durada = calculateDuration(hInici, hFi);
        slots.push({ hora_inici: hInici, hora_fi: hFi, durada });
        cur = next;
    }
    return slots;
}

function getSelectedSplitMins() {
    const activeBtn = document.querySelector('#modal-dividir-torn .btn-preset.active');
    if (!activeBtn) return 60;
    const val = activeBtn.dataset.mins;
    if (val === 'custom') {
        return parseInt(document.getElementById('split-custom-mins').value) || 60;
    }
    return parseInt(val) || 60;
}

function openDividirTornModal(tornId) {
    const torn = allTorns.find(t => t.id === tornId);
    if (!torn) return;

    const espai = allEspais.find(e => e.id === torn.espai_id);

    document.getElementById('dividir-torn-id').value = torn.id;
    document.getElementById('dividir-info-espai-dia').textContent = `${espai ? espai.nom : 'Espai'} • ${torn.dia}`;
    document.getElementById('dividir-info-horari').textContent = `${torn.hora_inici} – ${torn.hora_fi}`;
    document.getElementById('dividir-info-durada').textContent = calculateDuration(torn.hora_inici, torn.hora_fi);
    document.getElementById('dividir-info-tasca').textContent = torn.tasca || 'Sense tasca especificada';
    document.getElementById('dividir-info-places').textContent = `${torn.necessaris} places requerides`;

    // Reset presets a 60 min
    document.querySelectorAll('#modal-dividir-torn .btn-preset').forEach(b => {
        b.classList.toggle('active', b.dataset.mins === '60');
    });
    document.getElementById('custom-mins-row').style.display = 'none';
    document.getElementById('split-form-error').style.display = 'none';

    updateSplitPreview();
    document.getElementById('modal-dividir-torn').style.display = 'flex';
}

function closeDividirTornModal() {
    document.getElementById('modal-dividir-torn').style.display = 'none';
}

function updateSplitPreview() {
    const tornId = document.getElementById('dividir-torn-id').value;
    const torn = allTorns.find(t => t.id === tornId);
    if (!torn) return;

    const chunkMins = getSelectedSplitMins();
    const slots = calculateSplitSlots(torn.hora_inici, torn.hora_fi, chunkMins);
    const list = document.getElementById('split-preview-list');
    const countEl = document.getElementById('split-preview-count');
    const btnDo = document.getElementById('btn-do-dividir');

    countEl.textContent = slots.length;
    list.innerHTML = '';

    if (slots.length <= 1) {
        list.innerHTML = `<p style="color: #fbbf24; font-size: 0.85rem; padding: 0.4rem;">⚠️ La durada triada (${chunkMins} min) és igual o superior a la durada total del torn. Tria una durada inferior per poder dividir-lo en trams.</p>`;
        btnDo.disabled = true;
        return;
    }

    btnDo.disabled = false;

    slots.forEach((s, idx) => {
        const item = document.createElement('div');
        item.className = 'split-preview-item';
        item.innerHTML = `
            <div>
                <strong>Tram ${idx + 1}:</strong> <span class="split-preview-time">${s.hora_inici} – ${s.hora_fi}</span>
            </div>
            <span class="shift-duration">${s.durada}</span>
        `;
        list.appendChild(item);
    });
}

async function handleDoDividirTorn() {
    const tornId = document.getElementById('dividir-torn-id').value;
    const torn = allTorns.find(t => t.id === tornId);
    const err = document.getElementById('split-form-error');
    const btn = document.getElementById('btn-do-dividir');
    if (!torn) return;

    const chunkMins = getSelectedSplitMins();
    const slots = calculateSplitSlots(torn.hora_inici, torn.hora_fi, chunkMins);

    if (slots.length <= 1) {
        err.textContent = "Cal dividir en almenys 2 trams horaris.";
        err.style.display = 'block';
        return;
    }

    const assignats = allAssignacions.filter(a => a.torn_id === torn.id);
    if (assignats.length > 0) {
        const proceed = confirm(
            `⚠️ Aquest torn té ${assignats.length} voluntari(s) assignat(s).\n\n` +
            `Si el divideixes, el torn original s'esborrarà i es crearan els ${slots.length} trams nous buits perquè els voluntaris tornin a triar el seu horari.\n\n` +
            `Vols continuar?`
        );
        if (!proceed) return;
    }

    btn.disabled = true;
    btn.textContent = 'Dividint torn...';
    if (err) err.style.display = 'none';

    try {
        const tornIso = getDiaIso(torn);
        const diaInfo = parseIsoToCatalan(tornIso);
        const diaFormatted = `${diaInfo.nom} (${diaInfo.data})`;

        const newShiftsPayload = slots.map(s => ({
            data_iso: tornIso,
            dia: diaFormatted,
            espai_id: torn.espai_id,
            hora_inici: s.hora_inici,
            hora_fi: s.hora_fi,
            tasca: torn.tasca || '',
            lloc: torn.lloc || '',
            necessaris: torn.necessaris || 1
        }));

        // 1. Eliminar torn original
        const delRes = await supabaseClient.from('vol_torns').delete().eq('id', torn.id);
        if (delRes.error) throw delRes.error;

        // 2. Inserir nous torns
        const insRes = await supabaseClient.from('vol_torns').insert(newShiftsPayload);
        if (insRes.error) throw insRes.error;

        closeDividirTornModal();
        await fetchData();
        renderAll();
    } catch (e) {
        console.error("Error dividint el torn:", e);
        err.textContent = "Error: " + e.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '✂️ Aplicar i Crear Trams';
    }
}

window.openDividirTornModal = openDividirTornModal;
window.openTornModal = openTornModal;

// ==========================================
// 9. GESTIÓ D'ESPAIS (ADMIN)
// ==========================================
let editingEspaiId = null;

function openEspaisModal() {
    editingEspaiId = null;
    const input = document.getElementById('new-espai-nom');
    if (input) input.value = '';
    const err = document.getElementById('espais-form-error');
    if (err) err.style.display = 'none';

    renderEspaisAdminList();
    document.getElementById('modal-espais').style.display = 'flex';
    if (input) setTimeout(() => input.focus(), 100);
}

function renderEspaisAdminList() {
    const list = document.getElementById('espais-admin-list');
    list.innerHTML = '';

    if (allEspais.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No hi ha cap espai creat.</p>';
        return;
    }

    allEspais.forEach((e, index) => {
        const isFirst = index === 0;
        const isLast = index === allEspais.length - 1;
        const row = document.createElement('div');
        row.className = 'espai-item-row';

        if (editingEspaiId === e.id) {
            // Mode edició inline
            row.innerHTML = `
                <div style="display: flex; gap: 0.5rem; width: 100%; align-items: center;">
                    <span class="espai-order-num">#${index + 1}</span>
                    <input type="text" id="input-edit-espai-${e.id}" value="${e.nom.replace(/"/g, '&quot;')}" style="padding: 0.4rem 0.6rem; font-size: 0.9rem; flex: 1;">
                    <button class="btn-primary" onclick="saveEspaiName('${e.id}')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✓</button>
                    <button class="btn-ghost" onclick="cancelEditEspaiName()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✕</button>
                </div>
            `;
            setTimeout(() => {
                const inp = document.getElementById(`input-edit-espai-${e.id}`);
                if (inp) {
                    inp.focus();
                    inp.select();
                    inp.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') saveEspaiName(e.id);
                        if (ev.key === 'Escape') cancelEditEspaiName();
                    });
                }
            }, 50);
        } else {
            // Mode normal amb botons d'ordenació
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <span class="espai-order-num">#${index + 1}</span>
                    <div class="espai-order-controls">
                        <button class="btn-order-arrow" title="Pujar espai" onclick="moveEspaiOrder('${e.id}', -1)" ${isFirst ? 'disabled' : ''}>▲</button>
                        <button class="btn-order-arrow" title="Baixar espai" onclick="moveEspaiOrder('${e.id}', 1)" ${isLast ? 'disabled' : ''}>▼</button>
                    </div>
                    <span style="font-weight: 600; color: white;">${e.nom}</span>
                </div>
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn-small" onclick="startEditEspaiName('${e.id}')" style="margin: 0; color: var(--primary); border-color: var(--primary);">✏️ Renombrar</button>
                    <button class="btn-small" onclick="deleteEspai('${e.id}')" style="margin: 0; color: var(--danger); border-color: var(--danger);">🗑️ Eliminar</button>
                </div>
            `;
        }

        list.appendChild(row);
    });
}

window.moveEspaiOrder = async function(id, direction) {
    const index = allEspais.findIndex(e => e.id === id);
    if (index === -1) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= allEspais.length) return;

    // 1. Intercanviar a la llista local
    const [moved] = allEspais.splice(index, 1);
    allEspais.splice(targetIndex, 0, moved);

    // 2. Reassignar valors d'ordre seqüencials
    allEspais.forEach((e, idx) => {
        e.ordre = idx;
    });

    // 3. Renderitzat optimista immediat
    renderEspaisAdminList();
    renderAll();

    // 4. Guardar a Supabase en segon pla
    try {
        const updates = allEspais.map((e, idx) =>
            supabaseClient.from('vol_espais').update({ ordre: idx }).eq('id', e.id)
        );
        await Promise.all(updates);
    } catch (err) {
        console.error("Error guardant l'ordre dels espais:", err);
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

window.startEditEspaiName = function(id) {
    editingEspaiId = id;
    renderEspaisAdminList();
};

window.cancelEditEspaiName = function() {
    editingEspaiId = null;
    renderEspaisAdminList();
};

function isDuplicateEspai(nom, excludeId = null) {
    if (!nom) return false;
    const clean = nom.trim().toLowerCase();
    return allEspais.some(e => {
        if (excludeId && e.id === excludeId) return false;
        return (e.nom || '').trim().toLowerCase() === clean;
    });
}

window.saveEspaiName = async function(id) {
    const inp = document.getElementById(`input-edit-espai-${id}`);
    const newNom = inp ? inp.value.trim() : '';
    if (!newNom) {
        alert("El nom de l'espai no pot estar buit.");
        return;
    }

    if (isDuplicateEspai(newNom, id)) {
        alert(`Ja existeix un espai amb el nom "${newNom}". Tria un nom diferent.`);
        return;
    }

    const { error } = await supabaseClient
        .from('vol_espais')
        .update({ nom: newNom })
        .eq('id', id);

    if (error) {
        alert("Error guardant el nou nom: " + error.message);
    } else {
        editingEspaiId = null;
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

window.promptEditEspaiName = async function(id) {
    const espai = allEspais.find(e => e.id === id);
    if (!espai) return;

    const newNom = prompt("Canvia el nom d'aquest espai:", espai.nom);
    if (newNom === null) return;
    const trimmed = newNom.trim();
    if (!trimmed || trimmed === espai.nom) return;

    if (isDuplicateEspai(trimmed, id)) {
        alert(`Ja existeix un espai amb el nom "${trimmed}". Tria un nom diferent.`);
        return;
    }

    const { error } = await supabaseClient
        .from('vol_espais')
        .update({ nom: trimmed })
        .eq('id', id);

    if (error) {
        alert("Error canviant el nom de l'espai: " + error.message);
    } else {
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

async function handleAddEspai() {
    const input = document.getElementById('new-espai-nom');
    const btn = document.getElementById('btn-add-espai');
    const err = document.getElementById('espais-form-error');
    const nom = input ? input.value.trim() : '';

    if (!nom) {
        if (err) {
            err.textContent = "Si us plau, escriu el nom de l'espai.";
            err.style.display = 'block';
        }
        return;
    }

    if (isDuplicateEspai(nom)) {
        if (err) {
            err.textContent = `Ja existeix un espai anomenat "${nom}". Si us plau, utilitza un altre nom.`;
            err.style.display = 'block';
        } else {
            alert(`Ja existeix un espai anomenat "${nom}".`);
        }
        return;
    }

    if (err) err.style.display = 'none';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Afegint...';
    }

    try {
        const nouOrdre = allEspais.length;
        const { data, error } = await supabaseClient.from('vol_espais').insert({ nom, ordre: nouOrdre }).select();
        
        if (error) {
            console.error("Error creant l'espai a Supabase:", error);
            if (err) {
                if (error.code === '42501' || error.message.includes('row-level security')) {
                    err.innerHTML = "<strong>Error de permisos a Supabase (RLS):</strong><br>Cal aplicar l'script <code>schema_voluntaris_v2.sql</code> a la consola SQL de Supabase per permetre la creació d'espais.";
                } else {
                    err.textContent = "Error creant l'espai: " + error.message;
                }
                err.style.display = 'block';
            } else {
                alert("Error creant l'espai: " + error.message);
            }
        } else {
            if (input) input.value = '';
            await fetchData();
            renderEspaisAdminList();
            renderAll();
        }
    } catch (e) {
        console.error("Excepció creant espai:", e);
        if (err) {
            err.textContent = "Excepció: " + e.message;
            err.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '+ Afegir';
        }
    }
}

window.deleteEspai = async function(id) {
    if (!confirm("Segur que vols eliminar aquest espai? S'esborraran tots els seus torns i assignacions.")) return;
    const { error } = await supabaseClient.from('vol_espais').delete().eq('id', id);
    if (error) {
        alert("Error eliminant l'espai: " + error.message);
    } else {
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

window.openEspaisModal = openEspaisModal;

// ==========================================
// 10. AUTH ADMIN
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
    const topActions = document.getElementById('admin-top-actions');
    if (topActions) topActions.style.display = active ? 'flex' : 'none';
    document.querySelectorAll('.admin-only-btn').forEach(b => {
        b.style.display = active ? 'inline-flex' : 'none';
    });
    document.getElementById('btn-admin-login-toggle').innerText = active ? 'Sortir Admin' : 'Accés Administrador';
    renderAll();
}

// ==========================================
// 11. EXPORTACIÓ CSV
// ==========================================
async function handleExportCSV() {
    // 1. CSV Voluntaris Contactes i Dinar
    let csvVol = "\uFEFF"; // UTF-8 BOM
    csvVol += "Nom;Cognoms;Telèfon;Dinar Dissabte (Data límit 11 setembre);Total Persones Dinar\n";
    const sortedVols = [...allVoluntaris].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    sortedVols.forEach(v => {
        const dinarTxt = v.dinar === false ? 'No' : 'Sí';
        const dinarPers = v.dinar === false ? 0 : (v.dinar_persones || 1);
        csvVol += `"${v.nom || ''}";"${v.cognom || ''}";"${v.telefon || ''}";"${dinarTxt}";${dinarPers}\n`;
    });
    downloadCSV("voluntaris_contactes_dinar_pluja_2026.csv", csvVol);

    // 2. CSV Graella de Torns (Formulada exactament com el document d'impressió PDF)
    let csvGraellaPdf = "\uFEFF"; // UTF-8 BOM
    csvGraellaPdf += "\"Festival Pluja d'Art 2026 — Graella de Torns de Voluntariat\";;;;\n\n";

    allDies.forEach(d => {
        const diaTorns = allTorns.filter(t => isTornInDia(t, d));
        if (diaTorns.length === 0) return;

        const diaTitle = d.nom + (d.data ? ' · ' + d.data : '');
        csvGraellaPdf += `"${diaTitle}";;;;\n`;

        allEspais.forEach(espai => {
            const torns = allTorns
                .filter(t => isTornInDia(t, d) && t.espai_id === espai.id)
                .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

            if (torns.length > 0) {
                csvGraellaPdf += `\n"Espai: ${espai.nom}";;;;\n`;
                csvGraellaPdf += `"Horari";"Tasca";"Lloc / Punt de Trobada";"Places";"Voluntaris Assignats"\n`;

                torns.forEach(t => {
                    const assignats = allAssignacions.filter(a => a.torn_id === t.id);
                    const nombresVols = assignats.map(a => {
                        const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                        return v ? `${v.nom} ${v.cognom}` : '';
                    }).filter(Boolean).join(", ") || "(Sense voluntaris)";

                    const horari = `${t.hora_inici} – ${t.hora_fi}`;
                    const tasca = t.tasca ? t.tasca.trim() : '-';
                    const lloc = t.lloc ? t.lloc.trim() : '-';
                    const places = `${assignats.length} / ${t.necessaris}`;

                    csvGraellaPdf += `"${horari}";"${tasca.replace(/"/g, '""')}";"${lloc.replace(/"/g, '""')}";"${places}";"${nombresVols.replace(/"/g, '""')}"\n`;
                });
            }
        });

        csvGraellaPdf += "\n";
    });

    setTimeout(() => {
        downloadCSV("graella_imprimir_pdf_pluja_2026.csv", csvGraellaPdf);
    }, 200);

    // 3. CSV Torns i Assignacions Detallat
    let csvTorns = "\uFEFF"; // UTF-8 BOM
    csvTorns += "Dia;Data;Espai;Hora Inici;Hora Fi;Durada;Tasca;Lloc;Places Necessàries;Inscrits;Voluntaris Assignats\n";

    allDies.forEach(d => {
        allEspais.forEach(espai => {
            const torns = allTorns
                .filter(t => isTornInDia(t, d) && t.espai_id === espai.id)
                .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

            torns.forEach(t => {
                const assignats = allAssignacions.filter(a => a.torn_id === t.id);
                const nombresVols = assignats.map(a => {
                    const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                    return v ? `${v.nom} ${v.cognom}` : '';
                }).filter(Boolean).join(", ");

                const durada = calculateDuration(t.hora_inici, t.hora_fi);

                csvTorns += `"${d.nom}";"${d.data || ''}";"${espai.nom}";"${t.hora_inici}";"${t.hora_fi}";"${durada}";"${(t.tasca || '').replace(/"/g, '""')}";"${(t.lloc || '').replace(/"/g, '""')}";${t.necessaris};${assignats.length};"${nombresVols.replace(/"/g, '""')}"\n`;
            });
        });
    });

    setTimeout(() => {
        downloadCSV("torns_horaris_detall_pluja_2026.csv", csvTorns);
    }, 400);

    // 4. CSV Resum de Cobertura per Tram Horari
    let csvCobertura = "\uFEFF"; // UTF-8 BOM
    csvCobertura += "Dia;Data;Horari;Durada;Voluntaris Necessaris;Voluntaris Inscrits;Dèficit (Falten);% Cobertura;Estat;Espais Implicats\n";

    allDies.forEach(d => {
        const diaTorns = allTorns.filter(t => isTornInDia(t, d));
        if (diaTorns.length === 0) return;

        const summarySlots = computeDayTimeSlotsSummary(diaTorns, allAssignacions);
        summarySlots.forEach(slot => {
            const durada = calculateDuration(slot.hora_inici, slot.hora_fi);
            let estat = 'Incomplet';
            if (slot.totalAssigned >= slot.totalNeeded) {
                estat = 'Complet (100%)';
            } else if (slot.totalAssigned === 0) {
                estat = 'Buit (0%)';
            } else {
                estat = `Parcial (${slot.pct}%)`;
            }

            const espaisList = Array.from(new Set(slot.torns.map(t => {
                const e = allEspais.find(x => x.id === t.espai_id);
                return e ? e.nom : '';
            }).filter(Boolean))).join(", ");

            csvCobertura += `"${d.nom}";"${d.data || ''}";"${slot.hora_inici} – ${slot.hora_fi}";"${durada}";${slot.totalNeeded};${slot.totalAssigned};${slot.deficit};"${slot.pct}%";"${estat}";"${espaisList.replace(/"/g, '""')}"\n`;
        });
    });

    setTimeout(() => {
        downloadCSV("resum_cobertura_voluntaris_per_tram_pluja_2026.csv", csvCobertura);
    }, 600);
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

// ==========================================
// 12. IMPRESSIÓ PDF
// ==========================================
async function handlePrintPDF() {
    try {
        let printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Pluja d'Art 2026 - Torns de Voluntariat</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; background: white; padding: 25px; }
                h1 { border-bottom: 2px solid #111; padding-bottom: 8px; font-size: 22px; margin-bottom: 20px; }
                h2 { border-bottom: 1.5px solid #444; padding-bottom: 4px; font-size: 16px; margin-top: 25px; margin-bottom: 12px; color: #111; }
                h3 { font-size: 14px; margin-top: 15px; margin-bottom: 6px; color: #0284c7; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
                th { background: #f1f5f9; font-weight: bold; }
                .time-col { width: 100px; font-weight: bold; white-space: nowrap; }
                .task-col { font-weight: 600; color: #0f172a; }
                .loc-col { color: #475569; font-size: 10.5px; }
                .places-col { width: 65px; text-align: center; font-weight: bold; }
                .vols-col { color: #334155; }
                @media print {
                    .page-break { page-break-after: always; }
                }
            </style>
        </head>
        <body>
            <h1>Festival Pluja d'Art 2026 — Graella de Torns de Voluntariat</h1>
        `;

        allDies.forEach((d, idx) => {
            const diaTitle = `${d.nom}${d.data ? ' · ' + d.data : ''}`;
            printHtml += `<h2>${diaTitle}</h2>`;

            const diaTorns = allTorns.filter(t => isTornInDia(t, d));
            const summarySlots = computeDayTimeSlotsSummary(diaTorns, allAssignacions);
            const totalDayNeeded = diaTorns.reduce((sum, t) => sum + (parseInt(t.necessaris) || 1), 0);
            const totalDayInscrits = diaTorns.reduce((sum, t) => {
                return sum + allAssignacions.filter(a => a.torn_id === t.id).length;
            }, 0);

            // Taula de Cobertura per Tram Horari
            if (summarySlots.length > 0) {
                printHtml += `
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong style="font-size: 12.5px; color: #1e293b;">📊 Resum de Cobertura de Voluntaris per Tram Horari</strong>
                            <span style="background: #e2e8f0; color: #0f172a; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 10.5px;">
                                Total Dia: ${totalDayInscrits} / ${totalDayNeeded} voluntaris (${Math.round((totalDayInscrits / (totalDayNeeded || 1)) * 100)}%)
                            </span>
                        </div>
                        <table>
                            <thead>
                                <tr style="background: #e2e8f0;">
                                    <th style="width: 120px;">Tram Horari</th>
                                    <th style="width: 75px; text-align: center;">Necessaris</th>
                                    <th style="width: 75px; text-align: center;">Inscrits</th>
                                    <th style="width: 100px; text-align: center;">Estat / Falten</th>
                                    <th>Espais i Àrees Actives</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                summarySlots.forEach(slot => {
                    let badgeBg = '#dcfce7';
                    let badgeColor = '#166534';
                    let badgeText = '✓ Complet';
                    if (slot.totalAssigned === 0) {
                        badgeBg = '#ffe4e6';
                        badgeColor = '#9f1239';
                        badgeText = `🚨 Falten ${slot.totalNeeded}`;
                    } else if (slot.totalAssigned < slot.totalNeeded) {
                        badgeBg = '#fef3c7';
                        badgeColor = '#92400e';
                        badgeText = `⚠️ Falten ${slot.deficit}`;
                    }

                    const espaisSummary = slot.torns.map(t => {
                        const esp = allEspais.find(e => e.id === t.espai_id);
                        const count = allAssignacions.filter(a => a.torn_id === t.id).length;
                        return `${esp ? esp.nom : 'Espai'} (${count}/${t.necessaris})`;
                    }).join(", ");

                    printHtml += `
                        <tr>
                            <td class="time-col">⏰ ${slot.hora_inici} – ${slot.hora_fi}</td>
                            <td style="text-align: center; font-weight: bold;">${slot.totalNeeded}</td>
                            <td style="text-align: center; font-weight: bold;">${slot.totalAssigned}</td>
                            <td style="text-align: center;">
                                <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                                    ${badgeText}
                                </span>
                            </td>
                            <td style="font-size: 10.5px; color: #334155;">${espaisSummary}</td>
                        </tr>
                    `;
                });

                printHtml += `</tbody></table></div>`;
            }

            allEspais.forEach(espai => {
                const torns = allTorns
                    .filter(t => isTornInDia(t, d) && t.espai_id === espai.id)
                    .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

                if (torns.length > 0) {
                    printHtml += `<h3>Espai: ${espai.nom}</h3>`;
                    printHtml += `
                        <table>
                            <thead>
                                <tr>
                                    <th class="time-col">Horari</th>
                                    <th>Tasca</th>
                                    <th>Lloc / Punt de Trobada</th>
                                    <th class="places-col">Places</th>
                                    <th class="vols-col">Voluntaris Assignats</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    torns.forEach(t => {
                        const assignats = allAssignacions.filter(a => a.torn_id === t.id);
                        const names = assignats.map(a => {
                            const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                            return v ? `${v.nom} ${v.cognom}` : '';
                        }).filter(Boolean).join(", ") || "<em>(Sense voluntaris)</em>";

                        printHtml += `
                            <tr>
                                <td class="time-col">${t.hora_inici} – ${t.hora_fi}</td>
                                <td class="task-col">${t.tasca || '-'}</td>
                                <td class="loc-col">${t.lloc || '-'}</td>
                                <td class="places-col">${assignats.length} / ${t.necessaris}</td>
                                <td class="vols-col">${names}</td>
                            </tr>
                        `;
                    });

                    printHtml += `</tbody></table>`;
                }
            });

            if (idx < allDies.length - 1) {
                printHtml += `<div class="page-break"></div>`;
            }
        });

        // Llistat de contactes i dinar de voluntaris
        printHtml += `<div class="page-break"></div>`;
        printHtml += `<h2>Directori de Voluntaris i Dinar de Dissabte</h2>`;

        const volsAmbDinar = allVoluntaris.filter(v => v.dinar !== false);
        const totalPersonesDinar = volsAmbDinar.reduce((sum, v) => sum + (parseInt(v.dinar_persones) || 1), 0);

        printHtml += `
            <div style="background: #f0fdf4; border: 1.5px solid #86efac; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 11.5px; color: #166534;">
                <strong>🍱 Resum Dinar de Voluntaris (Dissabte 19 de setembre):</strong> 
                Total de <strong>${totalPersonesDinar} persones</strong> inscrites (${volsAmbDinar.length} voluntaris + ${Math.max(0, totalPersonesDinar - volsAmbDinar.length)} acompanyants).
                <span style="color: #c2410c; margin-left: 10px; font-weight: bold;">(⏳ Data límit d'inscripció: 11 de setembre)</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 38%;">Nom i Cognoms</th>
                        <th style="width: 32%;">Telèfon de Contacte</th>
                        <th style="width: 30%;">Dinar Dissabte (Persones)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const sortedVoluntaris = [...allVoluntaris].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
        sortedVoluntaris.forEach(v => {
            const dinarStr = v.dinar === false ? '<span style="color: #64748b;">No</span>' : `<strong>Sí</strong> (${v.dinar_persones || 1} pers.)`;
            printHtml += `
                <tr>
                    <td>${v.nom} ${v.cognom}</td>
                    <td>${v.telefon}</td>
                    <td>${dinarStr}</td>
                </tr>
            `;
        });

        printHtml += `</tbody></table></body></html>`;

        // Generar a través d'un iframe ocult
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
        }, 500);
    } catch (err) {
        console.error("Error imprimint el PDF:", err);
        alert("Error preparant el document per imprimir: " + err.message);
    }
}
