VOLUME_NAME := LagrangeData

.PHONY: build config

config:
	op inject --in-file example.env --out-file .env

build:
	docker compose pull
	docker compose create
	@if ! docker volume inspect $(VOLUME_NAME) &>/dev/null; then \
		echo "Docker volume '$(VOLUME_NAME)' not found. Creating it..."; \
		docker volume create $(VOLUME_NAME); \
	else \
		echo "Docker volume '$(VOLUME_NAME)' already exists."; \
	fi
