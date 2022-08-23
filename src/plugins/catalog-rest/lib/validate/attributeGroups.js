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
            attributes: Joi.array().required(),
            id: Joi.number().required(),
            name: Joi.string().required(),
            order: Joi.number().required()
        };
    }
};
