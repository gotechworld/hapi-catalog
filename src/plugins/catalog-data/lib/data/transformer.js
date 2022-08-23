'use strict';

import _ from 'underscore';
import CategoryValidation from '../validate/category';
import ProductValidation from '../validate/product';

/**
 * Data transformer.
 * @param settings Push settings for formatting urls, pics or whatever
 * @constructor
 */
function DataTransformer (settings) {

    const self = this;

    this.settings = settings;

    const fullSchemaRelationshipTypes = ['super', 'up_sell', 'cross_sell'];

    /**
     * Custom function used in order to compare 2 elements by 'order' field.
     * @param el1
     * @param el2
     * @returns {boolean}
     */
    const sortElementsByOrder = (el1, el2) => {

        return el1.order > el2.order;
    };

    DataTransformer.prototype.fullSchemaRelationshipTypes = fullSchemaRelationshipTypes;

    /**
     * Get attribute text.
     * @param value
     * @param attributeInfo
     * @returns {string}
     */
    DataTransformer.prototype.getAttributeText = (value, attributeInfo) => {

        let toReturn = '';

        if (attributeInfo.frontend_input === 'boolean') {
            // @todo we can loop over options and translate from the renderer - tbd
            if (value === 1) {
                return this.settings.booleanOptions.yes;
            }
            else {
                return this.settings.booleanOptions.no;
            }
        }
        else if (attributeInfo.frontend_input === 'select') {

            attributeInfo.options.forEach((option) => {

                if (parseInt(option.value) === parseInt(value)) {
                    toReturn = option.label;
                }
            });
        }
        else if (attributeInfo.frontend_input === 'multiselect' && _.isArray(value)) {
            const values = [];
            value.forEach((arrayValue) => {

                attributeInfo.options.forEach((option) => {

                    if (parseInt(option.value) === parseInt(arrayValue)) {
                        values.push(option.label);
                    }
                });
            });
            toReturn = values.join(', ');
        }
        else {
            toReturn = value;
        }

        return toReturn;
    };

    /**
     * Get attribute label for frontend rendering.
     * @param attributeInfo
     * @returns {string|*|internals.Any.label}
     */
    DataTransformer.prototype.getAttributeLabel = (attributeInfo) => {

        return attributeInfo.label;
    };

    /**
     * Transform product for PDP rendering.
     * @param product
     * @param attributeSet
     * @param excludeFields
     * @returns {*}
     */
    DataTransformer.prototype.transformProductFullSchema = (product, attributeSet, excludeFields = []) => {

        //calculate meta
        product.meta_title = product.name;
        product.meta_description = `Cumpara acum ${product.name} la pretul de ${product.price} lei`;

        const immutable = [];
        const validationSchema = ProductValidation.getValidationSchema('full', excludeFields);
        validationSchema._inner.children.forEach((item) => {

            immutable.push(item.key);

            // enforce default values
            if (!_.isUndefined(item.schema._flags.default) && _.isUndefined(product[item.key])) {
                product[item.key] = item.schema._flags.default;
            }

            // parse by field type
            if (!_.isUndefined(product[item.key]) && item.schema._type === 'number' && !_.isUndefined(item.schema._tests)) {
                item.schema._tests.forEach((test) => {

                    if (test.name === 'integer') {
                        product[item.key] = parseInt(product[item.key]);
                    }
                });
            }

            if (!_.isUndefined(product[item.key]) && item.schema._type === 'string') {
                if (!_.isNull(product[item.key])) {
                    product[item.key] = product[item.key].toString();
                }
                else {
                    delete product[item.key];
                }
            }
        });

        // fix blank description products
        ['description', 'short_description', 'meta_title'].forEach((replaceField) => {

            if (_.isUndefined(product[replaceField])) {
                product[replaceField] = product['name'];
            }
        });

        const info = { groups: [] };

        attributeSet.groups.forEach((group) => {

            const groupInfo = {
                name: group.name,
                order: group.order,
                attributes: []
            };
            group.attributes.forEach((attributeId) => {

                const attributeInfo = attributeSet.attributes[parseInt(attributeId)];
                if (!_.isUndefined(attributeInfo) && attributeInfo.is_visible_front === 1) {
                    const attributeCode = attributeInfo.attribute_code;
                    if (!immutable.includes(attributeCode)) {
                        const value = product[attributeCode];
                        if (_.isUndefined(value) || _.isEmpty(self.getAttributeText(value, attributeInfo))) {
                            return;
                        }
                        groupInfo.attributes.push({
                            attribute_code: attributeCode,
                            value: self.getAttributeText(value, attributeInfo),
                            label: self.getAttributeLabel(attributeInfo),
                            order: attributeInfo.order_info
                        });
                        delete product[attributeCode];
                    }
                }
            });
            if (groupInfo.attributes.length > 0) {
                groupInfo.attributes = groupInfo.attributes.sort(sortElementsByOrder);
                info.groups.push(groupInfo);
            }
        });

        // format product links
        if (!_.isUndefined(product.product_links)) {
            Object.keys(product.product_links).forEach((relationshipType) => {

                // leave products untouched for protected rel types - they should be enforced at an upper level depending on attr set data
                if (!fullSchemaRelationshipTypes.includes(relationshipType)) {
                    for(let i = 0; i < product.product_links[relationshipType].length; ++i) {
                        product.product_links[relationshipType][i] = self.transformServiceSchema(
                            product.product_links[relationshipType][i]
                        );
                    }
                }
            });

            // count resealed
            product.resealed_count = !_.isUndefined(product.product_links) && !_.isUndefined(product.product_links['resealed']) ?
                product.product_links['resealed'].length :
                0;

            // has gift
            product.has_gift = !_.isUndefined(product.product_links)
                && (!_.isUndefined(product.product_links['gift_1']) || !_.isUndefined(product.product_links['gift_2'])) ?
                1 :
                0;
        }

        self.clearObject(product, immutable);

        // sort and push attribute group info over project
        info.groups = info.groups.sort(sortElementsByOrder);
        product.info = info;

        return product;
    };

    /**
     * Transform services - manipulate final price.
     *
     * @param product
     * @param mainProduct
     * @returns {*}
     */
    DataTransformer.prototype.transformServiceSchema = (product) => {

        // check if product is service
        ['price', 'regular_price'].forEach((priceKey) => {

            if (!_.isUndefined(product[priceKey])) {
                product[priceKey] = 0;
            }
        });

        product = self.transformProductSimpleSchema(product);

        return product;
    };

    /**
     * Clear unused attributes based on product's simple schema.
     * @param product
     */
    DataTransformer.prototype.transformProductSimpleSchema = (product, options = {}) => {

        const immutable = [];
        const validationSchema = ProductValidation.getValidationSchema('simple');
        for (const key in validationSchema) {
            immutable.push(key);

            // enforce default values
            if (!_.isUndefined(validationSchema[key]._flags.default) && _.isUndefined(product[key])) {
                product[key] = validationSchema[key]._flags.default;
            }

            // convert by type
            if (!_.isUndefined(product[key]) && validationSchema[key]._type === 'number' && !_.isUndefined(validationSchema[key]._tests)) {
                validationSchema[key]._tests.forEach((test) => {

                    if (test.name === 'integer') {
                        product[key] = parseInt(product[key]);
                    }
                });
            }
            if (!_.isUndefined(product[key]) && validationSchema[key]._type === 'string') {
                if (!_.isNull(product[key])) {
                    product[key] = product[key].toString();
                }
                else {
                    delete product[key];
                }
            }
        }

        self.clearObject(product, immutable);

        return product;
    };

    /**
     * Transform various properties over category objects.
     * @param category
     * @param parentCategory
     * @param lowestPrice
     * @returns {*}
     */
    DataTransformer.prototype.transformCategorySimpleSchema = (category) => {

        const validationSchema = CategoryValidation.getValidationSchema('simple');
        validationSchema._inner.children.forEach((item) => {

            // enforce default values
            if (!_.isUndefined(item.schema._flags.default) && _.isUndefined(category[item.key])) {
                category[item.key] = item.schema._flags.default;
            }
            // parse numbers - only for categories
            if (!_.isUndefined(category[item.key]) && item.schema._type === 'number') {
                category[item.key] = parseInt(category[item.key]);
            }
        });

        //calculate meta
        if (_.isEmpty(category.meta_title)) {
            category.meta_title = `${category.name} | Cel Mai Mic Pret din RO`;
        }

        if (_.isEmpty(category.meta_description)) {
            category.meta_description = `Descopera gama noastra de ${category.name} la SUPER preturi si oferte ➤ Cel mai mic pret din Romania ⭐ Plata in RATE ✅ Retur in 14 zile ➡️ Vezi ofertele!`;
        }

        return category;
    };

    /**
     * Clear object.
     * @param object
     * @param required
     * @returns {*}
     */
    DataTransformer.prototype.clearObject = (object, required) => {

        for (const fieldName in object) {
            if (!required.includes(fieldName)) {
                delete object[fieldName];
            }
        }

        return object;
    };

}

module.exports = DataTransformer;
