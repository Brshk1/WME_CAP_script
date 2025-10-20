// ==UserScript==
// @name         WME Alertas por Región y Nivel (Dinámico)
// @namespace    https://tusitio.com/
// @version      0.3
// @description  Carga polígonos dinámicos por región y aplica color según nivel de alerta en Waze Map Editor
// @author       José Daniel
// @match        https://www.waze.com/*editor*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const REGIONES = Array.from({length: 40}, (_, i) => `R${String(i + 1).padStart(2, '0')}`);
    const NIVELES = {
        amarillo: '#ffff00',
        naranja: '#ffa500',
        rojo: '#ff0000'
    };

    let layerGroup = null;
    let geometries = [];

    function waitForWME() {
        if (typeof W === 'undefined' || typeof W.map === 'undefined') {
            setTimeout(waitForWME, 1000);
        } else {
            initUI();
        }
    }

    function initUI() {
        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.top = '100px';
        panel.style.right = '20px';
        panel.style.zIndex = 9999;
        panel.style.background = 'white';
        panel.style.padding = '10px';
        panel.style.border = '1px solid #ccc';
        panel.style.borderRadius = '5px';

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

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Cargar Geometrías';
        loadBtn.onclick = () => {
            const region = regionSelect.value;
            const nivel = levelSelect.value;
            cargarGeometrias(region, nivel);
        };

        const updateColorBtn = document.createElement('button');
        updateColorBtn.textContent = 'Actualizar Color';
        updateColorBtn.style.marginTop = '5px';
        updateColorBtn.onclick = () => {
            const nivel = levelSelect.value;
            actualizarColor(nivel);
        };

        panel.appendChild(document.createTextNode('Región: '));
        panel.appendChild(regionSelect);
        panel.appendChild(document.createElement('br'));
        panel.appendChild(document.createTextNode('Nivel: '));
        panel.appendChild(levelSelect);
        panel.appendChild(document.createElement('br'));
        panel.appendChild(loadBtn);
        panel.appendChild(document.createElement('br'));
        panel.appendChild(updateColorBtn);

        document.body.appendChild(panel);
    }

    function cargarGeometrias(region, nivel) {
        if (layerGroup) {
            layerGroup.remove();
        }
        geometries = [];
        layerGroup = L.layerGroup().addTo(W.map);

        const indexUrl = `https://tuservidor.com/geometrias/${region}/index.json`;

        fetch(indexUrl)
            .then(res => res.json())
            .then(files => {
                files.forEach(file => {
                    const url = `https://tuservidor.com/geometrias/${region}/${file}`;
                    fetch(url)
                        .then(res => res.json())
                        .then(data => {
                            const color = NIVELES[nivel];
                            const geoLayer = L.geoJSON(data, {
                                style: {
                                    color: color,
                                    weight: 3,
                                    opacity: 0.7,
                                    fillOpacity: 0.2
                                }
                            }).addTo(layerGroup);
                            geometries.push({ layer: geoLayer, data: data });
                        })
                        .catch(err => {
                            console.error(`Error al cargar ${file}:`, err);
                        });
                });
            })
            .catch(err => {
                alert(`No se pudo cargar el índice de la región ${region}: ${err}`);
            });
    }

    function actualizarColor(nivel) {
        const color = NIVELES[nivel];
        if (!layerGroup || geometries.length === 0) {
            alert("Primero debes cargar una región.");
            return;
        }

        layerGroup.clearLayers();

        geometries.forEach(g => {
            const geoLayer = L.geoJSON(g.data, {
                style: {
                    color: color,
                    weight: 3,
                    opacity: 0.7,
                    fillOpacity: 0.2
                }
            }).addTo(layerGroup);
            g.layer = geoLayer;
        });
    }

    waitForWME();
})();
