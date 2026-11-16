from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_cors_allows_angular_development_origin() -> None:
    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": "http://localhost:4200"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
