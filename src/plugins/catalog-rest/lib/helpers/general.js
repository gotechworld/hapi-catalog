'use strict';

import _ from 'lodash';

module.exports = {

    /**
     * processFilters
     *
     * @param filters
     *
     * @returns {Object}
     */
    processFilters(filters) {

        const toReturn = [];

        filters.forEach((filter) => {

            const split = filter.split(':');

            toReturn.push({
                match: {
                    [split[0]]: split[1]
                }
            });
        });

        return toReturn;
    },
    parseFilters(params, filtersField = 'filter') {

        const parsed = {};
        if (!_.isUndefined(params[filtersField])) {

            if (!_.isArray(params[filtersField])) {
                params[filtersField] = [params[filtersField]];
            }

            params[filtersField].forEach((item) => {

                const queryValue = this.parseValuesPairs(item);
                const key = queryValue.key;
                let values = !_.isNull(queryValue.value) ? queryValue.value.split('_') : [];

                if (!values.length) {
                    return;
                }

                if (_.isUndefined(parsed[key])) {
                    parsed[key] = values;
                }
                else {
                    parsed[key] = _.union(parsed[key], values);
                }
            });
        }

        return parsed;
    },
    parseValuesPairs(queryValue) {

        const returnValue = {};
        const parts = queryValue.split(':');
        returnValue.key = parts[0];
        returnValue.value = !_.isUndefined(parts[1]) ? parts[1] : null;
        return returnValue;
    }
};
