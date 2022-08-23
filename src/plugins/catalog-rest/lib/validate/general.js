'use strict';

module.exports = {

    /**
     * validateFilter
     *
     *
     * @returns {*}
     */
    validateFilter: (filters, mapping) => {

        let toReturn = true;

        Object.keys(filters).forEach((filter) => {

            if ((mapping.indexOf(filter)) === -1) {

                toReturn = false;
            }
        });

        return toReturn;
    }
};
