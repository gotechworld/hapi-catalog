# HAPI - Catalog API

Serve data for catalog.

## Server connection keepAlive
In order to increase the server connection keepAlive and headersTimeout you have to set the following ENV vars on your process:

- KEEP_ALIVE_TIMEOUT - default value for now is 70000
- HEADERS_TIMEOUT - default value for now is 75000
*the timing is expressed in milliseconds
