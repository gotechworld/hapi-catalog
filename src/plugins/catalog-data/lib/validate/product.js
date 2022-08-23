'use strict';

import Joi from '@hapi/joi';
import VariousValidation from './various';
import _ from 'lodash';

const loadKeys = ['id', 'url_key', 'sku'];

/**
 * Product schema - simple - listings basically.
 */
const productSchemaSimple = {
    name: Joi.string().required().min(1),
    sku: Joi.string().required().min(1),
    price: Joi.number().required(),
    regular_price: Joi.number().required(),
    discount_type: Joi.string().optional(),
    msrp_price: Joi.number().optional(),
    lowest_price: Joi.number().optional(),
    attribute_set_id: Joi.number().integer().required(),
    brand_name: Joi.string().min(1),
    brand: Joi.number().min(1),
    id: Joi.number().integer().required(),
    seller_ids: Joi.array().optional(),
    stock_status: Joi.number().integer().default(0).required(),
    eol_status: Joi.number().integer().default(0).optional(),
    is_eol: Joi.number().integer().default(0).optional(),
    in_bundle: Joi.number().integer().default(0).optional(),
    pickup_is_in_stock: Joi.number().integer().default(0).valid([0, 1]).required(),
    thumbnail: Joi.string(),
    small_image: Joi.string(),
    image: Joi.string(),
    url_key: Joi.string().required(),
    label_actions_serialized: Joi.any().optional(),
    preorder_status: Joi.number().integer().default(0),
    preorder_release_date: Joi.string().optional(),
    filter_resealed: Joi.number().integer().default(0),
    resealed_count: Joi.number().default(0),
    service_details_url: Joi.string().optional(),
    short_description: Joi.string().optional(),
    energy_class: Joi.string().allow('').empty(''),
    energy_class_image: Joi.string().allow('').empty(''),
    on_demand: Joi.number().integer().default(0),
    status: Joi.number().integer().default(2).valid([0, 1, 2]).required(), // @todo 0 shouldn't be allowed but we have such values
    visibility: Joi.number().integer().default(1).valid([1, 2, 3, 4]).required(),
    ean_codes: Joi.any().optional().allow(null),
    reviews_count: Joi.number().integer().default(0),
    reviews_value: Joi.number().default(0),
    questions_count: Joi.number().default(0),
    seo_alternate_canonical: Joi.string().allow("").optional(),
    seo_index_noindex: Joi.number().optional(),
    seo_follow_nofollow: Joi.number().optional(),
    seo_alt_text: Joi.string().allow("").optional(),
    type_id: Joi.string().required(),
    product_links: Joi.any().label('Related products by relationship type'),
    gift_rules: Joi.any().optional(),
    resealed_reasons: Joi.any().optional(),
    operator_guid: Joi.any().optional(),
    has_gift: Joi.number().integer().default(0),
    subscription_price: Joi.number().optional().integer(),
    afm_energy_class: Joi.string().optional(),
    configurable_options: Joi.array().optional()
};

/**
 * Media gallery file.
 */
const mediaGalleryFileSchema = {
    label: Joi.any(),
    file: Joi.string().required(),
    position: Joi.number().required()
};

/**
 * Product schema - full.
 */
const productSchemaFull = _.merge({ ...productSchemaSimple}, {
    description: Joi.string().optional(),
    description_editor_object: Joi.string().optional(),
    short_description: Joi.string(),
    meta_title: Joi.string(),
    meta_description: Joi.string(),
    description_wide: Joi.number().integer().default(0),
    use_external_description: Joi.number().integer().optional().default(0),
    gallery: Joi.array().label('Gallery').items(Joi.object(mediaGalleryFileSchema).label('Gallery item')),
    breadcrumbs: Joi.array().label('Breadcrumbs').items(VariousValidation.breadcrumb)
});

/**
 * Product list schema.
 */
const productListSchema = Joi.object().required().label('Product list').keys({
    products: Joi.array().items(
        Joi.object(productSchemaSimple).label('Products')
    ).label('Products'),
    meta: Joi.object().required().label('Meta').keys({
        total: Joi.number().default(0)
    })
});


module.exports = {
    /**
     * Validation of view product action used by product handler.
     */
    viewActionValidation: {
        params: {
            key: Joi.string()
                .required()
                .valid(loadKeys)
                .description('Load attribute - must be one of ' + loadKeys.join(', ')),
            value: Joi.string()
                .required()
                .description('Value of the filter field')
        }
    },

    /**
     * Product list by filters
     */
    listActionValidation: {
        query: {
            filter: Joi.alternatives([Joi.string(), Joi.array()]).required().description('Collection of applied filters: attribute:val1_val2')
        }
    },

    /**
     * Get schema validations by context.
     * @param type
     * @param excludeFields
     * @returns {*}
     */
    getValidationSchema: (type, excludeFields = []) => {

        let schema;
        switch (type) {
            case 'simple':
                schema = productSchemaSimple;
                break;
            case 'full':
                schema = Object.assign({}, productSchemaFull);
                for (const excludeField of excludeFields) {
                    if (!_.isUndefined(schema[excludeField])) {
                        delete schema[excludeField];
                    }
                }
                schema = Joi.object(schema);
                break;
            case 'list':
                schema = productListSchema;
                break;
            default:
                throw 'Unknown schema type!';
        }

        return schema;
    }
};
