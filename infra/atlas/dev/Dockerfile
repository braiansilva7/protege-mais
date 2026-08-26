FROM node:24.12.0-alpine

ARG ATLAS_VERSION=v1.3.0

ENV TZ=UTC \
    PGTZ=UTC

RUN apk add --no-cache curl bash
RUN curl -sSf https://atlasgo.sh | ATLAS_VERSION=${ATLAS_VERSION} sh -s -- -y

WORKDIR /app
