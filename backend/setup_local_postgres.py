"""Prepara una base de desarrollo local sin borrar bases existentes."""

from __future__ import annotations

import getpass
import secrets
import subprocess
import sys
from pathlib import Path

import psycopg
from psycopg import sql


BACKEND = Path(__file__).resolve().parent
DATABASE = "autos_colombia_dev"
ENV_FILE = BACKEND / ".env"


def main() -> int:
    print(f"Se creará una base nueva llamada {DATABASE} y se aplicarán las migraciones del proyecto.")
    print("No se borrarán ni modificarán otras bases de datos.")
    if ENV_FILE.exists():
        print("Ya existe backend/.env. No lo sobrescribí; revisa esa configuración antes de continuar.")
        return 1

    admin_password = getpass.getpass("Contraseña de PostgreSQL para el usuario postgres (no se mostrará): ")
    if not admin_password:
        print("La contraseña está vacía; no se hicieron cambios.")
        return 1

    app_role = f"autos_colombia_app_{secrets.token_hex(3)}"
    app_password = secrets.token_urlsafe(32)
    try:
        with psycopg.connect(
            host="127.0.0.1",
            port=5432,
            dbname="postgres",
            user="postgres",
            password=admin_password,
            connect_timeout=5,
            autocommit=True,
        ) as connection:
            database_exists = connection.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s", (DATABASE,)
            ).fetchone()
            if database_exists:
                print(f"La base {DATABASE} ya existe. No la modifiqué; revisa su contenido en pgAdmin.")
                return 1
            role_exists = connection.execute(
                "SELECT 1 FROM pg_roles WHERE rolname = %s", (app_role,)
            ).fetchone()
            if role_exists:
                print("Hubo una colisión inesperada al generar el usuario; vuelve a ejecutar el asistente.")
                return 1
            connection.execute(
                sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                    sql.Identifier(app_role), sql.Literal(app_password)
                )
            )
            connection.execute(
                sql.SQL("CREATE DATABASE {} OWNER {}").format(
                    sql.Identifier(DATABASE), sql.Identifier(app_role)
                )
            )
    except psycopg.OperationalError:
        print("No se pudo autenticar o conectar con PostgreSQL en 127.0.0.1:5432. No se creó la base.")
        return 1
    except psycopg.Error:
        print("PostgreSQL rechazó la preparación. No se imprimieron detalles para proteger la configuración local.")
        return 1
    finally:
        admin_password = ""

    env_text = (
        "DB_HOST=127.0.0.1\n"
        "DB_PORT=5432\n"
        f"DB_NAME={DATABASE}\n"
        f"DB_USER={app_role}\n"
        f"DB_PASSWORD={app_password}\n"
        "DB_CONNECT_TIMEOUT=5\n"
    )
    try:
        with ENV_FILE.open("x", encoding="utf-8", newline="\n") as env_file:
            env_file.write(env_text)
    except OSError:
        print("Se creó la base, pero no fue posible escribir backend/.env. No se imprimieron credenciales.")
        print("La base no se eliminó. Revisa permisos y crea backend/.env antes de continuar.")
        return 1
    finally:
        app_password = ""
        env_text = ""

    migration = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if migration.returncode:
        print("La base y backend/.env quedaron preparados, pero la migración no terminó.")
        print("No se borró nada. Revisa backend/.env y luego ejecuta Alembic desde backend.")
        return migration.returncode

    check = subprocess.run(
        [sys.executable, "check_db.py"],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if check.returncode:
        print("La migración terminó, pero la comprobación de conexión falló. Revisa backend/.env.")
        return check.returncode

    current = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "current"],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if current.returncode:
        print("La conexión funciona, pero no se pudo verificar la revisión Alembic.")
        return current.returncode
    print("Configuración lista: conexión PostgreSQL correcta y migraciones aplicadas.")
    print(current.stdout.strip())
    print("Las credenciales de la aplicación se guardaron en backend/.env y no se mostraron.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
