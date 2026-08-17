import os
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
sns_client = boto3.client("sns")

TABLE_NAME = os.environ["TABLE_NAME"]
SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]

table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    print("ReminderFunction started")

    now = datetime.now(timezone.utc)

    try:
        # ---------------------------------------------------------
        # Obtener talleres programados
        # ---------------------------------------------------------
        response = table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq("WORKSHOP#ALL")
        )

        workshops = response.get("Items", [])

        print(
            f"Workshops encontrados: {len(workshops)}"
        )

        reminders_sent = 0

        # ---------------------------------------------------------
        # Procesar cada taller
        # ---------------------------------------------------------
        for workshop in workshops:

            if workshop.get("SK") != "META":
                continue

            if workshop.get("status") != "scheduled":
                continue

            start_at = workshop.get("startAt")

            if not start_at:
                continue

            try:
                workshop_start = datetime.fromisoformat(
                    start_at.replace("Z", "+00:00")
                )
            except ValueError:
                print(
                    f"Fecha inválida para taller "
                    f"{workshop.get('id')}: {start_at}"
                )
                continue

            # -----------------------------------------------------
            # Determinar si el taller necesita recordatorio
            # -----------------------------------------------------
            hours_until_start = (
                workshop_start - now
            ).total_seconds() / 3600

            if hours_until_start < 0:
                continue

            if hours_until_start > 24:
                continue

            workshop_id = str(
                workshop.get("id", "")
            )

            name = workshop.get(
                "name",
                "Taller"
            )

            location = workshop.get(
                "location",
                "Por confirmar"
            )

            # -----------------------------------------------------
            # Obtener registros del taller
            # -----------------------------------------------------
            registrations_response = table.query(
                KeyConditionExpression=Key("PK").eq(
                    f"WORKSHOP#{workshop_id}"
                )
            )

            registrations = [
                item
                for item in registrations_response.get(
                    "Items",
                    []
                )
                if str(item.get("SK", "")).startswith(
                    "REG#USER#"
                )
            ]

            print(
                f"Taller {workshop_id}: "
                f"{len(registrations)} registros encontrados"
            )

            # -----------------------------------------------------
            # Publicar recordatorio por cada registro
            # -----------------------------------------------------
            for registration in registrations:

                user_id = str(
                    registration.get(
                        "userId",
                        ""
                    )
                )

                if not user_id:
                    continue

                message = (
                    "Recordatorio de taller\n\n"
                    f"Usuario: {user_id}\n"
                    f"Taller: {workshop_id}\n"
                    f"Nombre: {name}\n"
                    f"Ubicación: {location}\n"
                    f"Inicio: {start_at}\n\n"
                    "Su taller está programado para "
                    "las próximas 24 horas."
                )

                subject = (
                    f"Recordatorio - Taller {workshop_id}"
                )

                try:
                    result = sns_client.publish(
                        TopicArn=SNS_TOPIC_ARN,
                        Subject=subject,
                        Message=message
                    )

                    message_id = result.get(
                        "MessageId"
                    )

                    print(
                        "Reminder SNS notification "
                        "published successfully. "
                        f"MessageId={message_id}, "
                        f"UserId={user_id}, "
                        f"WorkshopId={workshop_id}"
                    )

                    reminders_sent += 1

                except ClientError as error:

                    error_code = error.response.get(
                        "Error",
                        {}
                    ).get(
                        "Code",
                        ""
                    )

                    error_message = error.response.get(
                        "Error",
                        {}
                    ).get(
                        "Message",
                        ""
                    )

                    print(
                        "Reminder SNS notification "
                        "failed. "
                        f"Code={error_code}, "
                        f"Message={error_message}"
                    )

                    raise

        print(
            f"ReminderFunction completed. "
            f"Reminders sent: {reminders_sent}"
        )

        return {
            "statusCode": 200,
            "message": "Proceso de recordatorios completado",
            "remindersSent": reminders_sent
        }

    except ClientError as error:

        print(
            "ReminderFunction failed: "
            f"{error}"
        )

        raise