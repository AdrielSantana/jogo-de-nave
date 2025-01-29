FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY . .

EXPOSE 8888

ENV WAIT_VERSION 2.9.0
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/$WAIT_VERSION/wait /wait
RUN chmod +x /wait

USER node
