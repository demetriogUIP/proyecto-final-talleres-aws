import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])


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
    method = event.get("httpMethod", "GET")
    path = event.get("path", "/workshops")

    # ---------------------------------------------------------
    # Autorización mediante Cognito
    # ---------------------------------------------------------

    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )

    groups = claims.get("cognito:groups", "")

    if isinstance(groups, str):
        groups = [groups]

    is_admin = "admin" in groups

    # Las operaciones administrativas requieren el grupo admin.
    if method in ("POST", "PUT", "DELETE") and not is_admin:
        return response(
            403,
            {
                "message": "Se requiere rol de administrador"
            }
        )

    # ---------------------------------------------------------
    # GET /workshops
    # ---------------------------------------------------------

    if method == "GET" and path == "/workshops":
        result = table.scan()

        return response(
            200,
            {
                "items": result.get("Items", []),
                "count": result.get("Count", 0)
            }
        )

    # ---------------------------------------------------------
    # GET /workshops/{id}
    # ---------------------------------------------------------

    if method == "GET" and path.startswith("/workshops/"):
        workshop_id = path.split("/")[-1]

        if not workshop_id:
            return response(
                400,
                {
                    "message": "El ID del taller es obligatorio"
                }
            )

        result = table.get_item(
            Key={
                "PK": f"WORKSHOP#{workshop_id}",
                "SK": "META"
            }
        )

        item = result.get("Item")

        if not item:
            return response(
                404,
                {
                    "message": "Taller no encontrado",
                    "id": workshop_id
                }
            )

        return response(
            200,
            item
        )

    # ---------------------------------------------------------
    # POST /workshops
    # ---------------------------------------------------------

    if method == "POST" and path == "/workshops":
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return response(
                400,
                {
                    "message": "El cuerpo de la solicitud no contiene JSON válido"
                }
            )

        required_fields = [
            "id",
            "name",
            "description",
            "category",
            "location",
            "startAt",
            "endAt",
            "capacity"
        ]

        missing_fields = [
            field
            for field in required_fields
            if field not in body
        ]

        if missing_fields:
            return response(
                400,
                {
                    "message": "Faltan campos obligatorios",
                    "fields": missing_fields
                }
            )

        workshop_id = str(body["id"]).strip()

        if not workshop_id:
            return response(
                400,
                {
                    "message": "El ID del taller es obligatorio"
                }
            )

        try:
            capacity = int(body["capacity"])
        except (TypeError, ValueError):
            return response(
                400,
                {
                    "message": "capacity debe ser un número entero"
                }
            )

        if capacity <= 0:
            return response(
                400,
                {
                    "message": "capacity debe ser mayor que cero"
                }
            )

        now = datetime.now(timezone.utc).isoformat()

        item = {
            "PK": f"WORKSHOP#{workshop_id}",
            "SK": "META",
            "GSI1PK": "WORKSHOP#ALL",
            "GSI1SK": body["startAt"],
            "id": workshop_id,
            "name": body["name"],
            "description": body["description"],
            "category": body["category"],
            "location": body["location"],
            "startAt": body["startAt"],
            "endAt": body["endAt"],
            "status": body.get("status", "scheduled"),
            "capacity": capacity,
            "createdAt": now,
            "updatedAt": now
        }

        existing = table.get_item(
            Key={
                "PK": item["PK"],
                "SK": item["SK"]
            }
        )

        if "Item" in existing:
            return response(
                409,
                {
                    "message": "El taller ya existe",
                    "id": workshop_id
                }
            )

        table.put_item(Item=item)

        return response(
            201,
            item
        )

    # ---------------------------------------------------------
    # PUT /workshops/{id}
    # ---------------------------------------------------------

    if method == "PUT" and path.startswith("/workshops/"):
        workshop_id = path.split("/")[-1]

        if not workshop_id:
            return response(
                400,
                {
                    "message": "El ID del taller es obligatorio"
                }
            )

        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return response(
                400,
                {
                    "message": "El cuerpo de la solicitud no contiene JSON válido"
                }
            )

        allowed_fields = [
            "name",
            "description",
            "category",
            "location",
            "startAt",
            "endAt",
            "status",
            "capacity"
        ]

        updates = {
            field: body[field]
            for field in allowed_fields
            if field in body
        }

        if not updates:
            return response(
                400,
                {
                    "message": "No se proporcionaron campos para actualizar"
                }
            )

        if "startAt" in updates:
            updates["GSI1SK"] = updates["startAt"]

        existing = table.get_item(
            Key={
                "PK": f"WORKSHOP#{workshop_id}",
                "SK": "META"
            }
        )

        if "Item" not in existing:
            return response(
                404,
                {
                    "message": "Taller no encontrado",
                    "id": workshop_id
                }
            )

        updates["updatedAt"] = datetime.now(timezone.utc).isoformat()

        if "capacity" in updates:
            try:
                updates["capacity"] = int(updates["capacity"])
            except (TypeError, ValueError):
                return response(
                    400,
                    {
                        "message": "capacity debe ser un número entero"
                    }
                )

            if updates["capacity"] <= 0:
                return response(
                    400,
                    {
                        "message": "capacity debe ser mayor que cero"
                    }
                )

        expression_parts = []
        expression_names = {}
        expression_values = {}

        for index, (field, value) in enumerate(updates.items()):
            name_key = f"#field{index}"
            value_key = f":value{index}"

            expression_parts.append(
                f"{name_key} = {value_key}"
            )

            expression_names[name_key] = field
            expression_values[value_key] = value

        result = table.update_item(
            Key={
                "PK": f"WORKSHOP#{workshop_id}",
                "SK": "META"
            },
            UpdateExpression="SET " + ", ".join(expression_parts),
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW"
        )

        return response(
            200,
            result["Attributes"]
        )

    # ---------------------------------------------------------
    # DELETE /workshops/{id}
    # ---------------------------------------------------------

    if method == "DELETE" and path.startswith("/workshops/"):
        workshop_id = path.split("/")[-1]

        if not workshop_id:
            return response(
                400,
                {
                    "message": "El ID del taller es obligatorio"
                }
            )

        existing = table.get_item(
            Key={
                "PK": f"WORKSHOP#{workshop_id}",
                "SK": "META"
            }
        )

        if "Item" not in existing:
            return response(
                404,
                {
                    "message": "Taller no encontrado",
                    "id": workshop_id
                }
            )

        table.delete_item(
            Key={
                "PK": f"WORKSHOP#{workshop_id}",
                "SK": "META"
            }
        )

        return response(
            200,
            {
                "message": "Taller eliminado correctamente",
                "id": workshop_id
            }
        )

    # ---------------------------------------------------------
    # Ruta no encontrada
    # ---------------------------------------------------------

    return response(
        404,
        {
            "message": "Ruta no encontrada"
        }
    )