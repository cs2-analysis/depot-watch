FROM node:lts-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY index.js entrypoint.sh ./

ENV VERSION_FILE=/data/version.json

ENTRYPOINT [ "/app/entrypoint.sh" ]