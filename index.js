// index.js

lucide.createIcons();

// --- CONFIGURACIÓN LOCAL ---
// Cargamos datos guardados o iniciamos vacíos
let disciplines = JSON.parse(localStorage.getItem('gimnastik_disciplines')) || ['Musculación', 'Crossfit', 'Boxeo', 'Yoga'];
let students = JSON.parse(localStorage.getItem('gimnastik_students')) || [];

let isAdminAuthenticated = false;
let gymChartInstance = null;
let autoCloseTimer = null;

const views = { access: document.getElementById('view-access'), admin: document.getElementById('view-admin') };
const navBtns = { 
    access: document.getElementById('btn-nav-access'), 
    admin: document.getElementById('btn-nav-admin'),
    logout: document.getElementById('btn-logout'),
    themeToggle: document.getElementById('btn-theme-toggle')
};

// --- INICIALIZACIÓN ---
function init() {
    const theme = JSON.parse(localStorage.getItem('gimnastik_theme'));
    if (theme) setTheme(theme.rgb, false);

    const dniInput = document.getElementById('access-dni');
    if(dniInput) dniInput.addEventListener('keypress', (e) => { if(e.key==='Enter') handleAccess(); });

    // Inicializar UI con datos locales
    updateUI();
}

// --- PERSISTENCIA LOCAL (CORREGIDO) ---
function saveData() {
    localStorage.setItem('gimnastik_disciplines', JSON.stringify(disciplines));
    localStorage.setItem('gimnastik_students', JSON.stringify(students));
    updateUI(); // Refrescar UI inmediatamente
}

function updateUI() {
    renderDisciplinesTags();
    updateDisciplineSelect(); 
    renderStats();
    renderChart();
}

// --- LOGIN SIMULADO SEGURO ---
function requestAdminAccess() {
    if (isAdminAuthenticated) showView('admin');
    else {
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('login-user').focus();
    }
}
function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').classList.add('hidden');
}
function performLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    // LOGIN LOCAL: Comparación directa
    // Acepta "ADMIN" o "admin"
    if (user.toUpperCase() === 'ADMIN' && pass === 'ADMIN2025') {
        isAdminAuthenticated = true;
        closeLoginModal();
        showView('admin');
        navBtns.logout.classList.remove('hidden');
        navBtns.themeToggle.classList.remove('hidden');
        setTimeout(renderChart, 500);
    } else {
        document.getElementById('login-error').classList.remove('hidden');
        document.querySelector('#login-modal > div').classList.add('animate-shake');
        setTimeout(()=>document.querySelector('#login-modal > div').classList.remove('animate-shake'), 500);
    }
}
function logoutAdmin() {
    if(!confirm("¿Cerrar sesión?")) return;
    isAdminAuthenticated = false;
    navBtns.logout.classList.add('hidden');
    navBtns.themeToggle.classList.add('hidden');
    document.getElementById('theme-menu').classList.add('hidden');
    showView('access');
}

// --- CRUD LOCAL ---
function registerStudent() {
    if (!isAdminAuthenticated) return alert("Solo Admin");
    const name = document.getElementById('reg-name').value;
    const dni = document.getElementById('reg-dni').value;
    const disc = document.getElementById('reg-discipline').value;
    const visits = parseInt(document.getElementById('reg-visits').value);
    
    if (!name || !dni || !disc) return alert("Datos incompletos");
    if (students.find(s => s.dni == dni)) return alert("DNI existe");

    const newStudent = {
        id: Date.now().toString(), // ID único basado en tiempo
        dni, name, discipline: disc,
        isUnlimited: document.getElementById('reg-unlimited').checked,
        isMonthPack: document.getElementById('reg-month-pack').checked,
        lastRenewal: new Date().toISOString(),
        maxVisits: visits, 
        visitsLog: []
    };
    
    students.push(newStudent);
    saveData(); // Guardar en LocalStorage
    document.getElementById('form-register').reset();
    toggleVisitsInput();
    alert("Guardado");
}

function addDiscipline() {
    if (!isAdminAuthenticated) return;
    const name = document.getElementById('new-discipline-name').value.trim();
    if (name && !disciplines.includes(name)) {
        disciplines.push(name);
        saveData();
        document.getElementById('new-discipline-name').value = '';
    }
}

function deleteDiscipline(name, e) {
    if(e) e.stopPropagation();
    if(!confirm(`¿Borrar "${name}"?`)) return;
    disciplines = disciplines.filter(d => d !== name);
    saveData();
}

function deleteStudent(id, disc) {
    if(!confirm("¿Borrar alumno?")) return;
    students = students.filter(s => s.id !== id);
    closeModal();
    saveData();
}

