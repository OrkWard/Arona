VOLUME_NAME := LagrangeData

.PHONY init

init:
	git submodule update --init --recursive
	git crypt unlock
	cd external/web-scraper/
	git crypt unlock

build:
	docker compose pull
	docker compose create
	@if ! docker volume inspect $(VOLUME_NAME) &>/dev/null; then \
		echo "Docker volume '$(VOLUME_NAME)' not found. Creating it..."; \
		docker volume create $(VOLUME_NAME); \
	else \
		echo "Docker volume '$(VOLUME_NAME)' already exists."; \
	fi
