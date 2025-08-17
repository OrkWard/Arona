IMAGE_NAME := ghcr.io/orkward/arona
GIT_TAG := $(shell git describe --tags --always)

.PHONY: build config

all: config build

config:
	op inject --in-file example.env --out-file .env -f

build:
	pnpm install && pnpm -F arona build

upload-sourcemap: build
	sentry-cli sourcemaps inject apps/arona/dist
	sentry-cli sourcemaps upload apps/arona/dist

build-docker:
	docker build \
        --build-arg GIT_TAG=$(GIT_TAG) \
        --platform linux/amd64,linux/arm64 \
        -t $(IMAGE_NAME):$(GIT_TAG) \
        -t $(IMAGE_NAME):latest .
