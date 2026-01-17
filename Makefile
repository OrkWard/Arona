IMAGE_NAME := ghcr.io/orkward/arona
GIT_TAG := $(shell git describe --tags --always)
swagger_url := https://raw.githubusercontent.com/OrkWard/wormface/master/internal/server/docs/swagger.yaml

.PHONY: build config upload-sourcemap build-docker push generate-api

all: config build

config:
	op inject --in-file example.env --out-file .env -f

build:
	pnpm install && pnpm -F arona build

upload-sourcemap: build config
	sentry-cli sourcemaps inject apps/arona/dist
	sentry-cli sourcemaps upload apps/arona/dist

build-docker: build upload-sourcemap
	docker build \
        --build-arg GIT_TAG=$(GIT_TAG) \
        --platform linux/amd64,linux/arm64 \
        -t $(IMAGE_NAME):$(GIT_TAG) \
        -t $(IMAGE_NAME):latest .

push: build-docker
	docker push $(IMAGE_NAME):$(GIT_TAG)
	docker push $(IMAGE_NAME):latest

generate-api:
	swagger-codegen generate \
		-i $(swagger_url) \
		-l typescript-fetch \
		-o packages/wormface-openapi/src \
		--additional-properties=modelPropertyNaming=original
