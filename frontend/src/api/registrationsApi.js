import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'

const API_BASE_URL =
  'https://8bawhid0r6.execute-api.us-east-1.amazonaws.com/Prod'

export async function registerWorkshop(workshopId) {
  if (!workshopId) {
    throw new Error('El ID del taller es obligatorio')
  }

  const session = await fetchAuthSession()
  const idToken = session.tokens?.idToken?.toString()

  if (!idToken) {
    throw new Error('No existe una sesión autenticada')
  }

  const user = await getCurrentUser()

  if (!user?.userId) {
    throw new Error('No se pudo obtener el usuario autenticado')
  }

  const url = `${API_BASE_URL}/workshops/${workshopId}/register`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      userId: user.userId,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Error al registrar el taller (${response.status})`,
    )
  }

  return data
}
