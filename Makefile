default_target: local

COMMIT_HASH := $(shell git log -1 --pretty=format:"%h"|tail -1)
VERSION = 0.13.2
IMAGE_REPO ?= ghcr.io/blakeblackshear/opengate
GITHUB_REF_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
CURRENT_UID := $(shell id -u)
CURRENT_GID := $(shell id -g)
BOARDS= #Initialized empty

include docker/*/*.mk

build-boards: $(BOARDS:%=build-%)

push-boards: $(BOARDS:%=push-%)

version:
	echo 'VERSION = "$(VERSION)-$(COMMIT_HASH)"' > opengate/version.py

local: version
	docker buildx build --target=opengate --tag opengate:latest --load --file docker/main/Dockerfile .

amd64:
	docker buildx build --platform linux/amd64 --target=opengate --tag $(IMAGE_REPO):$(VERSION)-$(COMMIT_HASH) --file docker/main/Dockerfile .

arm64:
	docker buildx build --platform linux/arm64 --target=opengate --tag $(IMAGE_REPO):$(VERSION)-$(COMMIT_HASH) --file docker/main/Dockerfile .

build: version amd64 arm64
	docker buildx build --platform linux/arm64/v8,linux/amd64 --target=opengate --tag $(IMAGE_REPO):$(VERSION)-$(COMMIT_HASH) --file docker/main/Dockerfile .

push: push-boards
	docker buildx build --push --platform linux/arm64/v8,linux/amd64 --target=opengate --tag $(IMAGE_REPO):${GITHUB_REF_NAME}-$(COMMIT_HASH) --file docker/main/Dockerfile .

run: local
	docker run --rm --publish=5000:5000 --volume=${PWD}/config:/config opengate:latest

run_tests: local
	docker run --rm --workdir=/opt/opengate --entrypoint= opengate:latest python3 -u -m unittest
	docker run --rm --workdir=/opt/opengate --entrypoint= opengate:latest python3 -u -m mypy --config-file opengate/mypy.ini opengate

.PHONY: run_tests
