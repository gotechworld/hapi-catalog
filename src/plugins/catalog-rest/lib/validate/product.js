'use strict';

import Joi from '@hapi/joi';

const productSchemaValidation = {
    id: Joi.number().required(),
    name: Joi.string().allow('').empty(''),
    sku: Joi.string().allow('').empty(''),
    price: Joi.number().empty(''),
    regular_price: Joi.number().empty(''),
    attribute_set_id: Joi.number().empty(''),
    brand_name: Joi.string().allow(''),
    stock_status: Joi.number().empty(0),
    pickup_is_in_stock: Joi.number().valid([0, 1]).empty(''),
    thumbnail: Joi.string().allow('').empty(''),
    small_image: Joi.string().allow('').empty(''),
    image: Joi.string().allow('').empty(''),
    url_key: Joi.string().allow('').empty(''),
    preorder_status: Joi.number(),
    preorder_release_date: Joi.string().allow('').empty(''),
    filter_resealed: Joi.number(),
    resealed_count: Joi.number(),
    service_details_url: Joi.string().allow('').empty(''),
    short_description: Joi.string().allow('').empty(''),
    energy_class: Joi.string().allow('').empty(''),
    energy_class_image: Joi.string().allow('').empty(''),
    on_demand: Joi.number().empty(''),
    status: Joi.number().valid([0, 1, 2]).default(2),
    visibility: Joi.number().valid([1, 2, 3, 4]).default(1),
    reviews_count: Joi.number().empty(''),
    reviews_value: Joi.number().empty(''),
    questions_count: Joi.number().empty(''),
    type_id: Joi.string().allow('').empty(''),
    has_gift: Joi.number(),
    category_ids: Joi.array().allow(null)
};

module.exports = {
    createProductPayload:  Joi
        .object()
        .label('Create index payload schema')
        .keys(productSchemaValidation),

    getSchema: productSchemaValidation
};
