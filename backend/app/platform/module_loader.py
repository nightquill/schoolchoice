"""
app/platform/module_loader.py

Scans backend/app/modules/ for directories containing config.yaml.
Imports module models first (to populate Base.metadata), then registers routers.
Per D-07: manifest-based auto-discovery.
Per D-08: modules live at backend/app/modules/<domain_name>/.
"""
import importlib
import logging

import yaml
from pathlib import Path
from fastapi import FastAPI
from app.platform.health import register_health_callback

logger = logging.getLogger(__name__)


def discover_and_register_modules(app: FastAPI, modules_dir: Path) -> list[dict]:
    """Scan modules_dir for config.yaml manifests; import models first, then register routers."""
    registered = []
    for module_dir in sorted(modules_dir.iterdir()):
        if not module_dir.is_dir():
            continue
        config_path = module_dir / "config.yaml"
        if not config_path.exists():
            continue
        config = yaml.safe_load(config_path.read_text()) or {}
        module_name = config.get("name", module_dir.name)
        try:
            # CRITICAL: import models BEFORE routes (RESEARCH.md Pitfall 1)
            models_module = config.get("models_import")
            if models_module:
                importlib.import_module(models_module)

            # Register routers
            for router_ref in config.get("routes", []):
                # router_ref format: "students.router" -> module "students", attr "router"
                mod_name, attr = router_ref.rsplit(".", 1)
                sub_mod = importlib.import_module(f"app.modules.{module_dir.name}.routes.{mod_name}")
                router = getattr(sub_mod, attr)
                app.include_router(router, prefix="/api/v1")

            # Register health callback if specified
            health_ref = config.get("health_callback")
            if health_ref:
                # Format: "app.modules.school_choice.health:check_health"
                mod_path, fn_name = health_ref.split(":")
                health_mod = importlib.import_module(mod_path)
                health_fn = getattr(health_mod, fn_name)
                register_health_callback(module_name, health_fn)

            registered.append({"name": module_name, "status": "ok"})
            logger.info(f"Module registered: {module_name}")
        except Exception as e:
            logger.error(f"Module load failed: {module_name} — {e}")
            registered.append({"name": module_name, "status": "error", "detail": str(e)})
    return registered
