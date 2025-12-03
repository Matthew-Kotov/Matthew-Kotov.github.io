// config.js - настройки приложения
const CONFIG = {
    // Настройки NextGIS Web
    NGW_URL: 'https://apartmentfilter.nextgis.com',
    LAYER_IDS: {
        SALE: 58,           // modified_data (продажа)
        RENT: 54,           // modified_data_rent (аренда)
        SCHOOLS: 56,        // Школы csv
        KINDERGARTENS: 60,  // Детские сады csv
        BASEMAP: 19        // OpenStreetMap
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
