// config.js - настройки приложения
const CONFIG = {
    // Настройки NextGIS Web
    NGW_URL: 'https://apartmentfilter.nextgis.com',
    LAYER_IDS: {
        SALE: 5,
        RENT: 7,
        SCHOOLS: 3,
        KINDERGARTENS: 9,
        HOSPITALS: 10,        // добавьте правильный ID
        STOPS: 11,             // добавьте правильный ID
        BASEMAP: 19
    },
    
    // Настройки карты
    MAP_CENTER: [47.2313, 39.7233],
    MAP_ZOOM: 12,

    CITY_BOUNDS: {
        northEast: [47.35, 39.85],
        southWest: [47.15, 39.55]
    },
    
    // Стили слоев
    STYLES: {
        SALE: { color: 'blue', radius: 6 },
        RENT: { color: 'green', radius: 6 },
        SCHOOLS: { color: 'red', radius: 8 },
        KINDERGARTENS: { color: 'orange', radius: 8 },
        HOSPITALS: { color: '#dc3545', radius: 8 },    // красный
        STOPS: { color: '#6f42c1', radius: 6 },        // фиолетовый
        BUFFER: { color: 'rgba(0, 0, 255, 0.2)', weight: 2 }
    },

    // Настройки списка
    LIST_SETTINGS: {
        ITEMS_PER_PAGE: 50,
        SORT_OPTIONS: ['price_asc', 'price_desc', 'area_asc', 'area_desc']
    },
    
    // Настройки экспорта
    EXPORT_SETTINGS: {
        FILENAME_PREFIX: 'Квартиры_',
        DATE_FORMAT: 'YYYY-MM-DD',
        SHEET_NAME: 'Квартиры'
    }
};
