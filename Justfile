image_name := "localhost:5000/arona"
git_sha := `git rev-parse --short HEAD`

default: config build

config:
    op inject --in-file example.env --out-file .env -f

build:
    pnpm install && pnpm -F arona build

upload-sourcemap: build
    sentry-cli sourcemaps inject apps/arona/dist
    sentry-cli sourcemaps upload apps/arona/dist

docker:
    docker build -t {{image_name}}:latest -t {{image_name}}:{{git_sha}} .

push: docker
    docker push {{image_name}}:latest
    docker push {{image_name}}:{{git_sha}}
