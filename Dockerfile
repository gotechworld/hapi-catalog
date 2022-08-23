FROM node:12.10-alpine as builder

# additional packages
RUN apk update && apk upgrade && apk add --no-cache git openssh ca-certificates

# arguments
ARG port=4200
ARG ssh_key

# env stuff
ENV APP_DIR=/app/
ENV PORT=$port

# create ssh dir
RUN mkdir -p ~/.ssh

# Copy SSH key for git private repos
RUN echo "${ssh_key}" >> ~/.ssh/id_rsa

# set permissions
RUN chmod -R 600 ~/.ssh/

# add key to agent
ENV GIT_SSH_COMMAND='ssh -i ~/.ssh/id_rsa -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'

# install deps and build app
RUN mkdir -p $APP_DIR
COPY . $APP_DIR/
WORKDIR $APP_DIR

# clean directory
RUN rm -rf node_modules npm-shrinkwrap.json package-lock.json

#install npm
RUN npm install

#Build
RUN npm run-script build

#Create revision file
RUN git rev-parse HEAD >> release.txt

# final stage
FROM node:12.10-alpine

# Copy the certs from the builder stage
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/src /app/src
COPY --from=builder /app/src/config/manifest.json /app/dist/config/manifest.json
COPY --from=builder /app/package.json /app
COPY --from=builder /app/release.txt /app

EXPOSE $PORT

CMD ["npm", "run", "serve"]