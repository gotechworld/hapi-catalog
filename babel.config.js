module.exports = {
    "presets": [
        [
            "@babel/preset-env",
            {
                "targets": {
                    "node": true
                },
                "useBuiltIns": "usage",
                "corejs": { "version": 3, "proposals": true }
            }
        ]
    ]
};
