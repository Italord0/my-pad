#!/usr/bin/env bash
set -euo pipefail

# build-docker.sh
# Usage: IMAGE_NAME=${1:-mypad:latest} ./build-docker.sh [--push]
# If --push is provided, the script will push the multi-arch image to the registry
# and requires DOCKERHUB_USERNAME and DOCKERHUB_TOKEN (or docker already logged in).

IMAGE_NAME=${1:-mypad:latest}
PUSH=${2:-}

echo "Preparing to build multi-arch image: ${IMAGE_NAME}"

echo "Registering QEMU handlers (required for emulation)..."
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes || true

BUILDER_NAME=${BUILDER_NAME:-mybuilder}
echo "Creating buildx builder '${BUILDER_NAME}' (docker-container driver)..."
docker buildx rm "${BUILDER_NAME}" >/dev/null 2>&1 || true
docker buildx create --name "${BUILDER_NAME}" --driver docker-container --use
docker buildx inspect --bootstrap

if [ "${PUSH}" = "--push" ]; then
	if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
		echo "Logging in to registry as ${DOCKERHUB_USERNAME}"
		echo "${DOCKERHUB_TOKEN}" | docker login --username "${DOCKERHUB_USERNAME}" --password-stdin
	else
		echo "NOTE: --push specified but DOCKERHUB_USERNAME/DOCKERHUB_TOKEN not set. Ensure you're logged in or set these env vars."
	fi

	echo "Building and pushing multi-arch image for platforms: linux/amd64,linux/arm64"
	docker buildx build --platform linux/amd64,linux/arm64 -t "${IMAGE_NAME}" --push .
	echo "Pushed ${IMAGE_NAME}"
else
	echo "Building multi-arch image and exporting to local registry is not supported in a single step.
To publish multi-arch images you must push to a registry. Re-run with --push to upload the image."
	echo "If you only want to build for your local architecture, run: docker build -t ${IMAGE_NAME} ."
fi

