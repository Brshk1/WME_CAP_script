// ==UserScript==
// @name         WME Alertas Regionales (GeoJSON y Meteoalarm TXT)
// @namespace    https://tusitio.com/
// @version      1.0
// @description  Carga polígonos desde archivo GeoJSON local por región y muestra tabla de alertas desde archivo TXT de Meteoalarm en Waze Map Editor usando OpenLayers y la Sidebar API oficial. Compatible con CSP y Firefox.
// @author       José Daniel + Copilot
// @match        https://www.waze.com/*editor*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_ID = "wme-alertas-regionales";
    const REGIONES = Array.from({length: 40}, (_, i) => `R${String(i + 1).padStart(2, '0')}`);
    const NIVELES = {
        amarillo: '#ffff00',
        naranja: '#ffa500',
        rojo: '#ff0000'
    };

    let vectorLayer = null;
    let features = [];

    function getMap() {
        return W.map.getOLMap();
    }

    function cargarGeojsonDesdeObjeto(geojson, nivel) {
        const map = getMap();

        if (vectorLayer) {
            map.removeLayer(vectorLayer);
        }

        const format = new OpenLayers.Format.GeoJSON({
            internalProjection: map.getProjectionObject(),
            externalProjection: new OpenLayers.Projection("EPSG:4326")
        });

        features = format.read(geojson);

        const style = new OpenLayers.Style({
            fillColor: NIVELES[nivel],
            fillOpacity: 0.3,
            strokeColor: NIVELES[nivel],
            strokeWidth: 2
        });

        const styleMap = new OpenLayers.StyleMap(style);

        vectorLayer = new OpenLayers.Layer.Vector("Alertas Regionales", {
            styleMap: styleMap
        });

        vectorLayer.addFeatures(features);
        map.addLayer(vectorLayer);
    }

    function actualizarColor(nivel) {
        if (!vectorLayer || features.length === 0) {
            alert("Primero debes cargar un archivo GeoJSON.");
            return;
        }

        const style = new OpenLayers.Style({
            fillColor: NIVELES[nivel],
            fillOpacity: 0.3,
            strokeColor: NIVELES[nivel],
            strokeWidth: 2
        });

        vectorLayer.styleMap = new OpenLayers.StyleMap(style);
        vectorLayer.redraw();
    }


    function parsearAlertasMeteoalarm(txt) {
        const alertas = [];
        // Extrae todos los bloques de alerta
        const emmaIdRegex = /<valueName>EMMA_ID<\/valueName>\s*<value>(.*?)<\/value>/g;
        const areaDescRegex = /<cap:areaDesc>(.*?)<\/cap:areaDesc>/g;
        const eventRegex = /<cap:event>(.*?)<\/cap:event>/g;
        const effectiveRegex = /<cap:effective>(.*?)<\/cap:effective>/g;
        const expiresRegex = /<cap:expires>(.*?)<\/cap:expires>/g;
        const nivelRegex = /<cap:severity>(.*?)<\/cap:severity>/g;

        // Encuentra todos los matches
        const emmaIds = [...txt.matchAll(emmaIdRegex)].map(m => m[1]);
        const areaDescs = [...txt.matchAll(areaDescRegex)].map(m => m[1]);
        const events = [...txt.matchAll(eventRegex)].map(m => m[1]);
        const effectives = [...txt.matchAll(effectiveRegex)].map(m => m[1]);
        const expires = [...txt.matchAll(expiresRegex)].map(m => m[1]);
        const nivel = [...txt.matchAll(nivelRegex)].map(m => m[1]);


        // El número de alertas es el mínimo de todos los arrays
        const n = Math.min(emmaIds.length, areaDescs.length, events.length, effectives.length, expires.length, nivel.length);

        for (let i = 0; i < n; i++) {
            alertas.push({
                emma_id: emmaIds[i],
                nivel: nivel[i],
                areaDesc: areaDescs[i],
                event: events[i],
                effective: effectives[i],
                expires: expires[i]
            });
        }

        return alertas;
    }

    function mostrarTablaAlertas(alertas, container) {
        // Elimina tabla previa si existe
        const prev = container.querySelector('.tabla-alertas-wrapper');
        if (prev) prev.remove();


        // Ordena por severidad: extreme > severe > moderate
        const severidadOrden = { extreme: 0, severe: 1, moderate: 2 };
        alertas.sort((a, b) => {
            const sa = (/extreme/i.test(a.nivel)) ? 0 : (/severe/i.test(a.nivel)) ? 1 : 2;
            const sb = (/extreme/i.test(b.nivel)) ? 0 : (/severe/i.test(b.nivel)) ? 1 : 2;
            return sa - sb;
        });


        const tablaWrapper = document.createElement('div');
        tablaWrapper.className = 'tabla-alertas-wrapper';
        tablaWrapper.style.overflowX = 'auto';
        tablaWrapper.style.maxWidth = '100%';

        const tabla = document.createElement('table');
        tabla.className = 'tabla-alertas';
        tabla.style.marginTop = '10px';
        tabla.style.borderCollapse = 'collapse';
        tabla.style.background = '#fff';
        tabla.style.fontSize = '8px';
        tabla.style.minWidth = '600px';

        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>
        <th style="border:1px solid #ccc;padding:4px;">EMMA_ID</th>
        <th style="border:1px solid #ccc;padding:4px;">Nivel</th>
        <th style="border:1px solid #ccc;padding:4px;">Región</th>
        <th style="border:1px solid #ccc;padding:4px;">Evento</th>
        <th style="border:1px solid #ccc;padding:4px;">Inicio</th>
        <th style="border:1px solid #ccc;padding:4px;">Fin</th>
    </tr>`;
        tabla.appendChild(thead);

        const tbody = document.createElement('tbody');
        let selectedRow = null;
        let selectedData = null;

        alertas.forEach(a => {

            // Determina el color según el nivel de severidad
            let bgColor = '';
            if (/extreme/i.test(a.nivel)) {
                bgColor = '#ffd6d6'; // rojo suave
            } else if (/severe/i.test(a.nivel)) {
                bgColor = '#ffe7c2'; // naranja suave
            } else if (/moderate/i.test(a.nivel)) {
                bgColor = '#fffbc2'; // amarillo suave
            }

            const tr = document.createElement('tr');
            tr.style.background = bgColor;
            tr.style.cursor = 'pointer';
            tr.innerHTML = `<td style="border:1px solid #ccc;padding:4px;">${a.emma_id}</td>
                        <td style="border:1px solid #ccc;padding:4px;">${a.nivel}</td>
                        <td style="border:1px solid #ccc;padding:4px;">${a.areaDesc}</td>
                        <td style="border:1px solid #ccc;padding:4px;">${a.event}</td>
                        <td style="border:1px solid #ccc;padding:4px;">${a.effective}</td>
                        <td style="border:1px solid #ccc;padding:4px;">${a.expires}</td>`;
            // Selección de fila
            tr.onclick = function() {
                // Quita selección previa
                if (selectedRow) selectedRow.style.outline = '';
                selectedRow = tr;
                selectedData = a;
                tr.style.outline = '2px solid #0078d7';
            };

            tbody.appendChild(tr);
        });
        tabla.appendChild(tbody);

        tablaWrapper.appendChild(tabla);
        container.appendChild(tablaWrapper);

        // Botón para crear evento
        let eventoBtn = container.querySelector('.crear-evento-btn');
        if (!eventoBtn) {
            eventoBtn = document.createElement('button');
            eventoBtn.textContent = 'Crear evento';
            eventoBtn.className = 'crear-evento-btn';
            eventoBtn.style.marginTop = '10px';
            eventoBtn.onclick = function() {
                if (!selectedData) {
                    alert('Selecciona una fila primero.');
                    return;
                }
                // Aquí va la acción que quieras realizar con selectedData
                // Por ejemplo, mostrar los datos:
                alert(
                    `Evento creado:\n\n` +
                    `EMMA_ID: ${selectedData.emma_id}\n` +
                    `Región: ${selectedData.areaDesc}\n` +
                    `Evento: ${selectedData.event}\n` +
                    `Inicio: ${selectedData.effective}\n` +
                    `Fin: ${selectedData.expires}`
                );
            };
            container.appendChild(eventoBtn);
        }

    }

    // --- FIN NUEVO ---

    function crearInterfaz(tabPane) {
        const container = document.createElement('div');
        container.style.padding = '10px';

        // Botón Meteoalarm
        const meteoBtn = document.createElement('button');
        meteoBtn.textContent = 'Abrir Meteoalarm España';
        meteoBtn.onclick = () => {
            window.open('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain', '_blank');
        };
        container.appendChild(document.createElement('br'));
        container.appendChild(meteoBtn);
        container.appendChild(document.createElement('br'));

        // Selectores de región y nivel
        const regionSelect = document.createElement('select');
        REGIONES.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            regionSelect.appendChild(opt);
        });

        const levelSelect = document.createElement('select');
        Object.keys(NIVELES).forEach(level => {
            const opt = document.createElement('option');
            opt.value = level;
            opt.textContent = level.charAt(0).toUpperCase() + level.slice(1);
            levelSelect.appendChild(opt);
        });

        // Input para GeoJSON
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.geojson,application/json';
        fileInput.style.display = 'none';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Seleccionar archivo de región';
        loadBtn.onclick = () => {
            const region = regionSelect.value;
            alert(`Selecciona el archivo ${region}.geojson desde tu disco local.`);
            fileInput.click();
        };

        fileInput.onchange = () => {
            const file = fileInput.files[0];
            const nivel = levelSelect.value;

            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const geojson = JSON.parse(e.target.result);
                    cargarGeojsonDesdeObjeto(geojson, nivel);
                } catch (err) {
                    alert("Error al leer el archivo GeoJSON: " + err);
                }
            };
            reader.readAsText(file);
        };

        const updateColorBtn = document.createElement('button');
        updateColorBtn.textContent = 'Actualizar Color';
        updateColorBtn.style.marginTop = '5px';
        updateColorBtn.onclick = () => {
            const nivel = levelSelect.value;
            actualizarColor(nivel);
        };

        container.appendChild(document.createTextNode('Región:'));
        container.appendChild(document.createElement('br'));
        container.appendChild(regionSelect);
        container.appendChild(document.createElement('br'));
        container.appendChild(document.createTextNode('Nivel de alerta:'));
        container.appendChild(document.createElement('br'));
        container.appendChild(levelSelect);
        container.appendChild(document.createElement('br'));
        container.appendChild(loadBtn);
        container.appendChild(fileInput);
        container.appendChild(document.createElement('br'));
        container.appendChild(updateColorBtn);

        // --- NUEVO: Input y botón para TXT de alertas ---
        const txtInput = document.createElement('input');
        txtInput.type = 'file';
        //txtInput.accept = '.txt';
        txtInput.style.display = 'none';

        const loadTxtBtn = document.createElement('button');
        loadTxtBtn.textContent = 'Seleccionar archivo de alertas';
        loadTxtBtn.style.marginTop = '10px';
        loadTxtBtn.onclick = () => {
            txtInput.click();
        };


        txtInput.onchange = () => {
            const file = txtInput.files[0];
            // Aquí filtras por nombre:
            if (!file) return;
            if (!file.name.startsWith('meteoalarm-legacy-atom-spain')) {
                alert('Por favor selecciona un archivo que empiece por "meteoalarm-legacy-atom-spain".');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const txt = e.target.result;
                const alertas = parsearAlertasMeteoalarm(txt);
                mostrarTablaAlertas(alertas, container);
            };
            reader.readAsText(file);
        };


        container.appendChild(document.createElement('br'));
        container.appendChild(loadTxtBtn);
        container.appendChild(txtInput);
        // --- FIN NUEVO ---

        tabPane.appendChild(container);
    }

    function inicializarSidebar() {
        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab(SCRIPT_ID);

        tabLabel.innerText = 'Alertas';
        tabLabel.title = 'Alertas por Región';

        tabPane.addEventListener("element-connected", () => {
            crearInterfaz(tabPane);
        }, { once: true });

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            // Ya está en el DOM
        });
    }

    function esperarWME() {
        if (typeof W === 'undefined' || typeof W.map === 'undefined' || typeof W.userscripts === 'undefined') {
            setTimeout(esperarWME, 1000);
        } else {
            inicializarSidebar();
        }
    }

    esperarWME();
})();
