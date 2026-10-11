#!/usr/bin/env bash
# Local development only. Trust authentication is confined to the loopback port.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
task_db_directory="$(pwd)/.local/postgres"
mkdir -p "$task_db_directory"
if docker container inspect nsut-connect-db >/dev/null 2>&1; then
  task_existing_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}' nsut-connect-db)"
  if [[ "$task_existing_mount" != "$task_db_directory" ]]; then
    echo 'The existing nsut-connect-db container belongs to a different data directory. Leave it intact and choose another local database.' >&2
    exit 1
  fi
  docker start nsut-connect-db >/dev/null
else
  docker run -d --name nsut-connect-db --label nsut.connect.managed=true \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=nsut_connect \
    -p 127.0.0.1:5432:5432 \
    --mount "type=bind,source=$task_db_directory,target=/var/lib/postgresql/data" \
    postgres:16-bookworm >/dev/null
fi
task_ready=false
for task_attempt in {1..30}; do
  if docker exec nsut-connect-db pg_isready -U postgres >/dev/null 2>&1; then task_ready=true; break; fi
  sleep 1
done
if [[ "$task_ready" != true ]]; then echo 'PostgreSQL did not become ready.' >&2; exit 1; fi
if ! docker exec nsut-connect-db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'nsut_connect_test'" | rg -q '^1$'; then
  docker exec nsut-connect-db createdb -U postgres nsut_connect_test
fi
echo 'Local PostgreSQL is ready on 127.0.0.1:5432. Development and test databases are available.'
