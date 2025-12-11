document.addEventListener('DOMContentLoaded', () => {
    
    // CONFIG
    const CELL_WIDTH = 48; 
    const db = firebase.firestore();
    const auth = firebase.auth();
    const COLLECTION_NAME = 'reservas_atsa'; // Coincide con las reglas de Firebase
    
    let isLoggedIn = false;
    let currentDate = new Date();
    let reservations = [];
    let isDragging = false, dragStart = null, dragEnd = null, dragSelectionEl = null;

    // DOM
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    const daysHeader = document.getElementById('daysHeader');
    const cabinLabels = document.getElementById('cabinLabels');
    const gridCells = document.getElementById('gridCells');
    const gridHeaderContainer = document.getElementById('gridHeaderContainer');
    const gridBodyContainer = document.getElementById('gridBodyContainer');
    
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectionStatus = document.getElementById('connectionStatus');
    const loginOverlay = document.getElementById('loginOverlay');
    const newResBtn = document.getElementById('newResBtn');

    // Modal & Form
    const modal = document.getElementById('resModal');
    const resForm = document.getElementById('resForm');
    const btnDelete = document.getElementById('btnDeleteRes');
    const btnCancel = document.getElementById('btnCancelRes');
    const resFormError = document.getElementById('resFormError');

    // Login Elements
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    const inputUser = document.getElementById('inputUser');
    const inputPass = document.getElementById('inputPass');
    const loginError = document.getElementById('loginError');
    const closeLoginModal = document.getElementById('closeLoginModal');
    
    // Form Inputs
    const inpId = document.getElementById('resId');
    const inpCabin = document.getElementById('resCabin');
    const inpCheckIn = document.getElementById('resCheckIn');
    const inpCheckOut = document.getElementById('resCheckOut');
    const inpName = document.getElementById('resName');
    const inpDni = document.getElementById('resDni');
    const inpPhone = document.getElementById('resPhone');
    const inpEmail = document.getElementById('resEmail');
    const inpPax = document.getElementById('resPax');
    const inpPrice = document.getElementById('resPrice');
    const inpDeposit = document.getElementById('resDeposit');
    const inpBalance = document.getElementById('resBalance');
    const inpNotes = document.getElementById('resNotes');
    const radioStatus = document.getElementsByName('status');

    // INICIO
    renderGrid();
    syncScroll();
    
    // Si ya hay usuario (por persistencia), login automático
    // Si no, esperamos a que el usuario ingrese
    auth.onAuthStateChanged(user => {
        if (user) {
            // Usuario ya autenticado en Firebase
            handleLoginSuccess();
        } else {
            // Usuario desconectado
            handleLogout();
        }
    });

    // --- FUNCIONES DE ESTADO ---
    function handleLoginSuccess() {
        isLoggedIn = true;
        updateSystemStatus(true, "Conectado");
        loginBtnText.textContent = "Salir";
        loginBtn.classList.replace('bg-yellow-400', 'bg-red-500');
        loginBtn.classList.replace('text-blue-900', 'text-white');
        
        loginModal.style.display = 'none';
        loginOverlay.style.display = 'none'; // Quitar candado
        newResBtn.classList.remove('hidden');
        
        // Iniciar escucha de datos
        startListening();
    }

    function handleLogout() {
        isLoggedIn = false;
        updateSystemStatus(false, "Desconectado");
        loginBtnText.textContent = "Ingresar";
        loginBtn.classList.replace('bg-red-500', 'bg-yellow-400');
        loginBtn.classList.replace('text-white', 'text-blue-900');
        
        loginOverlay.style.display = 'flex'; // Mostrar candado
        newResBtn.classList.add('hidden');
        
        reservations = [];
        renderGrid(); // Limpiar grilla visualmente
    }

    function updateSystemStatus(online, text) {
        if (online) {
            statusDot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
            statusText.className = "text-green-700 font-bold text-xs";
            connectionStatus.classList.replace('border-gray-200', 'border-green-200');
        } else {
            statusDot.className = "w-2 h-2 rounded-full bg-red-500";
            statusText.className = "text-red-700 font-bold text-xs";
            connectionStatus.classList.replace('border-green-200', 'border-gray-200');
        }
        statusText.textContent = text;
    }

    // --- FIREBASE LISTENER ---
    function startListening() {
        db.collection(COLLECTION_NAME)
          .onSnapshot(snapshot => {
              reservations = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
              renderGrid();
              updateSystemStatus(true, `Online | ${reservations.length} Reservas`);
          }, err => {
              console.error("Error Firebase:", err);
              if (err.code === 'permission-denied') {
                  updateSystemStatus(false, "Permiso Denegado (Revisar Reglas)");
              } else {
                  updateSystemStatus(false, "Error Conexión");
              }
          });
    }

    // --- LÓGICA DE LOGIN ---
    loginBtn.onclick = () => {
        if(isLoggedIn) { 
            if(confirm("¿Cerrar sesión?")) auth.signOut(); 
        } else { 
            loginModal.style.display = 'flex'; 
            loginError.textContent = ''; 
            inputUser.value=''; 
            inputPass.value=''; 
        }
    };
    closeLoginModal.onclick = () => loginModal.style.display = 'none';
    
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const u = inputUser.value.trim();
        const p = inputPass.value.trim();
        
        // VALIDACIÓN DE CREDENCIALES MAESTRAS
        if (u === "ATSA" && p === "ATSA2025") {
            // Si la contraseña es correcta, iniciamos sesión ANÓNIMA en Firebase
            // Esto activa las reglas de seguridad: "allow read, write: if request.auth != null;"
            auth.signInAnonymously().catch(e => loginError.textContent = "Error Firebase: " + e.message);
        } else {
            loginError.textContent = "Usuario o contraseña incorrectos.";
        }
    };

    // --- UI HANDLERS ---
    document.getElementById('prevMonth').onclick = () => changeMonth(-1);
    document.getElementById('nextMonth').onclick = () => changeMonth(1);
    document.getElementById('newResBtn').onclick = () => openModal();
    document.getElementById('closeModal').onclick = closeModal;
    btnCancel.onclick = closeModal;
    
    gridBodyContainer.addEventListener('scroll', syncScroll);
    [inpPrice, inpDeposit].forEach(el => el.addEventListener('input', calculateBalance));
    document.addEventListener('mouseup', handleDragEnd);

    function calculateBalance() {
        const price = parseFloat(inpPrice.value) || 0;
        const deposit = parseFloat(inpDeposit.value) || 0;
        inpBalance.value = (price - deposit).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    }

    function syncScroll() { gridHeaderContainer.scrollLeft = gridBodyContainer.scrollLeft; }
    function changeMonth(delta) { currentDate.setMonth(currentDate.getMonth() + delta); renderGrid(); }
    
    function formatDateLocal(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // --- RENDERIZADO ---
    function renderGrid() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        monthYearDisplay.textContent = new Date(year, month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);

        daysHeader.innerHTML = '';
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = date.getTime() === today.getTime();
            const cell = document.createElement('div');
            cell.className = `day-header-cell flex-shrink-0 no-select ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`;
            cell.innerHTML = `<span class="uppercase font-bold text-xs opacity-60">${dayName}</span><span class="text-sm font-bold">${i}</span>`;
            daysHeader.appendChild(cell);
        }

        cabinLabels.innerHTML = '';
        gridCells.innerHTML = '';

        for (let cabin = 1; cabin <= 6; cabin++) {
            const label = document.createElement('div');
            label.className = 'cabin-label-cell no-select';
            label.innerHTML = `🏠 Cabaña ${cabin}`;
            cabinLabels.appendChild(label);

            const row = document.createElement('div');
            row.className = 'grid-row relative min-w-max';
            row.id = `row-cabin-${cabin}`;

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const dateStr = formatDateLocal(date);
                const cell = document.createElement('div');
                cell.className = `grid-cell flex-shrink-0 no-select ${isWeekend ? 'weekend' : ''}`;
                cell.dataset.date = dateStr;
                cell.dataset.cabin = cabin;
                cell.dataset.dayIndex = day;

                if (isLoggedIn) {
                    cell.addEventListener('mousedown', (e) => handleDragStart(e, cabin, dateStr, day, row));
                    cell.addEventListener('mouseenter', (e) => handleDragMove(e, dateStr, day));
                } else {
                    cell.style.cursor = 'not-allowed';
                }

                row.appendChild(cell);
            }

            const cabinReservations = reservations.filter(r => r.cabinId == cabin);
            cabinReservations.forEach(res => {
                const startParts = res.checkIn.split('-');
                const start = new Date(startParts[0], startParts[1]-1, startParts[2]);
                const endParts = res.checkOut.split('-');
                const end = new Date(endParts[0], endParts[1]-1, endParts[2]);

                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month, daysInMonth);

                if (end < monthStart || start > monthEnd) return;

                const visibleStart = start < monthStart ? monthStart : start;
                const visibleEnd = end > monthEnd ? monthEnd : end;
                const startDay = visibleStart.getDate();
                const diffTime = visibleEnd - visibleStart;
                let durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (durationDays < 1) durationDays = 1;
                if (end > monthEnd) durationDays += 1; 

                const leftPos = (startDay - 1) * CELL_WIDTH;
                const widthPx = durationDays * CELL_WIDTH - 4; 

                const bar = document.createElement('div');
                bar.className = `reservation-bar res-${res.status} no-select`;
                bar.style.left = `${leftPos + 2}px`;
                bar.style.width = `${widthPx}px`;
                bar.innerHTML = `<span class="truncate text-xs">${res.guestName}</span>`;
                bar.onclick = (e) => { e.stopPropagation(); openModal(res); };
                row.appendChild(bar);
            });

            gridCells.appendChild(row);
        }
    }

    // --- DRAG ---
    function handleDragStart(e, c, dateStr, idx, row) {
        if (e.button !== 0 || !isLoggedIn) return;
        e.preventDefault();
        isDragging = true;
        dragStart = { c, idx, row };
        dragEnd = { dateStr, idx };
        if(dragSelectionEl) dragSelectionEl.remove();
        dragSelectionEl = document.createElement('div');
        dragSelectionEl.className = 'selection-highlight';
        updateSelectionVisual();
        row.appendChild(dragSelectionEl);
    }
    function handleDragMove(e, dateStr, idx) {
        if (!isDragging) return;
        e.preventDefault();
        dragEnd = { dateStr, idx };
        updateSelectionVisual();
    }
    function handleDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        let s = dragStart.idx, eIdx = dragEnd.idx;
        if (s > eIdx) [s, eIdx] = [eIdx, s];
        const y = currentDate.getFullYear(), m = currentDate.getMonth();
        const inDate = formatDateLocal(new Date(y, m, s));
        const outDate = formatDateLocal(new Date(y, m, eIdx + 1));
        openModal(null, dragStart.c, inDate, outDate);
        if(dragSelectionEl) { dragSelectionEl.remove(); dragSelectionEl = null; }
        dragStart = null;
    }
    function updateSelectionVisual() {
        if (!dragSelectionEl || !dragStart) return;
        let s = dragStart.idx, e = dragEnd.idx;
        if (s > e) [s, e] = [e, s];
        dragSelectionEl.style.left = `${(s-1)*CELL_WIDTH}px`;
        dragSelectionEl.style.width = `${(e-s+1)*CELL_WIDTH}px`;
    }

    // --- GESTIÓN ---
    function openModal(res = null, cabinPre = 1, dateInPre = '', dateOutPre = '') {
        modal.classList.remove('hidden');
        resForm.reset();
        resFormError.textContent = ''; 
        btnDelete.classList.add('hidden');
        
        if (res) {
            document.getElementById('modalTitle').textContent = "Editar Reserva";
            inpId.value = res.id;
            inpCabin.value = res.cabinId;
            Array.from(radioStatus).forEach(r => r.checked = (r.value === res.status));
            inpCheckIn.value = res.checkIn;
            inpCheckOut.value = res.checkOut;
            inpName.value = res.guestName || '';
            inpDni.value = res.dni || '';
            inpPhone.value = res.phone || '';
            inpEmail.value = res.email || '';
            inpPax.value = res.pax || 1;
            inpPrice.value = res.price || '';
            inpDeposit.value = res.deposit || '';
            inpNotes.value = res.notes || '';
            calculateBalance();
            btnDelete.classList.remove('hidden');
        } else {
            document.getElementById('modalTitle').textContent = "Nueva Reserva";
            inpId.value = '';
            inpCabin.value = cabinPre;
            if (dateInPre) inpCheckIn.value = dateInPre;
            if (dateOutPre) inpCheckOut.value = dateOutPre;
            document.querySelector('input[name="status"][value="senado"]').checked = true;
            inpBalance.value = '';
        }
    }

    function closeModal() { modal.classList.add('hidden'); }
    function getStatusValue() { return Array.from(radioStatus).find(r => r.checked)?.value || 'senado'; }

    // --- GUARDAR ---
    resForm.onsubmit = (e) => {
        e.preventDefault();
        resFormError.textContent = "Guardando...";
        resFormError.className = "text-blue-600 text-xs font-bold text-center min-h-[1rem]";
        
        const newRes = {
            cabinId: inpCabin.value,
            status: getStatusValue(),
            checkIn: inpCheckIn.value,
            checkOut: inpCheckOut.value,
            guestName: inpName.value,
            dni: inpDni.value,
            phone: inpPhone.value,
            email: inpEmail.value,
            pax: inpPax.value,
            price: inpPrice.value,
            deposit: inpDeposit.value,
            notes: inpNotes.value
        };

        if (newRes.checkIn >= newRes.checkOut) { 
            resFormError.textContent = "Error: Salida debe ser posterior a entrada.";
            resFormError.className = "text-red-500 text-xs font-bold text-center min-h-[1rem]";
            return; 
        }

        const colRef = db.collection(COLLECTION_NAME);
        let promise;
        if (inpId.value) {
            promise = colRef.doc(inpId.value).update(newRes);
        } else {
            promise = colRef.add(newRes);
        }

        promise.then(() => {
            closeModal();
        }).catch(err => {
            console.error("Error Firebase:", err);
            resFormError.textContent = "Error: " + err.message;
            resFormError.className = "text-red-500 text-xs font-bold text-center min-h-[1rem]";
        });
    };

    btnDelete.onclick = () => {
        if(!inpId.value) return;
        if(confirm("¿Eliminar permanentemente?")) {
            db.collection(COLLECTION_NAME).doc(inpId.value).delete()
              .then(closeModal)
              .catch(err => alert("Error al eliminar: " + err.message));
        }
    };
});