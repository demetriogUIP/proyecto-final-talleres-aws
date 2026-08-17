import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

# Cliente de Amazon EventBridge
events_client = boto3.client("events")


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)

    raise TypeError(
        f"Object of type {type(obj).__name__} is not JSON serializable"
    )


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body, default=decimal_default)
    }


def lambda_handler(event, context):
    method = event.get("httpMethod", "POST")
    path = event.get("path", "/workshops/{id}/register")

    # ---------------------------------------------------------
    # POST /workshops/{id}/register
    # ---------------------------------------------------------
    if (
        method != "POST"
        or not path.startswith("/workshops/")
        or not path.endswith("/register")
    ):
        return response(
            404,
            {
                "message": "Ruta no encontrada"
            }
        )

    path_parts = path.strip("/").split("/")

    if (
        len(path_parts) != 3
        or path_parts[0] != "workshops"
        or path_parts[2] != "register"
    ):
        return response(
            404,
            {
                "message": "Ruta no encontrada"
            }
        )

    workshop_id = path_parts[1]

    if not workshop_id:
        return response(
            400,
            {
                "message": "El ID del taller es obligatorio"
            }
        )

    # ---------------------------------------------------------
    # Procesar JSON
    # ---------------------------------------------------------
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(
            400,
            {
                "message": (
                    "El cuerpo de la solicitud "
                    "no contiene JSON válido"
                )
            }
        )

    user_id = str(body.get("userId", "")).strip()

    if not user_id:
        return response(
            400,
            {
                "message": "El userId es obligatorio"
            }
        )

    # ---------------------------------------------------------
    # Claves DynamoDB
    # ---------------------------------------------------------
    workshop_key = {
        "PK": f"WORKSHOP#{workshop_id}",
        "SK": "META"
    }

    registration_key = {
        "PK": f"WORKSHOP#{workshop_id}",
        "SK": f"REG#USER#{user_id}"
    }

    # ---------------------------------------------------------
    # Verificar existencia del taller
    # ---------------------------------------------------------
    workshop_result = table.get_item(
        Key=workshop_key
    )

    workshop = workshop_result.get("Item")

    if not workshop:
        return response(
            404,
            {
                "message": "Taller no encontrado",
                "id": workshop_id
            }
        )

    # ---------------------------------------------------------
    # Verificar capacidad disponible
    # ---------------------------------------------------------
    capacity = int(
        workshop.get("capacity", 0)
    )

    registered_count = int(
        workshop.get("registeredCount", 0)
    )

    if registered_count >= capacity:
        return response(
            409,
            {
                "message": "El taller no tiene cupos disponibles",
                "id": workshop_id,
                "capacity": capacity,
                "registeredCount": registered_count
            }
        )

    # ---------------------------------------------------------
    # Crear información del registro
    # ---------------------------------------------------------
    now = datetime.now(timezone.utc).isoformat()

    registration_item = {
        "PK": registration_key["PK"],
        "SK": registration_key["SK"],
        "userId": user_id,
        "workshopId": workshop_id,
        "registeredAt": now,
        "status": "confirmed"
    }

    # ---------------------------------------------------------
    # Transacción DynamoDB
    #
    # 1. Incrementa registeredCount del taller.
    # 2. Crea el registro del usuario.
    #
    # Ambas operaciones son atómicas.
    # ---------------------------------------------------------
    try:
        dynamodb.meta.client.transact_write_items(
            TransactItems=[
                {
                    "Update": {
                        "TableName": table.name,
                        "Key": workshop_key,
                        "UpdateExpression": (
                            "SET registeredCount = "
                            "if_not_exists(registeredCount, :zero) + :one, "
                            "updatedAt = :updatedAt"
                        ),
                        "ConditionExpression": (
                            "attribute_exists(PK) AND "
                            "attribute_exists(SK) AND "
                            "("
                            "attribute_not_exists(registeredCount) "
                            "OR registeredCount < #capacity"
                            ")"
                        ),
                        "ExpressionAttributeNames": {
                            "#capacity": "capacity"
                        },
                        "ExpressionAttributeValues": {
                            ":zero": 0,
                            ":one": 1,
                            ":updatedAt": now
                        }
                    }
                },
                {
                    "Put": {
                        "TableName": table.name,
                        "Item": registration_item,
                        "ConditionExpression": (
                            "attribute_not_exists(PK)"
                        )
                    }
                }
            ]
        )

    except ClientError as error:
        error_code = error.response.get(
            "Error", {}
        ).get(
            "Code"
        )

        error_message = error.response.get(
            "Error", {}
        ).get(
            "Message",
            ""
        )

        print(
            "Registration transaction failed. "
            f"Code={error_code}, "
            f"Message={error_message}"
        )

        # -----------------------------------------------------
        # Transacción cancelada
        # -----------------------------------------------------
        if error_code == "TransactionCanceledException":

            current_workshop_result = table.get_item(
                Key=workshop_key
            )

            current_workshop = current_workshop_result.get(
                "Item"
            )

            if not current_workshop:
                return response(
                    404,
                    {
                        "message": "Taller no encontrado",
                        "id": workshop_id
                    }
                )

            current_registered_count = int(
                current_workshop.get(
                    "registeredCount",
                    0
                )
            )

            current_capacity = int(
                current_workshop.get(
                    "capacity",
                    0
                )
            )

            # -------------------------------------------------
            # Verificar si el usuario ya estaba registrado
            # -------------------------------------------------
            existing_registration = table.get_item(
                Key=registration_key
            )

            if "Item" in existing_registration:
                return response(
                    409,
                    {
                        "message": (
                            "El usuario ya está registrado "
                            "en este taller"
                        ),
                        "userId": user_id,
                        "workshopId": workshop_id
                    }
                )

            # -------------------------------------------------
            # Verificar si se agotaron los cupos
            # -------------------------------------------------
            if current_registered_count >= current_capacity:
                return response(
                    409,
                    {
                        "message": (
                            "El taller no tiene "
                            "cupos disponibles"
                        ),
                        "id": workshop_id,
                        "capacity": current_capacity,
                        "registeredCount": (
                            current_registered_count
                        )
                    }
                )

        # -----------------------------------------------------
        # Error no controlado
        # -----------------------------------------------------
        return response(
            500,
            {
                "message": (
                    "No fue posible completar el registro"
                ),
                "error": error_code,
                "detail": error_message
            }
        )

    # =========================================================
    # EVENTBRIDGE
    #
    # La transacción DynamoDB ya terminó correctamente.
    # Por lo tanto, el registro ya está confirmado.
    # =========================================================
    try:
        event_detail = {
            "workshopId": workshop_id,
            "userId": user_id,
            "registeredAt": now,
            "status": "confirmed"
        }

        event_result = events_client.put_events(
            Entries=[
                {
                    "EventBusName": os.environ["EVENT_BUS_NAME"],
                    "Source": "workshops.registration",
                    "DetailType": "STUDENT_REGISTERED",
                    "Detail": json.dumps(event_detail)
                }
            ]
        )

        failed_count = event_result.get(
            "FailedEntryCount",
            0
        )

        if failed_count > 0:
            print(
                "EventBridge event publication failed. "
                f"Result={event_result}"
            )

            # El registro en DynamoDB ya fue confirmado.
            # No se revierte la inscripción.
            return response(
                201,
                {
                    "message": (
                        "Registro realizado correctamente, "
                        "pero el evento no pudo ser publicado"
                    ),
                    "registration": registration_item,
                    "eventPublished": False
                }
            )

        print(
            "EventBridge event published successfully. "
            f"EventId={event_result['Entries'][0].get('EventId')}"
        )

    except ClientError as error:
        error_code = error.response.get(
            "Error", {}
        ).get(
            "Code"
        )

        error_message = error.response.get(
            "Error", {}
        ).get(
            "Message",
            ""
        )

        print(
            "EventBridge publication failed. "
            f"Code={error_code}, "
            f"Message={error_message}"
        )

        # El registro ya fue confirmado en DynamoDB.
        # Por eso no devolvemos 500 ni intentamos deshacer
        # la inscripción.
        return response(
            201,
            {
                "message": (
                    "Registro realizado correctamente, "
                    "pero el evento no pudo ser publicado"
                ),
                "registration": registration_item,
                "eventPublished": False
            }
        )

    # ---------------------------------------------------------
    # Registro y publicación del evento exitosos
    # ---------------------------------------------------------
    return response(
        201,
        {
            "message": "Registro realizado correctamente",
            "registration": registration_item,
            "eventPublished": True
        }
    )