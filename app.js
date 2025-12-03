// app.js - основная логика приложения с исправленной фильтрацией
class ApartmentFilterApp {
    constructor() {
        this.map = null;
        this.layers = {
            apartments: null,
            schools: null,
            kindergartens: null,
            priceLabels: null,
            customPoint: null,
            bufferZone: null
        };
        this.layerVisibility = {
            schools: false,
            kindergartens: false,
            priceLabels: true
        };
        this.filteredApartments = [];
        this.allApartments = [];
        this.districts = new Set();
        this.priceLabelsLayer = null;
        this.customPoint = null;
        this.isSettingCustomPoint = false;
        this.bufferRadius = 500; // Значение по умолчанию
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.initLayers();
        this.initEventListeners();
        this.initPriceLabels();
        // this.applyDefaultLayerVisibility();
    }
    
    initMap() {
        // Инициализация карты
        this.map = L.map('map', {
            minZoom: 12,
            maxZoom: 20,
            zoomControle: true
            maxBounds: cityBounds, // Ограничиваем перемещение границами
            maxBoundsViscosity: 1.0 // Насколько жестко ограничивать (0.0 - 1.0)
        }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
        
        // Добавление базового слоя (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Создаем границы города
        const cityBounds = L.latLngBounds(
            CONFIG.CITY_BOUNDS.southWest, // юго-западный угол
            CONFIG.CITY_BOUNDS.northEast  // северо-восточный угол
        );

        this.map.setMaxBounds(cityBounds);
        
        // Следим за изменением масштаба для обновления цен
        this.map.on('zoomend', () => {
            this.updatePriceLabels();
        });
        
        // Обработчик клика по карте для установки кастомной точки
        this.map.on('click', (e) => {
            if (this.isSettingCustomPoint) {
                this.setCustomPoint(e.latlng);
                this.isSettingCustomPoint = false;
                document.getElementById('set-custom-point').textContent = 'Установить точку на карте';
            }
        });
    }
    
    initLayers() {
        // Загрузка слоев из локальных GeoJSON файлов
        this.loadApartmentLayer('sale');
        this.loadSchoolsLayer();
        this.loadKindergartensLayer();
    }
    
    // Инициализация слоя с ценами
    initPriceLabels() {
        this.priceLabelsLayer = L.layerGroup().addTo(this.map);
        this.updatePriceLabels();
    }
    
    // Установка кастомной точки
    setCustomPoint(latlng) {
        // Удаляем предыдущую точку
        if (this.layers.customPoint) {
            this.map.removeLayer(this.layers.customPoint);
        }
        
        // Создаем новую точку
        this.layers.customPoint = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-point-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }),
            zIndexOffset: 1000
        }).addTo(this.map);
        
        this.customPoint = latlng;
        
        // Обновляем информацию о координатах
        document.getElementById('custom-point-coords').textContent = 
            `Координаты: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
        
        // Создаем буферную зону
        this.createBufferZone();
        
        // Применяем фильтр для отображения квартир в радиусе
        this.applyFilters();
    }
    
    // Очистка кастомной точки
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
        document.getElementById('custom-point-coords').textContent = 'Координаты: не установлены';
        
        // Обновляем фильтры (показываем все квартиры)
        this.applyFilters();
    }
    
    // Создание буферной зоны
    createBufferZone() {
        if (!this.customPoint) return;
        
        // Удаляем старую зону
        if (this.layers.bufferZone) {
            this.map.removeLayer(this.layers.bufferZone);
        }
        
        // Получаем текущий радиус
        this.bufferRadius = parseInt(document.getElementById('radius').value) || 500;
        
        // Создаем новую зону
        this.layers.bufferZone = L.circle(this.customPoint, {
            radius: this.bufferRadius,
            color: '#007cbf',
            fillColor: '#007cbf',
            fillOpacity: 0.15,
            weight: 3,
            dashArray: '5, 5',
            className: 'buffer-custom'
        });
        
        // Добавляем на карту если включено отображение буферов
        const showBuffers = document.getElementById('show-buffers').checked;
        if (showBuffers) {
            this.layers.bufferZone.addTo(this.map);
        }
    }
    
    // Обновление буферной зоны при изменении радиуса
    updateBufferZone() {
        if (this.customPoint) {
            this.createBufferZone();
            this.applyFilters(); // Переприменяем фильтры с новым радиусом
        }
    }
    
    // Обновление отображения цен в зависимости от масштаба
    updatePriceLabels() {
        if (!this.priceLabelsLayer || !this.layerVisibility.priceLabels) return;
        
        // Очищаем предыдущие метки
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
    
    // Создание метки с ценой
    createPriceLabel(price, dealType, coords, zoom) {
        const [lng, lat] = coords;
        
        // Форматируем цену в зависимости от масштаба
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
        
        // Создаем HTML для метки
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
    
    // Метод для использования координат из свойств вместо геометрии
    useCoordinatesFromProperties(geojson, layerType = 'apartments') {
        if (!geojson.features) return geojson;
        
        const transformedFeatures = geojson.features.map(feature => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const props = feature.properties;
                let newCoords = null;
                
                // Для квартир используем latitude и longitude
                if (layerType === 'apartments') {
                    if (props.latitude !== undefined && props.longitude !== undefined) {
                        newCoords = [props.longitude, props.latitude];
                    }
                } 
                // Для школ и детсадов используем X и Y
                else if (layerType === 'schools' || layerType === 'kindergartens') {
                    if (props.X !== undefined && props.Y !== undefined) {
                        newCoords = [props.X, props.Y];
                    }
                }
                
                if (newCoords) {
                    console.log(`Использую координаты из свойств для ${layerType}:`, newCoords);
                    return {
                        ...feature,
                        geometry: {
                            ...feature.geometry,
                            coordinates: newCoords
                        }
                    };
                } else {
                    console.log(`Координаты из свойств недоступны для ${layerType}, использую геометрию:`, feature.geometry.coordinates);
                    return feature;
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
            // Удаляем старый слой квартир
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
            
            // Используем координаты из свойств вместо геометрии
            const transformedGeojson = this.useCoordinatesFromProperties(geojson, 'apartments');
            
            this.allApartments = transformedGeojson.features || [];
            this.filteredApartments = [...this.allApartments];
            
            // Заполняем список районов
            this.populateDistricts();
            
            // Создаем слой на карте
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
                    this.bindApartmentPopup(feature, layer, dealType);
                }
            }).addTo(this.map);
            
            this.updateResultsCount();
            this.updatePriceLabels();
            
            // Автоматически подстраиваем карту под данные
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
        // Очищаем кроме первого элемента
        while (districtSelect.children.length > 1) {
            districtSelect.removeChild(districtSelect.lastChild);
        }
        
        // Собираем уникальные районы
        const districts = new Set();
        this.allApartments.forEach(apartment => {
            if (apartment.properties.district) {
                districts.add(apartment.properties.district);
            }
        });
        
        // Добавляем районы в выпадающий список
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
            
            // Для школ используем координаты из свойств (X, Y)
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
                    // Исправляем отображение свойств школ
                    const props = feature.properties;
                    const name = props.Полно || props.Кратк || props.name || props.NAME || props.Name || 'Не указано';
                    const address = props.Улица && props.Дом ? `${props.Улица}, ${props.Дом}` : 
                                    props.address || props.ADDRESS || props.Address || 'Не указан';
                    
                    layer.bindPopup(`
                        <div class="popup-content">
                            <h4>Школа</h4>
                            <p><strong>Название:</strong> ${name}</p>
                            <p><strong>Адрес:</strong> ${address}</p>
                            <p><strong>Тип:</strong> ${props.Тип_о || ''}</p>
                        </div>
                    `);
                }
            }).addTo(this.map);
            
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
            
            // Для детских садов используем координаты из свойств (X, Y)
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
                    // Исправляем отображение свойств детских садов
                    const props = feature.properties;
                    const name = props.Тип_д || props.name || props.NAME || props.Name || 'Не указано';
                    const address = props.Улица && props.Дом ? `${props.Улица}, ${props.Дом}` : 
                                    props.address || props.ADDRESS || props.Address || 'Не указан';
                    
                    layer.bindPopup(`
                        <div class="popup-content">
                            <h4>Детский сад</h4>
                            <p><strong>Название:</strong> ${name}</p>
                            <p><strong>Адрес:</strong> ${address}</p>
                        </div>
                    `);
                }
            }).addTo(this.map);
            
        } catch (error) {
            console.error('Ошибка загрузки слоя детских садов:', error);
        }
    }
    
    // Метод для переключения видимости слоя
    toggleLayer(layerName) {
        if (layerName === 'priceLabels') {
            this.layerVisibility.priceLabels = !this.layerVisibility.priceLabels;
            if (this.layerVisibility.priceLabels) {
                this.priceLabelsLayer.addTo(this.map);
                // Обновляем кнопку
                const button = document.getElementById('toggle-priceLabels');
                button.classList.remove('inactive');
                button.classList.add('active');
            } else {
                this.map.removeLayer(this.priceLabelsLayer);
                // Обновляем кнопку
                const button = document.getElementById('toggle-priceLabels');
                button.classList.remove('active');
                button.classList.add('inactive');
            }
            return;
        }
        
        if (this.layers[layerName]) {
            if (this.layerVisibility[layerName]) {
                this.map.removeLayer(this.layers[layerName]);
                this.layerVisibility[layerName] = false;
                
                const button = document.getElementById(`toggle-${layerName}`);
                button.classList.remove('active');
                button.classList.add('inactive');
            } else {
                this.map.addLayer(this.layers[layerName]);
                this.layerVisibility[layerName] = true;
                
                const button = document.getElementById(`toggle-${layerName}`);
                button.classList.remove('inactive');
                button.classList.add('active');
            }
        }
    }
    
    initEventListeners() {
        // Кнопка меню
        document.getElementById('menu-button').addEventListener('click', () => {
            this.toggleMenu();
        });
        
        // Закрытие меню
        document.getElementById('close-menu').addEventListener('click', () => {
            this.toggleMenu();
        });
        
        // Применение фильтров
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Очистка фильтров
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Изменение типа сделки
        document.getElementById('deal-type').addEventListener('change', (e) => {
            this.loadApartmentLayer(e.target.value);
        });
        
        // Управление слоями
        document.getElementById('toggle-schools').addEventListener('click', () => {
            this.toggleLayer('schools');
        });
        
        document.getElementById('toggle-kindergartens').addEventListener('click', () => {
            this.toggleLayer('kindergartens');
        });
        
        // Кнопка для показа цен
        this.addPriceLabelsButton();
        
        // Управление буферными зонами
        document.getElementById('show-buffers').addEventListener('change', (e) => {
            this.onShowBuffersChange(e.target.checked);
        });
        
        // Кастомная точка
        document.getElementById('set-custom-point').addEventListener('click', () => {
            this.startSettingCustomPoint();
        });
        
        document.getElementById('clear-custom-point').addEventListener('click', () => {
            this.clearCustomPoint();
        });
        
        // Изменение радиуса
        document.getElementById('radius').addEventListener('change', (e) => {
            this.onRadiusChange(parseInt(e.target.value) || 500);
        });
        
        document.getElementById('radius').addEventListener('input', (e) => {
            this.onRadiusChange(parseInt(e.target.value) || 500);
        });
        
        // Изменение выбора объекта (школы/детсады)
        document.getElementById('object-type').addEventListener('change', () => {
            this.applyFilters();
        });
    }
    
    // Обработчик изменения отображения буферных зон
    onShowBuffersChange(show) {
        if (this.layers.bufferZone) {
            if (show) {
                this.layers.bufferZone.addTo(this.map);
            } else {
                this.map.removeLayer(this.layers.bufferZone);
            }
        }
    }
    
    // Обработчик изменения радиуса
    onRadiusChange(newRadius) {
        this.bufferRadius = newRadius;
        if (this.customPoint) {
            this.updateBufferZone();
        }
        // Всегда применяем фильтры при изменении радиуса
        this.applyFilters();
    }
    
    // Начало установки кастомной точки
    startSettingCustomPoint() {
        this.isSettingCustomPoint = true;
        document.getElementById('set-custom-point').textContent = 'Кликните на карте для установки точки';
        alert('Кликните на карте в нужном месте для установки точки. После установки будут показаны квартиры в указанном радиусе.');
    }
    
    // Добавляем кнопку управления отображением цен
    addPriceLabelsButton() {
        const layerControls = document.querySelector('.layer-controls');
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
        menu.classList.toggle('open');
    }
    
    applyFilters() {
        const filters = this.getCurrentFilters();
        this.filterApartments(filters);
        
        // Применяем фильтр по радиусу если установлена кастомная точка
        if (this.customPoint) {
            this.applyRadiusFilter();
        }
        // Иначе применяем фильтр по объектам если выбран
        else {
            const objectType = document.getElementById('object-type').value;
            if (objectType !== 'none') {
                this.applyObjectFilter(objectType);
            }
        }
        
        this.updateMap();
        this.updateResultsCount();
        this.updatePriceLabels();
    }
    
    getCurrentFilters() {
        const dealType = document.getElementById('deal-type').value;
        const priceMax = document.getElementById('price-max').value;
        const areaMin = document.getElementById('area-min').value;
        const district = document.getElementById('district').value;
        
        // Получаем выбранные комнаты
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
            
            // Фильтр по цене
            if (filters.priceMax) {
                const price = filters.dealType === 'sale' ? props.price : props.price_per_month;
                if (!price || price > filters.priceMax) return false;
            }
            
            // Фильтр по площади
            if (filters.areaMin && (!props.total_meters || props.total_meters < filters.areaMin)) {
                return false;
            }
            
            // Фильтр по комнатам
            if (filters.selectedRooms.length > 0) {
                if (!filters.selectedRooms.includes(props.rooms_count)) {
                    return false;
                }
            }
            
            // Фильтр по району
            if (filters.district && props.district !== filters.district) {
                return false;
            }
            
            return true;
        });
    }
    
    // Применение фильтра по радиусу от кастомной точки
    applyRadiusFilter() {
        if (!this.customPoint) return;
        
        this.filteredApartments = this.filteredApartments.filter(apartment => {
            const apartmentPoint = apartment.geometry.coordinates;
            return this.isPointInRadius(apartmentPoint, this.customPoint, this.bufferRadius);
        });
    }
    
    // Применение фильтра по близости к объектам
    applyObjectFilter(objectType) {
        if (objectType === 'schools' || objectType === 'kindergartens') {
            const objectLayer = objectType === 'schools' ? this.layers.schools : this.layers.kindergartens;
            if (!objectLayer) return;
            
            this.filteredApartments = this.filteredApartments.filter(apartment => {
                const apartmentPoint = apartment.geometry.coordinates;
                return this.isNearObjects(apartmentPoint, objectLayer, this.bufferRadius);
            });
        }
        else if (objectType === 'both') {
            if (!this.layers.schools && !this.layers.kindergartens) return;
            this.filteredApartments = this.filteredApartments.filter(apartment => {
                const apartmentPoint = apartment.geometry.coordinates;
                const isNearSchool = this.layers.schools ? 
                    this.isNearObjects(apartmentPoint, this.layers.schools, this.bufferRadius) : false;
                const isNearKindergarten = this.layers.kindergartens ? 
                    this.isNearObjects(apartmentPoint, this.layers.kindergartens, this.bufferRadius) : false;
                return isNearSchool && isNearKindergarten;
            });
        }
    }
    
    // Проверка нахождения точки в радиусе
    isPointInRadius(apartmentCoords, centerPoint, radius) {
        const [lng, lat] = apartmentCoords;
        const apartmentLatLng = L.latLng(lat, lng);
        const distance = apartmentLatLng.distanceTo(centerPoint);
        return distance <= radius;
    }
    
    // Проверка близости к объектам
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
        // Обновляем отображение квартир на карте
        if (this.layers.apartments) {
            this.map.removeLayer(this.layers.apartments);
        }
        
        const dealType = document.getElementById('deal-type').value;
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
        
        // Подстраиваем карту под отфильтрованные данные
        if (this.filteredApartments.length > 0 && this.layers.apartments.getBounds().isValid()) {
            this.map.fitBounds(this.layers.apartments.getBounds());
        }
    }
    
    updateResultsCount() {
        const count = this.filteredApartments.length;
        document.getElementById('results-count').textContent = `Найдено квартир: ${count}`;
    }
    
    clearFilters() {
        // Сброс полей формы
        document.getElementById('price-max').value = '';
        document.getElementById('area-min').value = '';
        document.getElementById('radius').value = '500';
        document.getElementById('district').value = '';
        document.getElementById('object-type').value = 'none';
        
        // Сброс чекбоксов
        document.querySelectorAll('input[name="rooms"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.getElementById('show-buffers').checked = true;
        
        // Очищаем кастомную точку
        this.clearCustomPoint();
        
        // Показ всех квартир
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
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new ApartmentFilterApp();

});



