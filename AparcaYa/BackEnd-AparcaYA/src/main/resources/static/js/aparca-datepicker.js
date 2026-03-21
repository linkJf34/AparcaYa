// ============================================================
// APARCA-DATEPICKER.JS
// Ruta: /js/aparca-datepicker.js
//
// Calendario de fecha simple (sin hora) reutilizable en
// cualquier dashboard. Confirma al hacer clic en el día.
//
// USO:
//   new AparcaDatepicker({
//     btnId:      'btnDesdeReserva',
//     popupId:    'popDesdeReserva',
//     labelId:    'lblDesdeReserva',
//     hiddenId:   'filtroFechaDesdeReserva',
//     gridId:     'gridDesdeReserva',
//     mesId:      'mesDesdeReserva',
//     prevId:     'prevDesdeReserva',
//     nextId:     'nextDesdeReserva',
//     placeholder: 'Fecha inicio',
//     soloFuturo:  false,
//     onConfirm:  function(iso) { filtrarReservas(); }
//   });
// ============================================================

(function(global) {
    'use strict';

    var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    function pad(n) { return String(n).padStart(2, '0'); }
    function el(id) { return id ? document.getElementById(id) : null; }

    function toISO(dt) {
        return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    }
    function toLabel(dt) {
        return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function AparcaDatepicker(opts) {
        var now = new Date();
        this.opts = opts;
        this._y   = now.getFullYear();
        this._m   = now.getMonth();
        this._day = null;
        this._bindNav();
        this._bindTrigger();
        this._bindAfuera();
    }

    AparcaDatepicker.prototype._bindNav = function() {
        var self = this;
        var prev = el(this.opts.prevId);
        var next = el(this.opts.nextId);
        if (prev) { prev.onclick = function(e) { e.stopPropagation(); self.navMes(-1); }; }
        if (next) { next.onclick = function(e) { e.stopPropagation(); self.navMes(1);  }; }
    };

    AparcaDatepicker.prototype._bindTrigger = function() {
        var self = this;
        var btn  = el(this.opts.btnId);
        if (btn) { btn.onclick = function() { self.toggle(); }; }
    };

    AparcaDatepicker.prototype._bindAfuera = function() {
        var self = this;
        document.addEventListener('click', function(e) {
            var popup = el(self.opts.popupId);
            var btn   = el(self.opts.btnId);
            if (!popup || popup.style.display !== 'block') { return; }
            if (popup.contains(e.target)) { return; }
            if (btn && btn.contains(e.target)) { return; }
            self.cerrar();
        });
    };

    AparcaDatepicker.prototype.renderGrid = function() {
        var mesEl = el(this.opts.mesId);
        var grid  = el(this.opts.gridId);
        if (!mesEl || !grid) { return; }

        mesEl.textContent = MESES[this._m] + ' ' + this._y;
        grid.innerHTML    = '';

        var today    = new Date(); today.setHours(0, 0, 0, 0);
        var firstDay = new Date(this._y, this._m, 1).getDay();
        var offset   = firstDay === 0 ? 6 : firstDay - 1;
        var diasMes  = new Date(this._y, this._m + 1, 0).getDate();
        var self     = this;

        for (var i = 0; i < offset; i++) {
            var sp = document.createElement('span');
            sp.className = 'apk-day';
            sp.setAttribute('disabled', '');
            grid.appendChild(sp);
        }

        for (var d = 1; d <= diasMes; d++) {
            (function(dia) {
                var dt  = new Date(self._y, self._m, dia);
                var btn = document.createElement('button');
                btn.type        = 'button';
                btn.className   = 'apk-day';
                btn.textContent = dia;

                if (self.opts.soloFuturo && dt < today) { btn.setAttribute('disabled', ''); }
                if (dt.getTime() === today.getTime()) { btn.classList.add('apk-today'); }
                if (self._day && dt.getTime() === self._day.getTime()) { btn.classList.add('apk-sel'); }

                btn.onclick = function(e) {
                    e.stopPropagation();
                    if (self.opts.soloFuturo && dt < today) { return; }
                    self._day = dt;
                    self._confirmar();
                };
                grid.appendChild(btn);
            })(d);
        }
    };

    AparcaDatepicker.prototype.navMes = function(delta) {
        this._m += delta;
        if (this._m > 11) { this._m = 0;  this._y++; }
        if (this._m < 0)  { this._m = 11; this._y--; }
        this.renderGrid();
    };

    AparcaDatepicker.prototype.abrir = function() {
        var popup = el(this.opts.popupId);
        var btn   = el(this.opts.btnId);
        if (!popup || !btn) { return; }

        var rect = btn.getBoundingClientRect();
        var popW = 240;
        var top  = rect.bottom + 4;
        var left = rect.left;
        if (left + popW > window.innerWidth - 8) { left = rect.right - popW; }
        if (top  + 300 > window.innerHeight)     { top  = rect.top - 304; }

        popup.style.top     = top  + 'px';
        popup.style.left    = left + 'px';
        popup.style.display = 'block';
        if (btn) { btn.dataset.open = '1'; }
        this.renderGrid();
    };

    AparcaDatepicker.prototype.cerrar = function() {
        var popup = el(this.opts.popupId);
        var btn   = el(this.opts.btnId);
        if (popup) { popup.style.display = 'none'; }
        if (btn)   { delete btn.dataset.open; }
    };

    AparcaDatepicker.prototype.toggle = function() {
        var btn = el(this.opts.btnId);
        if (btn && btn.dataset.open) { this.cerrar(); }
        else { this.abrir(); }
    };

    AparcaDatepicker.prototype._confirmar = function() {
        if (!this._day) { return; }

        var iso      = toISO(this._day);
        var hiddenEl = el(this.opts.hiddenId);
        var labelEl  = el(this.opts.labelId);

        if (hiddenEl) { hiddenEl.value = iso; }
        if (labelEl)  { labelEl.textContent = toLabel(this._day); }

        this.cerrar();

        if (typeof this.opts.onConfirm === 'function') {
            this.opts.onConfirm(iso, this._day);
        }
    };

    AparcaDatepicker.prototype.limpiar = function() {
        var now = new Date();
        this._y   = now.getFullYear();
        this._m   = now.getMonth();
        this._day = null;

        var hiddenEl = el(this.opts.hiddenId);
        var labelEl  = el(this.opts.labelId);
        if (hiddenEl) { hiddenEl.value = ''; }
        if (labelEl)  { labelEl.textContent = this.opts.placeholder || 'Seleccionar'; }
        this.cerrar();
    };

    global.AparcaDatepicker = AparcaDatepicker;

})(window);