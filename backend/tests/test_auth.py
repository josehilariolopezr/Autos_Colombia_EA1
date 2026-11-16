from datetime import datetime, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import pytest

from app.auth import create_access_token, hash_password
from app.database import get_session
from app.main import app
from app.models import Usuario


@pytest.fixture
def test_admin_user():
    return Usuario(
        id=1,
        nombre="Administrador Test",
        documento="12345678",
        correo="admin@autoscolombia.com",
        password_hash=hash_password("Admin123*"),
        rol="ADMINISTRADOR",
        activo=True,
        creado_en=datetime.now(timezone.utc),
    )


@pytest.fixture
def test_operador_user():
    return Usuario(
        id=2,
        nombre="Operador Test",
        documento="87654321",
        correo="operador@autoscolombia.com",
        password_hash=hash_password("Operador123*"),
        rol="OPERADOR",
        activo=True,
        creado_en=datetime.now(timezone.utc),
    )


def test_login_exitoso_con_correo(test_admin_user):
    session = MagicMock()
    session.scalar.return_value = test_admin_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.post(
                "/auth/login",
                json={"correo": "admin@autoscolombia.com", "password": "Admin123*"},
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["usuario"]["correo"] == "admin@autoscolombia.com"
    assert data["usuario"]["rol"] == "ADMINISTRADOR"


def test_login_exitoso_con_documento(test_admin_user):
    session = MagicMock()
    session.scalar.return_value = test_admin_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.post(
                "/auth/login",
                json={"documento": "12345678", "password": "Admin123*"},
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    assert response.json()["usuario"]["documento"] == "12345678"


def test_login_password_incorrecta(test_admin_user):
    session = MagicMock()
    session.scalar.return_value = test_admin_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.post(
                "/auth/login",
                json={"correo": "admin@autoscolombia.com", "password": "PasswordIncorrecta*"},
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 401
    assert "Credenciales incorrectas" in response.json()["detail"]


def test_login_usuario_inexistente():
    session = MagicMock()
    session.scalar.return_value = None

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.post(
                "/auth/login",
                json={"correo": "noexiste@autoscolombia.com", "password": "Password123*"},
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 401


def test_login_usuario_inactivo(test_admin_user):
    test_admin_user.activo = False
    session = MagicMock()
    session.scalar.return_value = test_admin_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.post(
                "/auth/login",
                json={"correo": "admin@autoscolombia.com", "password": "Admin123*"},
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 403
    assert "inactivo" in response.json()["detail"].lower()


def test_me_con_token_valido(test_admin_user):
    token = create_access_token({"sub": "1", "rol": "ADMINISTRADOR"})
    session = MagicMock()
    session.get.return_value = test_admin_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    assert response.json()["correo"] == "admin@autoscolombia.com"
    assert response.json()["rol"] == "ADMINISTRADOR"


def test_me_sin_token_retorna_401():
    with TestClient(app) as client:
        response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_con_token_invalido():
    with TestClient(app) as client:
        response = client.get("/auth/me", headers={"Authorization": "Bearer tokeninvalido123"})
    assert response.status_code == 401
