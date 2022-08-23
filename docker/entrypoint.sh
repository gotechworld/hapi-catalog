#!/bin/sh

npm --prefix /var/www/api install /var/www/api
cd /var/www/api & npm start