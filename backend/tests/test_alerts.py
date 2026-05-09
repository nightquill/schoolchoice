"""
tests/test_alerts.py

Tests for the in-app alerts endpoint.
"""


def test_alerts_returns_200(client, auth_headers):
    """Authenticated request to /alerts returns 200 with alerts and count."""
    response = client.get("/api/v1/alerts/alerts", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "count" in data
    assert isinstance(data["alerts"], list)
    assert isinstance(data["count"], int)
    assert data["count"] == len(data["alerts"])


def test_alerts_unauthenticated(client):
    """Unauthenticated request to /alerts returns 401."""
    response = client.get("/api/v1/alerts/alerts")
    assert response.status_code == 401
