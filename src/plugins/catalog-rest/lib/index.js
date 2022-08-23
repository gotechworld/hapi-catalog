'use strict';

import Hoek from '@hapi/hoek';
import Routes from './routes';
import RequestListener from './listeners/request';

/**
 * Default config
 * @type {{}}
 */
const internals = {
    defaults: {
        config: {
            product: {
                index: 'catalog_products'
            },
            category: {
                index: 'catalog_categories',
            },
            attributes: {
                index: 'catalog_attributes'
            },
            attributes_sets: {
                index: 'catalog_attributes_sets'
            },
            attributes_groups: {
                index: 'catalog_attributes_groups'
            }
        }
    }
};

exports.plugin = {
    register: async (server, options) => {

        const settings = Hoek.applyToDefaults(internals.defaults.config, options);

        server.ext('onPreHandler', function (request, h) {
            RequestListener.run(request);
            return h.continue;
        });

        // load routes
        server.route(Routes);
    },
    pkg: require('../package.json')
};
