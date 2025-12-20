// config.js - настройки приложения
const CONFIG = {
    // Настройки NextGIS Web
    NGW_URL: 'https://apartmentfilter.nextgis.com',
    LAYER_IDS: {
        SALE: 58,           // modified_data (продажа) 58
        RENT: 54,           // modified_data_rent (аренда) 54
        SCHOOLS: 56,        // Школы csv 56
        KINDERGARTENS: 60,  // Детские сады csv 60
        BASEMAP: 19        // OpenStreetMap
    },

    // Настройки API запросов
    API_SETTINGS: {
        MAX_FEATURES: 1000,  // Максимальное количество объектов
        TIMEOUT: 30000,      // Таймаут запроса
        RETRY_ATTEMPTS: 3    // Попытки повторного запроса
    },
    
    // Настройки карты
    MAP_CENTER: [47.2313, 39.7233], // Центр Ростова-на-Дону [lat, lng]
    MAP_ZOOM: 12,

    CITY_BOUNDS: {
        northEast: [47.35, 39.85],  // Северо-восточный угол
        southWest: [47.15, 39.55]   // Юго-западный угол
    },
    
    // Стили слоев
    STYLES: {
        SALE: { color: 'blue', radius: 6 },
        RENT: { color: 'green', radius: 6 },
        SCHOOLS: { color: 'red', radius: 8 },
        KINDERGARTENS: { color: 'orange', radius: 8 },
        BUFFER: { color: 'rgba(0, 0, 255, 0.2)', weight: 2 }
    }

};




