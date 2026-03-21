/* ============================================================
   INDEX.JS — AparcaYA
   Slideshow automático en la columna derecha del hero.
   Solo imágenes, sin texto, pasando con fade cada 4s.
   ============================================================ */

let heroSlides = [];
let heroIndex  = 0;
let heroTimer  = null;

document.addEventListener('DOMContentLoaded', function () {
    loadHeroSlideshow();
});

async function loadHeroSlideshow() {
    try {
        const response = await fetch('/api/sedes');
        if (!response.ok) throw new Error('Error al cargar sedes');

        const sedes = await response.json();

        heroSlides = sedes.filter(function (s) { return s.imagenSede; });

        if (heroSlides.length === 0) {
            ocultarLoading();
            return;
        }

        crearSlides();
        crearDots();
        ocultarLoading();
        irASlide(0);

        heroTimer = setInterval(function () {
            irASlide((heroIndex + 1) % heroSlides.length);
        }, 4000);

    } catch (error) {
        console.error('Error cargando slideshow:', error);
        ocultarLoading();
    }
}

function crearSlides() {
    var slideshow = document.getElementById('hero-slideshow');
    if (!slideshow) return;
    var fade = slideshow.querySelector('.hero-slide-fade');
    heroSlides.forEach(function (sede, i) {
        var div = document.createElement('div');
        div.className = 'hero-slide';
        div.style.backgroundImage = "url('/uploads/" + sede.imagenSede + "')";
        slideshow.insertBefore(div, fade);
    });
}

function crearDots() {
    var dotsWrap = document.getElementById('hero-dots');
    if (!dotsWrap || heroSlides.length <= 1) return;
    heroSlides.forEach(function (_, i) {
        var btn = document.createElement('button');
        btn.className = 'hero-slide-dot';
        btn.setAttribute('aria-label', 'Sede ' + (i + 1));
        btn.addEventListener('click', function () {
            clearInterval(heroTimer);
            irASlide(i);
            heroTimer = setInterval(function () {
                irASlide((heroIndex + 1) % heroSlides.length);
            }, 4000);
        });
        dotsWrap.appendChild(btn);
    });
}

function irASlide(index) {
    heroIndex = index;
    document.querySelectorAll('.hero-slide').forEach(function (el, i) {
        el.classList.toggle('active', i === index);
    });
    document.querySelectorAll('.hero-slide-dot').forEach(function (dot, i) {
        dot.classList.toggle('active', i === index);
    });
}

function ocultarLoading() {
    var loading = document.getElementById('hero-slide-loading');
    if (!loading) return;
    loading.style.opacity = '0';
    setTimeout(function () { loading.style.display = 'none'; }, 500);
}