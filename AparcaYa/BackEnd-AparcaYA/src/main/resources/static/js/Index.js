let parkings     = [];
let currentIndex = 0;

// DOMContentLoaded
// CAMBIO: se elimina el bloque que añadía .opacity-100 a .animate-fade-in-up
// aparca-animations.css ya maneja la animación con forwards, no necesita JS
document.addEventListener('DOMContentLoaded', function() {
    loadParkingAccordion();
});


// ==================== ACORDEÓN DE PARQUEADEROS ====================
async function loadParkingAccordion() {
    try {
        const response = await fetch('/api/sedes');
        if (!response.ok) throw new Error('Error al cargar parqueaderos');

        parkings = await response.json();

        if (parkings.length > 0) {
            showParking(currentIndex);
            generateDots();

            // Auto-slide cada 5 segundos
            setInterval(() => {
                currentIndex = (currentIndex + 1) % parkings.length;
                showParking(currentIndex);
                updateDots();
            }, 5000);
        }
    } catch (error) {
        console.error('Error cargando parqueaderos:', error);
        const accordion = document.getElementById('parking-accordion');
        if (accordion) {
            accordion.innerHTML = `
                <p class="text-red-500 p-4 text-center text-sm">
                    Error al cargar parqueaderos. Intenta más tarde.
                </p>`;
        }
    }
}

function showParking(index) {
    const accordion = document.getElementById('parking-accordion');
    if (!accordion) return;

    const parking = parkings[index];
    const imagen  = parking.imagenUrl
        ? `<img src="${parking.imagenUrl}" alt="${parking.nombre}"
               class="w-16 h-16 rounded-full object-cover">`
        : `<div class="w-16 h-16 bg-gray-300 rounded-full flex
                       items-center justify-content text-2xl">📷</div>`;

    accordion.innerHTML = `
        <div class="collapse collapse-arrow join-item border border-base-300">
            <input type="radio" name="parking-accordion" checked />
            <div class="collapse-title text-xl font-medium flex items-center gap-4">
                ${imagen}
                ${parking.nombre}
            </div>
            <div class="collapse-content">
                <p><strong>Dirección:</strong>
                   ${parking.direccion.calle} ${parking.direccion.numero},
                   ${parking.direccion.ciudad}</p>
                <p><strong>Horarios:</strong>
                   ${parking.horaApertura} - ${parking.horaCierre}</p>
                <p><strong>Capacidades:</strong>
                   Carros: ${parking.capacidadCarros},
                   Motos: ${parking.capacidadMotos},
                   Bicicletas: ${parking.capacidadBicicletas}</p>
                <p><strong>Descripción:</strong>
                   ${parking.descripcion || 'Sin descripción'}</p>
            </div>
        </div>
    `;
}

function generateDots() {
    const dotsBar = document.getElementById('dots-bar');
    if (!dotsBar) return;

    dotsBar.innerHTML = '';
    parkings.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = `btn btn-circle btn-xs ${index === 0 ? 'btn-primary' : 'btn-outline'}`;
        dot.setAttribute('aria-label', `Parqueadero ${index + 1}`);
        dot.addEventListener('click', () => {
            currentIndex = index;
            showParking(currentIndex);
            updateDots();
        });
        dotsBar.appendChild(dot);
    });
}

function updateDots() {
    const dots = document.querySelectorAll('#dots-bar .btn');
    dots.forEach((dot, index) => {
        dot.classList.toggle('btn-primary', index === currentIndex);
        dot.classList.toggle('btn-outline', index !== currentIndex);
    });
}


// ==================== NAVEGACIÓN CON FLECHAS ====================
// CAMBIO: .addEventListener directo → ?.addEventListener
// Los botones existen en el HTML pero se protege contra
// posibles ausencias en entornos de prueba
document.getElementById('prev-arrow')?.addEventListener('click', function() {
    if (parkings.length > 0) {
        currentIndex = (currentIndex - 1 + parkings.length) % parkings.length;
        showParking(currentIndex);
        updateDots();
    }
});

document.getElementById('next-arrow')?.addEventListener('click', function() {
    if (parkings.length > 0) {
        currentIndex = (currentIndex + 1) % parkings.length;
        showParking(currentIndex);
        updateDots();
    }
});