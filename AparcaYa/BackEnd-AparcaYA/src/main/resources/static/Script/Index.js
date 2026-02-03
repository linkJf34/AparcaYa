let parkings = [];
let currentIndex = 0;

// Animación mejorada al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    const elements = document.querySelectorAll('.animate-fade-in-up');
    elements.forEach((el, index) => {
        setTimeout(() => {
            el.classList.add('opacity-100');
        }, index * 300);
    });
    // Cargar accordion de parqueaderos
    loadParkingAccordion();
});

// Fetch y generar accordion de parqueaderos con imágenes
async function loadParkingAccordion() {
    try {
        const response = await fetch('http://localhost:8080/api/sedes');
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
        document.getElementById('parking-accordion').innerHTML = '<p class="text-red-500">Error al cargar parqueaderos. Intenta más tarde.</p>';
    }
}

// Mostrar sede actual en el accordion
function showParking(index) {
    const accordion = document.getElementById('parking-accordion');
    const parking = parkings[index];
    accordion.innerHTML = `
        <div class="collapse collapse-arrow join-item border border-base-300">
            <input type="radio" name="parking-accordion" checked />
            <div class="collapse-title text-xl font-medium flex items-center gap-4">
                ${parking.imagenUrl ? `<img src="${parking.imagenUrl}" alt="${parking.nombre}" class="w-16 h-16 rounded-full object-cover">` : '<div class="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">📷</div>'}
                ${parking.nombre}
            </div>
            <div class="collapse-content">
                <p><strong>Dirección:</strong> ${parking.direccion.calle} ${parking.direccion.numero}, ${parking.direccion.ciudad}</p>
                <p><strong>Horarios:</strong> ${parking.horaApertura} - ${parking.horaCierre}</p>
                <p><strong>Capacidades:</strong> Carros: ${parking.capacidadCarros}, Motos: ${parking.capacidadMotos}, Bicicletas: ${parking.capacidadBicicletas}</p>
                <p><strong>Descripción:</strong> ${parking.descripcion || 'Sin descripción'}</p>
            </div>
        </div>
    `;
}

// Generar barra de dots
function generateDots() {
    const dotsBar = document.getElementById('dots-bar');
    dotsBar.innerHTML = '';
    parkings.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = `btn btn-circle btn-xs ${index === 0 ? 'btn-primary' : 'btn-outline'}`;
        dot.addEventListener('click', () => {
            currentIndex = index;
            showParking(currentIndex);
            updateDots();
        });
        dotsBar.appendChild(dot);
    });
}

// Actualizar dots activos
function updateDots() {
    const dots = document.querySelectorAll('#dots-bar .btn');
    dots.forEach((dot, index) => {
        dot.classList.toggle('btn-primary', index === currentIndex);
        dot.classList.toggle('btn-outline', index !== currentIndex);
    });
}

// Navegación con flechas
document.getElementById('prev-arrow').addEventListener('click', function() {
    if (parkings.length > 0) {
        currentIndex = (currentIndex - 1 + parkings.length) % parkings.length;
        showParking(currentIndex);
        updateDots();
    }
});

document.getElementById('next-arrow').addEventListener('click', function() {
    if (parkings.length > 0) {
        currentIndex = (currentIndex + 1) % parkings.length;
        showParking(currentIndex);
        updateDots();
    }
});