'use strict';

import Joi from '@hapi/joi';

module.exports = {
    /**
     * getValidationSchema
     *
     * @returns {*}
     */
    getValidationSchema: () => {

        return {
            attribute_code: Joi.string().required(),
            frontend_input: Joi.string().required(),
            id: Joi.number().required(),
            is_filterable: Joi.number().required(),
            is_required: Joi.number().required(),
            is_used_in_search: Joi.number().required(),
            is_visible: Joi.number().required(),
            is_visible_front: Joi.number().required(),
            label: Joi.string().required(),
            multiselect: Joi.number().required(),
            options: Joi.object().keys({
                label: Joi.string().required(),
                order: Joi.number().required(),
                slug: Joi.string().required(),
                value: Joi.number().required()
            }),
            order: Joi.number().required(),
            order_info: Joi.number().required(),
            slug: Joi.string().required(),
            type: Joi.string().required(),
            is_comparable: Joi.number().optional()
        };
    }
};
