import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA6c4YS_LbkoTgwr4kPRtJAQXWq4pBwhyU",
  authDomain: "reservasatsa-251a4.firebaseapp.com",
  databaseURL: "https://reservasatsa-251a4-default-rtdb.firebaseio.com",
  projectId: "reservasatsa-251a4",
  storageBucket: "reservasatsa-251a4.firebasestorage.app",
  messagingSenderId: "499318579854",
  appId: "1:499318579854:web:8bfa8bf15574f70009dfdf",
  measurementId: "G-401W2NX334"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedDate = null;
let allEvents = {}; 

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    listenToFirebase(); 
    renderCalendar();
    toggleFormFields(); 
}

// --- FUNCIONES ALERTA ---
window.showCustomAlert = function(message) {
    const alertBox = document.getElementById('custom-alert');
    const alertMsg = document.getElementById('custom-alert-message');
    alertMsg.innerText = message;
    alertBox.style.display = 'flex';
}
window.closeCustomAlert = function() {
    document.getElementById('custom-alert').style.display = 'none';
}

// --- FUNCIONES REGISTRO MENSUAL (Celeste) ---
window.openGuestModal = function() {
    document.getElementById('guest-modal').style.display = 'flex';
    renderGuestList();
}
window.closeGuestModal = function() {
    document.getElementById('guest-modal').style.display = 'none';
}

function renderGuestList() {
    const container = document.getElementById('guest-list-container');
    document.getElementById('report-month-label').innerText = `Registros de ${monthNames[currentMonth]} ${currentYear}`;
    container.innerHTML = "";

    const guests = getGuestsForCurrentMonth();

    if (guests.length === 0) {
        container.innerHTML = "<p style='text-align:center; margin-top:20px; color:#999;'>No hay ocupantes registrados en este mes.</p>";
        return;
    }

    guests.forEach(g => {
        const item = document.createElement('div');
        item.className = 'guest-item';
        item.innerHTML = `
            <strong>${g.occupant}</strong>
            <span>DNI: ${g.dni} | Tel: ${g.phone}</span>
            <span>Cabaña ${g.cabin} | ${g.startDate} al ${g.endDate}</span>
        `;
        container.appendChild(item);
    });
}

function getGuestsForCurrentMonth() {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const list = [];

    for (let key in allEvents) {
        const ev = allEvents[key];
        if (ev.status !== 'ocupado') continue;
        const start = new Date(ev.startDate.replace(/-/g, '/') + ' 00:00:00');
        const end = new Date(ev.endDate.replace(/-/g, '/') + ' 23:59:59');
        if (start <= lastDayOfMonth && end >= firstDayOfMonth) {
            list.push(ev);
        }
    }
    list.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    return list;
}

