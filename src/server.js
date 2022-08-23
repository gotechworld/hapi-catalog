import Glue from '@hapi/glue';
import Minimist from 'minimist';
import { isUndefined } from 'lodash';
import CatboxRedis from '@hapi/catbox-redis';
import Boom from '@hapi/boom';

const KEEP_ALIVE_TIMEOUT = process.env.KEEP_ALIVE_TIMEOUT || (65 * 1000);
const HEADERS_TIMEOUT = process.env.HEADERS_TIMEOUT || (70 * 1000);

/**
 * Load manifest file content.
 */
const loadManifest = () => {
    const args = Minimist(process.argv.slice(2));
    const configPath = isUndefined(args.CONFIG_FILE) ? './config/manifest.json' : args.CONFIG_FILE;
    return require(configPath); // eslint-disable-line
};

/**
 * Start an app (server) based on its manifest.
 * @param manifest
 * @param options
 * @returns {Promise.<void>}
 */
const startApp = async (manifest, options) => {
    const server = await Glue.compose(manifest, options);
    await server.start();
    server.listener.keepAliveTimeout = parseInt(KEEP_ALIVE_TIMEOUT);
    server.listener.headersTimeout = parseInt(HEADERS_TIMEOUT);

    server.log(['info'], `Server started at: ${server.info.uri}`);
};

// start app
const options = { relativeTo: __dirname };
const manifest = loadManifest();

// add better traceability
manifest.server.routes = {
    validate: {
        failAction: async (request, h, err) => {
            if (process.env.NODE_ENV === 'production') {
                console.error('ValidationError:', err.message);
                throw Boom.badRequest(`Invalid request payload input`);
            } else {
                console.error(err);
                throw err;
            }
        }
    }
};

// hack for CatboxRedis cache driver
manifest.server.cache.provider.constructor = CatboxRedis;

startApp(loadManifest(), options);

process
    .on('unhandledRejection', (reason, p) => {
        console.error(reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', (err) => {
        console.error(err, 'Uncaught Exception thrown');
        process.exit(1);
    });
