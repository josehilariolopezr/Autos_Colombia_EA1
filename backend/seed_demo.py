"""Carga y ajusta de forma repetible los registros de muestra de Figma."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine
from app.models import Celda, Cliente, Estancia, Operador, Vehiculo

BOGOTA = ZoneInfo("America/Bogota")
CELDAS_FIGMA = [
    ("A-01", "JTR-428", (8, 24)), ("A-02", None, None), ("A-03", None, None),
    ("A-04", "KLV-103", None), ("A-05", "NGQ-716", (9, 12)),
    ("A-06", None, None), ("A-07", "BMX-904", (10, 3)), ("A-08", None, None),
    ("M-01", "VRD-59F", (7, 58)), ("M-02", "QRS-82D", None),
    ("M-03", None, None), ("M-04", "DFK-31H", (10, 40)),
    ("M-05", None, None), ("M-06", None, None), ("M-07", "APL-70G", None),
    ("M-08", None, None), ("P-01", None, None), ("P-02", "TUX-872", (6, 42)),
]
CLIENTES_FIGMA = [
    ("CL-0248", "Laura Méndez", "315 442 9081", "KLV-103", 20),
    ("CL-0231", "Carlos Ramírez", "301 778 2490", "QRS-82D", 21),
    ("CL-0219", "Nicolás Torres", "312 510 3377", "APL-70G", 3),
    ("CL-0207", "Ana Salazar", "320 645 1922", "LWM-614", -7),
    ("CL-0194", "Felipe Duarte", "300 921 0455", "HTN-390", 30),
]


def sample_rows() -> list[tuple[str, str | None, tuple[int, int] | None]]:
    rows = list(CELDAS_FIGMA)
    occupied = 1
    for zone, first, last in (("A", 9, 26), ("M", 9, 26), ("P", 3, 10)):
        for number in range(first, last + 1):
            plate = f"DMO-{occupied:03d}" if occupied <= 15 else None
            entry = (11, occupied) if plate else None
            rows.append((f"{zone}-{number:02d}", plate, entry))
            if plate:
                occupied += 1
    return rows


def seed() -> dict[str, int]:
    """Inserta solo registros de muestra ausentes; no actualiza ni borra filas."""
    counts = {"celdas": 0, "vehiculos": 0, "clientes": 0, "estancias": 0, "operadores": 0}
    now = datetime.now(BOGOTA)
    with Session(get_engine()) as session, session.begin():
        cells = {row.codigo: row for row in session.scalars(select(Celda)).all()}
        vehicles = {row.placa: row for row in session.scalars(select(Vehiculo)).all()}
        clients = {row.codigo: row for row in session.scalars(select(Cliente)).all()}
        operator = session.scalar(
            select(Operador).where(
                Operador.nombre == "Andrés Molina",
                Operador.telefono == "3000000000",
            )
        )
        if operator is None:
            operator = Operador(nombre="Andrés Molina", telefono="3000000000")
            session.add(operator)
            session.flush()
            counts["operadores"] += 1

        # Completa los cinco propietarios visibles en Figma y 23 clientes adicionales
        # para los otros vehículos de muestra y el total de 28 clientes del mockup.
        client_specs = list(CLIENTES_FIGMA)
        plate_owners = {plate for _, _, _, plate, _ in CLIENTES_FIGMA if plate}
        all_sample_plates = [plate for _, plate, _ in sample_rows() if plate]
        remaining_plates = [plate for plate in all_sample_plates if plate not in plate_owners]
        for index, plate in enumerate(remaining_plates, start=1):
            client_specs.append((f"CL-{180-index:04d}", f"Propietario {index:02d}", f"300 000 {index:04d}", plate, None))
        while len(client_specs) < 28:
            index = len(client_specs) - len(CLIENTES_FIGMA) + 1
            client_specs.append((f"CL-{180-index:04d}", f"Cliente mensual {index:02d}", f"310 000 {index:04d}", None, 25))

        owners_by_plate: dict[str, Cliente] = {}
        today = now.date()
        for code, name, phone, plate, days_to_due in client_specs:
            client = clients.get(code)
            due = date.fromordinal(today.toordinal() + days_to_due) if days_to_due is not None else None
            if client is None and name.startswith(("Propietario ", "Cliente mensual ")):
                client = session.scalar(select(Cliente).where(Cliente.nombre == name))
                if client is not None:
                    client.codigo = code
                    clients[code] = client
            if client is None:
                client = Cliente(codigo=code, nombre=name, telefono=phone, vencimiento=due)
                session.add(client)
                clients[code] = client
                counts["clientes"] += 1
            elif (client.nombre, client.telefono) != (name, phone):
                raise ValueError(f"El código de muestra {code} ya existe con otros datos; no se modificó.")
            if plate:
                owners_by_plate[plate] = client

        rows = sample_rows()
        for code, plate, _ in rows:
            zone = code[0]
            if code not in cells:
                cell = Celda(codigo=code, tipo={"A": "AUTOMOVIL", "M": "MOTO", "P": "PESADO"}[zone])
                session.add(cell)
                cells[code] = cell
                counts["celdas"] += 1
            if plate and plate not in vehicles:
                vehicle = Vehiculo(
                    placa=plate,
                    color="Gris",
                    modelo=2024,
                    marca="Muestra",
                    tipo={"A": "AUTOMOVIL", "M": "MOTO", "P": "CAMIONETA"}[zone],
                )
                session.add(vehicle)
                vehicles[plate] = vehicle
                counts["vehiculos"] += 1
            if plate:
                owner = owners_by_plate.get(plate)
                if owner is not None:
                    if vehicles[plate].cliente_id not in (None, owner.id):
                        raise ValueError(f"El vehículo {plate} ya tiene otro propietario; no se modificó.")
                    vehicles[plate].cliente = owner

        # Otros dos clientes del mockup tienen vehículos que no están en las celdas activas.
        for code, name, phone, plate, _ in CLIENTES_FIGMA:
            if plate in vehicles:
                continue
            vehicle = Vehiculo(placa=plate, color="Gris", modelo=2024, marca="Muestra", tipo="AUTOMOVIL", cliente=clients[code])
            session.add(vehicle)
            vehicles[plate] = vehicle
            counts["vehiculos"] += 1

        session.flush()
        for code, plate, entry_time in rows:
            if plate is None:
                continue
            vehicle = vehicles[plate]
            cell = cells[code]
            open_stay = session.scalar(
                select(Estancia).where(
                    Estancia.vehiculo_id == vehicle.id,
                    Estancia.salida.is_(None),
                )
            )
            if open_stay is not None:
                if open_stay.celda_id != cell.id:
                    raise ValueError(
                        f"La placa de muestra {plate} ya está activa en otra celda; no se modificó."
                    )
                continue

            local_entry = (
                datetime.combine(now.date(), time(*entry_time), tzinfo=BOGOTA)
                if entry_time
                else now
            )
            if local_entry > now:
                local_entry -= timedelta(days=1)
            session.add(
                Estancia(
                    vehiculo_id=vehicle.id,
                    celda_id=cell.id,
                    operador_entrada_id=operator.id,
                    entrada=local_entry,
                )
            )
            counts["estancias"] += 1

    return counts


if __name__ == "__main__":
    print(f"Datos de muestra agregados: {seed()}")