window.downloadGuestTxt = function() {
    const guests = getGuestsForCurrentMonth();
    if (guests.length === 0) {
        showCustomAlert("No hay datos para descargar.");
        return;
    }

    let textContent = `REGISTRO DE OCUPANTES - ${monthNames[currentMonth].toUpperCase()} ${currentYear}\n`;
    textContent += "==================================================\n\n";

    guests.forEach(g => {
        textContent += `NOMBRE:  ${g.occupant}\n`;
        textContent += `DNI:     ${g.dni}\n`;
        textContent += `TEL:     ${g.phone}\n`;
        textContent += `CABAÑA:  ${g.cabin}\n`;
        textContent += `FECHA:   ${g.startDate} hasta ${g.endDate}\n`;
        textContent += "--------------------------------------------------\n";
    });

    const blob = new Blob([textContent], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `Ocupantes_${monthNames[currentMonth]}_${currentYear}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.target = "_blank";
    anchor.click(); 
}

// --- LÓGICA GENERAL APP ---
function listenToFirebase() {
    const dbRef = ref(db, 'reservas');
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        allEvents = data || {}; 
        processAutoUpdates(); 
        renderCalendar();
        if(selectedDate) showActivities(selectedDate);
        
        // Actualizar modal lista si está abierto
        if(document.getElementById('guest-modal').style.display === 'flex') renderGuestList();
    });
}

function processAutoUpdates() {
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let key in allEvents) {
        let ev = allEvents[key];
        const startDate = new Date(ev.startDate.replace(/-/g, '/') + ' 00:00:00');
        const endDate = new Date(ev.endDate.replace(/-/g, '/') + ' 23:59:59');

        if (today > endDate) {
            remove(ref(db, 'reservas/' + key));
            continue; 
        }

        if (ev.status === 'reservado') {
            if (today >= startDate && today <= endDate) {
                ev.status = 'ocupado';
                set(ref(db, 'reservas/' + key), ev);
            }
        }
    }
}

function verificarConflicto(cabin, start, end) {
    const newStart = new Date(start.replace(/-/g, '/') + ' 00:00:00').getTime();
    const newEnd = new Date(end.replace(/-/g, '/') + ' 23:59:59').getTime();

    for (let key in allEvents) {
        const ev = allEvents[key];
        if (ev.cabin !== cabin) continue;
        const evStart = new Date(ev.startDate.replace(/-/g, '/') + ' 00:00:00').getTime();
        const evEnd = new Date(ev.endDate.replace(/-/g, '/') + ' 23:59:59').getTime();

        if (newStart <= evEnd && newEnd >= evStart) {
            return true; 
        }
    }
    return false; 
}

window.saveBooking = function(e) {
    e.preventDefault();
    
    const status = document.querySelector('input[name="status"]:checked').value;
    const cabin = document.getElementById('cabinSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (status !== 'limpieza') {
        const hayConflicto = verificarConflicto(cabin, startDate, endDate);
        if (hayConflicto) {
            showCustomAlert("⚠️ Esa cabaña ya está ocupada en esas fechas.");
            return; 
        }
    }

    const newId = 'res_' + Date.now();
    
    const newBooking = {
        id: newId,
        status: status,
        cabin: cabin,
        startDate: startDate,
        endDate: endDate,
        occupant: status === 'limpieza' ? 'Limpieza' : document.getElementById('occupantName').value,
        dni: status === 'limpieza' ? '' : document.getElementById('occupantDNI').value,
        phone: status === 'limpieza' ? '' : document.getElementById('occupantPhone').value
    };

    set(ref(db, 'reservas/' + newId), newBooking)
        .then(() => {
            closeModal();
            e.target.reset();
            document.querySelector('input[value="ocupado"]').checked = true;
            toggleFormFields();
            showCustomAlert("¡Guardado exitosamente!");
        })
        .catch((error) => {
            showCustomAlert("Error: " + error.message);
        });
}

document.getElementById('bookingForm').addEventListener('submit', window.saveBooking);

window.deleteEvent = function(key) {
    if(confirm("¿Borrar esta actividad?")) {
        remove(ref(db, 'reservas/' + key));
    }
}

window.toggleFormFields = function() {
    const statusRadio = document.querySelector('input[name="status"]:checked');
    if(!statusRadio) return; 
    const status = statusRadio.value;
    const detailsDiv = document.getElementById('details-container');
    const inputs = detailsDiv.querySelectorAll('input');

    if (status === 'limpieza') {
        detailsDiv.style.display = 'none';
        inputs.forEach(input => input.removeAttribute('required'));
    } else {
        detailsDiv.style.display = 'block';
        document.getElementById('occupantName').setAttribute('required', 'true');
        document.getElementById('occupantDNI').setAttribute('required', 'true');
    }
}

function renderCalendar() {
    const daysGrid = document.getElementById('daysGrid');
    const monthDisplay = document.getElementById('monthYearDisplay');
    
    daysGrid.innerHTML = "";
    monthDisplay.innerText = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) daysGrid.appendChild(document.createElement('div'));

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day');
        
        const dateString = formatDateStr(currentYear, currentMonth, day);
        const numberSpan = document.createElement('span');
        numberSpan.className = 'day-number';
        numberSpan.innerText = day;
        dayDiv.appendChild(numberSpan);

        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'badges-container';
        
        const eventsToday = getEventsForDate(dateString);
        eventsToday.slice(0, 4).forEach(ev => {
            const badge = document.createElement('span');
            badge.className = 'badge';
            if (ev.status === 'limpieza') {
                badge.innerText = `LP${ev.cabin}`; badge.classList.add('bg-clean');
            } else {
                badge.innerText = `CB${ev.cabin}`; badge.classList.add(`bg-c${ev.cabin}`);
            }
            badgesContainer.appendChild(badge);
        });

        dayDiv.appendChild(badgesContainer);

        const now = new Date();
        const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
        if (dateString === todayStr) dayDiv.classList.add('today');
        if (selectedDate === dateString) dayDiv.classList.add('selected');

        dayDiv.onclick = () => {
            document.querySelectorAll('.day').forEach(d => d.classList.remove('selected'));
            dayDiv.classList.add('selected');
            selectedDate = dateString;
            showActivities(dateString);
        };
        daysGrid.appendChild(dayDiv);
    }
}

document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar();
    if(document.getElementById('guest-modal').style.display === 'flex') renderGuestList();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar();
    if(document.getElementById('guest-modal').style.display === 'flex') renderGuestList();
});

function formatDateStr(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getEventsForDate(dateStr) {
    const checkDate = new Date(dateStr.replace(/-/g, '/') + ' 00:00:00').getTime();
    const eventsList = [];
    for (let key in allEvents) {
        const ev = allEvents[key];
        const start = new Date(ev.startDate.replace(/-/g, '/') + ' 00:00:00').getTime();
        const end = new Date(ev.endDate.replace(/-/g, '/') + ' 23:59:59').getTime();
        
        if (checkDate >= start && checkDate <= end) eventsList.push(ev);
    }
    eventsList.sort((a, b) => a.cabin - b.cabin);
    return eventsList;
}

function showActivities(dateStr) {
    const listContainer = document.getElementById('activities-list');
    const label = document.getElementById('selected-date-label');
    const [y, m, d] = dateStr.split('-');
    label.innerText = `(${d}/${m})`;
    listContainer.innerHTML = "";
    
    const eventsToday = getEventsForDate(dateStr);
    if (eventsToday.length > 0) {
        eventsToday.forEach(ev => {
            const card = document.createElement('div');
            const borderClass = ev.status === 'limpieza' ? 'status-limpieza' : `border-c${ev.cabin}`;
            card.classList.add('activity-card', borderClass);
            
            const title = ev.status === 'limpieza' ? `Cabaña ${ev.cabin} - LIMPIEZA` : `Cabaña ${ev.cabin} - ${ev.status.toUpperCase()}`;
            const occupantInfo = ev.status === 'limpieza' ? 'Mantenimiento' : `<strong>${ev.occupant}</strong> (DNI: ${ev.dni})`;

            card.innerHTML = `
                <div class="activity-info">
                    <h4>${title}</h4> <p>${occupantInfo}</p> <p>${ev.startDate} hasta ${ev.endDate}</p>
                </div>
                <button class="delete-btn" onclick="deleteEvent('${ev.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            listContainer.appendChild(card);
        });
    } else {
        listContainer.innerHTML = `<p class="empty-msg">No hay actividades.</p>`;
    }
}

window.openModal = () => { 
    document.getElementById('booking-modal').style.display = 'flex'; 
    document.querySelector('input[value="ocupado"]').checked = true; 
    toggleFormFields(); 
};
window.closeModal = () => document.getElementById('booking-modal').style.display = 'none';
window.toggleFormFields = toggleFormFields;