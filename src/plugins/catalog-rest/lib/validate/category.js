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
            banners: Joi.number().required(),
            children_count: Joi.number().optional(),
            display_mode: Joi.string().required(),
            id: Joi.number().required(),
            landing_page: Joi.number().optional(),
            level: Joi.number().required(),
            meta_description: Joi.string().required(),
            meta_keywords: Joi.string().required(),
            meta_title: Joi.string().required(),
            name: Joi.string().required(),
            parent_id: Joi.number().optional(),
            path: Joi.string().required(),
            position: Joi.number().required(),
            request_path: Joi.string().required(),
            status: Joi.number().required(),
            thumbnail: Joi.string().required(),
            url_key: Joi.string().required()
        };
    }
};
