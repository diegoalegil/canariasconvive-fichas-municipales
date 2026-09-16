"""Errores conocidos de BASE_DATOS_CANCON.xlsx que el exportador corrige mientras
Pedro no los arregle en el libro. Cada corrección se aplica solo si el libro
sigue con el error: si ya está bien, no se toca nada, y el aviso desaparece.

Ahora mismo no hay ninguna pendiente. Los dos errores que hubo (15/9/2026,
confirmados y corregidos por Pedro en el libro del 16/9) quedan de ejemplo:
- C2I (nacidos fuera de España por isla): Lanzarote y Fuerteventura con las
  columnas cambiadas de 2021 a 2025. Ese tipo de cruce entre islas lo detecta
  y corrige exportar_datos.py por sí mismo (conciliar_extranjero_islas).
- C7M (saldo migratorio municipal): los dos San Bartolomé, el de Lanzarote y
  el de Tirajana, con las celdas cruzadas en 2022 y 2023. La suma de los
  municipios de cada isla no daba la de C7I (244 y 235 personas, en sentidos
  opuestos) y cruzarlas lo cuadraba exactamente. Se apuntó aquí así:
      ("C7M", "San Bartolomé", "San Bartolomé de Tirajana", (2022, 2023))
"""

# (hoja municipal, municipio A, municipio B, años): las celdas de A y B van cruzadas.
CELDAS_CRUZADAS = []

TOLERANCIA = 0.5   # personas: las hojas traen enteros


def cruzar_si_procede(hoja, series_mun, totales_isla, isla_de):
    """Aplica a `series_mun` ({municipio: {año: valor}}) las correcciones de
    `hoja` que sigan haciendo falta: solo si la isla de cada municipio no suma
    sus municipios ese año y cruzar las dos celdas lo cuadra. Devuelve las
    correcciones aplicadas [(a, b, año)]. Si la isla no cuadra y el cruce no lo
    arregla, lanza ValueError: el dato hay que mirarlo, no arreglarlo a ciegas."""
    aplicadas = []
    for h, a, b, anios in CELDAS_CRUZADAS:
        if h != hoja:
            continue
        for anio in anios:
            islas = {isla_de[a], isla_de[b]}
            if cuadra(islas, anio, series_mun, totales_isla, isla_de):
                continue
            va, vb = series_mun[a].get(anio), series_mun[b].get(anio)
            series_mun[a][anio], series_mun[b][anio] = vb, va
            if not cuadra(islas, anio, series_mun, totales_isla, isla_de):
                series_mun[a][anio], series_mun[b][anio] = va, vb
                raise ValueError(f"{hoja} {anio}: la suma de los municipios de {' y '.join(sorted(islas))} no da la "
                                 f"de la hoja insular y cruzar {a} y {b} no lo arregla. Revisar el libro.")
            aplicadas.append((a, b, anio))
    return aplicadas


def cuadra(islas, anio, series_mun, totales_isla, isla_de):
    """True si, para cada isla, la suma de sus municipios ese año es la de la
    hoja insular (o no se puede comprobar porque falta algún dato)."""
    for isla in islas:
        total = totales_isla.get(isla, {}).get(anio)
        valores = [series_mun[m].get(anio) for m in isla_de if isla_de[m] == isla]
        if total is None or any(v is None for v in valores):
            continue
        if abs(sum(valores) - total) > TOLERANCIA:
            return False
    return True


def descuadres(series_mun, totales_isla, isla_de):
    """[(isla, año, suma municipal, hoja insular)] donde la isla no suma sus
    municipios (con todos los datos presentes)."""
    salida = []
    islas = sorted(set(isla_de.values()))
    for isla in islas:
        for anio, total in totales_isla.get(isla, {}).items():
            valores = [series_mun[m].get(anio) for m in isla_de if isla_de[m] == isla]
            if total is None or any(v is None for v in valores):
                continue
            if abs(sum(valores) - total) > TOLERANCIA:
                salida.append((isla, anio, sum(valores), total))
    return salida
