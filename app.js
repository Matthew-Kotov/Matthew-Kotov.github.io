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
        this.districts = new Set();
        this.priceLabelsLayer = null;
        this.customPoint = null;
        this.isSettingCustomPoint = false;
        this.bufferRadius = 500;

        this.listPanelOpen = false;
        this.selectedApartment = null;
        this.selectedMarker = null;
        this.highlightedApartments = [];

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
            zoomControle: true,
            maxBounds: cityBounds,
            maxBoundsViscosity: 0.5
        }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

        this.map.setMaxBounds(cityBounds);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        this.map.on('zoomend', () => {
            this.updatePriceLabels();
        });
        
        this.map.on('click', (e) => {
            if (this.isSettingCustomPoint) {
                this.setCustomPoint(e.latlng);
                this.isSettingCustomPoint = false;
                const setPointBtn = document.getElementById('set-custom-point');
                if (setPointBtn) {
                    setPointBtn.textContent = 'Установить точку на карте';
                }
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
        if (this.layers.customPoint) {
            this.map.removeLayer(this.layers.customPoint);
        }
        
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
        if (coordsEl) {
            coordsEl.textContent = 'Координаты: не установлены';
        }
        
        this.applyFilters();
    }
    
    createBufferZone() {
        if (!this.customPoint) return;
        
        if (this.layers.bufferZone) {
            this.map.removeLayer(this.layers.bufferZone);
        }
        
        const radiusInput = document.getElementById('radius');
        this.bufferRadius = radiusInput ? parseInt(radiusInput.value) || 500 : 500;
        
        this.layers.bufferZone = L.circle(this.customPoint, {
            radius: this.bufferRadius,
            color: '#007cbf',
            fillColor: '#007cbf',
            fillOpacity: 0.15,
            weight: 3,
            dashArray: '5, 5',
            className: 'buffer-custom'
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
        if (showListBtn) {
            showListBtn.addEventListener('click', () => {
                this.toggleListPanel();
            });
        }
        
        const closeList = document.getElementById('close-list');
        if (closeList) {
            closeList.addEventListener('click', () => {
                this.toggleListPanel();
            });
        }

        const downloadBtn = document.getElementById('download-excel');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadExcel();
            });
        }
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
        
        let priceText;
        let isCompact = zoom < 14;
        
        if (dealType === 'sale') {
            if (price < 1) {
                priceText = isCompact ? `${(price * 1000).toFixed(0)}т` : `${this.formatPrice(price)} млн`;
            } else {
                priceText = isCompact ? `${price.toFixed(1)}м` : `${this.formatPrice(price)} млн`;
            }
        } else {
            if (price < 1000) {
                priceText = isCompact ? `${price}р` : `${this.formatPrice(price, 0)} руб`;
            } else if (price < 10000) {
                const thousands = (price / 1000).toFixed(1);
                priceText = isCompact ? `${thousands}т` : `${this.formatPrice(price, 0)} руб`;
            } else {
                const thousands = Math.round(price / 1000);
                priceText = isCompact ? `${thousands}т` : `${thousands} тыс. руб`;
            }
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
    
    useCoordinatesFromProperties(geojson, layerType = 'apartments') {
        if (!geojson.features) return geojson;
        
        const transformedFeatures = geojson.features.map(feature => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const props = feature.properties;
                let newCoords = null;
                
                if (layerType === 'apartments') {
                    if (props.latitude !== undefined && props.longitude !== undefined) {
                        newCoords = [props.longitude, props.latitude];
                    }
                } 
                else if (layerType === 'schools' || layerType === 'kindergartens' || 
                         layerType === 'hospitals' || layerType === 'stops') {
                    if (props.X !== undefined && props.Y !== undefined) {
                        newCoords = [props.X, props.Y];
                    } else if (props._longitude !== undefined && props._latitude !== undefined) {
                        newCoords = [props._longitude, props._latitude];
                    }
                }
                
                if (newCoords) {
                    return {
                        ...feature,
                        geometry: {
                            ...feature.geometry,
                            coordinates: newCoords
                        }
                    };
                }
            }
            return feature;
        });
        
        return {
            ...geojson,
            features: transformedFeatures
        };
    }
    
    async loadApartmentLayer(dealType) {
        const fileName = dealType === 'sale' ? 'sale.geojson' : 'rent.geojson';
        const style = dealType === 'sale' ? CONFIG.STYLES.SALE : CONFIG.STYLES.RENT;
        
        try {
            if (this.layers.apartments) {
                this.map.removeLayer(this.layers.apartments);
            }
            
            const response = await fetch(`data/${fileName}`);
            console.log('Статус загрузки квартир:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geojson = await response.json();
            console.log('Данные квартир получены, количество объектов:', geojson.features ? geojson.features.length : 'нет features');
            
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'apartments');
            
            this.allApartments = transformedGeojson.features || [];
            this.filteredApartments = [...this.allApartments];
            
            this.populateDistricts();
            
            this.layers.apartments = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: style.radius,
                        fillColor: style.color,
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    layer.feature = feature;
                    this.bindApartmentPopup(feature, layer, dealType);
                }
            }).addTo(this.map);
            
            this.updateResultsCount();
            this.updatePriceLabels();
            
            if (this.layers.apartments.getBounds().isValid()) {
                this.map.fitBounds(this.layers.apartments.getBounds());
                console.log('Карта подстроена под данные квартир');
            } else {
                console.log('Невозможно подстроить карту - невалидные границы данных квартир');
            }
            
        } catch (error) {
            console.error('Ошибка загрузки слоя квартир:', error);
            alert(`Ошибка загрузки данных квартир: ${error.message}`);
        }
    }
    
    populateDistricts() {
        const districtSelect = document.getElementById('district');
        if (!districtSelect) return;
        
        while (districtSelect.children.length > 1) {
            districtSelect.removeChild(districtSelect.lastChild);
        }
        
        const districts = new Set();
        this.allApartments.forEach(apartment => {
            if (apartment.properties.district) {
                districts.add(apartment.properties.district);
            }
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
            console.log('Статус загрузки школ:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geojson = await response.json();
            console.log('Данные школ получены, количество:', geojson.features ? geojson.features.length : 0);
            
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'schools');
            
            this.layers.schools = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: CONFIG.STYLES.SCHOOLS.radius,
                        fillColor: CONFIG.STYLES.SCHOOLS.color,
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.Полно || props.Кратк || props.name || props.NAME || props.Name || 'Не указано';
                    const address = props.Улица && props.Дом ? `${props.Улица}, ${props.Дом}` : 
                                    props.address || props.ADDRESS || props.Address || 'Не указан';
                    
                    layer.bindPopup(`
                        <div class="popup-content">
                            <h4>🏫 Школа</h4>
                            <p><strong>Название:</strong> ${name}</p>
                            <p><strong>Адрес:</strong> ${address}</p>
                            <p><strong>Тип:</strong> ${props.Тип_о || ''}</p>
                        </div>
                    `);
                }
            });
            
        } catch (error) {
            console.error('Ошибка загрузки слоя школ:', error);
        }
    }
    
    async loadKindergartensLayer() {
        try {
            const response = await fetch('data/kindergartens.geojson');
            console.log('Статус загрузки детских садов:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geojson = await response.json();
            console.log('Данные детских садов получены, количество:', geojson.features ? geojson.features.length : 0);
            
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'kindergartens');
            
            this.layers.kindergartens = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: CONFIG.STYLES.KINDERGARTENS.radius,
                        fillColor: CONFIG.STYLES.KINDERGARTENS.color,
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.Тип_д || props.name || props.NAME || props.Name || 'Не указано';
                    const address = props.Улица && props.Дом ? `${props.Улица}, ${props.Дом}` : 
                                    props.address || props.ADDRESS || props.Address || 'Не указан';
                    
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
            console.error('Ошибка загрузки слоя детских садов:', error);
        }
    }

    async loadHospitalsLayer() {
        try {
            const response = await fetch('data/hospitals.geojson');
            console.log('Статус загрузки больниц:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geojson = await response.json();
            console.log('Данные больниц получены, количество:', geojson.features ? geojson.features.length : 0);
            
            // Обработка MultiPoint геометрии
            const processedFeatures = [];
            geojson.features.forEach(feature => {
                if (feature.geometry.type === 'MultiPoint') {
                    feature.geometry.coordinates.forEach(coord => {
                        processedFeatures.push({
                            type: 'Feature',
                            properties: feature.properties,
                            geometry: {
                                type: 'Point',
                                coordinates: coord
                            }
                        });
                    });
                } else {
                    processedFeatures.push(feature);
                }
            });
            
            const processedGeojson = {
                ...geojson,
                features: processedFeatures
            };
            
            const transformedGeojson = this.useCoordinatesFromProperties(processedGeojson, 'hospitals');
            
            this.layers.hospitals = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: '#dc3545',
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.name || props.full_name || props.name_2 || props.full_name_2 || 'Не указано';
                    const type = props.type_objec || props.type_objec_2 || 'Медицинское учреждение';
                    const address = props.street && props.house_numb ? 
                        `${props.street}, ${props.house_numb}` : 
                        props.address || 'Не указан';
                    const phone = props.phone_head || props.phone_head_2 || '';
                    
                    let popupContent = `
                        <div class="popup-content">
                            <h4>🏥 Больница</h4>
                            <p><strong>Название:</strong> ${name}</p>
                            <p><strong>Тип:</strong> ${type}</p>
                            <p><strong>Адрес:</strong> ${address}</p>
                    `;
                    
                    if (phone) {
                        popupContent += `<p><strong>Телефон:</strong> ${phone}</p>`;
                    }
                    
                    if (props.mode || props.mode_2) {
                        popupContent += `<p><strong>Режим работы:</strong> ${props.mode || props.mode_2}</p>`;
                    }
                    
                    popupContent += `</div>`;
                    
                    layer.bindPopup(popupContent);
                }
            });
            
        } catch (error) {
            console.error('Ошибка загрузки слоя больниц:', error);
        }
    }

    async loadStopsLayer() {
        try {
            const response = await fetch('data/stopping_complexes.geojson');
            console.log('Статус загрузки остановок:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geojson = await response.json();
            console.log('Данные остановок получены, количество:', geojson.features ? geojson.features.length : 0);
            
            // Преобразуем координаты из EPSG:3857 в WGS84
            const transformedFeatures = geojson.features.map(feature => {
                console.log(feature.geometry, feature.geometry.coordinates);
                if (feature.geometry && feature.geometry.coordinates) {
                    const [x, y] = feature.geometry.coordinates;
                    console.log(x, y);
                    
                    return {
                        ...feature,
                        geometry: {
                            type: 'Point',
                            coordinates: [x, y]
                        }
                    };
                }
                return feature;
            });
            
            const transformedGeojson = {
                ...geojson,
                features: transformedFeatures
            };
            
            this.layers.stops = L.geoJSON(transformedGeojson, {
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: 6,
                        fillColor: '#6f42c1',
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = props.full_name || props.name || 'Не указано';
                    const bus = props.bus || props.trolleybus || props.tram || '';
                    
                    let popupContent = `
                        <div class="popup-content">
                            <h4>🚏 Остановка</h4>
                            <p><strong>Название:</strong> ${name}</p>
                    `;
                    
                    if (bus) {
                        popupContent += `<p><strong>Маршруты:</strong> ${bus}</p>`;
                    }
                    
                    popupContent += `</div>`;
                    
                    layer.bindPopup(popupContent);
                }
            });
            
        } catch (error) {
            console.error('Ошибка загрузки слоя остановок:', error);
        }
    }
    
    toggleLayer(layerName) {
        if (layerName === 'priceLabels') {
            this.layerVisibility.priceLabels = !this.layerVisibility.priceLabels;
            if (this.layerVisibility.priceLabels) {
                this.priceLabelsLayer.addTo(this.map);
                const button = document.getElementById('toggle-priceLabels');
                if (button) {
                    button.classList.remove('inactive');
                    button.classList.add('active');
                }
            } else {
                this.map.removeLayer(this.priceLabelsLayer);
                const button = document.getElementById('toggle-priceLabels');
                if (button) {
                    button.classList.remove('active');
                    button.classList.add('inactive');
                }
            }
            return;
        }
        
        if (this.layers[layerName]) {
            if (this.layerVisibility[layerName]) {
                this.map.removeLayer(this.layers[layerName]);
                this.layerVisibility[layerName] = false;
                
                const button = document.getElementById(`toggle-${layerName}`);
                if (button) {
                    button.classList.remove('active');
                    button.classList.add('inactive');
                }
            } else {
                this.map.addLayer(this.layers[layerName]);
                this.layerVisibility[layerName] = true;
                
                const button = document.getElementById(`toggle-${layerName}`);
                if (button) {
                    button.classList.remove('inactive');
                    button.classList.add('active');
                }
            }
        }
    }
    
    initEventListeners() {
        const menuButton = document.getElementById('menu-button');
        if (menuButton) {
            menuButton.addEventListener('click', () => {
                this.toggleMenu();
            });
        }
        
        const closeMenu = document.getElementById('close-menu');
        if (closeMenu) {
            closeMenu.addEventListener('click', () => {
                this.toggleMenu();
            });
        }
        
        const applyFilters = document.getElementById('apply-filters');
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.applyFilters();
            });
        }
        
        const clearFilters = document.getElementById('clear-filters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearFilters();
            });
        }
        
        const dealType = document.getElementById('deal-type');
        if (dealType) {
            dealType.addEventListener('change', (e) => {
                this.loadApartmentLayer(e.target.value);
            });
        }
        
        const toggleSchools = document.getElementById('toggle-schools');
        if (toggleSchools) {
            toggleSchools.addEventListener('click', () => {
                this.toggleLayer('schools');
            });
        }
        
        const toggleKindergartens = document.getElementById('toggle-kindergartens');
        if (toggleKindergartens) {
            toggleKindergartens.addEventListener('click', () => {
                this.toggleLayer('kindergartens');
            });
        }
        
        const toggleHospitals = document.getElementById('toggle-hospitals');
        if (toggleHospitals) {
            toggleHospitals.addEventListener('click', () => {
                this.toggleLayer('hospitals');
            });
        }
        
        const toggleStops = document.getElementById('toggle-stops');
        if (toggleStops) {
            toggleStops.addEventListener('click', () => {
                this.toggleLayer('stops');
            });
        }
        
        this.addPriceLabelsButton();
        
        const showBuffers = document.getElementById('show-buffers');
        if (showBuffers) {
            showBuffers.addEventListener('change', (e) => {
                this.onShowBuffersChange(e.target.checked);
            });
        }
        
        const setCustomPoint = document.getElementById('set-custom-point');
        if (setCustomPoint) {
            setCustomPoint.addEventListener('click', () => {
                this.startSettingCustomPoint();
            });
        }
        
        const clearCustomPoint = document.getElementById('clear-custom-point');
        if (clearCustomPoint) {
            clearCustomPoint.addEventListener('click', () => {
                this.clearCustomPoint();
            });
        }
        
        const radius = document.getElementById('radius');
        if (radius) {
            radius.addEventListener('change', (e) => {
                this.onRadiusChange(parseInt(e.target.value) || 500);
            });
            
            radius.addEventListener('input', (e) => {
                this.onRadiusChange(parseInt(e.target.value) || 500);
            });
        }
        
        const nearbyCondition = document.getElementById('nearby-condition');
        if (nearbyCondition) {
            nearbyCondition.addEventListener('change', () => {
                // Не применяем фильтры сразу, ждем кнопку "Применить"
            });
        }
        
        document.querySelectorAll('input[name="nearby"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                // Не применяем фильтры сразу, ждем кнопку "Применить"
            });
        });
    }
    
    onShowBuffersChange(show) {
        if (this.layers.bufferZone) {
            if (show) {
                this.layers.bufferZone.addTo(this.map);
            } else {
                this.map.removeLayer(this.layers.bufferZone);
            }
        }
    }
    
    onRadiusChange(newRadius) {
        this.bufferRadius = newRadius;
        if (this.customPoint) {
            this.updateBufferZone();
        }
        this.applyFilters();
    }
    
    startSettingCustomPoint() {
        this.isSettingCustomPoint = true;
        const setPointBtn = document.getElementById('set-custom-point');
        if (setPointBtn) {
            setPointBtn.textContent = 'Кликните на карте для установки точки';
        }
        alert('Кликните на карте в нужном месте для установки точки. После установки будут показаны квартиры в указанном радиусе.');
    }
    
    addPriceLabelsButton() {
        if (document.getElementById('toggle-priceLabels')) return;
        
        const layerControls = document.querySelector('.layer-controls');
        if (!layerControls) return;
        
        const priceButton = document.createElement('button');
        priceButton.id = 'toggle-priceLabels';
        priceButton.className = 'layer-btn active';
        priceButton.innerHTML = '<span>💰 Цены</span>';
        priceButton.addEventListener('click', () => {
            this.toggleLayer('priceLabels');
        });
        layerControls.appendChild(priceButton);
    }
    
    toggleMenu() {
        const menu = document.getElementById('side-menu');
        if (menu) {
            menu.classList.toggle('open');
        }
    }

    toggleListPanel() {
        const listPanel = document.getElementById('list-panel');
        if (!listPanel) return;
        
        listPanel.classList.toggle('open');
        this.listPanelOpen = !this.listPanelOpen;
        
        if (this.listPanelOpen) {
            this.updateApartmentList();
        }
    }
    
    applyFilters() {
        const filters = this.getCurrentFilters();
        this.filterApartments(filters);
        
        if (this.customPoint) {
            this.applyRadiusFilter();
        } else {
            const selectedObjects = document.querySelectorAll('input[name="nearby"]:checked');
            if (selectedObjects.length > 0) {
                this.applyObjectFilter();
            }
        }

        this.clearHighlight();
        
        if (this.listPanelOpen) {
            this.updateApartmentList();
        }
        
        this.updateMap();
        this.updateResultsCount();
        this.updatePriceLabels();
    }
    
    getCurrentFilters() {
        const dealTypeSelect = document.getElementById('deal-type');
        const priceMaxInput = document.getElementById('price-max');
        const areaMinInput = document.getElementById('area-min');
        const districtSelect = document.getElementById('district');
        
        const dealType = dealTypeSelect ? dealTypeSelect.value : 'sale';
        const priceMax = priceMaxInput ? priceMaxInput.value : '';
        const areaMin = areaMinInput ? areaMinInput.value : '';
        const district = districtSelect ? districtSelect.value : '';
        
        const roomCheckboxes = document.querySelectorAll('input[name="rooms"]:checked');
        const selectedRooms = Array.from(roomCheckboxes).map(cb => parseInt(cb.value));
        
        return {
            dealType,
            priceMax: priceMax ? parseFloat(priceMax) : null,
            areaMin: areaMin ? parseFloat(areaMin) : null,
            selectedRooms,
            district
        };
    }
    
    filterApartments(filters) {
        this.filteredApartments = this.allApartments.filter(apartment => {
            const props = apartment.properties;
            
            if (filters.priceMax) {
                const price = filters.dealType === 'sale' ? props.price : props.price_per_month;
                if (!price || price > filters.priceMax) return false;
            }
            
            if (filters.areaMin && (!props.total_meters || props.total_meters < filters.areaMin)) {
                return false;
            }
            
            if (filters.selectedRooms.length > 0) {
                if (!filters.selectedRooms.includes(props.rooms_count)) {
                    return false;
                }
            }
            
            if (filters.district && props.district !== filters.district) {
                return false;
            }
            
            return true;
        });
    }
    
    applyRadiusFilter() {
        if (!this.customPoint) return;
        
        this.filteredApartments = this.filteredApartments.filter(apartment => {
            const apartmentPoint = apartment.geometry.coordinates;
            return this.isPointInRadius(apartmentPoint, this.customPoint, this.bufferRadius);
        });
    }
    
    applyObjectFilter() {
        const selectedObjects = Array.from(
            document.querySelectorAll('input[name="nearby"]:checked')
        ).map(cb => cb.value);
        
        if (selectedObjects.length === 0) return;
        
        const conditionSelect = document.getElementById('nearby-condition');
        const condition = conditionSelect ? conditionSelect.value : 'any';
        const radius = this.bufferRadius;
        
        this.filteredApartments = this.filteredApartments.filter(apartment => {
            const apartmentPoint = apartment.geometry.coordinates;
            
            const results = selectedObjects.map(type => {
                const layer = this.layers[type];
                return layer ? this.isNearObjects(apartmentPoint, layer, radius) : false;
            });
            
            if (condition === 'any') {
                return results.some(result => result === true);
            } else {
                return results.every(result => result === true);
            }
        });
    }
    
    isPointInRadius(apartmentCoords, centerPoint, radius) {
        const [lng, lat] = apartmentCoords;
        const apartmentLatLng = L.latLng(lat, lng);
        const distance = apartmentLatLng.distanceTo(centerPoint);
        return distance <= radius;
    }
    
    isNearObjects(apartmentCoords, objectLayer, radius) {
        const [lng, lat] = apartmentCoords;
        const apartmentLatLng = L.latLng(lat, lng);
        
        let isNear = false;
        
        objectLayer.eachLayer(layer => {
            const distance = apartmentLatLng.distanceTo(layer.getLatLng());
            if (distance <= radius) {
                isNear = true;
                return false;
            }
        });
        
        return isNear;
    }
    
    updateMap() {
        if (this.layers.apartments) {
            this.map.removeLayer(this.layers.apartments);
        }
        
        const dealTypeSelect = document.getElementById('deal-type');
        const dealType = dealTypeSelect ? dealTypeSelect.value : 'sale';
        const style = dealType === 'sale' ? CONFIG.STYLES.SALE : CONFIG.STYLES.RENT;
        
        const filteredGeoJSON = {
            type: "FeatureCollection",
            features: this.filteredApartments
        };
        
        this.layers.apartments = L.geoJSON(filteredGeoJSON, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: style.radius,
                    fillColor: style.color,
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                this.bindApartmentPopup(feature, layer, dealType);
            }
        }).addTo(this.map);
        
        if (this.filteredApartments.length > 0 && this.layers.apartments.getBounds().isValid()) {
            this.map.fitBounds(this.layers.apartments.getBounds());
        }
    }
    
    updateResultsCount() {
        const count = this.filteredApartments.length;
        const resultsEl = document.getElementById('results-count');
        if (resultsEl) {
            resultsEl.textContent = `Найдено квартир: ${count}`;
        }
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
        
        const dealTypeSelect = document.getElementById('deal-type');
        const dealType = dealTypeSelect ? dealTypeSelect.value : 'sale';
        let html = '';
        
        this.excelData = this.filteredApartments.map((apartment, index) => {
            const props = apartment.properties;
            const price = dealType === 'sale' ? props.price : props.price_per_month;
            const priceText = dealType === 'sale' ? 
                `${this.formatPrice(price)} млн руб.` : 
                `${this.formatPrice(price, 0)} руб./мес`;
            
            let roomsText;
            if (props.rooms_count === -1) {
                roomsText = 'Свободная планировка';
            } else {
                roomsText = `${props.rooms_count} комн.`;
            }
            
            const address = props.street ? 
                `${props.street} ${props.house_number || ''}`.trim() : 
                'Адрес не указан';
            
            html += `
                <div class="apartment-item" data-index="${index}">
                    <h4>
                        <span>${roomsText}</span>
                        <span class="price">${priceText}</span>
                    </h4>
                    <div class="details">
                        <div class="detail">
                            <strong>Площадь:</strong> ${props.total_meters} м²
                        </div>
                        <div class="detail">
                            <strong>Этаж:</strong> ${props.floor}/${props.floors_count}
                        </div>
                        <div class="detail">
                            <strong>Район:</strong> ${props.district || 'Не указан'}
                        </div>
                        <div class="detail">
                            <strong>Цена м²:</strong> ${this.calcPricePerMeter(price, props.total_meters, dealType)}
                        </div>
                    </div>
                    <div class="address">${address}</div>
                    ${props.url ? `<a href="${props.url}" target="_blank" class="link">Перейти к объявлению</a>` : ''}
                </div>
            `;
            
            return {
                apartment,
                price,
                roomsText,
                address,
                priceText
            };
        });
        
        listContainer.innerHTML = html;
        
        document.querySelectorAll('.apartment-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') return;
                
                const index = parseInt(item.dataset.index);
                this.highlightApartment(index);
            });
        });
    }
    
    highlightApartment(index) {
        this.clearHighlight();
        
        this.selectedApartment = this.filteredApartments[index];
        
        if (!this.layers.apartments) return;
        
        this.layers.apartments.eachLayer((layer) => {
            if (layer.feature === this.selectedApartment) {
                layer.setStyle({
                    fillColor: '#ff9800',
                    color: '#ff9800',
                    weight: 3,
                    fillOpacity: 0.9
                });
                
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
                
                const listItems = document.querySelectorAll('.apartment-item');
                listItems.forEach((item, i) => {
                    if (i === index) {
                        item.classList.add('selected');
                        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        item.classList.remove('selected');
                    }
                });
                
                return false;
            }
        });
    }

    clearHighlight() {
        if (this.layers.apartments) {
            const dealTypeSelect = document.getElementById('deal-type');
            const dealType = dealTypeSelect ? dealTypeSelect.value : 'sale';
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
        
        document.querySelectorAll('.apartment-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        this.selectedApartment = null;
    }

    calcPricePerMeter(price, area, dealType) {
        if (!price || !area || area <= 0) return '-';
        
        const pricePerMeter = price / area;
        
        if (dealType === 'sale') {
            if (pricePerMeter < 1) {
                return `${(pricePerMeter * 1000).toFixed(0)} тыс./м²`;
            } else {
                return `${pricePerMeter.toFixed(2)} млн/м²`;
            }
        } else {
            return `${Math.round(pricePerMeter)} руб./м²`;
        }
    }

    clearFilters() {
        const priceMax = document.getElementById('price-max');
        const areaMin = document.getElementById('area-min');
        const radius = document.getElementById('radius');
        const district = document.getElementById('district');
        
        if (priceMax) priceMax.value = '';
        if (areaMin) areaMin.value = '';
        if (radius) radius.value = '500';
        if (district) district.value = '';
        
        document.querySelectorAll('input[name="rooms"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.querySelectorAll('input[name="nearby"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        const nearbyCondition = document.getElementById('nearby-condition');
        if (nearbyCondition) nearbyCondition.value = 'any';
        
        const showBuffers = document.getElementById('show-buffers');
        if (showBuffers) showBuffers.checked = true;
        
        this.clearCustomPoint();
        this.clearHighlight();
        
        if (this.listPanelOpen) {
            this.updateApartmentList();
        }
        
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
        
        const dealTypeSelect = document.getElementById('deal-type');
        const dealType = dealTypeSelect ? dealTypeSelect.value : 'sale';
        const priceLabel = dealType === 'sale' ? 'Цена продажи (млн. руб.)' : 'Цена аренды (руб./мес)';
        
        const excelData = this.filteredApartments.map((apartment, index) => {
            const props = apartment.properties;
            const price = dealType === 'sale' ? props.price : props.price_per_month;
            const pricePerMeter = this.calcPricePerMeterForExcel(price, props.total_meters, dealType);
            
            return {
                '№': index + 1,
                'Тип сделки': dealType === 'sale' ? 'Продажа' : 'Аренда',
                [priceLabel]: price,
                'Цена за м²': pricePerMeter,
                'Площадь (м²)': props.total_meters,
                'Комнат': props.rooms_count === -1 ? 'Свободная планировка' : props.rooms_count,
                'Этаж': `${props.floor}/${props.floors_count}`,
                'Район': props.district || 'Не указан',
                'Улица': props.street || '',
                'Дом': props.house_number || '',
                'Адрес': `${props.street || ''} ${props.house_number || ''}`.trim(),
                'Ссылка на объявление': props.url || '',
                'Широта': apartment.geometry.coordinates[1],
                'Долгота': apartment.geometry.coordinates[0]
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        const wscols = [
            { wch: 5 },   // №
            { wch: 10 },  // Тип сделки
            { wch: 20 },  // Цена
            { wch: 15 },  // Цена за м²
            { wch: 12 },  // Площадь
            { wch: 12 },  // Комнат
            { wch: 12 },  // Этаж
            { wch: 15 },  // Район
            { wch: 20 },  // Улица
            { wch: 8 },   // Дом
            { wch: 25 },  // Адрес
            { wch: 40 },  // Ссылка
            { wch: 12 },  // Широта
            { wch: 12 }   // Долгота
        ];
        ws['!cols'] = wscols;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Квартиры");
        
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        XLSX.writeFile(wb, `Квартиры_${dateStr}_${timeStr}.xlsx`);
        
        this.showNotification(`Файл с ${this.filteredApartments.length} квартирами успешно скачан!`);
    }

    calcPricePerMeterForExcel(price, area, dealType) {
        if (!price || !area || area <= 0) return '';
        
        const pricePerMeter = price / area;
        
        if (dealType === 'sale') {
            if (pricePerMeter < 1) {
                return `${(pricePerMeter * 1000).toFixed(0)} тыс./м²`;
            } else {
                return `${pricePerMeter.toFixed(2)} млн/м²`;
            }
        } else {
            return `${Math.round(pricePerMeter)} руб./м²`;
        }
    }

    showNotification(message) {
        const existingNotification = document.querySelector('.excel-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = 'excel-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 2000;
            font-weight: bold;
            animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        if (!document.querySelector('#excel-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'excel-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                    }
                    to {
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ApartmentFilterApp();
});



