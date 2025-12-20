// ngw-api.js - модуль для работы с NextGIS Web API
class NGWApi {
    constructor() {
        this.baseUrl = CONFIG.NGW_API_URL || CONFIG.NGW_URL + '/api';
    }
    
    // Метод для получения GeoJSON с NGW
    async getLayerGeoJSON(layerId, filters = {}) {
        try {
            // Формируем URL для запроса
            const url = `${this.baseUrl}/resource/${layerId}/feature/`;
            
            // Параметры запроса
            const params = new URLSearchParams({
                format: 'geojson',
                srs: 4326,  // WGS84 координаты
                limit: CONFIG.API_SETTINGS.MAX_FEATURES,
                ...filters
            });
            
            const response = await fetch(`${url}?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout: CONFIG.API_SETTINGS.TIMEOUT
            });
            
            if (!response.ok) {
                throw new Error(`NGW API error: ${response.status}`);
            }
            
            const geojson = await response.json();
            console.log(`Загружено ${geojson.features?.length || 0} объектов из слоя ${layerId}`);
            return geojson;
            
        } catch (error) {
            console.error(`Ошибка загрузки слоя ${layerId} из NGW:`, error);
            throw error;
        }
    }
    
    // Метод для получения стилей слоя
    async getLayerStyle(layerId) {
        try {
            const response = await fetch(`${this.baseUrl}/resource/${layerId}/style`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error(`Ошибка загрузки стиля слоя ${layerId}:`, error);
            return null;
        }
    }
    
    // Метод для проверки доступности NGW
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/component/pyramid/route`, {
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Экспортируем синглтон
const ngwApi = new NGWApi();
