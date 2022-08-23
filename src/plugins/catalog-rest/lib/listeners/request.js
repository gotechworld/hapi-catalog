'use strict';

import _ from 'lodash';
import Boom from '@hapi/boom';

const PluginName = require('../../package.json').name;

const mapping = {
    categories: 'category',
    products: 'product',
    attributes: 'attributes',
    attributesSets: 'attributes_sets',
    attributesGroups: 'attributes_groups'
};

module.exports = {
    /**
     * run
     *
     * @returns {*}
     */
    run: (request) => {
        let index = '';

        if (_.isUndefined(request.route.settings.plugins[PluginName])) {
            return;
        }

        const path = request.route.path.split('/');
        if (_.isArray([path]) && !_.isUndefined(path[2])) {

            const config = request.server.catalogGlobalSettings;

            const key = mapping[path[2]];
            index = config[key].index;
        }

        if (request.params !== null && !_.isUndefined(request.params.index)) {
            index = request.params.index;
        }
        else if (request.payload !== null && !_.isUndefined(request.payload.index)) {
            index = request.payload.index;
        }
        else if (request.query !== null && !_.isUndefined(request.query.index)) {
            index = request.query.index;
        }

        request.index = index;

        if (index === '') {
            throw Boom.notFound('Index not found');
        }
    }
};
