import json
import os

import boto3
from botocore.exceptions import ClientError


sns_client = boto3.client("sns")

SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]


def lambda_handler(event, context):
    print(
        "NotificationFunction received event: "
        f"{json.dumps(event)}"
    )

    # ---------------------------------------------------------
    # Validar tipo de evento
    # ---------------------------------------------------------
    detail_type = event.get("detail-type")

    if detail_type != "STUDENT_REGISTERED":
        print(
            "Evento ignorado. "
            f"DetailType={detail_type}"
        )

        return {
            "statusCode": 200,
            "message": "Evento ignorado"
        }

    # ---------------------------------------------------------
    # Obtener información del registro
    # ---------------------------------------------------------
    detail = event.get("detail", {})

    workshop_id = str(
        detail.get("workshopId", "")
    ).strip()

    user_id = str(
        detail.get("userId", "")
    ).strip()

    registered_at = str(
        detail.get("registeredAt", "")
    ).strip()

    status = str(
        detail.get("status", "confirmed")
    ).strip()

    if not workshop_id or not user_id:
        print(
            "Evento STUDENT_REGISTERED inválido: "
            "faltan workshopId o userId"
        )

        return {
            "statusCode": 400,
            "message": (
                "El evento no contiene "
                "los datos requeridos"
            )
        }

    # ---------------------------------------------------------
    # Construir mensaje de notificación
    # ---------------------------------------------------------
    message = (
        "Confirmación de registro\n\n"
        f"Usuario: {user_id}\n"
        f"Taller: {workshop_id}\n"
        f"Fecha de registro: {registered_at}\n"
        f"Estado: {status}\n\n"
        "Su inscripción ha sido confirmada correctamente."
    )

    subject = (
        f"Confirmación de registro - Taller {workshop_id}"
    )

    # ---------------------------------------------------------
    # Publicar en SNS
    # ---------------------------------------------------------
    try:
        result = sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )

        message_id = result.get("MessageId")

        print(
            "SNS notification published successfully. "
            f"MessageId={message_id}"
        )

        return {
            "statusCode": 200,
            "message": (
                "Notificación publicada correctamente"
            ),
            "messageId": message_id,
            "workshopId": workshop_id,
            "userId": user_id
        }

    except ClientError as error:
        error_code = error.response.get(
            "Error", {}
        ).get(
            "Code",
            ""
        )

        error_message = error.response.get(
            "Error", {}
        ).get(
            "Message",
            ""
        )

        print(
            "SNS notification failed. "
            f"Code={error_code}, "
            f"Message={error_message}"
        )

        raise