function renewMonth(id, disc) {
    const idx = students.findIndex(x => x.id === id);
    if(idx === -1 || !confirm(`¿Sumar mes?`)) return;
    
    const now = new Date();
    const s = students[idx];
    
    // Lógica inteligente de fecha
    if (s.isMonthPack) {
        const currentExp = new Date(s.lastRenewal);
        currentExp.setMonth(currentExp.getMonth() + 1);
        if (now > currentExp) s.lastRenewal = now.toISOString();
        else {
            const next = new Date(s.lastRenewal);
            next.setMonth(next.getMonth() + 1);
            s.lastRenewal = next.toISOString();
        }
    } else {
        s.lastRenewal = now.toISOString();
        const key = `${now.getFullYear()}-${now.getMonth()}`;
        // Opcional: limpiar visitas del mes anterior
        s.visitsLog = s.visitsLog.filter(d => {
            const date = new Date(d);
            return `${date.getFullYear()}-${date.getMonth()}` === key;
        });
    }

    students[idx] = s;
    saveData();
    openDisciplineModal(disc);
}

function addExtraDays(id, disc) {
    const val = parseInt(document.getElementById(`extra-days-${id}`).value);
    if(!val) return;
    const idx = students.findIndex(x => x.id === id);
    if(idx !== -1) {
        students[idx].maxVisits += val;
        saveData();
        openDisciplineModal(disc);
    }
}

