'use strict';

import Joi from '@hapi/joi';

/**
 * Breadcrumb schema.
 * @type {Array|Iterator.<number>|Iterator.<K>|Iterator.<T>|*}
 */
const breadcrumbSchema = Joi.object().label('Breadcrumb Item').keys({
    name: Joi.string().required().min(1),
    url_key: Joi.string().required(),
    id: Joi.number().default(0),
    level: Joi.number().default(0)
});

/**
 * Meta object.
 * @type {Array|Iterator.<number>|Iterator.<K>|Iterator.<T>|*}
 */
const metaObjectSchema = Joi.object().label('Meta').keys({
    items: Joi.number().default(0).required(),
    size: Joi.number().default(0).required(),
    page: Joi.number().default(0).required(),
    sort_direction: Joi.string().required().default('desc').valid(['asc', 'desc']),
    sort_attribute: Joi.string().required(),
    requestId: Joi.string().optional()
});

module.exports = {
    breadcrumb: breadcrumbSchema,
    meta: metaObjectSchema
};
