'use strict';

import Joi from '@hapi/joi';
import ProductValidation from './product';
import VariousValidation from './various';

const loadKeys = ['id', 'url_key', 'request_path'];

/**
 * Filter option validation.
 * @type {Array|Iterator.<number>|Iterator.<K>|Iterator.<T>|*}
 */
const filterOptionValidation = Joi.object().label('Filter Option').keys({
    order: Joi.number().optional(),
    label: Joi.string().required(),
    value: Joi.alternatives([Joi.string(), Joi.number()]).required(),
    slug: Joi.alternatives([Joi.string(), Joi.number()]).optional(),
    count: Joi.number().required()
});

/**
 * Filter validation.
 * @type {Array|Iterator.<number>|Iterator.<K>|Iterator.<T>|*}
 */
const filterValidation = Joi.object().label('Filter').keys({
    label: Joi.string().required(),
    attribute_code: Joi.string().required(),
    order: Joi.number().default(0),
    slug: Joi.string().required(),
    filters: Joi.array().items(filterOptionValidation.label('Filter options'))
});

/**
 * Product list validation.
 */
const productsValidation = Joi.array().items(
    Joi.object(ProductValidation.getValidationSchema('simple')).label('Product')
).label('Products');

/**
 * Layred navigation validation.
 */
const layeredNavigationValidation = Joi.array().optional().items(filterValidation.label('Filter')).label('Filters');

/**
 * Category validation.
 * @type {Array|Iterator.<number>|Iterator.<K>|Iterator.<T>|*}
 */
const categorySimple = Joi.object().label('Category').keys({
    name: Joi.string().required().min(1),
    id: Joi.number().required(),
    level: Joi.number().optional(),
    thumbnail: Joi.string().optional(),
    position: Joi.number().default(0).required(),
    include_in_menu: Joi.number().optional().valid([0, 1]).default(0),
    description: Joi.string().allow('').optional(),
    parent_id: Joi.number().default(0),
    url_key: Joi.string().required(),
    status: Joi.number().default(2).valid([0, 1, 2]).required(),
    display_mode: Joi.string().valid(['PRODUCTS', 'PAGE', 'PRODUCTS_AND_PAGE']),
    landing_page: Joi.any().optional().label('CMS block id'),
    meta_title: Joi.string().allow('').optional(),
    meta_description: Joi.string().allow('').optional(),
    description_wide: Joi.number().default(0),
    seo_alternate_canonical: Joi.string().optional(),
    seo_index_noindex: Joi.number().optional(),
    seo_follow_nofollow: Joi.number().optional(),
    seo_alt_text: Joi.string().optional(),
    meta: VariousValidation.meta,
    breadcrumbs: Joi.array().items(VariousValidation.breadcrumb),
    products: productsValidation,
    layeredNavigation: layeredNavigationValidation
});

module.exports = {
    /**
     * Components validation
     */
    productListValidation: productsValidation,
    layeredNavigationValidation,
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
        },
        query: {
            filter: Joi.alternatives([Joi.string(), Joi.array()]).optional().description('Collection of applied filters: attribute:val1_val2'),
            min_price: Joi.number().min(0).optional().description('Min price value'),
            max_price: Joi.number().positive().optional().description('Max price value'),
            size: Joi.number().positive().optional().description('Items per page'),
            page: Joi.number().positive().optional().default(1).description('Current page'),
            sort: Joi.string()
                .optional()
                .default('best_buy')
                .valid(['best_buy', 'price', 'name', 'best_deal'])
                .description('Sort attribute'),
            dir: Joi.string().optional().default('desc').valid(['asc', 'desc']).description('Sort direction')
        }
    },

    /**
     * Get schema validations by context.
     * @param type
     * @returns {*}
     */
    getValidationSchema: (type) => {

        if (type === 'simple') {
            return categorySimple;
        }
        throw 'Unknown schema type!';

    }
};
