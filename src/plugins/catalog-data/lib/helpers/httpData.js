'use strict';

import apisauce from 'apisauce';
import http from 'http';
import https from 'https';

/**
 * Constructor function
 */
class httpData {

    /**
     * Constructor.
     */
    constructor() {

        // http agents
        this._httpAgent = new http.Agent({keepAlive: true});
        this._httpsAgent = new https.Agent({keepAlive: true, rejectUnauthorized: false});
    }

    /**
     * Proxy call to client instance.
     * @param method
     * @param url
     * @param data
     * @param axiosConfig
     * @returns {Promise.<*>}
     */
    async call (method, url = '/', data = {}, axiosConfig = {}) {

        const httpClient = await apisauce.create({
            baseURL: url,
            headers: {
                'User-Agent': 'catalog-http/1.0.0'
            },
            httpAgent: this._httpAgent,
            httpsAgent: this._httpsAgent,
            timeout: 5000
        });
        return httpClient[method](url, data, axiosConfig);
    }
};

module.exports = httpData;
