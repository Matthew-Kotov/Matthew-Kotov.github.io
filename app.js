class ApartmentFilterApp {
    constructor() {
        this.map = null;
        this.layers = {
            apartments: null,
            schools: null,
            kindergartens: null,
            hospitals: null,
            stops: null,
            priceLabels: null,
            customPoint: null,
            bufferZone: null
        };
        this.layerVisibility = {
            schools: false,
            kindergartens: false,
            hospitals: false,
            stops: false,
            priceLabels: true
        };
        this.filteredApartments = [];
        this.allApartments = [];
        this.customPoint = null;
        this.isSettingCustomPoint = false;
        this.bufferRadius = 500;
        this.listPanelOpen = false;
        this.selectedApartment = null;
        this.selectedMarker = null;
        this.excelData = [];
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.initLayers();
        this.initEventListeners();
        this.initPriceLabels();
        this.initListPanel();
    }
    
    initMap() {
        const cityBounds = L.latLngBounds(
            CONFIG.CITY_BOUNDS.southWest,
            CONFIG.CITY_BOUNDS.northEast
        );
        
        this.map = L.map('map', {
            minZoom: 12,
            zoomControl: true,
            maxBounds: cityBounds,
            maxBoundsViscosity: 0.5
        }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        this.map.on('zoomend', () => this.updatePriceLabels());
        
        this.map.on('click', (e) => {
            if (this.isSettingCustomPoint) {
                this.setCustomPoint(e.latlng);
                this.isSettingCustomPoint = false;
                const btn = document.getElementById('set-custom-point');
                if (btn) btn.textContent = 'Установить точку на карте';
            }
        });
    }
    
    initLayers() {
        this.loadApartmentLayer('sale');
        this.loadSchoolsLayer();
        this.loadKindergartensLayer();
        this.loadHospitalsLayer();
        this.loadStopsLayer();
    }
    
    initPriceLabels() {
        this.priceLabelsLayer = L.layerGroup().addTo(this.map);
        this.updatePriceLabels();
    }
    
    setCustomPoint(latlng) {
        if (this.layers.customPoint) this.map.removeLayer(this.layers.customPoint);
        
        this.layers.customPoint = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-point-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }),
            zIndexOffset: 1000
        }).addTo(this.map);
        
        this.customPoint = latlng;
        
        const coordsEl = document.getElementById('custom-point-coords');
        if (coordsEl) {
            coordsEl.textContent = `Координаты: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
        }
        
        this.createBufferZone();
        this.applyFilters();
    }
    
    clearCustomPoint() {
        if (this.layers.customPoint) {
            this.map.removeLayer(this.layers.customPoint);
            this.layers.customPoint = null;
        }
        if (this.layers.bufferZone) {
            this.map.removeLayer(this.layers.bufferZone);
            this.layers.bufferZone = null;
        }
        this.customPoint = null;
        
        const coordsEl = document.getElementById('custom-point-coords');
        if (coordsEl) coordsEl.textContent = 'Координаты: не установлены';
        
        this.applyFilters();
    }
    
    createBufferZone() {
        if (!this.customPoint) return;
        
        if (this.layers.bufferZone) this.map.removeLayer(this.layers.bufferZone);
        
        const radiusInput = document.getElementById('radius');
        this.bufferRadius = radiusInput ? parseInt(radiusInput.value) || 500 : 500;
        
        this.layers.bufferZone = L.circle(this.customPoint, {
            radius: this.bufferRadius,
            color: '#007cbf',
            fillColor: '#007cbf',
            fillOpacity: 0.15,
            weight: 3,
            dashArray: '5, 5'
        });
        
        const showBuffers = document.getElementById('show-buffers');
        if (showBuffers && showBuffers.checked) {
            this.layers.bufferZone.addTo(this.map);
        }
    }
    
    updateBufferZone() {
        if (this.customPoint) {
            this.createBufferZone();
            this.applyFilters();
        }
    }
    
    initListPanel() {
        const showListBtn = document.getElementById('show-list-btn');
        if (showListBtn) showListBtn.addEventListener('click', () => this.toggleListPanel());
        
        const closeList = document.getElementById('close-list');
        if (closeList) closeList.addEventListener('click', () => this.toggleListPanel());
        
        const downloadBtn = document.getElementById('download-excel');
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadExcel());
    }
    
    updatePriceLabels() {
        if (!this.priceLabelsLayer || !this.layerVisibility.priceLabels) return;
        
        this.priceLabelsLayer.clearLayers();
        
        const currentZoom = this.map.getZoom();
        const apartmentsToShow = currentZoom >= 14 ? this.filteredApartments : 
                                currentZoom >= 12 ? this.filteredApartments.slice(0, 50) : 
                                currentZoom >= 10 ? this.filteredApartments.slice(0, 20) : [];
        
        const dealType = document.getElementById('deal-type').value;
        
        apartmentsToShow.forEach(apartment => {
            const props = apartment.properties;
            const coords = apartment.geometry.coordinates;
            const price = dealType === 'sale' ? props.price : props.price_per_month;
            
            if (price) {
                const priceLabel = this.createPriceLabel(price, dealType, coords, currentZoom);
                this.priceLabelsLayer.addLayer(priceLabel);
            }
        });
    }
    
    createPriceLabel(price, dealType, coords, zoom) {
        const [lng, lat] = coords;
        const isCompact = zoom < 14;
        
        let priceText;
        if (dealType === 'sale') {
            if (price < 1) priceText = isCompact ? `${(price * 1000).toFixed(0)}т` : `${this.formatPrice(price)} млн`;
            else priceText = isCompact ? `${price.toFixed(1)}м` : `${this.formatPrice(price)} млн`;
        } else {
            if (price < 1000) priceText = isCompact ? `${price}р` : `${this.formatPrice(price, 0)} руб`;
            else if (price < 10000) priceText = isCompact ? `${(price / 1000).toFixed(1)}т` : `${this.formatPrice(price, 0)} руб`;
            else priceText = isCompact ? `${Math.round(price / 1000)}т` : `${Math.round(price / 1000)} тыс. руб`;
        }
        
        const labelDiv = L.divIcon({
            className: `price-marker ${dealType} ${isCompact ? 'compact' : ''}`,
            html: `<div style="font-weight: 800;">${priceText}</div>`,
            iconSize: [isCompact ? 45 : 55, isCompact ? 22 : 26],
            iconAnchor: [isCompact ? 22 : 27, isCompact ? 26 : 30]
        });
        
        return L.marker([lat, lng], {
            icon: labelDiv,
            zIndexOffset: 1000
        });
    }
    
    async loadApartmentLayer(dealType) {
        const fileName = dealType === 'sale' ? 'sale.geojson' : 'rent.geojson';
        const style = dealType === 'sale' ? CONFIG.STYLES.SALE : CONFIG.STYLES.RENT;
        
        try {
            if (this.layers.apartments) this.map.removeLayer(this.layers.apartments);
            
            const response = await fetch(`data/${fileName}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const geojson = await response.json();
            
            // Используем координаты из properties если они есть
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'apartments');
            
            this.allApartments = transformedGeojson.features || [];
            this.filteredApartments = [...this.allApartments];
            
            this.populateDistricts();
            
            this.layers.apartments = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: style.radius,
                    fillColor: style.color,
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    layer.feature = feature;
                    this.bindApartmentPopup(feature, layer, dealType);
                }
            }).addTo(this.map);
            
            this.updateResultsCount();
            this.updatePriceLabels();
            
            if (this.layers.apartments.getBounds().isValid()) {
                this.map.fitBounds(this.layers.apartments.getBounds());
            }
        } catch (error) {
            alert(`Ошибка загрузки данных квартир: ${error.message}`);
        }
    }
    
    useCoordinatesFromProperties(geojson, layerType = 'apartments') {
        if (!geojson.features) return geojson;
        
        const transformedFeatures = geojson.features.map(feature => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const props = feature.properties;
                let newCoords = null;
                
                // Для квартир используем latitude/longitude
                if (layerType === 'apartments') {
                    if (props.latitude !== undefined && props.longitude !== undefined) {
                        newCoords = [props.longitude, props.latitude];
                    }
                } 
                // Для остальных слоёв проверяем разные варианты названий полей
                else {
                    if (props.X !== undefined && props.Y !== undefined) {
                        newCoords = [props.X, props.Y];
                    } else if (props._longitude !== undefined && props._latitude !== undefined) {
                        newCoords = [props._longitude, props._latitude];
                    } else if (props.longitude !== undefined && props.latitude !== undefined) {
                        newCoords = [props.longitude, props.latitude];
                    } else if (props.x !== undefined && props.y !== undefined) {
                        newCoords = [props.x, props.y];
                    }
                }
                
                if (newCoords) {
                    return {
                        ...feature,
                        geometry: {
                            type: 'Point',
                            coordinates: newCoords
                        }
                    };
                }
            }
            return feature;
        });
        
        return { ...geojson, features: transformedFeatures };
    }
    
    populateDistricts() {
        const districtSelect = document.getElementById('district');
        if (!districtSelect) return;
        
        while (districtSelect.children.length > 1) {
            districtSelect.removeChild(districtSelect.lastChild);
        }
        
        const districts = new Set();
        this.allApartments.forEach(apartment => {
            if (apartment.properties.district) districts.add(apartment.properties.district);
        });
        
        districts.forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
        });
    }
    
    bindApartmentPopup(feature, layer, dealType) {
        const props = feature.properties;
        const price = dealType === 'sale' ? props.price : props.price_per_month;
        const priceLabel = dealType === 'sale' ? 'Цена продажи' : 'Цена аренды в месяц';
        
        const content = `
            <div class="popup-content">
                <h4>Квартира</h4>
                <p><strong>${priceLabel}:</strong> ${this.formatPrice(price)} ${dealType === 'sale' ? 'млн. руб.' : 'руб.'}</p>
                <p><strong>Площадь:</strong> ${props.total_meters} м²</p>
                <p><strong>Комнат:</strong> ${props.rooms_count === -1 ? 'Свободная планировка' : props.rooms_count}</p>
                <p><strong>Район:</strong> ${props.district || 'Не указан'}</p>
                <p><strong>Адрес:</strong> ${props.street || ''} ${props.house_number || ''}</p>
                <p><strong>Этаж:</strong> ${props.floor}/${props.floors_count}</p>
                ${props.url ? `<p><a href="${props.url}" target="_blank">Ссылка на объявление</a></p>` : ''}
            </div>
        `;
        
        layer.bindPopup(content);
    }
    
    async loadSchoolsLayer() {
        try {
            const response = await fetch('data/schools.geojson');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const geojson = await response.json();
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'schools');
            
            this.layers.schools = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: CONFIG.STYLES.SCHOOLS.radius,
                    fillColor: CONFIG.STYLES.SCHOOLS.color,
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.Полно || props.Кратк || props.name || props.NAME || props.Name || 'Школа';
                    const address = props.Улица && props.Дом ? `${props.Улица}, ${props.Дом}` : 
                                    props.address || props.ADDRESS || props.Address || 'Адрес не указан';
                    
                    layer.bindPopup(`
                        <div class="popup-content">
                            <h4>🏫 Школа</h4>
                            <p><strong>Название:</strong> ${name}</p>
                            <p><strong>Адрес:</strong> ${address}</p>
                        </div>
                    `);
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки школ:', error);
        }
    }
    
    async loadKindergartensLayer() {
        try {
            const response = await fetch('data/kindergartens.geojson');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const geojson = await response.json();
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'kindergartens');
            
            this.layers.kindergartens = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: CONFIG.STYLES.KINDERGARTENS.radius,
                    fillColor: CONFIG.STYLES.KINDERGARTENS.color,
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.Тип_д || props.name || props.NAME || props.Name || 'Детский сад';
                    const address = props.Улица && props.Дом ? `${props.Улица}, ${props.Дом}` : 
                                    props.address || props.ADDRESS || props.Address || 'Адрес не указан';
                    
                    layer.bindPopup(`
                        <div class="popup-content">
                            <h4>🏠 Детский сад</h4>
                            <p><strong>Название:</strong> ${name}</p>
                            <p><strong>Адрес:</strong> ${address}</p>
                        </div>
                    `);
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки детских садов:', error);
        }
    }
    
    async loadHospitalsLayer() {
        try {
            const response = await fetch('data/hospitals.geojson');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const geojson = await response.json();
            
            // Обрабатываем MultiPoint геометрию
            const processedFeatures = [];
            geojson.features.forEach(feature => {
                if (feature.geometry.type === 'MultiPoint') {
                    feature.geometry.coordinates.forEach(coord => {
                        processedFeatures.push({
                            type: 'Feature',
                            properties: feature.properties,
                            geometry: { type: 'Point', coordinates: coord }
                        });
                    });
                } else {
                    processedFeatures.push(feature);
                }
            });
            
            const processedGeojson = { ...geojson, features: processedFeatures };
            const transformedGeojson = this.useCoordinatesFromProperties(processedGeojson, 'hospitals');
            
            this.layers.hospitals = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: '#dc3545',
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.full_name || props.name || props.name_2 || props.full_name_2 || 'Медицинское учреждение';
                    const type = props.type_objec || props.type_objec_2 || '';
                    const address = props.street && props.house_numb ? 
                        `${props.street}, ${props.house_numb}` : 
                        props.address || 'Адрес не указан';
                    const phone = props.phone_head || props.phone_head_2 || '';
                    
                    let popupContent = `<div class="popup-content"><h4>🏥 Больница</h4>`;
                    popupContent += `<p><strong>Название:</strong> ${name}</p>`;
                    if (type) popupContent += `<p><strong>Тип:</strong> ${type}</p>`;
                    popupContent += `<p><strong>Адрес:</strong> ${address}</p>`;
                    if (phone) popupContent += `<p><strong>Телефон:</strong> ${phone}</p>`;
                    if (props.mode || props.mode_2) {
                        popupContent += `<p><strong>Режим работы:</strong> ${props.mode || props.mode_2}</p>`;
                    }
                    popupContent += `</div>`;
                    
                    layer.bindPopup(popupContent);
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки больниц:', error);
        }
    }
    
    async loadStopsLayer() {
        try {
            const response = await fetch('data/stops.geojson');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const geojson = await response.json();
            
            // Обрабатываем - в stops.geojson координаты уже правильные
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'stops');
            
            this.layers.stops = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: '#6f42c1',
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.full_name || props.name || 'Остановка';
                    const bus = props.bus || props.trolleybus || props.tram || '';
                    
                    let popupContent = `<div class="popup-content"><h4>🚏 Остановка</h4>`;
                    popupContent += `<p><strong>Название:</strong> ${name}</p>`;
                    if (bus) popupContent += `<p><strong>Маршруты:</strong> ${bus}</p>`;
                    popupContent += `</div>`;
                    
                    layer.bindPopup(popupContent);
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки остановок:', error);
        }
    }
    
    toggleLayer(layerName) {
        if (layerName === 'priceLabels') {
            this.layerVisibility.priceLabels = !this.layerVisibility.priceLabels;
            if (this.layerVisibility.priceLabels) {
                this.priceLabelsLayer.addTo(this.map);
            } else {
                this.map.removeLayer(this.priceLabelsLayer);
            }
            this.updateLayerButton(layerName);
            return;
        }
        
        if (this.layers[layerName]) {
            if (this.layerVisibility[layerName]) {
                this.map.removeLayer(this.layers[layerName]);
                this.layerVisibility[layerName] = false;
            } else {
                this.map.addLayer(this.layers[layerName]);
                this.layerVisibility[layerName] = true;
            }
            this.updateLayerButton(layerName);
        }
    }
    
    updateLayerButton(layerName) {
        const button = document.getElementById(`toggle-${layerName}`);
        if (!button) return;
        
        if (this.layerVisibility[layerName]) {
            button.classList.remove('inactive');
            button.classList.add('active');
        } else {
            button.classList.remove('active');
            button.classList.add('inactive');
        }
    }
    
    initEventListeners() {
        document.getElementById('menu-button')?.addEventListener('click', () => this.toggleMenu());
        document.getElementById('close-menu')?.addEventListener('click', () => this.toggleMenu());
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-filters')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('deal-type')?.addEventListener('change', (e) => this.loadApartmentLayer(e.target.value));
        
        document.getElementById('toggle-schools')?.addEventListener('click', () => this.toggleLayer('schools'));
        document.getElementById('toggle-kindergartens')?.addEventListener('click', () => this.toggleLayer('kindergartens'));
        document.getElementById('toggle-hospitals')?.addEventListener('click', () => this.toggleLayer('hospitals'));
        document.getElementById('toggle-stops')?.addEventListener('click', () => this.toggleLayer('stops'));
        
        this.addPriceLabelsButton();
        
        document.getElementById('show-buffers')?.addEventListener('change', (e) => this.onShowBuffersChange(e.target.checked));
        document.getElementById('set-custom-point')?.addEventListener('click', () => this.startSettingCustomPoint());
        document.getElementById('clear-custom-point')?.addEventListener('click', () => this.clearCustomPoint());
        
        const radius = document.getElementById('radius');
        radius?.addEventListener('change', (e) => this.onRadiusChange(parseInt(e.target.value) || 500));
        radius?.addEventListener('input', (e) => this.onRadiusChange(parseInt(e.target.value) || 500));
    }
    
    onShowBuffersChange(show) {
        if (this.layers.bufferZone) {
            if (show) this.layers.bufferZone.addTo(this.map);
            else this.map.removeLayer(this.layers.bufferZone);
        }
    }
    
    onRadiusChange(newRadius) {
        this.bufferRadius = newRadius;
        if (this.customPoint) this.updateBufferZone();
        this.applyFilters();
    }
    
    startSettingCustomPoint() {
        this.isSettingCustomPoint = true;
        const btn = document.getElementById('set-custom-point');
        if (btn) btn.textContent = 'Кликните на карте для установки точки';
    }
    
    addPriceLabelsButton() {
        if (document.getElementById('toggle-priceLabels')) return;
        
        const layerControls = document.querySelector('.layer-controls');
        if (!layerControls) return;
        
        const priceButton = document.createElement('button');
        priceButton.id = 'toggle-priceLabels';
        priceButton.className = 'layer-btn active';
        priceButton.innerHTML = '<span>💰 Цены</span>';
        priceButton.addEventListener('click', () => this.toggleLayer('priceLabels'));
        layerControls.appendChild(priceButton);
    }
    
    toggleMenu() {
        document.getElementById('side-menu')?.classList.toggle('open');
    }
    
    toggleListPanel() {
        const listPanel = document.getElementById('list-panel');
        if (!listPanel) return;
        
        listPanel.classList.toggle('open');
        this.listPanelOpen = !this.listPanelOpen;
        
        if (this.listPanelOpen) this.updateApartmentList();
    }
    
    applyFilters() {
        const filters = this.getCurrentFilters();
        this.filterApartments(filters);
        
        if (this.customPoint) {
            this.applyRadiusFilter();
        } else {
            const selectedObjects = document.querySelectorAll('input[name="nearby"]:checked');
            if (selectedObjects.length > 0) this.applyObjectFilter();
        }
        
        this.clearHighlight();
        if (this.listPanelOpen) this.updateApartmentList();
        
        this.updateMap();
        this.updateResultsCount();
        this.updatePriceLabels();
    }
    
    getCurrentFilters() {
        const dealTypeSelect = document.getElementById('deal-type');
        const priceMaxInput = document.getElementById('price-max');
        const areaMinInput = document.getElementById('area-min');
        const districtSelect = document.getElementById('district');
        
        const roomCheckboxes = document.querySelectorAll('input[name="rooms"]:checked');
        const selectedRooms = Array.from(roomCheckboxes).map(cb => parseInt(cb.value));
        
        return {
            dealType: dealTypeSelect?.value || 'sale',
            priceMax: priceMaxInput?.value ? parseFloat(priceMaxInput.value) : null,
            areaMin: areaMinInput?.value ? parseFloat(areaMinInput.value) : null,
            selectedRooms,
            district: districtSelect?.value || ''
        };
    }
    
    filterApartments(filters) {
        this.filteredApartments = this.allApartments.filter(apartment => {
            const props = apartment.properties;
            
            if (filters.priceMax) {
                const price = filters.dealType === 'sale' ? props.price : props.price_per_month;
                if (!price || price > filters.priceMax) return false;
            }
            
            if (filters.areaMin && (!props.total_meters || props.total_meters < filters.areaMin)) return false;
            
            if (filters.selectedRooms.length > 0 && !filters.selectedRooms.includes(props.rooms_count)) return false;
            
            if (filters.district && props.district !== filters.district) return false;
            
            return true;
        });
    }
    
    applyRadiusFilter() {
        if (!this.customPoint) return;
        
        this.filteredApartments = this.filteredApartments.filter(apartment => {
            const aptPoint = apartment.geometry.coordinates;
            return this.isPointInRadius(aptPoint, this.customPoint, this.bufferRadius);
        });
    }
    
    applyObjectFilter() {
        const selectedObjects = Array.from(
            document.querySelectorAll('input[name="nearby"]:checked')
        ).map(cb => cb.value);
        
        if (selectedObjects.length === 0) return;
        
        const condition = document.getElementById('nearby-condition')?.value || 'any';
        const radius = this.bufferRadius;
        
        this.filteredApartments = this.filteredApartments.filter(apartment => {
            const aptPoint = apartment.geometry.coordinates;
            
            const results = selectedObjects.map(type => {
                const layer = this.layers[type];
                return layer ? this.isNearObjects(aptPoint, layer, radius) : false;
            });
            
            return condition === 'any' ? results.some(r => r) : results.every(r => r);
        });
    }
    
    isPointInRadius(apartmentCoords, centerPoint, radius) {
        const [lng, lat] = apartmentCoords;
        return L.latLng(lat, lng).distanceTo(centerPoint) <= radius;
    }
    
    isNearObjects(apartmentCoords, objectLayer, radius) {
        const [lng, lat] = apartmentCoords;
        const aptLatLng = L.latLng(lat, lng);
        let isNear = false;
        
        objectLayer.eachLayer(layer => {
            if (aptLatLng.distanceTo(layer.getLatLng()) <= radius) {
                isNear = true;
                return false; // break
            }
        });
        
        return isNear;
    }
    
    updateMap() {
        if (this.layers.apartments) this.map.removeLayer(this.layers.apartments);
        
        const dealType = document.getElementById('deal-type')?.value || 'sale';
        const style = dealType === 'sale' ? CONFIG.STYLES.SALE : CONFIG.STYLES.RENT;
        
        const filteredGeoJSON = {
            type: "FeatureCollection",
            features: this.filteredApartments
        };
        
        this.layers.apartments = L.geoJSON(filteredGeoJSON, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                radius: style.radius,
                fillColor: style.color,
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8
            }),
            onEachFeature: (feature, layer) => this.bindApartmentPopup(feature, layer, dealType)
        }).addTo(this.map);
        
        if (this.filteredApartments.length > 0 && this.layers.apartments.getBounds().isValid()) {
            this.map.fitBounds(this.layers.apartments.getBounds());
        }
    }
    
    updateResultsCount() {
        const resultsEl = document.getElementById('results-count');
        if (resultsEl) resultsEl.textContent = `Найдено квартир: ${this.filteredApartments.length}`;
    }
    
    updateApartmentList() {
        const listContainer = document.getElementById('apartments-list');
        const listCount = document.getElementById('list-count');
        if (!listContainer || !listCount) return;
        
        listCount.textContent = this.filteredApartments.length;
        
        if (this.filteredApartments.length === 0) {
            listContainer.innerHTML = '<div class="no-results">Квартиры не найдены</div>';
            return;
        }
        
        const dealType = document.getElementById('deal-type')?.value || 'sale';
        let html = '';
        
        this.excelData = this.filteredApartments.map((apartment, index) => {
            const props = apartment.properties;
            const price = dealType === 'sale' ? props.price : props.price_per_month;
            const priceText = dealType === 'sale' ? 
                `${this.formatPrice(price)} млн руб.` : 
                `${this.formatPrice(price, 0)} руб./мес`;
            
            const roomsText = props.rooms_count === -1 ? 'Свободная планировка' : `${props.rooms_count} комн.`;
            const address = props.street ? `${props.street} ${props.house_number || ''}`.trim() : 'Адрес не указан';
            
            html += `
                <div class="apartment-item" data-index="${index}">
                    <h4><span>${roomsText}</span><span class="price">${priceText}</span></h4>
                    <div class="details">
                        <div class="detail"><strong>Площадь:</strong> ${props.total_meters} м²</div>
                        <div class="detail"><strong>Этаж:</strong> ${props.floor}/${props.floors_count}</div>
                        <div class="detail"><strong>Район:</strong> ${props.district || 'Не указан'}</div>
                        <div class="detail"><strong>Цена м²:</strong> ${this.calcPricePerMeter(price, props.total_meters, dealType)}</div>
                    </div>
                    <div class="address">${address}</div>
                    ${props.url ? `<a href="${props.url}" target="_blank" class="link">Перейти к объявлению</a>` : ''}
                </div>
            `;
            
            return { apartment, price, roomsText, address, priceText };
        });
        
        listContainer.innerHTML = html;
        
        document.querySelectorAll('.apartment-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') return;
                this.highlightApartment(parseInt(item.dataset.index));
            });
        });
    }
    
    highlightApartment(index) {
        this.clearHighlight();
        this.selectedApartment = this.filteredApartments[index];
        
        if (!this.layers.apartments) return;
        
        this.layers.apartments.eachLayer((layer) => {
            if (layer.feature === this.selectedApartment) {
                layer.setStyle({ fillColor: '#ff9800', color: '#ff9800', weight: 3, fillOpacity: 0.9 });
                
                const coords = this.selectedApartment.geometry.coordinates;
                this.selectedMarker = L.marker([coords[1], coords[0]], {
                    icon: L.divIcon({
                        className: 'selected-apartment-marker',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    }),
                    zIndexOffset: 1000
                }).addTo(this.map);
                
                layer.openPopup();
                this.map.setView([coords[1], coords[0]], this.map.getZoom());
                
                document.querySelectorAll('.apartment-item').forEach((item, i) => {
                    item.classList.toggle('selected', i === index);
                    if (i === index) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
                
                return false;
            }
        });
    }
    
    clearHighlight() {
        if (this.layers.apartments) {
            const dealType = document.getElementById('deal-type')?.value || 'sale';
            const style = dealType === 'sale' ? CONFIG.STYLES.SALE : CONFIG.STYLES.RENT;
            
            this.layers.apartments.eachLayer((layer) => {
                layer.setStyle({
                    fillColor: style.color,
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                });
            });
        }
        
        if (this.selectedMarker) {
            this.map.removeLayer(this.selectedMarker);
            this.selectedMarker = null;
        }
        
        document.querySelectorAll('.apartment-item').forEach(item => item.classList.remove('selected'));
        this.selectedApartment = null;
    }
    
    calcPricePerMeter(price, area, dealType) {
        if (!price || !area || area <= 0) return '-';
        
        const ppm = price / area;
        
        if (dealType === 'sale') {
            return ppm < 1 ? `${(ppm * 1000).toFixed(0)} тыс./м²` : `${ppm.toFixed(2)} млн/м²`;
        } else {
            return `${Math.round(ppm)} руб./м²`;
        }
    }
    
    clearFilters() {
        document.getElementById('price-max')?.value &&= '';
        document.getElementById('area-min')?.value &&= '';
        document.getElementById('radius')?.value &&= '500';
        document.getElementById('district')?.value &&= '';
        
        document.querySelectorAll('input[name="rooms"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="nearby"]').forEach(cb => cb.checked = false);
        
        const nearbyCondition = document.getElementById('nearby-condition');
        if (nearbyCondition) nearbyCondition.value = 'any';
        
        const showBuffers = document.getElementById('show-buffers');
        if (showBuffers) showBuffers.checked = true;
        
        this.clearCustomPoint();
        this.clearHighlight();
        
        if (this.listPanelOpen) this.updateApartmentList();
        
        this.filteredApartments = [...this.allApartments];
        this.updateMap();
        this.updateResultsCount();
        this.updatePriceLabels();
    }
    
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }
    
    downloadExcel() {
        if (this.filteredApartments.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        const dealType = document.getElementById('deal-type')?.value || 'sale';
        const priceLabel = dealType === 'sale' ? 'Цена продажи (млн. руб.)' : 'Цена аренды (руб./мес)';
        
        const excelData = this.filteredApartments.map((apartment, index) => {
            const props = apartment.properties;
            const price = dealType === 'sale' ? props.price : props.price_per_month;
            
            return {
                '№': index + 1,
                'Тип сделки': dealType === 'sale' ? 'Продажа' : 'Аренда',
                [priceLabel]: price,
                'Цена за м²': this.calcPricePerMeter(price, props.total_meters, dealType),
                'Площадь (м²)': props.total_meters,
                'Комнат': props.rooms_count === -1 ? 'Свободная планировка' : props.rooms_count,
                'Этаж': `${props.floor}/${props.floors_count}`,
                'Район': props.district || 'Не указан',
                'Адрес': `${props.street || ''} ${props.house_number || ''}`.trim(),
                'Ссылка': props.url || '',
                'Широта': apartment.geometry.coordinates[1],
                'Долгота': apartment.geometry.coordinates[0]
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 5 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 12 }
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Квартиры");
        
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        XLSX.writeFile(wb, `Квартиры_${dateStr}_${timeStr}.xlsx`);
        
        this.showNotification(`Файл с ${this.filteredApartments.length} квартирами успешно скачан!`);
    }
    
    showNotification(message) {
        const existing = document.querySelector('.excel-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'excel-notification';
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #28a745; color: white;
            padding: 15px 20px; border-radius: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 2000; font-weight: bold; animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        if (!document.querySelector('#excel-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'excel-notification-styles';
            style.textContent = `
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => new ApartmentFilterApp());
