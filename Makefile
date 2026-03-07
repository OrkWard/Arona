IMAGE_NAME := ghcr.io/orkward/arona
GIT_TAG := $(shell git describe --tags --always)

.PHONY: build config upload-sourcemap docker push

all: config build

config:
	op inject --in-file example.env --out-file .env -f

build:
	pnpm install && pnpm -F arona build

upload-sourcemap: build
	sentry-cli sourcemaps inject apps/arona/dist
	sentry-cli sourcemaps upload apps/arona/dist

docker:
	docker build \
        --build-arg GIT_TAG=$(GIT_TAG) \
        -t $(IMAGE_NAME):$(GIT_TAG) \
        -t $(IMAGE_NAME):latest .

push: docker
	docker push $(IMAGE_NAME):$(GIT_TAG)
	docker push $(IMAGE_NAME):latest
