from datetime import datetime, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import pytest

from app.auth import create_access_token, hash_password
from app.database import get_session
from app.main import app
from app.models import Celda, Estancia, Usuario, Vehiculo


@pytest.fixture
def admin_user():
    return Usuario(
        id=1,
        nombre="Admin Principal",
        documento="11111111",
        correo="admin@autoscolombia.com",
        password_hash=hash_password("Admin123*"),
        rol="ADMINISTRADOR",
        activo=True,
        creado_en=datetime.now(timezone.utc),
    )


@pytest.fixture
def operador_user():
    return Usuario(
        id=2,
        nombre="Operador Uno",
        documento="22222222",
        correo="operador@autoscolombia.com",
        password_hash=hash_password("Operador123*"),
        rol="OPERADOR",
        activo=True,
        creado_en=datetime.now(timezone.utc),
    )


@pytest.fixture
def admin_headers():
    token = create_access_token({"sub": "1", "rol": "ADMINISTRADOR"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def operador_headers():
    token = create_access_token({"sub": "2", "rol": "OPERADOR"})
    return {"Authorization": f"Bearer {token}"}


def test_usuarios_requiere_autenticacion():
    with TestClient(app) as client:
        response = client.get("/usuarios")
    assert response.status_code == 401


def test_usuarios_rechaza_rol_operador(operador_user, operador_headers):
    session = MagicMock()
    session.get.return_value = operador_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.get("/usuarios", headers=operador_headers)
            assert response.status_code == 403
            response_post = client.post(
                "/usuarios",
                json={
                    "nombre": "Nuevo",
                    "documento": "999",
                    "correo": "nuevo@test.com",
                    "password": "Password123*",
                    "rol": "OPERADOR",
                },
                headers=operador_headers,
            )
            assert response_post.status_code == 403
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_administrador_puede_listar_y_crear_usuarios(admin_user, admin_headers):
    session = MagicMock()
    session.get.return_value = admin_user
    session.scalar.side_effect = [
        1,  # count for list
        None,  # check correo in create
        None,  # check doc in create
    ]
    session.scalars.return_value = [admin_user]
    session.refresh.side_effect = lambda u: (
        setattr(u, "id", 10),
        setattr(u, "creado_en", datetime.now(timezone.utc)),
    )

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            list_res = client.get("/usuarios", headers=admin_headers)
            assert list_res.status_code == 200
            assert list_res.json()["total"] == 1

            create_payload = {
                "nombre": "Nuevo Operador",
                "documento": "33333333",
                "correo": "nuevo.op@autoscolombia.com",
                "password": "Password123*",
                "rol": "OPERADOR",
            }
            create_res = client.post("/usuarios", json=create_payload, headers=admin_headers)
            assert create_res.status_code == 201
            data = create_res.json()
            assert data["nombre"] == "Nuevo Operador"
            assert data["rol"] == "OPERADOR"
            assert data["activo"] is True
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_administrador_desactivacion_logica(admin_user, admin_headers):
    target_user = Usuario(
        id=5,
        nombre="Para Desactivar",
        documento="55555555",
        correo="eliminar@test.com",
        password_hash="...",
        rol="OPERADOR",
        activo=True,
        creado_en=datetime.now(timezone.utc),
    )
    session = MagicMock()
    session.get.return_value = admin_user
    session.scalar.return_value = target_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            res = client.delete("/usuarios/5", headers=admin_headers)
            assert res.status_code == 200
            assert target_user.activo is False
            session.commit.assert_called()
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_no_se_puede_desactivar_al_ultimo_administrador(admin_user, admin_headers):
    session = MagicMock()
    session.get.return_value = admin_user
    session.scalar.side_effect = [admin_user, 1]

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.delete("/usuarios/1", headers=admin_headers)
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "No es posible desactivar ni quitar el rol al único administrador activo del sistema."
    )
    assert admin_user.activo is True
    session.commit.assert_not_called()


def test_no_se_puede_quitar_rol_al_ultimo_administrador(admin_user, admin_headers):
    session = MagicMock()
    session.get.return_value = admin_user
    session.scalar.side_effect = [admin_user, 1]

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.patch(
                "/usuarios/1",
                json={"rol": "OPERADOR"},
                headers=admin_headers,
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "No es posible desactivar ni quitar el rol al único administrador activo del sistema."
    )
    assert admin_user.rol == "ADMINISTRADOR"
    session.commit.assert_not_called()


def test_no_se_puede_desactivar_ultimo_admin_por_actualizacion(admin_user, admin_headers):
    session = MagicMock()
    session.get.return_value = admin_user
    session.scalar.side_effect = [admin_user, 1]

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.patch(
                "/usuarios/1",
                json={"activo": False},
                headers=admin_headers,
            )
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 409
    assert admin_user.activo is True
    session.commit.assert_not_called()


def test_se_puede_desactivar_admin_si_hay_otro_activo(admin_user, admin_headers):
    session = MagicMock()
    session.get.return_value = admin_user
    session.scalar.side_effect = [admin_user, 2]
    session.refresh.side_effect = lambda user: None

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.delete("/usuarios/1", headers=admin_headers)
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    assert admin_user.activo is False
    session.commit.assert_called_once()


def test_operador_no_puede_crear_ni_editar_celdas(operador_user, operador_headers):
    session = MagicMock()
    session.get.return_value = operador_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            get_res = client.get("/celdas", headers=operador_headers)
            assert get_res.status_code == 403

            post_res = client.post(
                "/celdas",
                json={"codigo": "Z-99", "tipo": "Automóvil"},
                headers=operador_headers,
            )
            assert post_res.status_code == 403

            patch_res = client.patch(
                "/celdas/1",
                json={"tipo": "Moto"},
                headers=operador_headers,
            )
            assert patch_res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_operador_no_puede_abrir_rutas_de_gestion(operador_user, operador_headers):
    session = MagicMock()
    session.get.return_value = operador_user

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            assert client.get("/vehiculos/1", headers=operador_headers).status_code == 403
            assert client.get("/operadores/1", headers=operador_headers).status_code == 403
            assert client.get("/estancias/recientes", headers=operador_headers).status_code == 403
            assert client.post(
                "/operadores",
                json={"nombre": "Nuevo", "telefono": "3001234567"},
                headers=operador_headers,
            ).status_code == 403
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_operador_solo_puede_modificar_asociacion_de_vehiculo(
    operador_user, operador_headers, monkeypatch
):
    vehicle = Vehiculo(
        id=11,
        placa="ABC123",
        color="Azul",
        modelo=2024,
        marca="Toyota",
        tipo="AUTOMOVIL",
        cliente_id=None,
        activo=True,
    )
    session = MagicMock()
    session.get.return_value = operador_user

    def override_session():
        yield session

    def update_vehicle(_session, _id, data):
        assert data.model_fields_set == {"cliente_id"}
        return vehicle

    monkeypatch.setattr("app.routers.vehiculos.service.update_vehicle", update_vehicle)
    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            denied = client.patch(
                "/vehiculos/11",
                json={"color": "Negro"},
                headers=operador_headers,
            )
            assert denied.status_code == 403

            allowed = client.patch(
                "/vehiculos/11",
                json={"cliente_id": None},
                headers=operador_headers,
            )
            assert allowed.status_code == 200
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_edicion_celda_con_estancia_abierta_retorna_409(admin_user, admin_headers):
    cell = Celda(id=1, codigo="A-01", tipo="AUTOMOVIL", estado="ACTIVA")
    session = MagicMock()
    session.get.return_value = admin_user
    # auth user, find cell, estancia activa check
    session.scalar.side_effect = [admin_user, cell, 10]

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            # Intentar cambiar código con estancia activa
            res_codigo = client.patch(
                "/celdas/1",
                json={"codigo": "A-02"},
                headers=admin_headers,
            )
            assert res_codigo.status_code == 409

            # Reset side effect
            session.scalar.side_effect = [admin_user, cell, 10]
            # Intentar cambiar tipo con estancia activa
            res_tipo = client.patch(
                "/celdas/1",
                json={"tipo": "MOTO"},
                headers=admin_headers,
            )
            assert res_tipo.status_code == 409

            # Reset side effect
            session.scalar.side_effect = [admin_user, cell, 10]
            # Intentar pasar a MANTENIMIENTO con estancia activa
            res_mant = client.patch(
                "/celdas/1",
                json={"estado": "MANTENIMIENTO"},
                headers=admin_headers,
            )
            assert res_mant.status_code == 409
    finally:
        app.dependency_overrides.pop(get_session, None)