// --- UI HELPERS ---
function renderDisciplinesTags() {
    const c = document.getElementById('disciplines-tags'); c.innerHTML = '';
    disciplines.forEach(d => {
        const b = document.createElement('button');
        b.className = 'text-xs bg-black/40 border border-gray-700 px-2 py-1 rounded text-white mr-1 mb-1';
        b.textContent = d;
        b.onclick = () => { document.getElementById('new-discipline-name').value = d; document.getElementById('reg-discipline').value = d; };
        c.appendChild(b);
    });
}
function updateDisciplineSelect() {
    const s = document.getElementById('reg-discipline'); s.innerHTML = '';
    disciplines.forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = d; o.className = "text-black";
        s.appendChild(o);
    });
    // Restore selection logic if needed
}
function toggleVisitsInput() {
    const dis = document.getElementById('reg-unlimited').checked;
    document.getElementById('reg-visits').disabled = dis;
    document.getElementById('reg-visits').style.opacity = dis ? 0.5 : 1;
}
function renderStats() {
    const c = document.getElementById('stats-container'); c.innerHTML = '';
    document.getElementById('total-students-badge').textContent = `${students.length} Alumnos`;
    disciplines.forEach(d => {
        const count = students.filter(s => s.discipline === d).length;
        const div = document.createElement('div');
        div.className = "glass-panel p-5 rounded-xl flex justify-between items-center border border-white/5 hover:border-gimnastik-primary cursor-pointer group";
        div.innerHTML = `<div class="flex items-center gap-3"><div class="w-2 h-8 bg-gimnastik-primary rounded-full"></div><span class="font-bold text-lg">${d}</span></div><div class="flex items-center gap-4"><span class="text-3xl font-bold text-white">${count}</span><button onclick="deleteDiscipline('${d}', event)" class="text-red-500 hover:text-white"><i data-lucide="trash-2"></i></button></div>`;
        div.onclick = () => openModal(d);
        c.appendChild(div);
    });
    lucide.createIcons();
    renderChart();
}
function renderChart() {
    const ctx = document.getElementById('gymChart'); if(!ctx) return;
    if(gymChartInstance) gymChartInstance.destroy();
    const data = disciplines.map(d => students.filter(s => s.discipline === d).length);
    gymChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: { labels: disciplines, datasets: [{ data, backgroundColor: ['#FF0055','#00E5FF','#7C4DFF','#FFD600'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#fff' } } } }
    });
}
function setTheme(rgb, save) {
    document.documentElement.style.setProperty('--bg-theme-rgb', rgb);
    if(save) localStorage.setItem('gimnastik_theme', JSON.stringify({rgb}));
    document.getElementById('theme-menu').classList.add('hidden');
}
function toggleThemeMenu() { document.getElementById('theme-menu').classList.toggle('hidden'); }
function showView(v) { 
    views.access.classList.add('hidden'); views.admin.classList.add('hidden');
    views[v].classList.remove('hidden');
    // Update navbar state
    const accessBtn = document.getElementById('btn-nav-access');
    const adminBtn = document.getElementById('btn-nav-admin');
    if(v === 'access') {
        accessBtn.className = "text-sm font-medium text-gimnastik-primary border-b-2 border-gimnastik-primary pb-1";
        adminBtn.className = "text-gray-400 hover:text-white transition p-2 rounded-full hover:bg-white/10";
        adminBtn.innerHTML = '<i data-lucide="key-round" class="w-5 h-5"></i>';
    } else {
        accessBtn.className = "text-sm font-medium text-gray-400 hover:text-white transition pb-1";
        adminBtn.className = "text-gimnastik-primary transition p-2 rounded-full bg-white/10 border border-gimnastik-primary/30";
        adminBtn.innerHTML = '<i data-lucide="lock-open" class="w-5 h-5"></i>';
    }
    lucide.createIcons();
}

// --- ACCESO ---
function handleAccess() {
    const dni = document.getElementById('access-dni').value.trim();
    if(!dni) return;
    document.getElementById('access-result').classList.add('hidden');
    document.getElementById('access-loader').classList.remove('hidden');
    setTimeout(() => showAccessResult(dni), 1500);
    document.getElementById('access-dni').value = '';
}
function showAccessResult(dni) {
    document.getElementById('access-loader').classList.add('hidden');
    const res = document.getElementById('access-result');
    res.classList.remove('hidden', 'slide-up-out');
    
    // Loose match
    const sIdx = students.findIndex(st => st.dni == dni);
    const icon = document.getElementById('access-icon');
    
    if(sIdx === -1) {
        icon.innerHTML = '<i data-lucide="x-circle"></i>';
        document.getElementById('access-name').textContent = "No Encontrado";
        document.getElementById('access-discipline').textContent = "-";
        return;
    }
    
    const s = students[sIdx];
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    const visits = (s.visitsLog||[]).filter(d => new Date(d).toISOString().startsWith(key.slice(0,7))).length;
    
    let ok = true;
    if(s.isMonthPack) {
        const exp = new Date(s.lastRenewal); exp.setMonth(exp.getMonth()+1);
        if(now > exp) ok = false;
    } else if (!s.isUnlimited && visits >= s.maxVisits) ok = false;

    if(ok) {
        const today = now.toDateString();
        if(!(s.visitsLog||[]).some(d => new Date(d).toDateString() === today)) {
             students[sIdx].visitsLog.push(now.toISOString());
             saveData();
        }
        icon.innerHTML = '<i data-lucide="check-circle"></i>';
    } else {
        icon.innerHTML = '<i data-lucide="alert-triangle"></i>';
    }
    
    document.getElementById('access-name').textContent = s.name;
    document.getElementById('access-discipline').textContent = ok ? "Bienvenido" : "Acceso Denegado";
    lucide.createIcons();

    if(autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => res.classList.add('slide-up-out'), 15000);
}

// Modal Detalle
function openModal(disc) {
    const m = document.getElementById('modal-overlay'); m.classList.remove('hidden');
    const b = document.getElementById('modal-body'); b.innerHTML = '';
    document.getElementById('modal-title').textContent = disc;
    students.filter(s => s.discipline === disc).forEach(s => {
        const d = document.createElement('div');
        d.className = "glass-panel p-4 mb-2 flex justify-between items-center";
        
        // Fechas
        const lastPay = new Date(s.lastRenewal);
        const payStr = lastPay.toLocaleDateString();
        const exp = new Date(lastPay); exp.setMonth(exp.getMonth()+1);
        const expStr = exp.toLocaleDateString();
        const isExp = new Date() > exp;
        const color = isExp ? 'text-red-500' : 'text-[#FF0055]';

        const btnText = "Sumar Mes Pago";
        const addDays = (!s.isUnlimited && !s.isMonthPack) ? `<div class="flex items-center gap-1 mt-1"><input type="number" id="extra-days-${s.id}" value="1" min="1" max="30" class="w-10 bg-black/40 border border-gray-700 rounded text-center text-sm py-1 focus:border-gimnastik-primary outline-none"><button onclick="addExtraDays('${s.id}', '${disc}')" class="bg-gray-800 hover:bg-white text-white hover:text-black p-1 rounded transition"><i data-lucide="plus" class="w-4 h-4"></i></button></div>` : '';
        
        d.innerHTML = `
            <div>
                <span class="font-bold text-lg">${s.name}</span>
                <div class="text-xs mt-1 text-gray-400">Pago: ${payStr} <br> Vence: <span class="${color}">${expStr}</span></div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <div><button onclick="renewMonth('${s.id}', '${disc}')" class="text-green-400 mr-2 flex items-center gap-1"><i data-lucide="calendar-plus" class="w-3 h-3"></i> ${btnText}</button>
                <button onclick="deleteStudent('${s.id}', '${disc}')" class="text-red-400"><i data-lucide="trash-2"></i></button></div>
                ${addDays}
            </div>`;
        b.appendChild(d);
    });
    lucide.createIcons();
}

init();