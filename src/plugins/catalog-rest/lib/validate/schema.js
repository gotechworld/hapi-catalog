'use strict';

import Joi from '@hapi/joi';

module.exports = {
    createIndexPayload: Joi
        .object()
        .label('Create index payload schema')
        .keys({
            index: Joi.string().required(),
            settings: Joi.object().optional(),
            mapping: Joi.alternatives().try([
                Joi.object().optional(),
                Joi.array().optional()
            ])
        }),
    createIndexResponse: Joi
        .object()
        .label('Create index response')
        .keys({
            create: Joi.any().required(),
            mapping: Joi.any().required(),
        }),
    createAliasPayload: Joi
        .object()
        .label('Create alias payload schema')
        .keys({
            clean_alias: Joi.bool().required(),
            index: Joi.string().required(),
            alias: Joi.string().required()
        }),
    createAliasResponse: Joi
        .object()
        .label('Create alias response')
        .keys({
            created: Joi.bool().required()
        })
};
